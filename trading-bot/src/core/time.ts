// Time helpers centered on US market time (America/New_York). The authoritative
// "is the market open?" answer comes from Alpaca's /v2/clock at runtime; these
// helpers are for day-keys (idempotency) and date-window queries (frequency
// caps), and are DST-safe via Intl.

import type { Mode, OrderSide } from '@/lib/types';

const ET = 'America/New_York';

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInTz(date: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    // Intl emits hour "24" at midnight in some runtimes; normalize to 0.
    hour: out.hour! % 24,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Offset (ms) that the wall clock in `timeZone` leads UTC by (negative west). */
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - date.getTime();
}

/** Calendar day in ET as 'YYYY-MM-DD' (used in idempotency keys + daily_pnl). */
export function etDayKey(date: Date): string {
  const p = partsInTz(date, ET);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** UTC instant of ET midnight for the ET calendar day containing `date`. */
export function etDayStart(date: Date): Date {
  const offset = tzOffsetMs(date, ET);
  const p = partsInTz(date, ET);
  const wallMidnightAsUTC = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  return new Date(wallMidnightAsUTC - offset);
}

/** Start of a rolling N-day window ending now (used for the weekly buy cap). */
export function rollingDaysAgo(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Deterministic idempotency key. The same (mode, symbol, side, token) on the
 * same ET day yields the same id, so a retry — or a signal that keeps firing
 * every 5 minutes — cannot place a duplicate order. Alpaca and the DB unique
 * constraint both reject repeats of this id.
 *
 * The engine passes `token = 'entry'` for buys (so "one buy per symbol per day"
 * holds no matter which dip rule fired) and the specific reason for sells
 * (take_profit vs stop_loss are genuinely different actions).
 */
export function makeClientOrderId(
  mode: Mode,
  symbol: string,
  side: OrderSide,
  token: string,
  now: Date,
): string {
  return `tracer-${mode}-${symbol}-${side}-${token}-${etDayKey(now)}`;
}
