import type { ScenarioConfig, ScenarioName } from './types';

// ---------------------------------------------------------------------------
// Tunable parameter sets the Book and Drills load. Each one is a recognizable
// market condition. Numbers are chosen to *feel* right on a phone screen, not
// to model any specific real instrument.
// ---------------------------------------------------------------------------

export const SCENARIOS: Record<ScenarioName, ScenarioConfig> = {
  calm: {
    name: 'calm',
    label: 'Calm / Balanced',
    blurb: 'Tight spread, even depth, gentle drift.',
    explainer:
      'A liquid, orderly market. The spread is one tick, depth is roughly even on both sides, and the price drifts gently. This is the easiest book to read — and the kind you want to learn on.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 1400,
    volatility: 0.55,
    drift: 0,
    tradeRate: 0.6,
    spreadTicks: 1,
  },
  thinning: {
    name: 'thinning',
    label: 'Thinning Liquidity',
    blurb: 'Sizes shrink below the top; price gets jumpy.',
    explainer:
      'Resting size is draining away, especially below the best levels. With little depth to absorb orders, even a modest market order can gap the price several ticks. Thin books move fast — respect them.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 700,
    volatility: 1.3,
    drift: 0,
    tradeRate: 0.55,
    spreadTicks: 2,
  },
  wall: {
    name: 'wall',
    label: 'Buy Wall',
    blurb: 'One oversized level acts as support.',
    explainer:
      'A single huge resting bid sits a few levels down, dwarfing everything around it — a "wall." It can act as support because price has to chew through all that size to fall past it. But walls can be genuine demand or bait that vanishes; watch whether it actually absorbs trades.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 1100,
    volatility: 0.7,
    drift: 0,
    tradeRate: 0.6,
    spreadTicks: 1,
  },
  spoof: {
    name: 'spoof',
    label: 'Spoof',
    blurb: 'A big order appears, then vanishes before filling.',
    explainer:
      'A large order repeatedly flashes onto one side, then disappears before any of it trades. That is the tell of spoofing — fake size meant to scare or lure other traders. It is illegal, but it happens. The lesson: an order is only real if it is willing to get filled.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 1000,
    volatility: 0.9,
    drift: 0,
    tradeRate: 0.55,
    spreadTicks: 1,
  },
  momentum: {
    name: 'momentum',
    label: 'Momentum Surge',
    blurb: 'Asks get lifted fast; tape goes green, price climbs.',
    explainer:
      'Buyers are aggressively lifting offers. The tape floods green, ask levels get eaten one after another, and price climbs through the book. This is a breakout in microstructure terms — real buying pressure overwhelming resting supply.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 1000,
    volatility: 1.1,
    drift: 0.9,
    tradeRate: 0.92,
    spreadTicks: 1,
  },
  absorption: {
    name: 'absorption',
    label: 'Absorption',
    blurb: 'A big bid keeps getting hit but does not drop.',
    explainer:
      'Sellers keep hitting a large resting bid, the tape prints red — yet the bid refills and price refuses to fall. Someone is absorbing all that supply, a strong-hand buyer quietly accumulating. When the selling exhausts, price often snaps up.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 1200,
    volatility: 0.8,
    drift: 0,
    tradeRate: 0.8,
    spreadTicks: 1,
  },
  halt: {
    name: 'halt',
    label: 'Halt / Gap',
    blurb: 'Sudden gap — shows why stops slip.',
    explainer:
      'The book freezes and then re-opens at a gapped price. In a real halt, resting orders far from the new price get blown through instantly. This is why a stop order is not a guaranteed exit price — in fast or halted markets it can fill far worse than you hoped.',
    tickSize: 0.01,
    levels: 10,
    baseSize: 900,
    volatility: 2.2,
    drift: -1.4,
    tradeRate: 0.4,
    spreadTicks: 4,
  },
};

export const SCENARIO_ORDER: ScenarioName[] = [
  'calm',
  'thinning',
  'wall',
  'spoof',
  'momentum',
  'absorption',
  'halt',
];
