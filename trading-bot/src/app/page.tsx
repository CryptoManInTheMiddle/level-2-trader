// Read-only status dashboard (Section 7). Server-rendered so the Supabase
// service key never reaches the browser. Gated by STATUS_TOKEN when set.

import { statusAuthorization } from '@/lib/auth';
import { getStatusSnapshot, type StatusSnapshot } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function n(v: unknown, dp = 2): string {
  const num = Number(v);
  return Number.isFinite(num) ? num.toFixed(dp) : '—';
}

function ts(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function pnlClass(v: unknown): string {
  const num = Number(v);
  if (!Number.isFinite(num) || num === 0) return '';
  return num > 0 ? 'pos' : 'neg';
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const authz = statusAuthorization(token);

  if (authz === 'denied') {
    return (
      <main>
        <h1>Tracer Bot</h1>
        <p className="sub">Locked. Append <code>?token=YOUR_STATUS_TOKEN</code> to view.</p>
      </main>
    );
  }

  let snapshot: StatusSnapshot | null = null;
  let error: string | null = null;
  try {
    snapshot = await getStatusSnapshot();
  } catch (err) {
    error = String(err);
  }

  if (error || !snapshot) {
    return (
      <main>
        <h1>Tracer Bot</h1>
        <p className="sub">Could not load status. Check Supabase env / schema.</p>
        <pre className="level-error">{error}</pre>
      </main>
    );
  }

  const cfg = snapshot.config ?? {};
  const mode = String(cfg.mode ?? 'paper');
  const killOn = Boolean(cfg.kill_switch);
  const allowlist = Array.isArray(cfg.allowlist) ? (cfg.allowlist as string[]).join(', ') : '—';

  return (
    <main>
      <h1>Tracer Bot</h1>
      <p className="sub">Paper-first 24/7 trading bot — read-only status.</p>

      {authz === 'open' && (
        <div className="banner warn">
          ⚠ This status page is UNAUTHENTICATED. Set a <code>STATUS_TOKEN</code> env var to lock it.
        </div>
      )}
      {mode === 'live' && (
        <div className="banner live">
          ● LIVE MODE — real money is at risk. The hard account cap is {n(cfg.hard_account_cap_usd)}.
        </div>
      )}

      <div className="cards">
        <div className="card">
          <div className="label">Mode</div>
          <div className="value">
            <span className={`badge ${mode === 'live' ? 'live' : 'paper'}`}>{mode}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">Kill switch</div>
          <div className="value">
            <span className={`badge ${killOn ? 'on' : 'off'}`}>{killOn ? 'ON' : 'off'}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">Tranche (USD)</div>
          <div className="value">{n(cfg.tranche_usd)}</div>
        </div>
        <div className="card">
          <div className="label">Daily loss limit</div>
          <div className="value">{n(cfg.daily_loss_limit_usd)}</div>
        </div>
        <div className="card">
          <div className="label">Hard account cap</div>
          <div className="value">{n(cfg.hard_account_cap_usd)}</div>
        </div>
        <div className="card">
          <div className="label">Allowlist</div>
          <div className="value" style={{ fontSize: 14 }}>{allowlist}</div>
        </div>
      </div>

      <h2>Positions</h2>
      {snapshot.positions.length ? (
        <table>
          <thead>
            <tr><th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {snapshot.positions.map((p) => (
              <tr key={String(p.symbol)}>
                <td>{String(p.symbol)}</td>
                <td>{n(p.qty, 6)}</td>
                <td>{n(p.avg_cost)}</td>
                <td>{ts(p.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">Flat — no open positions.</p>
      )}

      <h2>Recent orders</h2>
      {snapshot.orders.length ? (
        <table>
          <thead>
            <tr>
              <th>Time</th><th>Symbol</th><th>Side</th><th>Qty</th>
              <th>Limit</th><th>Status</th><th>Reason</th><th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.orders.map((o) => (
              <tr key={String(o.id)}>
                <td>{ts(o.ts)}</td>
                <td>{String(o.symbol ?? '—')}</td>
                <td className={o.side === 'buy' ? 'pos' : 'neg'}>{String(o.side ?? '—')}</td>
                <td>{n(o.qty, 6)}</td>
                <td>{n(o.limit_price)}</td>
                <td>{String(o.status ?? '—')}</td>
                <td>{String(o.reason ?? '—')}</td>
                <td>{String(o.mode ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">No orders yet.</p>
      )}

      <h2>Daily P&amp;L</h2>
      {snapshot.dailyPnl.length ? (
        <table>
          <thead>
            <tr><th>Day</th><th>Start equity</th><th>End equity</th><th>Day change</th></tr>
          </thead>
          <tbody>
            {snapshot.dailyPnl.map((d) => {
              const change = Number(d.end_equity) - Number(d.start_equity);
              return (
                <tr key={String(d.day)}>
                  <td>{String(d.day)}</td>
                  <td>{n(d.start_equity)}</td>
                  <td>{n(d.end_equity)}</td>
                  <td className={pnlClass(change)}>{Number.isFinite(change) ? change.toFixed(2) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty">No P&amp;L recorded yet.</p>
      )}

      <h2>Recent log</h2>
      {snapshot.runLog.length ? (
        <table>
          <thead>
            <tr><th>Time</th><th>Level</th><th>Message</th></tr>
          </thead>
          <tbody>
            {snapshot.runLog.map((r) => (
              <tr key={String(r.id)}>
                <td>{ts(r.ts)}</td>
                <td className={`level-${String(r.level)}`}>{String(r.level ?? '—')}</td>
                <td>{String(r.message ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">No log entries yet.</p>
      )}
    </main>
  );
}
