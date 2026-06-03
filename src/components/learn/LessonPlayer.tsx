import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { lessonById, nextLessonId, type Lesson } from '../../lessons/lessons';
import { useProgressStore } from '../../store/progressStore';
import { useUiStore } from '../../store/uiStore';

type Step =
  | { type: 'concept' }
  | { type: 'explanation' }
  | { type: 'live' }
  | { type: 'question'; qi: number }
  | { type: 'done' };

function buildSteps(lesson: Lesson): Step[] {
  return [
    { type: 'concept' },
    { type: 'explanation' },
    ...(lesson.seeItLive ? [{ type: 'live' as const }] : []),
    ...lesson.questions.map((_, qi) => ({ type: 'question' as const, qi })),
    { type: 'done' },
  ];
}

// A swipeable card stack for a single lesson: concept → explanation → "see it
// live" on the Book → check question(s) → completion. Step lives in the UI
// store so a "see it live" detour to the Book resumes right where you left off.
export function LessonPlayer({ onJumpToBook }: { onJumpToBook: () => void }) {
  const activeLessonId = useUiStore((s) => s.activeLessonId);
  const step = useUiStore((s) => s.lessonStep);
  const setStep = useUiStore((s) => s.setLessonStep);
  const closeLesson = useUiStore((s) => s.closeLesson);
  const focusBook = useUiStore((s) => s.focusBook);
  const openLesson = useUiStore((s) => s.openLesson);

  const completeLesson = useProgressStore((s) => s.completeLesson);
  const awardBadge = useProgressStore((s) => s.awardBadge);
  const alreadyDone = useProgressStore((s) =>
    activeLessonId ? s.lessonsCompleted.includes(activeLessonId) : false,
  );

  const lesson = activeLessonId ? lessonById(activeLessonId) : undefined;
  const steps = useMemo(() => (lesson ? buildSteps(lesson) : []), [lesson]);

  // Selected answers per question index (local; reset when lesson changes).
  const [answers, setAnswers] = useState<Record<number, number>>({});

  if (!lesson) return null;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const goNext = () => {
    if (current.type === 'done') return;
    setStep(Math.min(step + 1, steps.length - 1));
  };
  const goBack = () => {
    if (step === 0) closeLesson();
    else setStep(step - 1);
  };

  const finish = () => {
    completeLesson(lesson.id);
    if (lesson.badge) awardBadge(lesson.badge);
  };

  const canAdvance =
    current.type !== 'question' || answers[current.qi] !== undefined;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <button onClick={goBack} className="text-muted" aria-label="Back">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wide text-accent">
            Module {lesson.module}
          </div>
          <div className="text-sm font-semibold text-ink">{lesson.title}</div>
        </div>
        <button onClick={closeLesson} className="text-xs text-muted">
          Close
        </button>
      </div>

      {/* progress dots */}
      <div className="flex gap-1 px-4 pb-3">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-accent' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>

      {/* card */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="h-full overflow-y-auto rounded-2xl border border-border bg-surface p-5"
          >
            {current.type === 'concept' && (
              <div>
                <div className="mb-3 text-3xl">💡</div>
                <h3 className="mb-2 text-xl font-bold text-ink">{lesson.title}</h3>
                <p className="text-base leading-relaxed text-ink/90">{lesson.concept}</p>
              </div>
            )}

            {current.type === 'explanation' && (
              <div className="space-y-3">
                {lesson.explanation.map((p, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-ink/90">
                    {p}
                  </p>
                ))}
              </div>
            )}

            {current.type === 'live' && lesson.seeItLive && (
              <div>
                <div className="mb-2 text-2xl">👀</div>
                <h3 className="mb-2 text-lg font-semibold text-ink">See it live</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted">{lesson.seeItLive.hint}</p>
                <button
                  onClick={() => {
                    focusBook({
                      scenario: lesson.seeItLive!.scenario,
                      term: lesson.seeItLive!.term,
                    });
                    onJumpToBook();
                  }}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-base"
                >
                  Open it on the Book →
                </button>
                <p className="mt-3 text-center text-[11px] text-muted">
                  Tap “Learn” when you’re done to come back and continue.
                </p>
              </div>
            )}

            {current.type === 'question' && (
              <QuestionCard
                lesson={lesson}
                qi={current.qi}
                selected={answers[current.qi]}
                onSelect={(opt) =>
                  setAnswers((a) =>
                    a[current.qi] !== undefined ? a : { ...a, [current.qi]: opt },
                  )
                }
              />
            )}

            {current.type === 'done' && (
              <DoneCard
                lessonId={lesson.id}
                badge={lesson.badge}
                alreadyDone={alreadyDone}
                onContinue={() => {
                  const nid = nextLessonId(lesson.id);
                  if (nid) openLesson(nid);
                  else closeLesson();
                }}
                onFinishEffect={finish}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer nav */}
      {current.type !== 'done' && (
        <div className="px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
              canAdvance ? 'bg-accent text-base' : 'bg-surface-2 text-muted'
            }`}
          >
            {isLast ? 'Finish' : current.type === 'question' && !canAdvance ? 'Pick an answer' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  lesson,
  qi,
  selected,
  onSelect,
}: {
  lesson: Lesson;
  qi: number;
  selected: number | undefined;
  onSelect: (opt: number) => void;
}) {
  const q = lesson.questions[qi];
  const answered = selected !== undefined;
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
        Check {qi + 1} of {lesson.questions.length}
      </div>
      <h3 className="mb-4 text-base font-semibold text-ink">{q.q}</h3>
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = selected === i;
          let cls = 'border-border bg-surface-2 text-ink/90';
          if (answered && isAnswer) cls = 'border-bid bg-bid/10 text-bid';
          else if (answered && isPicked && !isAnswer) cls = 'border-ask bg-ask/10 text-ask';
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${cls}`}
            >
              <span className="flex-1">{opt}</span>
              {answered && isAnswer && <span>✓</span>}
              {answered && isPicked && !isAnswer && <span>✕</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed text-ink/90">
          {selected === q.answer ? '✅ Right. ' : 'Not quite. '}
          {q.why}
        </div>
      )}
    </div>
  );
}

function DoneCard({
  badge,
  alreadyDone,
  onContinue,
  onFinishEffect,
}: {
  lessonId: string;
  badge?: string;
  alreadyDone: boolean;
  onContinue: () => void;
  onFinishEffect: () => void;
}) {
  // Award XP/badge once when this completion card mounts. The underlying
  // store actions are idempotent, so a StrictMode double-invoke is harmless.
  useEffect(() => {
    onFinishEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="mb-4 text-5xl"
      >
        🎉
      </motion.div>
      <h3 className="mb-1 text-xl font-bold text-ink">Lesson complete</h3>
      {!alreadyDone ? (
        <p className="mb-1 font-mono text-sm text-accent">+25 XP</p>
      ) : (
        <p className="mb-1 text-sm text-muted">Reviewed — XP already earned</p>
      )}
      {badge && !alreadyDone && (
        <p className="mb-2 text-sm text-violet">🏅 Badge unlocked: {badge}</p>
      )}
      <button
        onClick={onContinue}
        className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-base"
      >
        Continue
      </button>
    </div>
  );
}
