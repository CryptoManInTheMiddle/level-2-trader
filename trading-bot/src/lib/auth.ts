// Endpoint authorization. The cron/trigger endpoints require CRON_SECRET (which
// Vercel Cron sends automatically as `Authorization: Bearer <CRON_SECRET>`).
// The status views use the optional STATUS_TOKEN.

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { getSecurityEnv } from '@/lib/env';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Authorize a cron/trigger request. Requires CRON_SECRET to be configured. */
export function isCronAuthorized(req: Request): boolean {
  const { CRON_SECRET } = getSecurityEnv();
  if (!CRON_SECRET) return false; // fail closed until configured
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const qs = new URL(req.url).searchParams.get('secret') ?? '';
  return safeEqual(bearer, CRON_SECRET) || safeEqual(qs, CRON_SECRET);
}

/**
 * Authorize a status view by token. Returns:
 *  - 'open'   when STATUS_TOKEN is unset (render, but warn it's unauthenticated)
 *  - 'ok'     when the provided token matches
 *  - 'denied' otherwise
 */
export function statusAuthorization(token: string | undefined): 'open' | 'ok' | 'denied' {
  const { STATUS_TOKEN } = getSecurityEnv();
  if (!STATUS_TOKEN) return 'open';
  if (token && safeEqual(token, STATUS_TOKEN)) return 'ok';
  return 'denied';
}
