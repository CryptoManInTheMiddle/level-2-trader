import { SCENARIOS, SCENARIO_ORDER } from '../../sim/scenarios';
import type { ScenarioName } from '../../sim/types';

// Horizontal chip row to load a market condition into the book.
export function ScenarioSelector({
  value,
  onChange,
}: {
  value: ScenarioName;
  onChange: (s: ScenarioName) => void;
}) {
  return (
    <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {SCENARIO_ORDER.map((name) => {
        const cfg = SCENARIOS[name];
        const on = name === value;
        return (
          <button
            key={name}
            onClick={() => onChange(name)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              on
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-surface text-muted'
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
