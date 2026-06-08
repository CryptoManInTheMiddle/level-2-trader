// Structured operational logging. Every line goes to the console (Vercel logs)
// and to the `run_log` table. Logging must never crash a run, so DB failures
// are swallowed after being printed.

import 'server-only';
import { getSupabase } from '@/lib/supabase';

export type LogLevel = 'info' | 'warn' | 'error';

export async function log(level: LogLevel, message: string, detail?: unknown): Promise<void> {
  const stamped = `[tracer:${level}] ${message}`;
  if (level === 'error') console.error(stamped, detail ?? '');
  else if (level === 'warn') console.warn(stamped, detail ?? '');
  else console.log(stamped, detail ?? '');

  try {
    await getSupabase()
      .from('run_log')
      .insert({ level, message, detail: detail ?? null });
  } catch (err) {
    console.error('[tracer:error] run_log insert failed', err);
  }
}

export const logger = {
  info: (m: string, d?: unknown) => log('info', m, d),
  warn: (m: string, d?: unknown) => log('warn', m, d),
  error: (m: string, d?: unknown) => log('error', m, d),
};
