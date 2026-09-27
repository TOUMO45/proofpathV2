import type { ProofGap } from "@/lib/gap";
import { RichText } from "./RichText";
import { VerdictBadge } from "./VerdictBadge";

export function ProofGapCard({ gap, onRecord }: { gap: ProofGap; onRecord?: () => void }) {
  return (
    <article className="border border-rule border-l-4 border-l-notproven bg-sheet p-5" data-testid={`gap-${gap.requirementId}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="label">Proof gap</span>
        <span className="font-mono text-xs text-muted">{gap.requirementId}</span>
        <VerdictBadge status={gap.status} />
      </header>
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
      {onRecord && (
        <button
          type="button"
          onClick={onRecord}
          className="mt-4 border border-ink px-3 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper"
        >
          Record this test
        </button>
      )}
    </article>
  );
}
