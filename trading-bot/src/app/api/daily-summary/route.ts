// Daily summary entrypoint — invoked by Vercel Cron once after the close.

import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/auth';
import { runDailySummary } from '@/engine/summary';
import { sendAlert } from '@/lib/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDailySummary();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    await sendAlert({
      title: 'daily-summary failed',
      body: String(err),
      level: 'error',
    });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
