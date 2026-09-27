type Props = {
  isDemo: boolean;
  coverage: number | null;
  step: "evidence" | "proof";
  onReset: () => void;
  onEditContract: () => void;
};

const STEPS = [
  { id: "contract", label: "Contract" },
  { id: "evidence", label: "Evidence" },
  { id: "proof", label: "Proof" },
] as const;

export function WorkspaceTopBar({ isDemo, coverage, step, onReset, onEditContract }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.id === step);
  return (
    <header className="sticky top-0 z-10 border-b border-rule bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">ProofPath</span>
          {isDemo && (
            <span className="pill font-mono text-[11px] tracking-wider" data-testid="demo-label">
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
                className={i === activeIndex ? "pill" : i < activeIndex ? "text-ink" : "text-muted"}
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
          <button type="button" onClick={onEditContract} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
            Edit contract
          </button>
          <button type="button" onClick={onReset} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
            Start over
          </button>
        </div>
      </div>
    </header>
  );
}
