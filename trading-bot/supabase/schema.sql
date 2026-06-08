-- ───────────────────────────────────────────────────────────────────────────
-- Tracer v1 — Supabase schema (run in the Supabase SQL editor)
--
-- Defaults are deliberately conservative and PAPER-first. The bot reads every
-- threshold from `config` at runtime, so you can tune without redeploying.
--
-- Security model: the bot connects with the SERVICE ROLE key, which bypasses
-- RLS. We still enable RLS with NO policies on every table so that the public
-- anon/auth roles cannot read or write this data by accident.
-- ───────────────────────────────────────────────────────────────────────────

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ── Runtime config (single row, id = 1) ────────────────────────────────────
create table if not exists config (
  id                       int primary key default 1,
  mode                     text    not null default 'paper',   -- 'paper' | 'live' (defaults to paper!)
  tranche_usd              numeric not null default 12.50,
  reserve_usd              numeric not null default 10.00,
  max_buys_day_per_symbol  int     not null default 1,
  max_buys_week            int     not null default 2,
  dip_day_pct              numeric not null default 1.5,
  dip_high_pct             numeric not null default 3.0,
  take_profit_pct          numeric not null default 10.0,
  stop_loss_pct            numeric not null default 10.0,
  daily_loss_limit_usd     numeric not null default 5.00,       -- circuit breaker
  hard_account_cap_usd     numeric not null default 50.00,      -- bot may never deploy beyond this
  max_spread_pct           numeric not null default 0.5,        -- liquidity guard
  min_price_usd            numeric not null default 5.0,        -- penny-stock guard
  kill_switch              boolean not null default false,      -- master off switch
  allowlist                text[]  not null default array['SPY','QQQ','VOO'],
  updated_at               timestamptz not null default now(),
  constraint config_singleton check (id = 1),
  constraint config_mode_valid check (mode in ('paper', 'live'))
);

-- ── Positions (mirror of broker truth — reconciled every run) ───────────────
create table if not exists positions (
  symbol     text primary key,
  qty        numeric not null,
  avg_cost   numeric not null,
  updated_at timestamptz not null default now()
);

-- ── Orders (every submission, with full broker response) ────────────────────
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  ts              timestamptz not null default now(),
  symbol          text,
  side            text,           -- buy | sell
  type            text,           -- limit
  qty             numeric,
  limit_price     numeric,
  status          text,           -- submitted | filled | partially_filled | canceled | rejected | duplicate
  reason          text,           -- which rule triggered it (dip_day, dip_high, take_profit, stop_loss)
  mode            text,           -- paper | live
  client_order_id text unique,    -- idempotency key (also enforced by Alpaca)
  raw             jsonb           -- full broker response
);

create index if not exists orders_ts_idx              on orders (ts desc);
create index if not exists orders_symbol_side_ts_idx  on orders (symbol, side, ts desc);
create index if not exists orders_side_ts_idx         on orders (side, ts desc);
create index if not exists orders_mode_idx            on orders (mode);

-- ── Signals (every evaluation that produced an intent) ──────────────────────
create table if not exists signals (
  id     uuid primary key default gen_random_uuid(),
  ts     timestamptz not null default now(),
  symbol text,
  signal text,            -- buy | sell
  detail jsonb,           -- reason, prices, risk decision
  acted  boolean not null default false
);

create index if not exists signals_ts_idx on signals (ts desc);

-- ── Run log (structured operational log) ────────────────────────────────────
create table if not exists run_log (
  id      uuid primary key default gen_random_uuid(),
  ts      timestamptz not null default now(),
  level   text,           -- info | warn | error
  message text,
  detail  jsonb
);

create index if not exists run_log_ts_idx    on run_log (ts desc);
create index if not exists run_log_level_idx on run_log (level);

-- ── Daily P&L (one row per trading day) ─────────────────────────────────────
create table if not exists daily_pnl (
  day           date primary key,
  realized_pnl  numeric default 0,
  start_equity  numeric,
  end_equity    numeric,
  updated_at    timestamptz not null default now()
);

-- ── Keep config.updated_at fresh ────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists config_set_updated_at on config;
create trigger config_set_updated_at
  before update on config
  for each row execute function set_updated_at();

drop trigger if exists positions_set_updated_at on positions;
create trigger positions_set_updated_at
  before update on positions
  for each row execute function set_updated_at();

-- ── Seed the single config row (idempotent) ─────────────────────────────────
insert into config (id) values (1)
on conflict (id) do nothing;

-- ── Lock down: RLS on, no policies (service role bypasses RLS) ──────────────
alter table config    enable row level security;
alter table positions enable row level security;
alter table orders    enable row level security;
alter table signals   enable row level security;
alter table run_log   enable row level security;
alter table daily_pnl enable row level security;
