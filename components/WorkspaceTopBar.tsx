type Props = { isDemo: boolean; coverage: number | null; step: "evidence" | "proof"; onReset: () => void };

const STEPS = [
  { id: "contract", label: "Contract" },
  { id: "evidence", label: "Evidence" },
  { id: "proof", label: "Proof" },
] as const;

export function WorkspaceTopBar({ isDemo, coverage, step, onReset }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.id === step);
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">ProofPath</span>
          {isDemo && (
            <span className="border border-accent px-1.5 font-mono text-[11px] font-semibold tracking-wider text-accent" data-testid="demo-label">
              DEMO · FIXTURE DATA
            </span>
          )}
        </div>
        <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-muted">
                  →
                </span>
              )}
              <span
                aria-current={i === activeIndex ? "step" : undefined}
                className={i === activeIndex ? "font-semibold text-accent" : i < activeIndex ? "text-ink" : "text-muted"}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-sm" aria-label="Coverage">
            {coverage === null ? "—" : `${coverage}%`} <span className="text-muted">proven</span>
          </span>
          <button type="button" onClick={onReset} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
            Start over
          </button>
        </div>
      </div>
    </header>
  );
}
