# Level 2 Trainer

A mobile-first PWA that teaches you to read a Level 2 order book and the tape
(time & sales) on a **live, fully simulated** market. No real money, no
brokerage, no external data — everything is generated locally so it's safe to
learn on.

> ⚠️ **Education only.** All prices, sizes, and prints are randomly generated.
> This app is **not** trading advice and **not** a brokerage.

## Stack
React + Vite + TypeScript · Tailwind CSS · Zustand · Framer Motion · PWA
(installable, offline-capable).

## Run it
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## What's built so far
- **Scaffold**: dark trading-terminal design system, 5-tab bottom nav
  (Learn · Book · Drills · Practice · Progress), persistent simulated-data
  disclaimer, PWA manifest + service worker + icons.
- **Simulation engine** (`src/sim/`): a self-contained generator of a
  believable book + tape. Random-walks the mid, churns resting size so cells
  flash like real L2, fires market orders that print to the tape, and layers
  on seven scenarios (calm, thinning, wall, spoof, momentum, absorption,
  halt).
- **Book tab**: best bid/ask + spread header, cumulative-depth V-chart,
  10-level ladder with depth bars and green/red flash on size changes, the
  tape, an Explain-mode coach (tap any element for a definition), and a
  scenario selector.

Learn, Drills, and Practice tabs are scaffolded placeholders — next up.

## Project layout
- `src/sim/` — simulation engine, scenario configs, domain types
- `src/store/` — Zustand stores (market loop, persisted progress)
- `src/components/book/` — order book UI (ladder, depth chart, tape, header)
- `src/tabs/` — the five screens
