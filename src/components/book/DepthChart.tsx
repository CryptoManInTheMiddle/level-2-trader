import { useMemo } from 'react';
import type { Order } from '../../sim/types';

// Cumulative depth "V-shape": green bids stepping down on the left, red asks
// stepping up on the right. Drawn as two filled SVG step-areas.
export function DepthChart({ bids, asks }: { bids: Order[]; asks: Order[] }) {
  const W = 320;
  const H = 72;
  const mid = W / 2;

  const { bidPath, askPath, maxCum } = useMemo(() => {
    let acc = 0;
    const bidCum = bids.map((b) => (acc += b.size));
    acc = 0;
    const askCum = asks.map((a) => (acc += a.size));
    const max = Math.max(1, bidCum[bidCum.length - 1] ?? 1, askCum[askCum.length - 1] ?? 1);

    const stepW = mid / Math.max(1, bids.length);

    // Bids: start at mid, step left and down (area to baseline).
    let bp = `M ${mid} ${H} L ${mid} ${H}`;
    bidCum.forEach((c, i) => {
      const x = mid - (i + 1) * stepW;
      const y = H - (c / max) * H;
      bp += ` L ${mid - i * stepW} ${y} L ${x} ${y}`;
    });
    bp += ` L ${mid - bids.length * stepW} ${H} Z`;

    let ap = `M ${mid} ${H} L ${mid} ${H}`;
    askCum.forEach((c, i) => {
      const x = mid + (i + 1) * stepW;
      const y = H - (c / max) * H;
      ap += ` L ${mid + i * stepW} ${y} L ${x} ${y}`;
    });
    ap += ` L ${mid + asks.length * stepW} ${H} Z`;

    return { bidPath: bp, askPath: ap, maxCum: max };
  }, [bids, asks]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16C784" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#16C784" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EA3943" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#EA3943" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={bidPath} fill="url(#bidGrad)" stroke="#16C784" strokeWidth={1} />
      <path d={askPath} fill="url(#askGrad)" stroke="#EA3943" strokeWidth={1} />
      <line x1={mid} y1={0} x2={mid} y2={H} stroke="#252D38" strokeWidth={1} strokeDasharray="2 3" />
      <title>Cumulative depth, peak {Math.round(maxCum).toLocaleString()} shares</title>
    </svg>
  );
}
