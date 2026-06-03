// ---------------------------------------------------------------------------
// Core domain types for the simulated market.
// Everything here is fake data generated locally — education only.
// ---------------------------------------------------------------------------

export type Side = 'buy' | 'sell';

export type Order = {
  price: number;
  size: number;
  /** Transient flag set by the engine when this level just changed, so the
   *  UI can flash it. 'up' = size grew, 'down' = size shrank. */
  flash?: 'up' | 'down';
};

export type Print = {
  price: number;
  size: number;
  /** 'buy' = aggressor lifted the ask, 'sell' = aggressor hit the bid. */
  side: Side;
  ts: number;
  /** True for unusually large single executions (block prints). */
  block?: boolean;
};

export type ScenarioName =
  | 'calm'
  | 'thinning'
  | 'wall'
  | 'spoof'
  | 'momentum'
  | 'absorption'
  | 'halt';

export type BookState = {
  symbol: string;
  midPrice: number;
  /** Sorted descending by price — best (highest) bid first. */
  bids: Order[];
  /** Sorted ascending by price — best (lowest) ask first. */
  asks: Order[];
  lastPrint: Print | null;
  /** Recent executions, newest first. Capped to a window. */
  tape: Print[];
  scenario: ScenarioName;
  /** Monotonic tick counter, useful for scenario phase logic. */
  tick: number;
};

export type ScenarioConfig = {
  name: ScenarioName;
  label: string;
  /** One-line description for the selector. */
  blurb: string;
  /** Longer "what's really happening" explainer surfaced in the UI. */
  explainer: string;
  /** Price tick increment for this symbol. */
  tickSize: number;
  /** Number of price levels rendered on each side. */
  levels: number;
  /** Base resting size near the top of the book. */
  baseSize: number;
  /** How aggressively the mid drifts each tick (in ticks of std-dev). */
  volatility: number;
  /** Directional bias of the random walk, -1..1 (negative = down). */
  drift: number;
  /** Probability per tick that a market order crosses and prints. */
  tradeRate: number;
  /** Multiplier on the spread (1 = one tick, higher = wider). */
  spreadTicks: number;
};
