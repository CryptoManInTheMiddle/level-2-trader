import type { BookState, Order, Print, ScenarioName, Side } from './types';
import { SCENARIOS } from './scenarios';

// ---------------------------------------------------------------------------
// MarketEngine — a self-contained generator of a believable order book + tape.
//
// It runs on a fixed tick (driven externally). Each tick it:
//   1. random-walks the mid price,
//   2. churns resting size at every level so cells flash like real L2,
//   3. fires simulated market orders that cross the spread and print to tape,
//   4. layers on per-scenario behavior (walls, spoofs, momentum, etc.).
//
// All data is synthetic. No network, no real prices.
// ---------------------------------------------------------------------------

const TAPE_LIMIT = 60;
const SYMBOLS = ['TRNR', 'FRVO', 'LVL2', 'MCRX'];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Box-Muller-ish cheap gaussian, mean 0 std 1. */
function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 1;
}

function roundTo(value: number, tick: number) {
  return Math.round(value / tick) * tick;
}

export class MarketEngine {
  private symbol: string;
  private scenario: ScenarioName;
  private mid: number;
  private tickCount = 0;

  // Persistent per-level size arrays, index 0 = best price.
  private bidSizes: number[] = [];
  private askSizes: number[] = [];
  // Previous frame's prices/sizes so we can compute flash flags.
  private prevBidSizes: number[] = [];
  private prevAskSizes: number[] = [];

  private tape: Print[] = [];
  private lastPrint: Print | null = null;

  // Scenario-specific transient state.
  private spoofActive = false;
  private spoofLevel = 0;
  private spoofTtl = 0;
  private haltTtl = 0;

  constructor(scenario: ScenarioName = 'calm', symbol?: string) {
    this.scenario = scenario;
    this.symbol = symbol ?? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    this.mid = rand(18, 42);
    this.mid = roundTo(this.mid, SCENARIOS[scenario].tickSize);
    this.initLadders();
  }

  // -- public API ---------------------------------------------------------

  getSymbol() {
    return this.symbol;
  }

  setScenario(scenario: ScenarioName) {
    if (scenario === this.scenario) return;
    this.scenario = scenario;
    this.spoofActive = false;
    this.spoofTtl = 0;
    this.haltTtl = 0;
    this.initLadders();
  }

  getScenario() {
    return this.scenario;
  }

  /** How long until the next book update, in ms. Real order books do not
   *  update on a fixed clock — events arrive in irregular bursts with the
   *  occasional lull. This returns the natural pace for the current scenario
   *  with that burstiness baked in (before any user speed multiplier). */
  nextDelayMs(): number {
    const base = SCENARIOS[this.scenario].tempoMs;

    if (this.scenario === 'halt') {
      // Long freezes punctuated by violent fast bursts at the re-open.
      return this.haltTtl > 0 ? base * rand(0.4, 1.4) : rand(1100, 2400);
    }

    // ~15% of the time the book goes quiet for a beat; the rest of the time
    // updates cluster rapidly. That mix is what makes it feel alive rather
    // than metronomic.
    const lull = Math.random() < 0.15;
    const factor = lull ? rand(1.8, 3.6) : rand(0.3, 1.1);
    return Math.max(25, base * factor);
  }

  /** Advance the simulation one tick and return an immutable snapshot. */
  tick(): BookState {
    this.tickCount += 1;
    const cfg = SCENARIOS[this.scenario];

    this.prevBidSizes = [...this.bidSizes];
    this.prevAskSizes = [...this.askSizes];

    if (this.scenario === 'halt') {
      this.stepHalt(cfg.tickSize);
    } else {
      this.walkMid(cfg.volatility, cfg.drift, cfg.tickSize);
    }

    this.churn();
    this.applyScenario();
    this.runTrades();

    return this.snapshot();
  }

  /** Snapshot without advancing — used by the practice engine to read depth. */
  snapshot(): BookState {
    const cfg = SCENARIOS[this.scenario];
    const tick = cfg.tickSize;
    const spread = tick * cfg.spreadTicks;
    const bestBid = roundTo(this.mid - spread / 2, tick);
    const bestAsk = roundTo(bestBid + spread, tick);

    const bids: Order[] = this.bidSizes.map((size, i) => ({
      price: roundTo(bestBid - i * tick, tick),
      size: Math.max(0, Math.round(size)),
      flash: this.flashFor(size, this.prevBidSizes[i]),
    }));
    const asks: Order[] = this.askSizes.map((size, i) => ({
      price: roundTo(bestAsk + i * tick, tick),
      size: Math.max(0, Math.round(size)),
      flash: this.flashFor(size, this.prevAskSizes[i]),
    }));

    return {
      symbol: this.symbol,
      midPrice: roundTo((bestBid + bestAsk) / 2, tick / 2),
      bids,
      asks,
      lastPrint: this.lastPrint,
      tape: this.tape,
      scenario: this.scenario,
      tick: this.tickCount,
    };
  }

  // -- internals ----------------------------------------------------------

  private initLadders() {
    const cfg = SCENARIOS[this.scenario];
    this.bidSizes = [];
    this.askSizes = [];
    for (let i = 0; i < cfg.levels; i += 1) {
      this.bidSizes.push(this.targetSize(i, 'buy'));
      this.askSizes.push(this.targetSize(i, 'sell'));
    }
    this.prevBidSizes = [...this.bidSizes];
    this.prevAskSizes = [...this.askSizes];
    this.tape = [];
    this.lastPrint = null;
  }

  /** A "natural" resting size for a level, shaped by the scenario. */
  private targetSize(level: number, side: Side): number {
    const cfg = SCENARIOS[this.scenario];
    let base = cfg.baseSize;

    // Calm: roughly even, slight thinning deeper, with occasional big levels.
    let depthFalloff = 1 - level * 0.04;

    if (this.scenario === 'thinning') {
      // Steep drop-off below the top — that is the whole point. Supply (asks)
      // drains a touch harder than demand, so the book leans bid-heavy.
      const extra = side === 'sell' ? 0.06 : 0;
      depthFalloff = level === 0 ? 1 : Math.max(0.15, 1 - level * (0.18 + extra));
    }

    const noise = rand(0.55, 1.45);
    let size = base * depthFalloff * noise;

    // Occasional naturally large level (not a wall) for texture.
    if (Math.random() < 0.06) size *= rand(1.8, 2.6);

    return Math.max(50, Math.round(size / 10) * 10);
  }

  private walkMid(volatility: number, drift: number, tick: number) {
    const step = (gauss() * volatility + drift * 0.6) * tick;
    this.mid = roundTo(Math.max(tick * 5, this.mid + step), tick);
  }

  private stepHalt(tick: number) {
    // A halt: freeze for a beat, then gap hard and re-open jumpy.
    if (this.haltTtl <= 0) {
      const gap = roundTo(rand(0.4, 1.1) * (Math.random() < 0.7 ? -1 : 1), tick);
      this.mid = roundTo(Math.max(tick * 5, this.mid + gap), tick);
      this.haltTtl = Math.floor(rand(6, 14));
    } else {
      this.haltTtl -= 1;
      // Small jitter while "halted".
      this.mid = roundTo(this.mid + gauss() * 0.4 * tick, tick);
    }
  }

  /** Evolve every resting level toward its target with noise → flashing cells. */
  private churn() {
    for (let i = 0; i < this.bidSizes.length; i += 1) {
      this.bidSizes[i] = this.evolve(this.bidSizes[i], this.targetSize(i, 'buy'));
    }
    for (let i = 0; i < this.askSizes.length; i += 1) {
      this.askSizes[i] = this.evolve(this.askSizes[i], this.targetSize(i, 'sell'));
    }
  }

  private evolve(current: number, target: number): number {
    // Pull toward a fresh target, plus jitter so sizes wiggle every tick.
    const pull = (target - current) * rand(0.05, 0.25);
    const jitter = current * rand(-0.12, 0.12);
    return Math.max(0, current + pull + jitter);
  }

  private flashFor(size: number, prev: number | undefined): 'up' | 'down' | undefined {
    if (prev === undefined) return undefined;
    const a = Math.round(size);
    const b = Math.round(prev);
    if (a === b) return undefined;
    // Only flash on meaningful moves to avoid constant strobing.
    if (Math.abs(a - b) < Math.max(20, b * 0.05)) return undefined;
    return a > b ? 'up' : 'down';
  }

  /** Per-scenario structural behavior layered on top of the base book. */
  private applyScenario() {
    switch (this.scenario) {
      case 'wall':
        // A persistent oversized bid a few levels down = support.
        this.bidSizes[3] = Math.max(this.bidSizes[3], SCENARIOS.wall.baseSize * 6);
        break;
      case 'absorption':
        // The best bid refuses to die — it keeps refilling big.
        this.bidSizes[0] = Math.max(this.bidSizes[0], SCENARIOS.absorption.baseSize * 5);
        break;
      case 'spoof':
        this.stepSpoof();
        break;
      default:
        break;
    }
  }

  private stepSpoof() {
    const cfg = SCENARIOS.spoof;
    if (this.spoofActive) {
      this.spoofTtl -= 1;
      // Keep the fake wall pumped while it lives...
      this.askSizes[this.spoofLevel] = cfg.baseSize * 7;
      if (this.spoofTtl <= 0) {
        // ...then yank it before it ever fills. That is the tell.
        this.askSizes[this.spoofLevel] = this.targetSize(this.spoofLevel, 'sell');
        this.spoofActive = false;
        this.spoofTtl = Math.floor(rand(3, 7)); // cooldown
      }
    } else {
      this.spoofTtl -= 1;
      if (this.spoofTtl <= 0) {
        this.spoofActive = true;
        this.spoofLevel = Math.floor(rand(1, 4));
        this.spoofTtl = Math.floor(rand(4, 8));
      }
    }
  }

  /** Fire simulated market orders that cross the spread and hit the tape. */
  private runTrades() {
    const cfg = SCENARIOS[this.scenario];
    const tick = cfg.tickSize;
    const spread = tick * cfg.spreadTicks;
    const bestBid = roundTo(this.mid - spread / 2, tick);
    const bestAsk = roundTo(bestBid + spread, tick);

    if (Math.random() > cfg.tradeRate) return;

    // Decide aggressor side. Drift / momentum biases buyers; absorption &
    // halt bias sellers hitting the bid.
    let buyBias = 0.5 + cfg.drift * 0.4;
    if (this.scenario === 'absorption') buyBias = 0.25;
    if (this.scenario === 'momentum') buyBias = 0.85;
    const side: Side = Math.random() < buyBias ? 'buy' : 'sell';

    const bursts = this.scenario === 'momentum' ? Math.floor(rand(1, 4)) : 1;
    for (let b = 0; b < bursts; b += 1) {
      const block = Math.random() < 0.08;
      const size =
        Math.round((block ? rand(2.2, 4.5) : rand(0.15, 1.1)) * cfg.baseSize * 0.5);

      if (side === 'buy') {
        this.askSizes[0] = Math.max(0, this.askSizes[0] - size * 0.6);
        this.pushPrint({ price: bestAsk, size, side: 'buy', ts: Date.now(), block });
      } else {
        const eat = this.scenario === 'absorption' ? size * 0.2 : size * 0.6;
        this.bidSizes[0] = Math.max(0, this.bidSizes[0] - eat);
        this.pushPrint({ price: bestBid, size, side: 'sell', ts: Date.now(), block });
      }
    }
  }

  private pushPrint(p: Print) {
    this.lastPrint = p;
    this.tape.unshift(p);
    if (this.tape.length > TAPE_LIMIT) this.tape.length = TAPE_LIMIT;
  }
}
