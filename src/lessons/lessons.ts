import type { ScenarioName } from '../sim/types';

// ---------------------------------------------------------------------------
// Curriculum content for the Learn skill tree. Modules 1–2 here; later modules
// land in subsequent passes. Each lesson is a small card stack: concept →
// plain-English explanation → "see it live" on the Book → a check question.
// ---------------------------------------------------------------------------

export type CheckQuestion = {
  q: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  /** Shown after answering, explaining why. */
  why: string;
};

export type SeeItLive = {
  /** Load this scenario on the Book when the learner taps "see it live". */
  scenario?: ScenarioName;
  /** Auto-open the Explain coach popover for this glossary term. */
  term?: string;
  /** One line telling the learner what to look for. */
  hint: string;
};

export type Lesson = {
  id: string;
  module: number;
  title: string;
  /** A short hook shown on the first card. */
  concept: string;
  /** The plain-English teaching, one or more short paragraphs. */
  explanation: string[];
  seeItLive?: SeeItLive;
  questions: CheckQuestion[];
  /** Badge awarded the first time this lesson is completed, if any. */
  badge?: string;
};

export type ModuleMeta = { module: number; title: string; subtitle: string };

export const MODULES: ModuleMeta[] = [
  { module: 1, title: 'Module 1', subtitle: 'Foundations' },
  { module: 2, title: 'Module 2', subtitle: 'Reading the Ladder' },
];

export const LESSONS: Lesson[] = [
  // -- Module 1: Foundations ------------------------------------------------
  {
    id: 'm1-what-is-l2',
    module: 1,
    title: 'What is Level 2?',
    concept: 'The order book shows the supply and demand behind the last price.',
    explanation: [
      'Level 1 shows you only the best bid, the best ask, and the last traded price — the surface.',
      'Level 2 shows the depth behind them: all the resting buy and sell orders waiting at each price level. It is the real-time map of supply and demand that the price is moving through.',
      'On the Book tab, the ladder in the middle is the Level 2 view — bids on the left, asks on the right, several price levels deep on each side.',
    ],
    seeItLive: {
      scenario: 'calm',
      hint: 'Look at the ladder: each row is a price with resting orders waiting there.',
    },
    questions: [
      {
        q: 'What does Level 2 add over Level 1?',
        options: [
          'The depth of resting orders at many price levels',
          'A faster internet connection',
          'A guaranteed profit signal',
        ],
        answer: 0,
        why: 'Level 2 reveals the resting orders stacked behind the best bid/ask — the depth of supply and demand. Level 1 only shows the top.',
      },
    ],
  },
  {
    id: 'm1-bid-ask',
    module: 1,
    title: 'Bid vs. Ask',
    concept: 'Bid = highest price buyers will pay. Ask = lowest price sellers will accept.',
    explanation: [
      'The bid is the highest price someone is currently willing to buy at. The ask (or offer) is the lowest price someone is willing to sell at.',
      'As a trader you generally buy at the ask and sell at the bid. That small difference is a real cost every time you enter and exit.',
      'On the Book, bids are green on the left, asks are red on the right, with the best of each at the top of the ladder.',
    ],
    seeItLive: {
      scenario: 'calm',
      term: 'bestBid',
      hint: 'The Best Bid (green) and Best Ask (red) sit at the top of the header.',
    },
    questions: [
      {
        q: 'You place a market order to BUY. Which price do you generally get?',
        options: ['The bid', 'The ask', 'The midpoint, always'],
        answer: 1,
        why: 'Buyers lift the ask (the lowest price a seller will accept). Sellers hit the bid. That gap between them is the spread.',
      },
    ],
  },
  {
    id: 'm1-spread',
    module: 1,
    title: 'The Spread',
    concept: 'The gap between bid and ask is your cost of admission.',
    explanation: [
      'The spread is the distance between the best bid and the best ask.',
      'A tight spread (a penny or two) means the stock is liquid and cheap to trade — you lose little crossing it. A wide spread means it is illiquid: just entering and exiting costs you more.',
      'When learning, favor names with tight spreads. The spread quietly taxes every round trip.',
    ],
    seeItLive: {
      scenario: 'thinning',
      term: 'spread',
      hint: 'Watch the Spread box. In thinning liquidity it widens and gets jumpy.',
    },
    questions: [
      {
        q: 'A wider spread generally means…',
        options: [
          'The stock is more liquid and cheaper to trade',
          'The stock is less liquid and costs more to enter/exit',
          'Nothing — spread does not affect cost',
        ],
        answer: 1,
        why: 'A wide spread signals thin liquidity. You buy higher and sell lower, so each round trip costs more before the price even moves.',
      },
    ],
    badge: 'Spread Reader',
  },
  {
    id: 'm1-size-depth',
    module: 1,
    title: 'Size / Depth',
    concept: 'Size is how many shares are resting at a price.',
    explanation: [
      'Each row in the ladder shows a price and the number of shares resting there — its size.',
      'Big sizes mean a lot of interest is parked at that level; it takes real volume to push price through it. Thin sizes mean price can move through easily.',
      'The shaded bar behind each row scales with its size, so you can read depth at a glance.',
    ],
    seeItLive: {
      scenario: 'calm',
      term: 'size',
      hint: 'Compare the size numbers and the depth bars behind each ladder row.',
    },
    questions: [
      {
        q: 'A price level with very large resting size tends to…',
        options: [
          'Let price slip through instantly',
          'Resist price moving through it until that size is consumed',
          'Have no effect on price',
        ],
        answer: 1,
        why: 'Large size is a lot of shares to trade through. Price has to absorb all of it to move past that level, so big sizes act as friction.',
      },
    ],
  },
  {
    id: 'm1-last-next',
    module: 1,
    title: 'Last price ≠ next price',
    concept: 'The book is the cause; the chart is the effect.',
    explanation: [
      'The last traded price is history. The next price depends on what happens in the book — which resting orders get filled and how the book shifts.',
      'When buyers lift all the size at the best ask, that ask disappears and the next ask up becomes the new best — price has moved. The book is the cause; the chart is the effect.',
      'Reading the book is reading the next move forming, before it prints on the chart.',
    ],
    seeItLive: {
      scenario: 'momentum',
      term: 'lastPrint',
      hint: 'Watch asks get eaten and the price climb level by level as buyers lift offers.',
    },
    questions: [
      {
        q: 'Price moves up on the book when…',
        options: [
          'The clock ticks forward',
          'Buyers consume the resting size at the ask and the next level becomes best',
          'The spread is wide',
        ],
        answer: 1,
        why: 'Price is not on a timer. It moves when resting orders fill and the best bid/ask shift — the book is the cause of the chart.',
      },
    ],
  },

  // -- Module 2: Reading the Ladder ----------------------------------------
  {
    id: 'm2-cumulative-depth',
    module: 2,
    title: 'Cumulative Depth (the V-shape)',
    concept: 'Stack up the resting size to see who is leaning harder.',
    explanation: [
      'The depth chart adds up resting size as you move away from the spread — green bids stepping down on the left, red asks stepping up on the right, forming a V.',
      'A roughly symmetric V means buyers and sellers are balanced. A lopsided V — much more green than red, or vice versa — hints at an imbalance in resting interest.',
      'It is a hint, not a guarantee: resting orders can be pulled. But it is a fast way to read the lean.',
    ],
    seeItLive: {
      scenario: 'calm',
      term: 'depth',
      hint: 'Watch the V-shape. Notice when one side stacks deeper than the other.',
    },
    questions: [
      {
        q: 'A depth V that is much deeper green on the left suggests…',
        options: [
          'More resting buy interest than sell interest',
          'The stock is halted',
          'The spread must be wide',
        ],
        answer: 0,
        why: 'A deeper green (bid) side means more resting demand than supply — a lean toward buyers. Treat it as a hint, since orders can be cancelled.',
      },
    ],
  },
  {
    id: 'm2-thinning',
    module: 2,
    title: 'Thinning Liquidity',
    concept: 'When depth drains away, price gaps on small orders.',
    explanation: [
      'When sizes below the top level shrink, there is little to absorb incoming orders. A modest market order can then skip several price levels at once.',
      'Thin books move fast and jump in larger steps. The same order size that barely budges a deep book can rip through a thin one.',
      'This is why liquidity matters: in thin conditions, your entries, exits, and stops can all slip.',
    ],
    seeItLive: {
      scenario: 'thinning',
      hint: 'See how small the sizes get below the top — and how jumpy the price becomes.',
    },
    questions: [
      {
        q: 'In a thin book, a modest market order is likely to…',
        options: [
          'Fill entirely at the best price',
          'Walk through several levels and move price more',
          'Be rejected automatically',
        ],
        answer: 1,
        why: 'With little resting size, the order eats past the top level into worse prices — it walks the book and moves price more than it would in a deep one.',
      },
    ],
  },
  {
    id: 'm2-walls',
    module: 2,
    title: 'Walls',
    concept: 'An oversized level can act as support or resistance — or be bait.',
    explanation: [
      'A wall is a single resting level far larger than its neighbors. A big bid can act as support (price must chew through it to fall); a big ask as resistance.',
      'But walls are not promises. A genuine wall absorbs trades and holds. A fake one is pulled the moment price approaches — bait to scare or lure other traders.',
      'The test is behavior: does the wall actually get hit and hold, or does it vanish? Watch, do not assume.',
    ],
    seeItLive: {
      scenario: 'wall',
      term: 'wall',
      hint: 'Spot the oversized bid a few levels down. Does it hold as price approaches?',
    },
    questions: [
      {
        q: 'A large bid wall is most trustworthy as support when…',
        options: [
          'It is the biggest number on the screen',
          'It actually absorbs trades and stays as price tests it',
          'It appears and disappears repeatedly',
        ],
        answer: 1,
        why: 'Size alone proves nothing — orders can be cancelled. A wall earns trust by getting hit and holding. One that flickers in and out is likely bait.',
      },
    ],
    badge: 'Wall Spotter',
  },
  {
    id: 'm2-imbalance',
    module: 2,
    title: 'Reading Imbalance',
    concept: 'Far more size on one side is a hint — only a hint.',
    explanation: [
      'When the bid side holds far more resting size than the ask side (or vice versa), it suggests pressure building in that direction.',
      'But it is only a hint. Resting orders can be cancelled in an instant, and big players sometimes show size precisely to mislead.',
      'Use imbalance as one input. Confirm it with the tape — actual executions — before you trust it.',
    ],
    seeItLive: {
      scenario: 'absorption',
      term: 'depth',
      hint: 'A heavy bid keeps refilling while the tape prints red — imbalance plus absorption.',
    },
    questions: [
      {
        q: 'A strong bid/ask imbalance should be treated as…',
        options: [
          'A guaranteed direction',
          'A hint to confirm with the tape',
          'Irrelevant noise',
        ],
        answer: 1,
        why: 'Imbalance hints at pressure, but resting size can vanish or be a decoy. Confirm with actual executions on the tape before trusting it.',
      },
    ],
  },
];

export function lessonById(id: string) {
  return LESSONS.find((l) => l.id === id);
}

/** A lesson is unlocked if it is first, or the previous lesson is completed. */
export function isLessonUnlocked(id: string, completed: string[]): boolean {
  const idx = LESSONS.findIndex((l) => l.id === id);
  if (idx <= 0) return true;
  return completed.includes(LESSONS[idx - 1].id);
}

export function nextLessonId(id: string): string | null {
  const idx = LESSONS.findIndex((l) => l.id === id);
  if (idx < 0 || idx + 1 >= LESSONS.length) return null;
  return LESSONS[idx + 1].id;
}
