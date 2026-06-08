// The 24/7 engine entrypoint. Invoked by Vercel Cron (and manually for tests).
// Market-hours gating, the kill switch, and all risk checks live inside
// runStrategy(); this handler only authorizes and provides the crash safety net.

import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { runStrategy } from '@/engine/run';
import { sendAlert } from '@/lib/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runStrategy();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // Catch, log, alert, skip this cycle — never crash-loop (Section 10).
    await sendAlert({
      title: 'run-strategy cycle failed',
      body: String(err),
      level: 'error',
    });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
