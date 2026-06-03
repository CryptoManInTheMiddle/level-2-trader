export type TabId = 'learn' | 'book' | 'drills' | 'practice' | 'progress';

type Item = { id: TabId; label: string; icon: JSX.Element };

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ITEMS: Item[] = [
  { id: 'learn', label: 'Learn', icon: <Icon d="M4 5h16M4 12h16M4 19h10" /> },
  { id: 'book', label: 'Book', icon: <Icon d="M4 6h7v12H4zM13 6h7v12h-7M4 10h7M13 14h7" /> },
  { id: 'drills', label: 'Drills', icon: <Icon d="M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 100 8 4 4 0 000-8z" /> },
  { id: 'practice', label: 'Practice', icon: <Icon d="M3 17l6-6 4 4 7-7M21 8v5h-5" /> },
  { id: 'progress', label: 'Progress', icon: <Icon d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L6 22l2-7L2.5 9H10z" /> },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-stretch border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
              on ? 'text-accent' : 'text-muted'
            }`}
            aria-current={on ? 'page' : undefined}
          >
            <span className={on ? 'scale-110 transition-transform' : 'transition-transform'}>
              {item.icon}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
