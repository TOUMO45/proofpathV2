import type { ProofGap } from "@/lib/gap";
import { RichText } from "./RichText";
import { VerdictBadge } from "./VerdictBadge";

export function ProofGapCard({ gap, onRecord, stale = false }: { gap: ProofGap; onRecord?: () => void; stale?: boolean }) {
  return (
    <article
      className={`card enter border-l-4 p-5 ${stale ? "border-l-muted" : "border-l-notproven"}`}
      data-testid={`gap-${gap.requirementId}`}
      data-stale={stale || undefined}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="label">Proof gap</span>
        <span className="font-mono text-xs text-muted">{gap.requirementId}</span>
        <VerdictBadge status={stale ? "STALE" : gap.status} />
        {stale && <span className="font-mono text-[11px] font-semibold tracking-wider text-muted">STALE: re-verify</span>}
      </header>
      <div className={stale ? "opacity-60" : undefined}>
      <p className="mt-2 font-medium">{gap.requirementText}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
        <dt className="label text-xs">Next test</dt>
        <dd>
          <RichText text={gap.action} />
        </dd>
        <dt className="label text-xs">Record</dt>
        <dd>
          <RichText text={gap.observe} />
          {gap.retestOf.length > 0 && (
            <span className="mt-1 block text-muted">
              Retest supersedes: <span className="font-mono">{gap.retestOf.join(", ")}</span>
            </span>
          )}
        </dd>
        <dt className="label text-xs">Claim</dt>
        <dd className="font-mono text-[0.9em]">{gap.statement}</dd>
        <dt className="label text-xs">Why open</dt>
        <dd className="text-muted">
          <RichText text={gap.why} />
        </dd>
      </dl>
      </div>
      {onRecord && (
        <button
          type="button"
          onClick={onRecord}
          className="mt-4 btn btn-secondary px-3 py-1.5 text-sm"
        >
          Record this test
        </button>
      )}
    </article>
  );
}
