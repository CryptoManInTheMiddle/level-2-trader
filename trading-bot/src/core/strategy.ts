// Tracer v1 strategy (Section 3) — pure signal evaluation.
//
//  Entry:        buy a fixed tranche when a symbol is down >= dipDayPct on the
//                day, OR >= dipHighPct below its trailing 20-day high.
//  Take-profit:  when a position is up >= takeProfitPct, sell 1/3.
//  Stop-loss:    when a position is down >= stopLossPct, sell the whole thing;
//                never average down past the stop.
//
// These functions decide *intent* (which rule fired). Sizing and pricing live
// in the engine + pricing helpers; risk gating lives in risk.ts.

import type { Config, PositionSnapshot, Quote, Signal } from '@/lib/types';
import { pctChange } from '@/core/pricing';

/** How far below the trailing 20-day high `last` is, as a positive percent. */
export function belowHighPct(high20: number, last: number): number {
  if (!(high20 > 0)) return 0;
  return ((high20 - last) / high20) * 100;
}

/** Entry signal for one symbol, or null if no dip rule fired. */
export function evaluateEntry(quote: Quote, config: Config): Signal | null {
  const dayChange = pctChange(quote.prevClose, quote.last); // negative = down
  const belowHigh = belowHighPct(quote.high20, quote.last); // positive = below high

  const dipDay = dayChange <= -config.dipDayPct;
  const dipHigh = belowHigh >= config.dipHighPct;

  if (!dipDay && !dipHigh) return null;

  // Prefer the deeper-pullback reason when both fire; the engine's idempotency
  // key for buys is reason-agnostic, so this only affects logging.
  const reason = dipHigh ? 'dip_high' : 'dip_day';
  const detail =
    `down ${dayChange.toFixed(2)}% on day (limit -${config.dipDayPct}%), ` +
    `${belowHigh.toFixed(2)}% below 20d high (limit ${config.dipHighPct}%)`;

  return { symbol: quote.symbol, side: 'buy', reason, detail };
}

/** Exit signal for a held position, or null. Stop-loss takes priority. */
export function evaluateExit(
  position: PositionSnapshot,
  quote: Quote,
  config: Config,
): Signal | null {
  const gain = pctChange(position.avgCost, quote.last); // +ve = profit

  if (gain <= -config.stopLossPct) {
    return {
      symbol: position.symbol,
      side: 'sell',
      reason: 'stop_loss',
      detail: `down ${gain.toFixed(2)}% from avg cost ${position.avgCost} (stop -${config.stopLossPct}%) — sell all`,
    };
  }

  if (gain >= config.takeProfitPct) {
    return {
      symbol: position.symbol,
      side: 'sell',
      reason: 'take_profit',
      detail: `up ${gain.toFixed(2)}% from avg cost ${position.avgCost} (target +${config.takeProfitPct}%) — sell 1/3`,
    };
  }

  return null;
}

export interface EvaluateInput {
  quotes: Quote[];
  positions: PositionSnapshot[];
  config: Config;
}

/**
 * Produce all signals for a run. Exits (risk-reducing) are evaluated for held
 * positions; entries are evaluated for allowlisted symbols. If a position is
 * being stopped out this run, we suppress any same-symbol entry so we never
 * average down into a name we're exiting.
 */
export function evaluateSignals(input: EvaluateInput): Signal[] {
  const { quotes, positions, config } = input;
  const quoteBySymbol = new Map(quotes.map((q): [string, Quote] => [q.symbol, q]));
  const signals: Signal[] = [];
  const stoppedOut = new Set<string>();

  for (const position of positions) {
    const quote = quoteBySymbol.get(position.symbol);
    if (!quote) continue;
    const exit = evaluateExit(position, quote, config);
    if (exit) {
      signals.push(exit);
      if (exit.reason === 'stop_loss') stoppedOut.add(position.symbol);
    }
  }

  for (const symbol of config.allowlist) {
    if (stoppedOut.has(symbol)) continue;
    const quote = quoteBySymbol.get(symbol);
    if (!quote) continue;
    const entry = evaluateEntry(quote, config);
    if (entry) signals.push(entry);
  }

  return signals;
}
