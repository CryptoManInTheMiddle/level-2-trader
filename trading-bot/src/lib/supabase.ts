// Supabase access using the SERVICE ROLE key. Server-only: this client bypasses
// RLS and must never be imported into client components.

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/env';
import type { Config } from '@/lib/types';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getSupabaseEnv();
  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Map the raw `config` row (snake_case, possibly stringy numerics) to Config. */
export function mapConfigRow(row: Record<string, unknown>): Config {
  const num = (v: unknown, fallback: number) =>
    v === null || v === undefined ? fallback : Number(v);
  return {
    mode: row.mode === 'live' ? 'live' : 'paper',
    trancheUsd: num(row.tranche_usd, 12.5),
    reserveUsd: num(row.reserve_usd, 10),
    maxBuysDayPerSymbol: num(row.max_buys_day_per_symbol, 1),
    maxBuysWeek: num(row.max_buys_week, 2),
    dipDayPct: num(row.dip_day_pct, 1.5),
    dipHighPct: num(row.dip_high_pct, 3),
    takeProfitPct: num(row.take_profit_pct, 10),
    stopLossPct: num(row.stop_loss_pct, 10),
    dailyLossLimitUsd: num(row.daily_loss_limit_usd, 5),
    hardAccountCapUsd: num(row.hard_account_cap_usd, 50),
    maxSpreadPct: num(row.max_spread_pct, 0.5),
    minPriceUsd: num(row.min_price_usd, 5),
    killSwitch: Boolean(row.kill_switch),
    allowlist: Array.isArray(row.allowlist) ? (row.allowlist as string[]) : ['SPY', 'QQQ', 'VOO'],
  };
}

export async function loadConfig(): Promise<Config> {
  const { data, error } = await getSupabase()
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) {
    throw new Error(`Failed to load config: ${error?.message ?? 'no row'} (did you run schema.sql?)`);
  }
  return mapConfigRow(data as Record<string, unknown>);
}

/** Flip the master kill switch on. Idempotent. */
export async function tripKillSwitch(): Promise<void> {
  const { error } = await getSupabase()
    .from('config')
    .update({ kill_switch: true })
    .eq('id', 1);
  if (error) throw new Error(`Failed to trip kill switch: ${error.message}`);
}
