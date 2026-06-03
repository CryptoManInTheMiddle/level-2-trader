import { useMemo } from 'react';
import type { Order } from '../../sim/types';
import * as fmt from '../../lib/format';
import { Explainable } from '../Explainable';

// The ladder: Bid Size | Bid Price | Ask Price | Ask Size, ~10 levels each side,
// monospaced and column-aligned, with a depth bar behind every row and a flash
// on size changes — the thing that makes it feel like real Level 2.
export function OrderBookLadder({ bids, asks }: { bids: Order[]; asks: Order[] }) {
  const maxSize = useMemo(
    () => Math.max(1, ...bids.map((b) => b.size), ...asks.map((a) => a.size)),
    [bids, asks],
  );
  const rows = Math.min(bids.length, asks.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-4 border-b border-border bg-surface-2 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        <Explainable term="size" className="text-left">Bid Size</Explainable>
        <Explainable term="bid" className="text-right">Bid</Explainable>
        <Explainable term="ask" className="text-left pl-2">Ask</Explainable>
        <Explainable term="size" className="text-right">Ask Size</Explainable>
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <LadderRow key={i} bid={bids[i]} ask={asks[i]} maxSize={maxSize} />
        ))}
      </div>
    </div>
  );
}

function LadderRow({ bid, ask, maxSize }: { bid: Order; ask: Order; maxSize: number }) {
  const bidPct = Math.min(100, (bid.size / maxSize) * 100);
  const askPct = Math.min(100, (ask.size / maxSize) * 100);

  return (
    <div className="grid grid-cols-4 items-stretch text-[13px] font-mono">
      {/* Bid size — depth bar grows from the right */}
      <Cell flash={bid.flash} flashKey={bid.size} align="left">
        <span
          className="absolute inset-y-0 right-0 bg-bid-dim"
          style={{ width: `${bidPct}%` }}
          aria-hidden
        />
        <span className="relative z-10 text-ink/90">{fmt.size(bid.size)}</span>
      </Cell>
      {/* Bid price */}
      <div className="flex items-center justify-end px-2 py-1 font-semibold text-bid">
        {fmt.price(bid.price)}
      </div>
      {/* Ask price */}
      <div className="flex items-center justify-start px-2 py-1 font-semibold text-ask">
        {fmt.price(ask.price)}
      </div>
      {/* Ask size — depth bar grows from the left */}
      <Cell flash={ask.flash} flashKey={ask.size} align="right">
        <span
          className="absolute inset-y-0 left-0 bg-ask-dim"
          style={{ width: `${askPct}%` }}
          aria-hidden
        />
        <span className="relative z-10 text-ink/90">{fmt.size(ask.size)}</span>
      </Cell>
    </div>
  );
}

function Cell({
  children,
  flash,
  flashKey,
  align,
}: {
  children: React.ReactNode;
  flash?: 'up' | 'down';
  flashKey: number;
  align: 'left' | 'right';
}) {
  // Key on the size value so the flash animation only re-triggers when the
  // size actually changes — not on every render.
  const anim = flash === 'up' ? 'animate-flashUp' : flash === 'down' ? 'animate-flashDown' : '';
  return (
    <div
      key={`${flash ?? 'none'}-${flashKey}`}
      className={`relative flex items-center px-2 py-1 ${
        align === 'left' ? 'justify-start' : 'justify-end'
      } ${anim}`}
    >
      {children}
    </div>
  );
}
