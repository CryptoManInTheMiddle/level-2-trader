// Short, plain-English definitions surfaced by Explain mode on the Book, and
// reusable anywhere a term needs a one-tap explainer.
export type GlossaryEntry = { term: string; title: string; body: string };

export const GLOSSARY: Record<string, GlossaryEntry> = {
  bid: {
    term: 'bid',
    title: 'Bid',
    body: 'The highest price buyers are currently willing to pay. You generally sell into the bid. Bigger bid size = more demand resting at that price.',
  },
  ask: {
    term: 'ask',
    title: 'Ask (Offer)',
    body: 'The lowest price sellers are currently willing to accept. You generally buy at the ask. Bigger ask size = more supply waiting there.',
  },
  spread: {
    term: 'spread',
    title: 'The Spread',
    body: 'The gap between the best bid and best ask. Tight spread = liquid and cheap to trade. Wide spread = illiquid; you lose more just entering and exiting.',
  },
  bestBid: {
    term: 'bestBid',
    title: 'Best Bid',
    body: 'The highest-priced buy order in the book right now, and the size resting there. This is what you would hit if you sold at market.',
  },
  bestAsk: {
    term: 'bestAsk',
    title: 'Best Ask',
    body: 'The lowest-priced sell order in the book right now, and the size resting there. This is what you would lift if you bought at market.',
  },
  size: {
    term: 'size',
    title: 'Size / Depth',
    body: 'The number of shares resting at a price. Large sizes mean lots of interest there; thin sizes mean price can move through that level easily.',
  },
  depth: {
    term: 'depth',
    title: 'Cumulative Depth',
    body: 'The V-shape adds up all resting size out from the spread — green bids on the left, red asks on the right. A lopsided V hints at an imbalance between buyers and sellers.',
  },
  tape: {
    term: 'tape',
    title: 'Time & Sales (the Tape)',
    body: 'A live feed of actual executions — price, size, time. Green prints lifted the ask (buyers aggressive); red prints hit the bid (sellers aggressive). The book is intentions; the tape is what really happened.',
  },
  wall: {
    term: 'wall',
    title: 'Wall',
    body: 'An oversized resting level that dwarfs its neighbors. A big bid can act as support, a big ask as resistance — but walls can be genuine or bait that vanishes. Watch whether it actually absorbs trades.',
  },
  mid: {
    term: 'mid',
    title: 'Mid Price',
    body: 'The midpoint between the best bid and best ask. A neutral reference point — note that you cannot usually trade exactly at the mid.',
  },
  lastPrint: {
    term: 'lastPrint',
    title: 'Last Print',
    body: 'The most recent execution. Last price is not next price — price moves when resting orders get filled and the book shifts.',
  },
};
