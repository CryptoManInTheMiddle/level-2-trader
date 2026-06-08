// Alerting: "unattended" must not mean "unobserved" (Section 7). Every alert is
// mirrored to run_log, then fanned out to whatever channels are configured
// (generic webhook and/or Resend email). Delivery failures are logged, never
// thrown — a broken alert channel must not break the trading loop.

import 'server-only';
import { getAlertEnv } from '@/lib/env';
import { log, type LogLevel } from '@/lib/logger';

const ALERT_TIMEOUT_MS = 10_000;

export type AlertLevel = LogLevel;

export interface Alert {
  title: string;
  body: string;
  level?: AlertLevel;
  data?: unknown;
}

async function postWebhook(url: string, alert: Required<Alert>): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: alert.title,
      body: alert.body,
      level: alert.level,
      data: alert.data,
      ts: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
  });
}

async function sendResend(
  apiKey: string,
  from: string,
  to: string,
  alert: Required<Alert>,
): Promise<void> {
  const text =
    alert.data === undefined
      ? alert.body
      : `${alert.body}\n\n${JSON.stringify(alert.data, null, 2)}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `[Tracer] ${alert.title}`, text }),
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
  });
}

export async function sendAlert(alert: Alert): Promise<void> {
  const level = alert.level ?? 'info';
  const full: Required<Alert> = { ...alert, level, data: alert.data };

  // Always record to run_log first.
  await log(level, `ALERT: ${alert.title} — ${alert.body}`, alert.data);

  let env;
  try {
    env = getAlertEnv();
  } catch (err) {
    await log('warn', 'alert env invalid; alert only went to run_log', String(err));
    return;
  }

  const tasks: Promise<void>[] = [];
  if (env.ALERT_WEBHOOK_URL) tasks.push(postWebhook(env.ALERT_WEBHOOK_URL, full));
  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) {
    tasks.push(sendResend(env.RESEND_API_KEY, env.ALERT_EMAIL_FROM, env.ALERT_EMAIL_TO, full));
  }

  if (!tasks.length) return; // run_log is the only channel; that's fine.

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'rejected') {
      await log('warn', 'alert channel delivery failed', String(r.reason));
    }
  }
}
