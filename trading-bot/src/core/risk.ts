// THE RISK MODULE (Section 5) — non-negotiable guardrails.
//
// `runRiskChecks` is a pure function: given an order proposal and a snapshot of
// the world, it returns a decision. Every check runs (no short-circuit) so logs
// show the full picture. If ANY check fails, the order must be skipped. Build
// and test this before any order-placement code — it is what makes unattended
// operation survivable.

import type {
  AccountSnapshot,
  Config,
  PositionSnapshot,
  ProposedOrder,
  Quote,
} from '@/lib/types';
import { spreadPct, pctChange } from '@/core/pricing';

export interface SanityParams {
  /** Max age of the freshest quote datapoint during market hours (ms). */
  maxQuoteAgeMs: number;
  /** A daily move larger than this (abs %) is treated as a wild/bad quote. */
  maxDailyMovePct: number;
  /** Latest trade this far (abs %) from the current mid is wild. */
  maxLastVsMidPct: number;
}

export const DEFAULT_SANITY: SanityParams = {
  maxQuoteAgeMs: 15 * 60 * 1000,
  maxDailyMovePct: 25,
  maxLastVsMidPct: 10,
};

export interface RiskInput {
  order: ProposedOrder;
  config: Config;
  now: Date;
  marketIsOpen: boolean;
  quote: Quote;
  /** Current broker-truth holdings, used for the hard-cap aggregate. */
  positions: PositionSnapshot[];
  account: AccountSnapshot;
  /** Buys already placed for this symbol today (frequency cap). */
  buysTodayForSymbol: number;
  /** Buys already placed across all symbols this week (frequency cap). */
  buysThisWeek: number;
  sanity?: SanityParams;
}

export interface RiskCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface RiskResult {
  ok: boolean;
  /** First failing check's reason, for concise logging. */
  reason: string;
  checks: RiskCheck[];
  /** When true the engine must flip the master kill switch and stop. */
  tripKillSwitch: boolean;
}

/** Quote freshness/wildness check, reused by the engine to pre-filter quotes. */
export function evaluateQuoteSanity(
  quote: Quote,
  now: Date,
  marketIsOpen: boolean,
  params: SanityParams = DEFAULT_SANITY,
): RiskCheck {
  const ageMs = now.getTime() - quote.asOf;
  const dailyMove = Math.abs(pctChange(quote.prevClose, quote.last));
  const mid = (quote.bid + quote.ask) / 2;
  const lastVsMid = mid > 0 ? Math.abs((quote.last - mid) / mid) * 100 : Infinity;

  const stale = marketIsOpen && ageMs > params.maxQuoteAgeMs;
  const wildMove = dailyMove > params.maxDailyMovePct;
  const wildLast = lastVsMid > params.maxLastVsMidPct;
  const ok = !stale && !wildMove && !wildLast && quote.last > 0;

  return {
    name: 'sanity',
    ok,
    detail: ok
      ? `fresh (${Math.round(ageMs / 1000)}s old), dailyMove ${dailyMove.toFixed(2)}%, last vs mid ${lastVsMid.toFixed(2)}%`
      : `rejected: ${stale ? `stale ${Math.round(ageMs / 1000)}s ` : ''}${wildMove ? `wild daily move ${dailyMove.toFixed(2)}% ` : ''}${wildLast ? `last ${lastVsMid.toFixed(2)}% off mid ` : ''}`.trim(),
  };
}

/** Sum of cost basis across current holdings (bot-deployed capital). */
export function deployedCostBasis(positions: PositionSnapshot[]): number {
  return positions.reduce((sum, p) => sum + p.costBasis, 0);
}

export function runRiskChecks(input: RiskInput): RiskResult {
  const {
    order,
    config,
    now,
    marketIsOpen,
    quote,
    positions,
    account,
    buysTodayForSymbol,
    buysThisWeek,
  } = input;
  const sanity = input.sanity ?? DEFAULT_SANITY;
  const isBuy = order.side === 'buy';
  const checks: RiskCheck[] = [];
  const na = (name: string): RiskCheck => ({ name, ok: true, detail: 'n/a for sell' });

  // 1. Kill switch — master off switch.
  checks.push({
    name: 'kill_switch',
    ok: !config.killSwitch,
    detail: config.killSwitch ? 'kill switch is ON — no actions' : 'off',
  });

  // 2. Allowlist — never touch anything not explicitly approved.
  checks.push({
    name: 'allowlist',
    ok: config.allowlist.includes(order.symbol),
    detail: config.allowlist.includes(order.symbol)
      ? `${order.symbol} is allowlisted`
      : `${order.symbol} NOT on allowlist [${config.allowlist.join(', ')}]`,
  });

  // 3. Market-hours guard — regular hours only.
  checks.push({
    name: 'market_hours',
    ok: marketIsOpen,
    detail: marketIsOpen ? 'market open' : 'market closed/halted',
  });

  // 4. Sanity — stale or wild quotes are rejected.
  checks.push(evaluateQuoteSanity(quote, now, marketIsOpen, sanity));

  // 5. Liquidity/spread guard — price floor + tight spread.
  const sp = spreadPct(quote.bid, quote.ask);
  const liquidityOk = quote.last >= config.minPriceUsd && sp <= config.maxSpreadPct;
  checks.push({
    name: 'liquidity_spread',
    ok: liquidityOk,
    detail: `price ${quote.last} (floor ${config.minPriceUsd}), spread ${sp === Infinity ? 'crossed/invalid' : sp.toFixed(3) + '%'} (max ${config.maxSpreadPct}%)`,
  });

  // 6. Position-size cap (buys only) — every buy must equal the tranche.
  if (isBuy) {
    const cap = config.trancheUsd * 1.005; // small tolerance for tick rounding
    checks.push({
      name: 'position_size_cap',
      ok: order.notional <= cap,
      detail: `order notional ${order.notional.toFixed(2)} vs tranche ${config.trancheUsd.toFixed(2)}`,
    });
  } else {
    checks.push(na('position_size_cap'));
  }

  // 7. Frequency caps (buys only).
  if (isBuy) {
    const dayOk = buysTodayForSymbol < config.maxBuysDayPerSymbol;
    const weekOk = buysThisWeek < config.maxBuysWeek;
    checks.push({
      name: 'frequency_caps',
      ok: dayOk && weekOk,
      detail: `${order.symbol} buys today ${buysTodayForSymbol}/${config.maxBuysDayPerSymbol}, week ${buysThisWeek}/${config.maxBuysWeek}`,
    });
  } else {
    checks.push(na('frequency_caps'));
  }

  // 8. Hard account cap (buys only) — the bot can never grow its own budget.
  if (isBuy) {
    const deployed = deployedCostBasis(positions);
    const projected = deployed + order.notional;
    checks.push({
      name: 'hard_account_cap',
      ok: projected <= config.hardAccountCapUsd,
      detail: `deployed ${deployed.toFixed(2)} + order ${order.notional.toFixed(2)} = ${projected.toFixed(2)} vs cap ${config.hardAccountCapUsd.toFixed(2)}`,
    });
  } else {
    checks.push(na('hard_account_cap'));
  }

  // 9. Cash reserve (buys only) — keep a reserve uninvested.
  if (isBuy) {
    const afterCash = account.cash - order.notional;
    checks.push({
      name: 'cash_reserve',
      ok: afterCash >= config.reserveUsd,
      detail: `cash after ${afterCash.toFixed(2)} vs reserve ${config.reserveUsd.toFixed(2)}`,
    });
  } else {
    checks.push(na('cash_reserve'));
  }

  // 10. Daily loss limit (circuit breaker) — applies to every order. When
  // breached, the engine must flip the kill switch and stop for the day.
  const todayPnl = account.equity - account.lastEquity;
  const lossBreached = todayPnl <= -config.dailyLossLimitUsd;
  checks.push({
    name: 'daily_loss_limit',
    ok: !lossBreached,
    detail: `today P&L ${todayPnl.toFixed(2)} vs limit -${config.dailyLossLimitUsd.toFixed(2)}`,
  });

  const failing = checks.filter((c) => !c.ok);
  const tripKillSwitch = lossBreached;
  return {
    ok: failing.length === 0,
    reason: failing.length ? `${failing[0]!.name}: ${failing[0]!.detail}` : 'all checks passed',
    checks,
    tripKillSwitch,
  };
}
