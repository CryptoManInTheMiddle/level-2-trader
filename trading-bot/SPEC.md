# 24/7 Automated Trading Bot — Build Spec (Claude Code + Supabase + Vercel + Alpaca)

> The original build spec this project was created from. It is preserved here
> because the safety rules are core requirements, not suggestions. Revise it as
> you learn — keep every rule unambiguous.

---

## 0. Honest framing (read first)

- **Goal of v1 = test reliability, not make money.** "Reliable" means: fires the right orders, handles errors without blowing up, behaves correctly at the open/close and during weird events, and logs everything. You measure that in **paper mode**, where bugs cost $0.
- **Why paper-first is the whole point.** The only way to answer "can it be reliable?" without paying tuition in real losses is to run it hands-off against live data with fake money for weeks. Paper trading *is* the reliability test.
- **Most automated retail strategies underperform just holding an index.** Treat profit as a surprise, not the plan. The value of v1 is a working, observable, safe system.

---

## 1. CRITICAL: instrument universe — what this bot trades

**The bot trades a small, fixed list of LIQUID instruments. Penny stocks / sub-$5 / OTC names are explicitly forbidden.** Hard-code this allowlist and reject anything not on it.

**Default universe (liquid, tight spreads):** `SPY`, `QQQ`, `VOO`, plus optionally 1–2 liquid large-caps (e.g. `NVDA`). Nothing else.

**Hard exclusion filters (enforced in code, every order):**
- Reject any symbol with last price **< $5**.
- Reject any symbol not on the allowlist.
- Reject if the **bid-ask spread > 0.5%** of price at order time (liquidity guard).
- Reject if average daily dollar volume is below a set floor (e.g. < $50M/day).

---

## 2. Tech stack & architecture

| Layer | Tool | Role |
|-------|------|------|
| Build tool | Claude Code | Scaffolds and writes the whole project |
| Brokerage / market data | Alpaca | REST API for quotes + paper and (later) live order execution |
| Database / state | Supabase (Postgres) | Stores config, positions, orders, signals, logs, daily P&L, kill-switch |
| Scheduler / compute | Vercel | Serverless functions + Vercel Cron (the "24/7" engine) |
| Alerting | Email / push | Notification on every trade, error, and circuit-breaker trip |

---

## 3. Strategy logic (Tracer v1)

- **Universe:** the allowlist only.
- **Entry:** buy a fixed small tranche when down ≥ 1.5% on the day OR ≥ 3% below the trailing 20-day high.
- **Tranche size:** a fixed dollar amount from config (e.g. `$12.50`), never a % that can balloon.
- **Frequency caps:** max 1 buy per symbol per day; max 2 buys per week total.
- **Profit-take:** when up ≥ 10% from average cost, sell ⅓ (limit order).
- **Stop-loss:** when down ≥ 10% from average cost, sell the whole position. Never average down past the stop.
- **Order type:** limit orders only, priced at/near the ask (buys) or bid (sells). Never market orders.
- **Cash discipline:** keep a configured reserve uninvested; respect settlement.

All thresholds live in a Supabase `config` table.

---

## 4. Supabase schema

See `supabase/schema.sql` for the implemented version (extended with a
`client_order_id` idempotency column, indexes, an `updated_at` trigger, and RLS).

---

## 5. The RISK MODULE (must run before every order — non-negotiable)

1. **Kill switch** — if on, do nothing, ever.
2. **Hard account cap** — total deployed may never exceed `hard_account_cap_usd`. No auto-refill logic exists anywhere.
3. **Daily loss limit (circuit breaker)** — if today's loss ≥ limit, flip kill switch, alert, stop for the day.
4. **Position-size cap** — every order equals the tranche.
5. **Frequency caps** — per-symbol/day and weekly.
6. **Liquidity/spread guard** — price ≥ $5, spread ≤ 0.5%, symbol on allowlist.
7. **Market-hours guard** — regular hours only.
8. **Duplicate/idempotency guard** — per-signal idempotency key.
9. **Sanity guard** — skip stale/wild quotes and alert.

---

## 6. Vercel Cron (the 24/7 engine)

- `vercel.json` cron invokes the strategy function on a schedule; market-hours gating happens inside the function.
- Secrets live in Vercel environment variables, never in code.
- The function is stateless; all state is in Supabase.

---

## 7. Alerting & monitoring

- Alert on every order (entry/exit, fill price, reason).
- Alert on every error and circuit-breaker trip.
- Daily summary (trades, P&L vs buy-and-hold SPY, current positions).
- A read-only status page.

---

## 8. Build order

1. Scaffold (Next.js, TypeScript), wire Supabase + Alpaca paper, env vars.
2. Create the Supabase schema and seed `config` (paper, allowlist, conservative caps).
3. Quotes + strategy evaluation → write to `signals`.
4. Risk module as a single gate. Build and unit-test it **before** any order code.
5. Order placement (paper) with idempotency; log to `orders`, reconcile `positions`.
6. Vercel Cron wiring with market-hours gating.
7. Alerting — trades, errors, daily summary.
8. Run hands-off in PAPER for ≥ 4 weeks.
9. Only then consider the live gate.

---

## 9. The paper → real-money gate (do NOT skip)

Flip `mode` to `live` only if ALL are true after ≥ 4 weeks of paper:
- 30+ paper trades with zero "did something I didn't intend" incidents.
- Error handling proven.
- Matched or beat buy-and-hold SPY over the window.
- Max drawdown within your limit.

When live: fund with a hard cap you can lose entirely; no auto-refill, ever;
review the daily summary every day.

---

## 10. Failure modes the system must handle

| Failure | Required behavior |
|---------|-------------------|
| API/network error | Catch, log, alert, skip cycle — never crash-loop or double-submit |
| Stale/wild quote | Skip + alert |
| Partial fill | Reconcile positions from broker truth |
| Duplicate trigger | Idempotency key blocks double orders |
| Daily loss breached | Auto kill-switch + alert + stop for the day |
| Symbol halted / illiquid | Liquidity guard rejects; log |
| Deploy/region down | Stateless design + Supabase truth ⇒ safe restart |

---

## 11. Secrets / env vars

See `.env.example`.

---

## 12. Honest caveats
- Paper fills flatter you. Live will be worse — which is why the live cap is tiny and un-refillable.
- Reliability ≠ profitability. Measure both; respect the benchmark.
- You are solely responsible for anything a live bot does.
- Start, and stay, paper until the gate is genuinely met.
