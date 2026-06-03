export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl">
        🚧
      </div>
      <h2 className="mb-2 text-lg font-semibold text-ink">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{blurb}</p>
      <p className="mt-6 text-[11px] text-muted">
        Building in order — the live Book is up first. This screen lands next.
      </p>
    </div>
  );
}
