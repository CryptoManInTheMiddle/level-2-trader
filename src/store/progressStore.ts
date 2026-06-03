import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Persistent learner progress. Mirrors the Section 8 data model. Stored in
// localStorage — no backend, no accounts. Paper balance is SIMULATED.
// ---------------------------------------------------------------------------

export type PaperTrade = {
  ts: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  shares: number;
  price: number;
  note: string;
};

export type Progress = {
  xp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string;
  lessonsCompleted: string[];
  badges: string[];
  drillStats: { attempts: number; correct: number };
  paper: {
    cash: number;
    position: { shares: number; avgCost: number } | null;
    realizedPnl: number;
    tradeLog: PaperTrade[];
  };
  settings: { explainMode: boolean; reduceMotion: boolean };
};

const STORAGE_KEY = 'l2t.progress.v1';
const STARTING_CASH = 1000;

export function xpForLevel(level: number) {
  // Gentle ramp: level n requires 100 * n*(n-1)/2 total-ish.
  return 120 * level;
}

export function levelForXp(xp: number) {
  let level = 1;
  let acc = 0;
  while (acc + xpForLevel(level) <= xp) {
    acc += xpForLevel(level);
    level += 1;
  }
  return level;
}

const defaultProgress: Progress = {
  xp: 0,
  level: 1,
  streakDays: 0,
  lastActiveDate: '',
  lessonsCompleted: [],
  badges: [],
  drillStats: { attempts: 0, correct: 0 },
  paper: {
    cash: STARTING_CASH,
    position: null,
    realizedPnl: 0,
    tradeLog: [],
  },
  settings: { explainMode: true, reduceMotion: false },
};

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultProgress };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      ...defaultProgress,
      ...parsed,
      paper: { ...defaultProgress.paper, ...parsed.paper },
      settings: { ...defaultProgress.settings, ...parsed.settings },
      drillStats: { ...defaultProgress.drillStats, ...parsed.drillStats },
    };
  } catch {
    return { ...defaultProgress };
  }
}

function persist(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable in private mode — fail silently */
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type ProgressStore = Progress & {
  addXp: (amount: number) => void;
  completeLesson: (id: string) => void;
  awardBadge: (id: string) => void;
  recordDrill: (correct: boolean) => void;
  setSetting: <K extends keyof Progress['settings']>(
    key: K,
    value: Progress['settings'][K],
  ) => void;
  touchStreak: () => void;
  reset: () => void;
};

export const useProgressStore = create<ProgressStore>((set) => {
  const initial = load();

  const update = (mutator: (p: Progress) => Progress) => {
    set((state) => {
      const current: Progress = {
        xp: state.xp,
        level: state.level,
        streakDays: state.streakDays,
        lastActiveDate: state.lastActiveDate,
        lessonsCompleted: state.lessonsCompleted,
        badges: state.badges,
        drillStats: state.drillStats,
        paper: state.paper,
        settings: state.settings,
      };
      const next = mutator(current);
      next.level = levelForXp(next.xp);
      persist(next);
      return next;
    });
  };

  return {
    ...initial,

    addXp: (amount) => update((p) => ({ ...p, xp: p.xp + amount })),

    completeLesson: (id) =>
      update((p) =>
        p.lessonsCompleted.includes(id)
          ? p
          : { ...p, lessonsCompleted: [...p.lessonsCompleted, id], xp: p.xp + 25 },
      ),

    awardBadge: (id) =>
      update((p) =>
        p.badges.includes(id) ? p : { ...p, badges: [...p.badges, id] },
      ),

    recordDrill: (correct) =>
      update((p) => ({
        ...p,
        xp: p.xp + (correct ? 15 : 0),
        drillStats: {
          attempts: p.drillStats.attempts + 1,
          correct: p.drillStats.correct + (correct ? 1 : 0),
        },
      })),

    setSetting: (key, value) =>
      update((p) => ({ ...p, settings: { ...p.settings, [key]: value } })),

    touchStreak: () =>
      update((p) => {
        const today = todayStr();
        if (p.lastActiveDate === today) return p;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const streakDays = p.lastActiveDate === yesterday ? p.streakDays + 1 : 1;
        return { ...p, lastActiveDate: today, streakDays };
      }),

    reset: () => {
      persist({ ...defaultProgress });
      set({ ...defaultProgress });
    },
  };
});
