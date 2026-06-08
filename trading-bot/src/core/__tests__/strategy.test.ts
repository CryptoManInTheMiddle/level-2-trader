import { describe, it, expect } from 'vitest';
import { evaluateEntry, evaluateExit, evaluateSignals, belowHighPct } from '@/core/strategy';
import { makeConfig, makeQuote, makePosition } from './fixtures';

const config = makeConfig();

describe('evaluateEntry', () => {
  it('fires dip_day when down >= 1.5% on the day', () => {
    const q = makeQuote({ prevClose: 600, last: 590, high20: 600, bid: 589.9, ask: 590.1 });
    const sig = evaluateEntry(q, config);
    expect(sig?.side).toBe('buy');
    expect(sig?.reason).toBe('dip_day');
  });

  it('fires dip_high when >= 3% below the 20-day high', () => {
    const q = makeQuote({ prevClose: 600, last: 595, high20: 620, bid: 594.9, ask: 595.1 });
    const sig = evaluateEntry(q, config);
    expect(sig?.reason).toBe('dip_high');
  });

  it('prefers dip_high when both fire', () => {
    const q = makeQuote({ prevClose: 600, last: 580, high20: 620, bid: 579.9, ask: 580.1 });
    expect(evaluateEntry(q, config)?.reason).toBe('dip_high');
  });

  it('returns null when neither rule fires', () => {
    const q = makeQuote({ prevClose: 600, last: 599, high20: 605, bid: 598.9, ask: 599.1 });
    expect(evaluateEntry(q, config)).toBeNull();
  });

  it('belowHighPct computes distance below the high', () => {
    expect(belowHighPct(100, 95)).toBeCloseTo(5);
  });
});

describe('evaluateExit', () => {
  it('fires stop_loss at -10% from avg cost', () => {
    const pos = makePosition({ avgCost: 600 });
    const q = makeQuote({ last: 540 });
    const sig = evaluateExit(pos, q, config);
    expect(sig?.reason).toBe('stop_loss');
  });

  it('fires take_profit at +10% from avg cost', () => {
    const pos = makePosition({ avgCost: 600 });
    const q = makeQuote({ last: 660 });
    expect(evaluateExit(pos, q, config)?.reason).toBe('take_profit');
  });

  it('returns null between the bands', () => {
    const pos = makePosition({ avgCost: 600 });
    const q = makeQuote({ last: 620 });
    expect(evaluateExit(pos, q, config)).toBeNull();
  });
});

describe('evaluateSignals', () => {
  it('emits exits for holdings and entries for the allowlist, and suppresses an entry on a stopped-out name', () => {
    const positions = [makePosition({ symbol: 'SPY', avgCost: 600, qty: 0.02 })];
    const quotes = [
      // SPY: down 10% -> stop_loss AND would otherwise be a dip_day entry
      makeQuote({ symbol: 'SPY', prevClose: 600, last: 540, high20: 620, bid: 539.9, ask: 540.1 }),
      // QQQ: down 2% on day -> entry
      makeQuote({ symbol: 'QQQ', prevClose: 500, last: 490, high20: 500, bid: 489.9, ask: 490.1 }),
      // VOO: flat -> nothing
      makeQuote({ symbol: 'VOO', prevClose: 550, last: 549, high20: 552, bid: 548.9, ask: 549.1 }),
    ];

    const signals = evaluateSignals({ quotes, positions, config });
    const spy = signals.filter((s) => s.symbol === 'SPY');
    const qqq = signals.filter((s) => s.symbol === 'QQQ');
    const voo = signals.filter((s) => s.symbol === 'VOO');

    expect(spy).toHaveLength(1);
    expect(spy[0]!.reason).toBe('stop_loss'); // entry suppressed
    expect(qqq).toHaveLength(1);
    expect(qqq[0]!.side).toBe('buy');
    expect(voo).toHaveLength(0);
  });
});
