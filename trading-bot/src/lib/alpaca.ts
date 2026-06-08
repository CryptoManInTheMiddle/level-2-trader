// Thin Alpaca REST client (fetch-based — no SDK). Covers exactly what Tracer
// needs: clock, account, positions, quotes (snapshot + daily bars), and limit
// order submission. Defaults to the PAPER endpoint via env.

import 'server-only';
import { getAlpacaEnv, isLiveEndpoint, type AlpacaEnv } from '@/lib/env';
import type {
  AccountSnapshot,
  OrderSide,
  PositionSnapshot,
  ProposedOrder,
  Quote,
} from '@/lib/types';

const REQUEST_TIMEOUT_MS = 15_000;

export interface AlpacaHttpError extends Error {
  status?: number;
  body?: unknown;
}

async function alpacaFetch(
  base: string,
  path: string,
  env: AlpacaEnv,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'APCA-API-KEY-ID': env.ALPACA_API_KEY_ID,
      'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    const err = new Error(
      `Alpaca ${init?.method ?? 'GET'} ${path} -> ${res.status}: ${detail}`,
    ) as AlpacaHttpError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Format a fractional qty without scientific notation. */
function qtyToString(qty: number): string {
  return qty.toFixed(6).replace(/\.?0+$/, '');
}

function ms(ts: string | undefined): number {
  if (!ts) return 0;
  const n = Date.parse(ts);
  return Number.isNaN(n) ? 0 : n;
}

export interface ClockInfo {
  isOpen: boolean;
  nextOpen: string;
  nextClose: string;
  timestamp: string;
}

export interface SubmitResult {
  status: string;
  duplicate: boolean;
  raw: unknown;
}

export interface AlpacaClient {
  env: AlpacaEnv;
  isLive: boolean;
  getClock(): Promise<ClockInfo>;
  getAccount(): Promise<AccountSnapshot>;
  getPositions(): Promise<PositionSnapshot[]>;
  buildQuotes(symbols: string[]): Promise<Quote[]>;
  submitOrder(order: ProposedOrder, side: OrderSide): Promise<SubmitResult>;
}

export function createAlpaca(): AlpacaClient {
  const env = getAlpacaEnv();
  const trade = (path: string, init?: RequestInit) =>
    alpacaFetch(env.ALPACA_BASE_URL, path, env, init);
  const data = (path: string, init?: RequestInit) =>
    alpacaFetch(env.ALPACA_DATA_URL, path, env, init);

  async function getClock(): Promise<ClockInfo> {
    const b = (await trade('/v2/clock')) as Record<string, unknown>;
    return {
      isOpen: Boolean(b.is_open),
      nextOpen: String(b.next_open ?? ''),
      nextClose: String(b.next_close ?? ''),
      timestamp: String(b.timestamp ?? ''),
    };
  }

  async function getAccount(): Promise<AccountSnapshot> {
    const b = (await trade('/v2/account')) as Record<string, unknown>;
    return {
      equity: Number(b.equity),
      lastEquity: Number(b.last_equity),
      cash: Number(b.cash),
    };
  }

  async function getPositions(): Promise<PositionSnapshot[]> {
    const arr = (await trade('/v2/positions')) as Record<string, unknown>[];
    return (arr ?? []).map((p) => {
      const qty = Number(p.qty);
      const avgCost = Number(p.avg_entry_price);
      return {
        symbol: String(p.symbol),
        qty,
        avgCost,
        costBasis: p.cost_basis !== undefined ? Number(p.cost_basis) : qty * avgCost,
        currentPrice: Number(p.current_price),
        marketValue: Number(p.market_value),
        unrealizedPl: Number(p.unrealized_pl),
      };
    });
  }

  async function buildQuotes(symbols: string[]): Promise<Quote[]> {
    if (!symbols.length) return [];
    const list = symbols.join(',');
    const feed = env.ALPACA_DATA_FEED;

    const [snapRes, barsRes] = await Promise.all([
      data(`/v2/stocks/snapshots?symbols=${encodeURIComponent(list)}&feed=${feed}`),
      data(
        `/v2/stocks/bars?symbols=${encodeURIComponent(list)}&timeframe=1Day&limit=20&sort=desc&adjustment=split&feed=${feed}`,
      ),
    ]);

    const snapshots = (snapRes as Record<string, any>) ?? {};
    const barsBySymbol = ((barsRes as Record<string, any>)?.bars ?? {}) as Record<string, any[]>;

    const quotes: Quote[] = [];
    for (const symbol of symbols) {
      const snap = snapshots[symbol];
      if (!snap) continue;
      const lq = snap.latestQuote ?? {};
      const lt = snap.latestTrade ?? {};
      const prev = snap.prevDailyBar ?? {};
      const bars = barsBySymbol[symbol] ?? [];
      const high20 = bars.length
        ? Math.max(...bars.map((bar) => Number(bar.h)).filter((n) => Number.isFinite(n)))
        : 0;

      quotes.push({
        symbol,
        bid: Number(lq.bp ?? 0),
        ask: Number(lq.ap ?? 0),
        last: Number(lt.p ?? 0),
        prevClose: Number(prev.c ?? 0),
        high20,
        asOf: Math.max(ms(lt.t), ms(lq.t)),
      });
    }
    return quotes;
  }

  async function submitOrder(order: ProposedOrder, side: OrderSide): Promise<SubmitResult> {
    const payload = {
      symbol: order.symbol,
      qty: qtyToString(order.qty),
      side,
      type: 'limit',
      time_in_force: 'day',
      limit_price: order.limitPrice.toFixed(2),
      client_order_id: order.clientOrderId,
      extended_hours: false,
    };

    try {
      const b = (await trade('/v2/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      })) as Record<string, unknown>;
      return { status: String(b.status ?? 'submitted'), duplicate: false, raw: b };
    } catch (err) {
      const e = err as AlpacaHttpError;
      // A duplicate client_order_id is the idempotency guard doing its job.
      const msg = (e.message ?? '').toLowerCase();
      if (e.status === 422 && (msg.includes('client_order_id') || msg.includes('duplicate'))) {
        return { status: 'duplicate', duplicate: true, raw: e.body ?? { message: e.message } };
      }
      throw err;
    }
  }

  return {
    env,
    isLive: isLiveEndpoint(env.ALPACA_BASE_URL),
    getClock,
    getAccount,
    getPositions,
    buildQuotes,
    submitOrder,
  };
}
