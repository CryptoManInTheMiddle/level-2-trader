// Builders for test data. Defaults describe a healthy, allowlisted, liquid
// buy that should pass every risk check; individual tests override one field.

import type {
  AccountSnapshot,
  Config,
  PositionSnapshot,
  ProposedOrder,
  Quote,
} from '@/lib/types';
import type { RiskInput } from '@/core/risk';

export const NOW = new Date('2026-06-08T15:00:00.000Z'); // a Monday, mid-session

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    mode: 'paper',
    trancheUsd: 12.5,
    reserveUsd: 10,
    maxBuysDayPerSymbol: 1,
    maxBuysWeek: 2,
    dipDayPct: 1.5,
    dipHighPct: 3,
    takeProfitPct: 10,
    stopLossPct: 10,
    dailyLossLimitUsd: 5,
    hardAccountCapUsd: 50,
    maxSpreadPct: 0.5,
    minPriceUsd: 5,
    killSwitch: false,
    allowlist: ['SPY', 'QQQ', 'VOO'],
    ...overrides,
  };
}

export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'SPY',
    bid: 600.0,
    ask: 600.05,
    last: 600.02,
    prevClose: 600.0,
    high20: 610.0,
    asOf: NOW.getTime() - 5_000,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return { equity: 100_000, lastEquity: 100_000, cash: 100_000, ...overrides };
}

export function makePosition(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  const qty = overrides.qty ?? 0.02;
  const avgCost = overrides.avgCost ?? 600;
  const currentPrice = overrides.currentPrice ?? 600;
  return {
    symbol: 'SPY',
    qty,
    avgCost,
    costBasis: overrides.costBasis ?? qty * avgCost,
    currentPrice,
    marketValue: overrides.marketValue ?? qty * currentPrice,
    unrealizedPl: overrides.unrealizedPl ?? qty * (currentPrice - avgCost),
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<ProposedOrder> = {}): ProposedOrder {
  const qty = overrides.qty ?? 0.0208;
  const limitPrice = overrides.limitPrice ?? 600.05;
  return {
    symbol: 'SPY',
    side: 'buy',
    reason: 'dip_day',
    qty,
    limitPrice,
    notional: overrides.notional ?? qty * limitPrice,
    clientOrderId: 'tracer-paper-SPY-buy-entry-2026-06-08',
    ...overrides,
  };
}

export function makeRiskInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    order: makeOrder(),
    config: makeConfig(),
    now: NOW,
    marketIsOpen: true,
    quote: makeQuote(),
    positions: [],
    account: makeAccount(),
    buysTodayForSymbol: 0,
    buysThisWeek: 0,
    ...overrides,
  };
}
