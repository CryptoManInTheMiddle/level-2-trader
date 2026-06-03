import { LESSONS, MODULES, isLessonUnlocked } from '../../lessons/lessons';
import { useProgressStore } from '../../store/progressStore';
import { useUiStore } from '../../store/uiStore';

// The vertical learning path. Lessons are grouped by module; each node shows
// completed / unlocked / locked state. Later lessons gate behind earlier ones.
export function SkillTree() {
  const completed = useProgressStore((s) => s.lessonsCompleted);
  const openLesson = useUiStore((s) => s.openLesson);

  const doneCount = completed.filter((id) => LESSONS.some((l) => l.id === id)).length;
  const pct = Math.round((doneCount / LESSONS.length) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-3">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-ink">Learn</h2>
        <p className="text-xs text-muted">
          Bite-sized lessons. Each one points at the live Book so you see it for real.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[11px] text-muted">
            {doneCount}/{LESSONS.length}
          </span>
        </div>
      </div>

      {MODULES.map((mod) => {
        const lessons = LESSONS.filter((l) => l.module === mod.module);
        return (
          <div key={mod.module} className="mb-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                {mod.title}
              </span>
              <span className="text-[11px] text-muted">{mod.subtitle}</span>
            </div>

            <div className="relative ml-3 border-l border-border pl-5">
              {lessons.map((lesson) => {
                const done = completed.includes(lesson.id);
                const unlocked = isLessonUnlocked(lesson.id, completed);
                return (
                  <button
                    key={lesson.id}
                    disabled={!unlocked && !done}
                    onClick={() => openLesson(lesson.id)}
                    className={`relative mb-2.5 block w-full rounded-xl border p-3 text-left transition ${
                      done
                        ? 'border-bid/40 bg-bid/5'
                        : unlocked
                          ? 'border-border bg-surface active:scale-[0.99]'
                          : 'border-border/50 bg-surface/40 opacity-55'
                    }`}
                  >
                    {/* node dot on the timeline */}
                    <span
                      className={`absolute -left-[27px] top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        done
                          ? 'border-bid bg-bid text-base'
                          : unlocked
                            ? 'border-accent bg-base'
                            : 'border-border bg-base'
                      }`}
                    >
                      {done && (
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={4}>
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{lesson.title}</span>
                      {!unlocked && !done ? (
                        <span className="text-xs text-muted">🔒</span>
                      ) : done ? (
                        <span className="text-[10px] font-medium uppercase text-bid">Done</span>
                      ) : (
                        <span className="text-[10px] font-medium uppercase text-accent">Start</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted">{lesson.concept}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="pb-4 pt-1 text-center text-[10px] text-muted">
        More modules (the Tape, traps, and putting it to work) are on the way.
      </p>
    </div>
  );
}
