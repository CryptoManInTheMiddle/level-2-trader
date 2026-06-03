import { create } from 'zustand';
import { MarketEngine } from '../sim/engine';
import type { BookState, ScenarioName } from '../sim/types';

const TICK_MS = 450;

type MarketStore = {
  book: BookState | null;
  running: boolean;
  scenario: ScenarioName;
  start: () => void;
  stop: () => void;
  setScenario: (s: ScenarioName) => void;
  /** Read the live book without subscribing (used by the practice engine). */
  getEngine: () => MarketEngine;
};

// Single shared engine instance for the whole app.
let engine: MarketEngine | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;

function ensureEngine() {
  if (!engine) engine = new MarketEngine('calm');
  return engine;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  book: null,
  running: false,
  scenario: 'calm',

  start: () => {
    subscribers += 1;
    const eng = ensureEngine();
    if (!get().book) set({ book: eng.snapshot() });
    if (timer) return;
    set({ running: true });
    timer = setInterval(() => {
      set({ book: ensureEngine().tick() });
    }, TICK_MS);
  },

  stop: () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0 && timer) {
      clearInterval(timer);
      timer = null;
      set({ running: false });
    }
  },

  setScenario: (s) => {
    const eng = ensureEngine();
    eng.setScenario(s);
    set({ scenario: s, book: eng.snapshot() });
  },

  getEngine: () => ensureEngine(),
}));
