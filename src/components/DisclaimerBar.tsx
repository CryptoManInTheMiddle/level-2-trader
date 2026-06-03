// A persistent, unmissable reminder that everything here is fake. Non-negotiable
// per the spec — the app must repeatedly state it is simulated education only.
export function DisclaimerBar() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 bg-violet/15 px-3 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-violet"
      style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet" />
      Simulated data · Education only · Not trading advice
    </div>
  );
}
