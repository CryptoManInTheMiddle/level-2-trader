// The engine: one stateless strategy cycle. Reads broker truth + config, runs
// the pure strategy + risk core, and (only on a full risk pass) submits limit
// orders. Everything funnels through the risk gate; per-order failures are
// isolated so one bad order can't abort the cycle.

import 'server-only';
import { loadConfig, tripKillSwitch } from '@/lib/supabase';
import {
  reconcilePositions,
  recordOrder,
  recordSignal,
  countBuysForSymbolSince,
  countBuysSince,
  upsertDailyPnl,
} from '@/lib/db';
import { createAlpaca } from '@/lib/alpaca';
import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { evaluateSignals } from '@/core/strategy';
import { runRiskChecks, evaluateQuoteSanity } from '@/core/risk';
import { limitPriceForBuy, limitPriceForSell, qtyForTranche } from '@/core/pricing';
import { etDayKey, etDayStart, rollingDaysAgo, makeClientOrderId } from '@/core/time';
import type {
  Config,
  PositionSnapshot,
  ProposedOrder,
  Quote,
  Signal,
} from '@/lib/types';

export interface RunResult {
  ok: boolean;
  skipped?: string;
  evaluated: number;
  submitted: number;
  duplicates: number;
  rejected: number;
  errors: number;
  detail?: unknown;
}

function floor6(n: number): number {
  return Math.floor(n * 1e6) / 1e6;
}

/** Synthetic position used to make the hard-cap check aware of buys already
 * approved earlier in this same cycle. */
function pendingPosition(costBasis: number): PositionSnapshot {
  return {
    symbol: '__pending__',
    qty: 0,
    avgCost: 0,
    costBasis,
    currentPrice: 0,
    marketValue: 0,
    unrealizedPl: 0,
  };
}

function buildProposedOrder(
  signal: Signal,
  quote: Quote,
  config: Config,
  position: PositionSnapshot | undefined,
  now: Date,
): ProposedOrder | null {
  if (signal.side === 'buy') {
    const limitPrice = limitPriceForBuy(quote.ask);
    const qty = qtyForTranche(config.trancheUsd, limitPrice);
    if (!(qty > 0) || !(limitPrice > 0)) return null;
    return {
      symbol: signal.symbol,
      side: 'buy',
      reason: signal.reason,
      qty,
      limitPrice,
      notional: floor6(qty * limitPrice),
      clientOrderId: makeClientOrderId(config.mode, signal.symbol, 'buy', 'entry', now),
    };
  }

  // sell
  if (!position || !(position.qty > 0)) return null;
  const limitPrice = limitPriceForSell(quote.bid);
  const qty = signal.reason === 'take_profit' ? floor6(position.qty / 3) : floor6(position.qty);
  if (!(qty > 0) || !(limitPrice > 0)) return null;
  return {
    symbol: signal.symbol,
    side: 'sell',
    reason: signal.reason,
    qty,
    limitPrice,
    notional: floor6(qty * limitPrice),
    clientOrderId: makeClientOrderId(config.mode, signal.symbol, 'sell', signal.reason, now),
  };
}

export async function runStrategy(now: Date = new Date()): Promise<RunResult> {
  const empty: RunResult = {
    ok: true,
    evaluated: 0,
    submitted: 0,
    duplicates: 0,
    rejected: 0,
    errors: 0,
  };

  const config = await loadConfig();

  // 1. Kill switch — do nothing, ever.
  if (config.killSwitch) {
    await logger.info('kill switch ON — skipping cycle');
    return { ...empty, skipped: 'kill_switch' };
  }

  const alpaca = createAlpaca();

  // Safety: config.mode and the Alpaca endpoint must agree. A mismatch (e.g.
  // mode=live with paper keys, or mode=paper against the live endpoint) is a
  // configuration error — refuse to trade.
  const wantLive = config.mode === 'live';
  if (wantLive !== alpaca.isLive) {
    await sendAlert({
      title: 'Mode/endpoint mismatch — refusing to trade',
      body: `config.mode=${config.mode} but ALPACA_BASE_URL is ${alpaca.isLive ? 'LIVE' : 'paper'}. Fix env or config.`,
      level: 'error',
    });
    return { ...empty, ok: false, skipped: 'mode_mismatch' };
  }

  // 2. Market-hours guard (broker is authoritative; handles holidays/halts).
  const clock = await alpaca.getClock();
  if (!clock.isOpen) {
    await logger.info('market closed — skipping cycle', { nextOpen: clock.nextOpen });
    return { ...empty, skipped: 'market_closed' };
  }

  // 3. Account + daily-loss circuit breaker (Section 5.3).
  const account = await alpaca.getAccount();
  const dayKey = etDayKey(now);
  await upsertDailyPnl({ day: dayKey, startEquity: account.lastEquity, endEquity: account.equity });

  const todayPnl = account.equity - account.lastEquity;
  if (todayPnl <= -config.dailyLossLimitUsd) {
    await tripKillSwitch();
    await sendAlert({
      title: 'CIRCUIT BREAKER — daily loss limit hit',
      body: `Today P&L ${todayPnl.toFixed(2)} <= -${config.dailyLossLimitUsd}. Kill switch flipped ON; stopped for the day.`,
      level: 'error',
      data: { equity: account.equity, lastEquity: account.lastEquity },
    });
    return { ...empty, ok: false, skipped: 'daily_loss_breaker' };
  }

  // 4. Reconcile positions to broker truth.
  const positions = await alpaca.getPositions();
  await reconcilePositions(positions);
  const positionBySymbol = new Map(positions.map((p): [string, PositionSnapshot] => [p.symbol, p]));

  // 5. Quotes for the allowlist, then drop any that fail the sanity guard.
  const allQuotes = await alpaca.buildQuotes(config.allowlist);
  const goodQuotes: Quote[] = [];
  for (const q of allQuotes) {
    const sane = evaluateQuoteSanity(q, now, clock.isOpen);
    if (sane.ok) goodQuotes.push(q);
    else {
      await sendAlert({
        title: `Skipping ${q.symbol} — bad quote`,
        body: sane.detail,
        level: 'warn',
        data: q,
      });
    }
  }
  const quoteBySymbol = new Map(goodQuotes.map((q): [string, Quote] => [q.symbol, q]));

  // 6. Evaluate signals.
  const signals = evaluateSignals({ quotes: goodQuotes, positions, config });

  const result: RunResult = { ...empty, evaluated: signals.length };
  const weekStartISO = rollingDaysAgo(now, 7).toISOString();
  const dayStartISO = etDayStart(now).toISOString();
  let pendingBuyNotional = 0;

  // 7. For each signal: size → risk gate → submit (or skip).
  for (const signal of signals) {
    const quote = quoteBySymbol.get(signal.symbol);
    if (!quote) continue;

    const order = buildProposedOrder(
      signal,
      quote,
      config,
      positionBySymbol.get(signal.symbol),
      now,
    );
    if (!order) {
      await logger.warn(`could not size order for ${signal.symbol}`, signal);
      continue;
    }

    const isBuy = order.side === 'buy';
    const buysTodayForSymbol = isBuy
      ? await countBuysForSymbolSince(signal.symbol, dayStartISO, config.mode)
      : 0;
    const buysThisWeek = isBuy ? await countBuysSince(weekStartISO, config.mode) : 0;
    const positionsForCheck =
      isBuy && pendingBuyNotional > 0 ? [...positions, pendingPosition(pendingBuyNotional)] : positions;

    const risk = runRiskChecks({
      order,
      config,
      now,
      marketIsOpen: clock.isOpen,
      quote,
      positions: positionsForCheck,
      account,
      buysTodayForSymbol,
      buysThisWeek,
    });

    if (!risk.ok) {
      result.rejected += 1;
      await recordSignal(signal.symbol, signal.side, {
        reason: signal.reason,
        detail: signal.detail,
        risk: risk.reason,
        checks: risk.checks.filter((c) => !c.ok),
      }, false);
      await logger.info(`risk blocked ${signal.side} ${signal.symbol}: ${risk.reason}`);

      if (risk.tripKillSwitch) {
        await tripKillSwitch();
        await sendAlert({
          title: 'CIRCUIT BREAKER — risk gate tripped kill switch',
          body: risk.reason,
          level: 'error',
        });
        break; // stop the cycle entirely
      }
      continue;
    }

    // 8. Submit. Isolate failures so one bad order doesn't abort the cycle.
    try {
      const submit = await alpaca.submitOrder(order, order.side);
      await recordOrder({
        symbol: order.symbol,
        side: order.side,
        type: 'limit',
        qty: order.qty,
        limitPrice: order.limitPrice,
        status: submit.status,
        reason: order.reason,
        mode: config.mode,
        clientOrderId: order.clientOrderId,
        raw: submit.raw,
      });
      await recordSignal(signal.symbol, signal.side, {
        reason: signal.reason,
        detail: signal.detail,
        status: submit.status,
      }, true);

      if (submit.duplicate) {
        result.duplicates += 1;
        await logger.info(`duplicate (idempotency) ${order.side} ${order.symbol} — skipped`);
      } else {
        result.submitted += 1;
        if (isBuy) pendingBuyNotional += order.notional;
        await sendAlert({
          title: `Order ${order.side.toUpperCase()} ${order.symbol} (${order.reason})`,
          body: `${order.side} ${order.qty} @ ${order.limitPrice.toFixed(2)} [${config.mode}] — status ${submit.status}. ${signal.detail}`,
          level: 'info',
          data: { clientOrderId: order.clientOrderId },
        });
      }
    } catch (err) {
      result.errors += 1;
      await recordSignal(signal.symbol, signal.side, {
        reason: signal.reason,
        error: String(err),
      }, false);
      await sendAlert({
        title: `Order error ${order.side} ${order.symbol}`,
        body: String(err),
        level: 'error',
      });
      // continue — next signal still gets a chance.
    }
  }

  await logger.info('cycle complete', result);
  return result;
}
