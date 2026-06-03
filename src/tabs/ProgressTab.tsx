import { useProgressStore, xpForLevel } from '../store/progressStore';

export function ProgressTab() {
  const xp = useProgressStore((s) => s.xp);
  const level = useProgressStore((s) => s.level);
  const streakDays = useProgressStore((s) => s.streakDays);
  const lessonsCompleted = useProgressStore((s) => s.lessonsCompleted);
  const badges = useProgressStore((s) => s.badges);
  const drillStats = useProgressStore((s) => s.drillStats);

  // XP accumulated so far within the current level.
  let acc = 0;
  for (let l = 1; l < level; l += 1) acc += xpForLevel(l);
  const intoLevel = xp - acc;
  const need = xpForLevel(level);
  const pct = Math.min(100, Math.round((intoLevel / need) * 100));

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-3">
      <h2 className="text-lg font-semibold text-ink">Progress</h2>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-violet/15 to-accent/10 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Level</div>
            <div className="text-3xl font-bold text-ink">{level}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted">Total XP</div>
            <div className="font-mono text-2xl font-bold text-accent">{xp}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-base">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-right text-[10px] text-muted">
          {intoLevel} / {need} XP to level {level + 1}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Day streak" value={`${streakDays}🔥`} />
        <Stat label="Lessons" value={String(lessonsCompleted.length)} />
        <Stat
          label="Drill acc."
          value={
            drillStats.attempts > 0
              ? `${Math.round((drillStats.correct / drillStats.attempts) * 100)}%`
              : '—'
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">Badges</div>
        {badges.length === 0 ? (
          <p className="text-sm text-muted">
            No badges yet. Complete lessons and drills to earn “Spread Reader,” “Wall Spotter,”
            “Tape Whisperer,” and more.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-violet/15 px-3 py-1 text-xs text-violet">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-ink/90">Reality check:</span> most active day traders
        lose money over time. This app teaches mechanics on simulated data — not a money-making
        guarantee. Paper trade for months before risking a cent.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <div className="font-mono text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
