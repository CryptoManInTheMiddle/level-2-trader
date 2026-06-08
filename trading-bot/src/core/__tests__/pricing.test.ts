import { describe, it, expect } from 'vitest';
import {
  roundToTick,
  ceilToTick,
  floorToTick,
  spreadPct,
  limitPriceForBuy,
  limitPriceForSell,
  qtyForTranche,
  pctChange,
} from '@/core/pricing';

describe('tick rounding', () => {
  it('rounds to the nearest cent', () => {
    expect(roundToTick(601.234)).toBeCloseTo(601.23, 5);
    expect(roundToTick(601.236)).toBeCloseTo(601.24, 5);
  });

  it('ceils up to the next cent but leaves aligned prices alone', () => {
    expect(ceilToTick(601.231)).toBeCloseTo(601.24, 5);
    expect(ceilToTick(601.23)).toBeCloseTo(601.23, 5);
  });

  it('floors down to the previous cent but leaves aligned prices alone', () => {
    expect(floorToTick(601.239)).toBeCloseTo(601.23, 5);
    expect(floorToTick(601.23)).toBeCloseTo(601.23, 5);
  });
});

describe('spreadPct', () => {
  it('computes spread as a percent of mid', () => {
    expect(spreadPct(599.5, 600.5)).toBeCloseTo(0.16667, 4);
  });

  it('returns Infinity for crossed or invalid quotes', () => {
    expect(spreadPct(601, 600)).toBe(Infinity);
    expect(spreadPct(0, 10)).toBe(Infinity);
    expect(spreadPct(10, 0)).toBe(Infinity);
  });
});

describe('limit pricing', () => {
  it('buy limit sits at/above the ask and stays tick-aligned', () => {
    expect(limitPriceForBuy(600.05)).toBeCloseTo(600.05, 5);
    const buffered = limitPriceForBuy(600.05, 0.05);
    expect(buffered).toBeGreaterThanOrEqual(600.05);
    expect(Math.round(buffered * 100) % 1).toBe(0);
  });

  it('sell limit sits at/below the bid', () => {
    expect(limitPriceForSell(600.0)).toBeCloseTo(600.0, 5);
    expect(limitPriceForSell(600.0, 0.05)).toBeLessThanOrEqual(600.0);
  });
});

describe('qtyForTranche', () => {
  it('sizes a fractional qty whose notional never exceeds the tranche', () => {
    const qty = qtyForTranche(12.5, 600.05);
    expect(qty).toBeGreaterThan(0);
    expect(qty * 600.05).toBeLessThanOrEqual(12.5);
  });

  it('returns 0 for unusable inputs', () => {
    expect(qtyForTranche(12.5, 0)).toBe(0);
    expect(qtyForTranche(0, 600)).toBe(0);
  });
});

describe('pctChange', () => {
  it('computes percent change', () => {
    expect(pctChange(100, 110)).toBeCloseTo(10);
    expect(pctChange(100, 90)).toBeCloseTo(-10);
    expect(pctChange(0, 90)).toBe(0);
  });
});
