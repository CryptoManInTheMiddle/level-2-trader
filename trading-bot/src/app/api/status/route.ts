// Read-only JSON status (token-gated by STATUS_TOKEN). Handy for scripts/uptime
// checks that want machine-readable health.

import { NextResponse } from 'next/server';
import { statusAuthorization } from '@/lib/auth';
import { getStatusSnapshot } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token') ?? undefined;
  const authz = statusAuthorization(token);
  if (authz === 'denied') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const snapshot = await getStatusSnapshot();
    return NextResponse.json({ ok: true, authenticated: authz === 'ok', ...snapshot });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
