// Speed slider for the simulation. 1x is the scenario's natural, real-life
// pace; left slows it down to study, right pushes toward a fast-name blur.
// Mapped exponentially so 1x sits dead center.

const MIN = 0.25;
const MAX = 4;

// slider t in [0,1] -> multiplier in [MIN, MAX], with 1x at t=0.5
function tToSpeed(t: number) {
  return MIN * Math.pow(MAX / MIN, t);
}
function speedToT(s: number) {
  return Math.log(s / MIN) / Math.log(MAX / MIN);
}

function feel(s: number) {
  if (s <= 0.4) return 'study';
  if (s < 0.85) return 'slow';
  if (s <= 1.2) return 'real-time';
  if (s <= 2.5) return 'fast';
  return 'firehose';
}

export function SpeedControl({
  speed,
  onChange,
}: {
  speed: number;
  onChange: (s: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">Speed</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={speedToT(speed)}
        onChange={(e) => {
          const raw = tToSpeed(Number(e.target.value));
          // Gently snap near 1x so real-time is easy to land on.
          onChange(Math.abs(raw - 1) < 0.08 ? 1 : Math.round(raw * 100) / 100);
        }}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent"
        aria-label="Simulation speed"
      />
      <span className="w-20 text-right font-mono text-[11px] text-accent">
        {speed.toFixed(2)}× <span className="text-muted">{feel(speed)}</span>
      </span>
    </div>
  );
}
