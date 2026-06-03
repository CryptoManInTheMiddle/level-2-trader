import { useEffect, useState } from 'react';
import { useMarketStore } from '../store/marketStore';
import { useUiStore } from '../store/uiStore';
import { SCENARIOS } from '../sim/scenarios';
import { ExplainProvider, useExplain } from '../components/ExplainProvider';
import { SpreadHeader } from '../components/book/SpreadHeader';
import { DepthChart } from '../components/book/DepthChart';
import { OrderBookLadder } from '../components/book/OrderBookLadder';
import { TapePanel } from '../components/book/TapePanel';
import { ScenarioSelector } from '../components/book/ScenarioSelector';
import { SpeedControl } from '../components/book/SpeedControl';
import { Explainable } from '../components/Explainable';

export function BookTab() {
  return (
    <ExplainProvider>
      <BookInner />
    </ExplainProvider>
  );
}

function BookInner() {
  const book = useMarketStore((s) => s.book);
  const scenario = useMarketStore((s) => s.scenario);
  const start = useMarketStore((s) => s.start);
  const stop = useMarketStore((s) => s.stop);
  const setScenario = useMarketStore((s) => s.setScenario);
  const speed = useMarketStore((s) => s.speed);
  const setSpeed = useMarketStore((s) => s.setSpeed);
  const { enabled, setEnabled, show } = useExplain();
  const [showExplainer, setShowExplainer] = useState(false);

  const bookFocus = useUiStore((s) => s.bookFocus);
  const clearBookFocus = useUiStore((s) => s.clearBookFocus);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // Apply a "see it live" deep-link from the Learn tab: load the scenario and
  // pop the relevant coach popover so the learner lands on exactly the thing
  // the lesson is about.
  useEffect(() => {
    if (!bookFocus) return;
    if (bookFocus.scenario) setScenario(bookFocus.scenario);
    if (bookFocus.term) {
      setEnabled(true);
      // Let the scenario settle a tick before opening the popover.
      const t = setTimeout(() => show(bookFocus.term!), 350);
      clearBookFocus();
      return () => clearTimeout(t);
    }
    clearBookFocus();
  }, [bookFocus, setScenario, setEnabled, show, clearBookFocus]);

  if (!book) {
    return <div className="flex h-full items-center justify-center text-muted">Booting market…</div>;
  }

  const cfg = SCENARIOS[scenario];

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-3 py-2">
      <ScenarioSelector value={scenario} onChange={setScenario} />

      <SpeedControl speed={speed} onChange={setSpeed} />

      {/* Explain mode toggle + scenario explainer */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            enabled ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface text-muted'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-accent' : 'bg-muted'}`} />
          Explain {enabled ? 'on' : 'off'}
        </button>
        <button
          onClick={() => setShowExplainer((v) => !v)}
          className="flex-1 truncate rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-muted"
        >
          {cfg.blurb}
        </button>
      </div>

      {showExplainer && (
        <div className="rounded-xl border border-violet/30 bg-violet/10 p-3 text-xs leading-relaxed text-ink/90">
          <div className="mb-1 font-semibold text-violet">{cfg.label} — what's really happening</div>
          {cfg.explainer}
        </div>
      )}

      <SpreadHeader book={book} />

      <Explainable term="depth" className="rounded-xl border border-border bg-surface p-2">
        <div className="mb-1 px-1 text-[10px] uppercase tracking-wide text-muted">
          Cumulative Depth
        </div>
        <DepthChart bids={book.bids} asks={book.asks} />
      </Explainable>

      <OrderBookLadder bids={book.bids} asks={book.asks} />

      <div className="flex min-h-[160px] flex-col">
        <TapePanel tape={book.tape} />
      </div>

      <p className="pb-2 pt-1 text-center text-[10px] text-muted">
        All prices, sizes, and prints are randomly generated. Nothing here is a real market.
      </p>
    </div>
  );
}
