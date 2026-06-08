# Tracer v1 — 24/7 Automated Trading Bot

A headless, scheduled trading bot that runs unattended against **live market
data with simulated money** (Alpaca paper), so you can test *reliability* at
**zero financial risk** before ever touching real money.

> **Read this first.** v1's goal is **reliability, not profit**. "Reliable"
> means: it fires the right orders, handles errors without blowing up, behaves
> correctly at the open/close and during weird events, and logs everything. You
> prove that in **paper mode**, where bugs cost $0. Most automated retail
> strategies underperform just holding an index — treat profit as a surprise,
> not the plan. **Stay paper until the gate in §"Paper → real money" is
> genuinely met.**

Built per [`SPEC.md`](./SPEC.md):
**Next.js (Vercel) + Supabase (Postgres) + Alpaca**, paper-first, with the risk
module written and unit-tested *before* any order code.

---

## How it works

```
Vercel Cron (every ~5 min during market hours)
        │
        ▼
/api/run-strategy  ── load config + kill switch (Supabase)
        │                ├─ kill switch ON / market closed / mode mismatch → no-op
        │                ├─ daily-loss circuit breaker → flip kill switch, alert, stop
        │                ▼
        ├─ reconcile positions from broker truth (Alpaca)
        ├─ fetch quotes (snapshot + 20d bars) → drop stale/wild quotes
        ├─ evaluate Tracer v1 rules → signals
        │        ▼
        ├─ RISK MODULE (every order must pass all checks)
        │        │ pass
        │        ▼
        ├─ submit LIMIT order (paper) w/ idempotency key → log to Supabase → alert
        ▼
   write run-log to Supabase

/api/daily-summary  ── once after close: P&L vs buy-and-hold SPY, positions, alert
/  (status page)    ── read-only dashboard (token-gated)
```

The serverless functions are **stateless**; all state lives in Supabase, so a
restart or region change is always safe.

## Project layout

| Path | What |
|------|------|
| `src/core/` | **Pure, unit-tested** logic: `pricing`, `strategy` (Tracer v1), `risk` (the gate), `time` (idempotency/day keys) |
| `src/core/__tests__/` | Vitest suites — risk module covered thoroughly |
| `src/lib/` | I/O: `alpaca` (REST client), `supabase`/`db` (state), `alerts`, `logger`, `env`, `auth`, `types` |
| `src/engine/` | Orchestration: `run` (one strategy cycle), `summary` (daily digest) |
| `src/app/api/` | Cron endpoints: `run-strategy`, `daily-summary`, `status` (JSON) |
| `src/app/page.tsx` | Read-only status dashboard |
| `supabase/schema.sql` | Tables + seed + indexes + RLS |
| `vercel.json` | Cron schedules |

---

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run `supabase/schema.sql`. This creates the
   tables, seeds a single `config` row (PAPER, conservative caps), adds indexes,
   and enables RLS.
3. Copy your **Project URL** and **service_role** key (Settings → API).

### 2. Alpaca (paper)
1. Sign up at [alpaca.markets](https://alpaca.markets) and generate
   **paper** API keys (the dashboard has a paper/live toggle).
2. Keep `ALPACA_BASE_URL=https://paper-api.alpaca.markets`.

### 3. Local dev
```bash
cd trading-bot
npm install
cp .env.example .env.local   # fill in the values
npm run test                 # core logic (39 tests)
npm run dev                  # http://localhost:3000
```
Trigger a cycle locally (needs `CRON_SECRET` set in `.env.local`):
```bash
curl "http://localhost:3000/api/run-strategy?secret=$CRON_SECRET"
```

### 4. Deploy to Vercel
1. Import the repo into Vercel and set the **Root Directory** to `trading-bot`.
2. Add all env vars from `.env.example` (Project → Settings → Environment
   Variables). At minimum: the Alpaca keys, Supabase URL + service role key, and
   a `CRON_SECRET` (`openssl rand -hex 32`).
3. Deploy. `vercel.json` registers the cron jobs.

> **Vercel cron caveat:** the Hobby plan runs cron jobs **at most once per day**.
> The `*/5` schedule in `vercel.json` needs a **Pro** plan. On Hobby, either keep
> a daily cron, or drive `/api/run-strategy` from an external scheduler
> (cron-job.org, GitHub Actions, etc.) sending
> `Authorization: Bearer <CRON_SECRET>`. Market-hours gating happens inside the
> function, so extra off-hours calls simply no-op.

### 5. Alerting (recommended)
Set at least one channel so you're notified on every trade, error, and
circuit-breaker trip:
- `ALERT_WEBHOOK_URL` — POSTs JSON `{title, body, level, data, ts}`. Works with
  Slack/Discord/ntfy/Make/your phone. Easiest, no signup.
- Resend email — `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`.

If no channel is configured, alerts still land in the `run_log` table and the
status page.

---

## The strategy (Tracer v1)

All thresholds are read from the `config` table at runtime — **tune without
redeploying.**

- **Universe:** the `allowlist` only (default `SPY, QQQ, VOO`). Penny/sub-$5/OTC
  names are structurally forbidden.
- **Entry:** buy a fixed-dollar tranche when a symbol is down ≥ `dip_day_pct`
  on the day **OR** ≥ `dip_high_pct` below its trailing 20-day high.
- **Take-profit:** up ≥ `take_profit_pct` → sell ⅓.
- **Stop-loss:** down ≥ `stop_loss_pct` → sell the whole position; never average
  down into a name being stopped out.
- **Orders:** **limit only**, marketable (buy at the ask, sell at the bid), as
  fractional `qty` so a small fixed tranche works on high-priced ETFs.
- **Frequency caps:** ≤ `max_buys_day_per_symbol` per symbol/day, ≤
  `max_buys_week` total (rolling 7 days).

## The risk module (`src/core/risk.ts`)

Every order passes a single gate. If **any** check fails, the order is skipped
and logged:

1. **Kill switch** — `config.kill_switch = true` ⇒ do nothing, ever.
2. **Allowlist** — reject anything not explicitly approved.
3. **Market hours** — Alpaca's clock is authoritative (handles holidays/halts).
4. **Sanity** — reject stale or wild quotes (age, daily move, last-vs-mid).
5. **Liquidity/spread** — reject price < `min_price_usd` or spread >
   `max_spread_pct`.
6. **Position-size cap** — every buy must equal the tranche.
7. **Frequency caps** — per-symbol/day and weekly.
8. **Hard account cap** — deployed cost basis + this order may **never** exceed
   `hard_account_cap_usd`. **No auto-refill logic exists anywhere.**
9. **Cash reserve** — keep `reserve_usd` uninvested.
10. **Daily loss circuit breaker** — if today's P&L ≤ `-daily_loss_limit_usd`,
    flip the kill switch, alert, and stop for the day.

> **Circuit-breaker behavior:** when the daily loss limit trips, the kill switch
> goes ON and the bot stops **all** activity (including sells) until you reset it
> manually. With a tiny hard cap this is intentional — the cap is the real
> stop-loss, and a human reviews before resuming. Reset by setting
> `config.kill_switch = false` in Supabase.

### Idempotency
Each order gets a deterministic `client_order_id`
(`tracer-<mode>-<symbol>-<side>-<token>-<ET-day>`). Alpaca and a DB unique
constraint both reject duplicates, so a retry or a signal that keeps firing
every 5 minutes can't double-submit.

---

## Paper → real money (do NOT skip)

Flip `config.mode` to `live` **only if ALL are true after ≥ 4 weeks of paper**:
- 30+ paper trades with **zero** "did something I didn't intend" incidents.
- Error handling proven (survived an API hiccup / off-hours / weird quote).
- Matched or beat **buy-and-hold SPY** over the window.
- Max drawdown stayed within your limit.

When you go live:
- Change **both** `config.mode = 'live'` **and**
  `ALPACA_BASE_URL = https://api.alpaca.markets` (with live keys). The engine
  refuses to trade if mode and endpoint disagree.
- Fund the account with a **hard cap you can lose entirely** (e.g. $50 — the same
  `hard_account_cap_usd` the code enforces).
- **No auto-refill. Ever.** If it loses the cap, it stops and you reassess.
- Review the daily summary **every single day**.

---

## Failure modes handled

| Failure | Behavior |
|---------|----------|
| API/network error | Caught, logged, alerted; cycle skipped — no crash-loop, no double-submit |
| Stale/wild quote | Dropped by the sanity guard + alert |
| Partial fill | Positions reconciled from broker truth each cycle |
| Duplicate trigger | Idempotency key blocks the second order |
| Daily loss breached | Auto kill-switch + alert + stop for the day |
| Halted / illiquid symbol | Liquidity guard rejects; logged |
| Deploy/region down | Stateless design + Supabase truth ⇒ safe restart |

## Honest caveats
- **Paper fills flatter you** — simulators under-model slippage/partial fills.
  Live will be worse, which is why the live cap is tiny and un-refillable.
- **Reliability ≠ profitability.** Measure both; respect the SPY benchmark.
- **You are solely responsible** for anything a live bot does.

## Security notes
- Runs on **Next.js 15 + React 19**; the direct Next.js advisories are patched.
  Remaining `npm audit` items are **dev-only** test tooling (vite/vitest/esbuild)
  and a transitive PostCSS stringify issue — none ship in the serverless
  runtime.
- The Supabase **service role** key is server-only and never sent to the browser.
- Cron/trigger endpoints require `CRON_SECRET`; the status views use
  `STATUS_TOKEN`.

## Commands
```bash
npm run test        # unit tests (core: pricing, strategy, risk)
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run dev         # local dev server
```
