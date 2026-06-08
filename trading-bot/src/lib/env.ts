// Lazily-validated environment access. Each subsystem validates only the vars
// it needs, *when* it needs them — so `next build` and the read-only status
// page never crash just because the trading secrets aren't present in that
// context. Validation uses zod; empty strings are treated as "unset".

import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const urlWithDefault = (d: string) =>
  z.preprocess(emptyToUndefined, z.string().url().default(d));

const alpacaSchema = z.object({
  ALPACA_API_KEY_ID: z.string().min(1, 'ALPACA_API_KEY_ID is required'),
  ALPACA_API_SECRET_KEY: z.string().min(1, 'ALPACA_API_SECRET_KEY is required'),
  ALPACA_BASE_URL: urlWithDefault('https://paper-api.alpaca.markets'),
  ALPACA_DATA_URL: urlWithDefault('https://data.alpaca.markets'),
  ALPACA_DATA_FEED: z.preprocess(emptyToUndefined, z.string().default('iex')),
});

const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
});

const alertSchema = z.object({
  ALERT_WEBHOOK_URL: optionalUrl,
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ALERT_EMAIL_TO: z.preprocess(emptyToUndefined, z.string().optional()),
  ALERT_EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
});

const securitySchema = z.object({
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  STATUS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type AlpacaEnv = z.infer<typeof alpacaSchema>;
export type SupabaseEnv = z.infer<typeof supabaseSchema>;
export type AlertEnv = z.infer<typeof alertSchema>;
export type SecurityEnv = z.infer<typeof securitySchema>;

export function getAlpacaEnv(): AlpacaEnv {
  return alpacaSchema.parse(process.env);
}
export function getSupabaseEnv(): SupabaseEnv {
  return supabaseSchema.parse(process.env);
}
export function getAlertEnv(): AlertEnv {
  return alertSchema.parse(process.env);
}
export function getSecurityEnv(): SecurityEnv {
  return securitySchema.parse(process.env);
}

/** True when the configured Alpaca trading endpoint is the LIVE one. */
export function isLiveEndpoint(baseUrl: string): boolean {
  return /\/\/api\.alpaca\.markets/.test(baseUrl);
}
