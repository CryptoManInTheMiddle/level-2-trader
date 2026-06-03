import type { Print } from '../../sim/types';
import * as fmt from '../../lib/format';
import { Explainable } from '../Explainable';

// Time & Sales — a scrolling feed of executed prints. Green lifted the ask
// (buyers aggressive), red hit the bid (sellers aggressive). Block prints get
// a marker. Newest on top.
export function TapePanel({ tape }: { tape: Print[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Explainable term="tape">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
            Time &amp; Sales
          </span>
          <span className="text-[10px] text-muted">the tape</span>
        </div>
      </Explainable>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tape.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted">Waiting for prints…</div>
        )}
        {tape.map((p, i) => (
          <div
            key={`${p.ts}-${i}`}
            className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-[3px] font-mono text-[12px] ${
              i === 0 ? 'bg-white/[0.02]' : ''
            }`}
          >
            <span className="text-muted">{fmt.clockTime(p.ts)}</span>
            <span className={`text-right tabular-nums ${p.side === 'buy' ? 'text-bid' : 'text-ask'}`}>
              {fmt.size(p.size)}
              {p.block && <span className="ml-1 text-violet">◆</span>}
            </span>
            <span
              className={`w-12 text-right font-semibold ${
                p.side === 'buy' ? 'text-bid' : 'text-ask'
              }`}
            >
              {fmt.price(p.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
