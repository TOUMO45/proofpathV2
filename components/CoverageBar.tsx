type Props = { proven: number; total: number; state: "current" | "stale" | "unverified" };

/** Coverage = PROVEN ÷ total. Explicitly not a confidence score. */
export function CoverageBar({ proven, total, state }: Props) {
  const pct = total === 0 ? 0 : Math.round((100 * proven) / total);
  const current = state === "current";
  return (
    <section aria-labelledby="coverage-label" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="coverage-label" className="label">
          Coverage
        </h2>
        <p className="text-xs text-muted">Proven ÷ total requirements. Not a confidence score.</p>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span key={current ? pct : state} className={`bump font-mono text-4xl font-semibold ${current ? "" : "text-muted"}`} data-testid="coverage">
          {current ? `${pct}%` : "—"}
        </span>
        <span className="text-sm text-muted">
          {state === "current" && `${proven} of ${total} requirements proven`}
          {state === "unverified" && "Not verified yet. Press Verify."}
          {state === "stale" && "Stale: evidence or contract changed. Verify again."}
        </span>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-label="Coverage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={current ? pct : undefined}
      >
        <div className="meter-fill h-2.5 rounded-full" style={{ width: current ? `${pct}%` : "0%" }} />
      </div>
    </section>
  );
}
