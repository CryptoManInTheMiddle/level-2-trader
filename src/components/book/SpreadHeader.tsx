import type { BookState } from '../../sim/types';
import * as fmt from '../../lib/format';
import { Explainable } from '../Explainable';

// Best Bid · Spread · Best Ask, plus symbol and last print. The top-line read.
export function SpreadHeader({ book }: { book: BookState }) {
  const bestBid = book.bids[0];
  const bestAsk = book.asks[0];
  const spread = bestAsk.price - bestBid.price;
  const spreadBps = (spread / book.midPrice) * 10000;
  const last = book.lastPrint;

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">{book.symbol}</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
            Sim
          </span>
        </div>
        <Explainable term="lastPrint">
          <div className="text-right">
            <div
              className={`font-mono text-sm font-semibold ${
                last?.side === 'buy' ? 'text-bid' : last?.side === 'sell' ? 'text-ask' : 'text-ink'
              }`}
            >
              {last ? fmt.price(last.price) : fmt.price(book.midPrice)}
            </div>
            <div className="text-[9px] uppercase text-muted">Last</div>
          </div>
        </Explainable>
      </div>

      <div className="grid grid-cols-3 items-center gap-2">
        <Explainable term="bestBid" className="rounded-lg bg-bid/10 p-2">
          <div className="text-[9px] uppercase tracking-wide text-bid/80">Best Bid</div>
          <div className="font-mono text-lg font-bold text-bid">{fmt.price(bestBid.price)}</div>
          <div className="font-mono text-[11px] text-muted">{fmt.size(bestBid.size)}</div>
        </Explainable>

        <Explainable term="spread" className="rounded-lg bg-surface-2 p-2 text-center">
          <div className="text-[9px] uppercase tracking-wide text-muted">Spread</div>
          <div className="font-mono text-base font-bold text-ink">{fmt.price(spread)}</div>
          <div className="font-mono text-[10px] text-muted">{spreadBps.toFixed(1)} bps</div>
        </Explainable>

        <Explainable term="bestAsk" className="rounded-lg bg-ask/10 p-2 text-right">
          <div className="text-[9px] uppercase tracking-wide text-ask/80">Best Ask</div>
          <div className="font-mono text-lg font-bold text-ask">{fmt.price(bestAsk.price)}</div>
          <div className="font-mono text-[11px] text-muted">{fmt.size(bestAsk.size)}</div>
        </Explainable>
      </div>
    </div>
  );
}
