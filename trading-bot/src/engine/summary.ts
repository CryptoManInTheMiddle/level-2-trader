// Daily summary (Section 7): a once-a-day digest so the operator can review
// hands-off. Reports day P&L vs a buy-and-hold SPY benchmark, plus positions.

import 'server-only';
import { loadConfig } from '@/lib/supabase';
import { reconcilePositions, countBuysSince, upsertDailyPnl } from '@/lib/db';
import { createAlpaca } from '@/lib/alpaca';
import { sendAlert } from '@/lib/alerts';
import { pctChange } from '@/core/pricing';
import { etDayKey, etDayStart } from '@/core/time';

export interface SummaryResult {
  ok: boolean;
  day: string;
  dayPnl: number;
  dayPnlPct: number;
  spyDayPct: number;
  beatBenchmark: boolean;
}

export async function runDailySummary(now: Date = new Date()): Promise<SummaryResult> {
  const config = await loadConfig();
  const alpaca = createAlpaca();

  const [account, positions, spyQuotes] = await Promise.all([
    alpaca.getAccount(),
    alpaca.getPositions(),
    alpaca.buildQuotes(['SPY']),
  ]);

  await reconcilePositions(positions);

  const day = etDayKey(now);
  const dayPnl = account.equity - account.lastEquity;
  const dayPnlPct = pctChange(account.lastEquity, account.equity);

  const spy = spyQuotes[0];
  const spyDayPct = spy ? pctChange(spy.prevClose, spy.last) : 0;
  const beatBenchmark = dayPnlPct >= spyDayPct;

  // Persist end-of-day figures. realized_pnl stores the day's equity change as a
  // pragmatic proxy (paper P&L isn't broken out realized-vs-unrealized here).
  await upsertDailyPnl({
    day,
    startEquity: account.lastEquity,
    endEquity: account.equity,
    realizedPnl: dayPnl,
  });

  const buysToday = await countBuysSince(etDayStart(now).toISOString(), config.mode);

  const positionsText = positions.length
    ? positions
        .map(
          (p) =>
            `  ${p.symbol}: ${p.qty} @ ${p.avgCost.toFixed(2)} (uPL ${p.unrealizedPl.toFixed(2)})`,
        )
        .join('\n')
    : '  (flat — no positions)';

  const body =
    `Mode: ${config.mode}\n` +
    `Equity: ${account.equity.toFixed(2)} (start ${account.lastEquity.toFixed(2)})\n` +
    `Day P&L: ${dayPnl.toFixed(2)} (${dayPnlPct.toFixed(2)}%)\n` +
    `SPY buy-and-hold: ${spyDayPct.toFixed(2)}%  →  ${beatBenchmark ? 'matched/beat' : 'lagged'} benchmark\n` +
    `Buys today: ${buysToday}\n` +
    `Positions:\n${positionsText}`;

  await sendAlert({
    title: `Daily summary ${day}`,
    body,
    level: 'info',
    data: { dayPnl, dayPnlPct, spyDayPct, beatBenchmark },
  });

  return { ok: true, day, dayPnl, dayPnlPct, spyDayPct, beatBenchmark };
}
