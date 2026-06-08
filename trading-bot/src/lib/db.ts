// Repository layer: typed reads/writes over the Supabase tables. Keeps SQL-ish
// details out of the engine.

import 'server-only';
import { getSupabase } from '@/lib/supabase';
import type { Mode, OrderSide, PositionSnapshot, SignalReason } from '@/lib/types';

/** Statuses that do NOT count toward frequency caps. */
const NON_COUNTING_STATUSES = '(rejected,duplicate)';

/** Reconcile the positions table to broker truth: upsert held, delete the rest. */
export async function reconcilePositions(positions: PositionSnapshot[]): Promise<void> {
  const sb = getSupabase();

  if (positions.length) {
    const rows = positions.map((p) => ({ symbol: p.symbol, qty: p.qty, avg_cost: p.avgCost }));
    const { error } = await sb.from('positions').upsert(rows, { onConflict: 'symbol' });
    if (error) throw new Error(`reconcilePositions upsert: ${error.message}`);
  }

  const held = positions.map((p) => p.symbol);
  const del = held.length
    ? sb.from('positions').delete().not('symbol', 'in', `(${held.join(',')})`)
    : sb.from('positions').delete().neq('symbol', '__none__'); // matches all rows
  const { error } = await del;
  if (error) throw new Error(`reconcilePositions delete: ${error.message}`);
}

export interface OrderRecordInput {
  symbol: string;
  side: OrderSide;
  type: string;
  qty: number;
  limitPrice: number;
  status: string;
  reason: SignalReason;
  mode: Mode;
  clientOrderId: string;
  raw: unknown;
}

export async function recordOrder(o: OrderRecordInput): Promise<void> {
  const { error } = await getSupabase().from('orders').insert({
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    qty: o.qty,
    limit_price: o.limitPrice,
    status: o.status,
    reason: o.reason,
    mode: o.mode,
    client_order_id: o.clientOrderId,
    raw: o.raw ?? null,
  });
  // A duplicate client_order_id collides with the unique constraint — that's a
  // successful idempotency stop, not a failure.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new Error(`recordOrder: ${error.message}`);
  }
}

export async function recordSignal(
  symbol: string,
  side: OrderSide,
  detail: unknown,
  acted: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from('signals')
    .insert({ symbol, signal: side, detail: detail ?? null, acted });
  if (error) throw new Error(`recordSignal: ${error.message}`);
}

export async function countBuysForSymbolSince(
  symbol: string,
  sinceISO: string,
  mode: Mode,
): Promise<number> {
  const { count, error } = await getSupabase()
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('side', 'buy')
    .eq('mode', mode)
    .eq('symbol', symbol)
    .gte('ts', sinceISO)
    .not('status', 'in', NON_COUNTING_STATUSES);
  if (error) throw new Error(`countBuysForSymbolSince: ${error.message}`);
  return count ?? 0;
}

export async function countBuysSince(sinceISO: string, mode: Mode): Promise<number> {
  const { count, error } = await getSupabase()
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('side', 'buy')
    .eq('mode', mode)
    .gte('ts', sinceISO)
    .not('status', 'in', NON_COUNTING_STATUSES);
  if (error) throw new Error(`countBuysSince: ${error.message}`);
  return count ?? 0;
}

export interface DailyPnlInput {
  day: string; // YYYY-MM-DD
  startEquity?: number;
  endEquity?: number;
  realizedPnl?: number;
}

export async function upsertDailyPnl(input: DailyPnlInput): Promise<void> {
  const row: Record<string, unknown> = { day: input.day };
  if (input.startEquity !== undefined) row.start_equity = input.startEquity;
  if (input.endEquity !== undefined) row.end_equity = input.endEquity;
  if (input.realizedPnl !== undefined) row.realized_pnl = input.realizedPnl;
  const { error } = await getSupabase().from('daily_pnl').upsert(row, { onConflict: 'day' });
  if (error) throw new Error(`upsertDailyPnl: ${error.message}`);
}

export interface StatusSnapshot {
  config: Record<string, unknown> | null;
  positions: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  runLog: Record<string, unknown>[];
  dailyPnl: Record<string, unknown>[];
}

/** Everything the read-only status dashboard needs, in one call. */
export async function getStatusSnapshot(): Promise<StatusSnapshot> {
  const sb = getSupabase();
  const [config, positions, orders, runLog, dailyPnl] = await Promise.all([
    sb.from('config').select('*').eq('id', 1).maybeSingle(),
    sb.from('positions').select('*').order('symbol'),
    sb.from('orders').select('*').order('ts', { ascending: false }).limit(20),
    sb.from('run_log').select('*').order('ts', { ascending: false }).limit(30),
    sb.from('daily_pnl').select('*').order('day', { ascending: false }).limit(14),
  ]);
  return {
    config: (config.data as Record<string, unknown>) ?? null,
    positions: (positions.data as Record<string, unknown>[]) ?? [],
    orders: (orders.data as Record<string, unknown>[]) ?? [],
    runLog: (runLog.data as Record<string, unknown>[]) ?? [],
    dailyPnl: (dailyPnl.data as Record<string, unknown>[]) ?? [],
  };
}
