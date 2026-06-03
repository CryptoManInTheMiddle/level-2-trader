import { create } from 'zustand';
import { MarketEngine } from '../sim/engine';
import type { BookState, ScenarioName } from '../sim/types';

// Clamp the effective delay so a high speed multiplier can't peg the CPU.
const MIN_DELAY_MS = 30;
const MAX_DELAY_MS = 8000;

type MarketStore = {
  book: BookState | null;
  running: boolean;
  scenario: ScenarioName;
  /** User-facing speed multiplier. 1 = the scenario's natural pace. */
  speed: number;
  start: () => void;
  stop: () => void;
  setScenario: (s: ScenarioName) => void;
  setSpeed: (s: number) => void;
  /** Read the live engine without subscribing (used by the practice engine). */
  getEngine: () => MarketEngine;
};

// Single shared engine instance for the whole app.
let engine: MarketEngine | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let subscribers = 0;
let speed = 1;

function ensureEngine() {
  if (!engine) engine = new MarketEngine('calm');
  return engine;
}

export const useMarketStore = create<MarketStore>((set, get) => {
  // Self-scheduling loop: each step asks the engine how long until the next
  // update (irregular + scenario-driven), scaled by the user's speed.
  const schedule = () => {
    const eng = ensureEngine();
    const delay = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, eng.nextDelayMs() / speed));
    timer = setTimeout(() => {
      set({ book: eng.tick() });
      schedule();
    }, delay);
  };

  return {
    book: null,
    running: false,
    scenario: 'calm',
    speed: 1,

    start: () => {
      subscribers += 1;
      const eng = ensureEngine();
      if (!get().book) set({ book: eng.snapshot() });
      if (timer) return;
      set({ running: true });
      schedule();
    },

    stop: () => {
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0 && timer) {
        clearTimeout(timer);
        timer = null;
        set({ running: false });
      }
    },

    setScenario: (s) => {
      const eng = ensureEngine();
      eng.setScenario(s);
      set({ scenario: s, book: eng.snapshot() });
    },

    setSpeed: (s) => {
      speed = s;
      set({ speed: s });
    },

    getEngine: () => ensureEngine(),
  };
});
