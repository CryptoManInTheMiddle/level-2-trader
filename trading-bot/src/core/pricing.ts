// Pure numeric helpers for prices, spreads, and order sizing.
// No I/O, no dates — trivially unit-testable.

/** Round to a price tick (default 1 cent; our universe is all > $5). */
export function roundToTick(price: number, tick = 0.01): number {
  return Math.round(price / tick) * tick;
}

/** Smallest tick-aligned price >= `price`. Used to keep buy limits marketable. */
export function ceilToTick(price: number, tick = 0.01): number {
  return Math.ceil(price / tick - 1e-9) * tick;
}

/** Largest tick-aligned price <= `price`. Used to keep sell limits marketable. */
export function floorToTick(price: number, tick = 0.01): number {
  return Math.floor(price / tick + 1e-9) * tick;
}

/** Mid price between bid and ask. */
export function midPrice(bid: number, ask: number): number {
  return (bid + ask) / 2;
}

/**
 * Bid-ask spread as a percent of the mid. Returns Infinity if the quote is
 * unusable (non-positive or crossed), so the liquidity guard rejects it.
 */
export function spreadPct(bid: number, ask: number): number {
  if (!(bid > 0) || !(ask > 0) || ask < bid) return Infinity;
  const mid = midPrice(bid, ask);
  if (!(mid > 0)) return Infinity;
  return ((ask - bid) / mid) * 100;
}

/**
 * Marketable BUY limit: at/near the ask. `bufferPct` (e.g. 0.05) nudges it
 * above the ask to improve fill odds; we round UP so the limit stays >= ask.
 */
export function limitPriceForBuy(ask: number, bufferPct = 0): number {
  return ceilToTick(ask * (1 + bufferPct / 100));
}

/**
 * Marketable SELL limit: at/near the bid. We round DOWN so the limit stays
 * <= bid and remains marketable.
 */
export function limitPriceForSell(bid: number, bufferPct = 0): number {
  return floorToTick(bid * (1 - bufferPct / 100));
}

/**
 * Fractional share quantity for a fixed-dollar tranche. Floored to 6 decimals
 * so the resulting notional never exceeds the tranche. Returns 0 if inputs are
 * unusable.
 */
export function qtyForTranche(trancheUsd: number, limitPrice: number): number {
  if (!(trancheUsd > 0) || !(limitPrice > 0)) return 0;
  const raw = trancheUsd / limitPrice;
  return Math.floor(raw * 1e6) / 1e6;
}

/** Percent change from `from` to `to`, e.g. (110 from 100) => +10. */
export function pctChange(from: number, to: number): number {
  if (!(from > 0)) return 0;
  return ((to - from) / from) * 100;
}
