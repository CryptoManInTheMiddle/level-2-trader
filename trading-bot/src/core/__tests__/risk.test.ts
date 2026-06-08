import { describe, it, expect } from 'vitest';
import { runRiskChecks, deployedCostBasis, evaluateQuoteSanity } from '@/core/risk';
import type { RiskCheck } from '@/core/risk';
import {
  makeRiskInput,
  makeConfig,
  makeQuote,
  makeAccount,
  makeOrder,
  makePosition,
  NOW,
} from './fixtures';

function check(checks: RiskCheck[], name: string): RiskCheck {
  const c = checks.find((x) => x.name === name);
  if (!c) throw new Error(`no check named ${name}`);
  return c;
}

describe('runRiskChecks — baseline', () => {
  it('passes a healthy allowlisted tranche buy', () => {
    const result = runRiskChecks(makeRiskInput());
    expect(result.ok).toBe(true);
    expect(result.tripKillSwitch).toBe(false);
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });
});

describe('runRiskChecks — hard guards', () => {
  it('blocks everything when the kill switch is on', () => {
    const result = runRiskChecks(
      makeRiskInput({ config: makeConfig({ killSwitch: true }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'kill_switch').ok).toBe(false);
  });

  it('rejects symbols not on the allowlist', () => {
    const result = runRiskChecks(
      makeRiskInput({
        order: makeOrder({ symbol: 'GME' }),
        quote: makeQuote({ symbol: 'GME' }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'allowlist').ok).toBe(false);
  });

  it('does nothing when the market is closed', () => {
    const result = runRiskChecks(makeRiskInput({ marketIsOpen: false }));
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'market_hours').ok).toBe(false);
  });
});

describe('runRiskChecks — sanity guard', () => {
  it('rejects a stale quote during market hours', () => {
    const result = runRiskChecks(
      makeRiskInput({ quote: makeQuote({ asOf: NOW.getTime() - 30 * 60 * 1000 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'sanity').ok).toBe(false);
  });

  it('rejects a wild daily move', () => {
    const result = runRiskChecks(
      makeRiskInput({ quote: makeQuote({ prevClose: 600, last: 400, bid: 399.9, ask: 400.1 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'sanity').ok).toBe(false);
  });

  it('rejects a last price far from the current mid', () => {
    // last 500 vs mid 600.05 ≈ 16.7% off (> 10% threshold), daily move 16.7% (< 25%)
    const result = runRiskChecks(
      makeRiskInput({ quote: makeQuote({ bid: 600, ask: 600.1, last: 500, prevClose: 600 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'sanity').ok).toBe(false);
  });

  it('evaluateQuoteSanity ignores staleness when the market is closed', () => {
    const stale = makeQuote({ asOf: NOW.getTime() - 60 * 60 * 1000 });
    expect(evaluateQuoteSanity(stale, NOW, false).ok).toBe(true);
    expect(evaluateQuoteSanity(stale, NOW, true).ok).toBe(false);
  });
});

describe('runRiskChecks — liquidity', () => {
  it('rejects price below the floor', () => {
    const result = runRiskChecks(
      makeRiskInput({
        order: makeOrder({ limitPrice: 4.5 }),
        quote: makeQuote({ bid: 4.49, ask: 4.5, last: 4.49, prevClose: 4.5, high20: 4.8 }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'liquidity_spread').ok).toBe(false);
  });

  it('rejects a spread wider than the max', () => {
    // 1% spread > 0.5% limit
    const result = runRiskChecks(
      makeRiskInput({ quote: makeQuote({ bid: 597, ask: 603, last: 600 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'liquidity_spread').ok).toBe(false);
  });
});

describe('runRiskChecks — sizing & frequency', () => {
  it('rejects an order larger than the tranche', () => {
    const result = runRiskChecks(
      makeRiskInput({ order: makeOrder({ qty: 1, limitPrice: 600.05, notional: 600.05 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'position_size_cap').ok).toBe(false);
  });

  it('rejects when the per-symbol daily buy cap is hit', () => {
    const result = runRiskChecks(makeRiskInput({ buysTodayForSymbol: 1 }));
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'frequency_caps').ok).toBe(false);
  });

  it('rejects when the weekly buy cap is hit', () => {
    const result = runRiskChecks(makeRiskInput({ buysThisWeek: 2 }));
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'frequency_caps').ok).toBe(false);
  });
});

describe('runRiskChecks — capital limits', () => {
  it('rejects a buy that would breach the hard account cap', () => {
    // Already deployed $49.50; a $12.50 tranche would push past the $50 cap.
    const positions = [makePosition({ qty: 0.0825, avgCost: 600, costBasis: 49.5 })];
    const result = runRiskChecks(makeRiskInput({ positions }));
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'hard_account_cap').ok).toBe(false);
  });

  it('respects deployedCostBasis aggregation', () => {
    const positions = [
      makePosition({ symbol: 'SPY', costBasis: 20 }),
      makePosition({ symbol: 'QQQ', costBasis: 15 }),
    ];
    expect(deployedCostBasis(positions)).toBeCloseTo(35);
  });

  it('rejects a buy that would dip below the cash reserve', () => {
    const result = runRiskChecks(
      makeRiskInput({ account: makeAccount({ cash: 15, equity: 100_000, lastEquity: 100_000 }) }),
    );
    // cash 15 - 12.48 = 2.52 < reserve 10
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'cash_reserve').ok).toBe(false);
  });
});

describe('runRiskChecks — daily loss circuit breaker', () => {
  it('trips the kill switch when today P&L breaches the limit', () => {
    const result = runRiskChecks(
      makeRiskInput({ account: makeAccount({ equity: 99_994, lastEquity: 100_000 }) }),
    );
    expect(result.ok).toBe(false);
    expect(check(result.checks, 'daily_loss_limit').ok).toBe(false);
    expect(result.tripKillSwitch).toBe(true);
  });

  it('does not trip on a small drawdown within the limit', () => {
    const result = runRiskChecks(
      makeRiskInput({ account: makeAccount({ equity: 99_998, lastEquity: 100_000 }) }),
    );
    expect(result.ok).toBe(true);
    expect(result.tripKillSwitch).toBe(false);
  });
});

describe('runRiskChecks — sell orders', () => {
  it('treats buy-only caps as n/a for sells but still enforces hard guards', () => {
    // A sell with maxed frequency/hard-cap should still pass those (n/a)…
    const positions = [makePosition({ costBasis: 49.5 })];
    const sell = makeOrder({ side: 'sell', reason: 'stop_loss', qty: 0.02, limitPrice: 540 });
    const result = runRiskChecks(
      makeRiskInput({ order: sell, positions, buysTodayForSymbol: 9, buysThisWeek: 9 }),
    );
    expect(check(result.checks, 'frequency_caps').ok).toBe(true);
    expect(check(result.checks, 'hard_account_cap').ok).toBe(true);
    expect(check(result.checks, 'position_size_cap').ok).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('still blocks a sell when the kill switch is on', () => {
    const sell = makeOrder({ side: 'sell', reason: 'stop_loss' });
    const result = runRiskChecks(
      makeRiskInput({ order: sell, config: makeConfig({ killSwitch: true }) }),
    );
    expect(result.ok).toBe(false);
  });
});
