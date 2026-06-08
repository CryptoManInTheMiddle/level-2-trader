// Domain types shared by the pure core (strategy/risk/pricing) and the I/O
// layer (Alpaca/Supabase). Keeping these framework-free makes the core unit
// testable without mocking the world.

export type Mode = 'paper' | 'live';
export type OrderSide = 'buy' | 'sell';

/** Why an order/signal was generated. Drives the idempotency key. */
export type SignalReason = 'dip_day' | 'dip_high' | 'take_profit' | 'stop_loss';

/** Runtime configuration — mirrors the `config` table (Section 4). */
export interface Config {
  mode: Mode;
  trancheUsd: number;
  reserveUsd: number;
  maxBuysDayPerSymbol: number;
  maxBuysWeek: number;
  dipDayPct: number;
  dipHighPct: number;
  takeProfitPct: number;
  stopLossPct: number;
  dailyLossLimitUsd: number;
  hardAccountCapUsd: number;
  maxSpreadPct: number;
  minPriceUsd: number;
  killSwitch: boolean;
  allowlist: string[];
}

/** A normalized quote built from Alpaca's snapshot + daily bars. */
export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  /** Latest trade price (used for P&L and signal math). */
  last: number;
  /** Previous session close. */
  prevClose: number;
  /** Trailing 20-session high. */
  high20: number;
  /** Timestamp of the freshest data point in this quote (ms epoch). */
  asOf: number;
}

/** A position as the broker reports it (broker is the source of truth). */
export interface PositionSnapshot {
  symbol: string;
  qty: number;
  avgCost: number;
  /** qty * avgCost — cost basis used by the hard-cap check. */
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
}

/** Account-level figures from the broker. */
export interface AccountSnapshot {
  /** Current total equity. */
  equity: number;
  /** Equity at the previous trading day's close. */
  lastEquity: number;
  cash: number;
}

/** A trading intent produced by the strategy, before risk checks. */
export interface Signal {
  symbol: string;
  side: OrderSide;
  reason: SignalReason;
  /** Human-readable explanation for logs/alerts. */
  detail: string;
}

/** A concrete order proposal (sized + priced), still subject to risk checks. */
export interface ProposedOrder {
  symbol: string;
  side: OrderSide;
  reason: SignalReason;
  qty: number;
  limitPrice: number;
  /** qty * limitPrice. */
  notional: number;
  clientOrderId: string;
}
