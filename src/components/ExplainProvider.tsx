import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { GLOSSARY } from '../lib/glossary';

type ExplainCtx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  show: (term: string) => void;
};

const Ctx = createContext<ExplainCtx | null>(null);

export function useExplain() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useExplain must be used inside ExplainProvider');
  return ctx;
}

export function ExplainProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [term, setTerm] = useState<string | null>(null);

  const show = (t: string) => {
    if (GLOSSARY[t]) setTerm(t);
  };

  const value = useMemo(() => ({ enabled, setEnabled, show }), [enabled]);
  const entry = term ? GLOSSARY[term] : null;

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {entry && (
          <motion.div
            className="absolute inset-0 z-30 flex items-end bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTerm(null)}
          >
            <motion.div
              className="w-full rounded-t-2xl border-t border-border bg-surface-2 p-5"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <h3 className="mb-1.5 text-base font-semibold text-ink">{entry.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{entry.body}</p>
              <button
                onClick={() => setTerm(null)}
                className="mt-4 w-full rounded-xl bg-accent/15 py-2.5 text-sm font-medium text-accent"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
