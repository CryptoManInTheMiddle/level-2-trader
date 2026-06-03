import type { ReactNode } from 'react';
import { useExplain } from './ExplainProvider';

// Wraps a Book element so that, when Explain mode is on, tapping it opens the
// coach popover for the given glossary term. When off, it is inert.
export function Explainable({
  term,
  children,
  className = '',
}: {
  term: string;
  children: ReactNode;
  className?: string;
}) {
  const { enabled, show } = useExplain();

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <button
      type="button"
      onClick={() => show(term)}
      className={`relative text-left ring-accent/60 transition hover:ring-1 ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent/70" />
    </button>
  );
}
