// Goal → Requirements → Evidence → Verdict, as plain HTML/CSS rows.
// spec.md > UI Components: no graph library.

import type { Session } from "@/lib/types";
import { overLinks, supersededIds } from "@/lib/verify";
import { RichText } from "./RichText";
import { VerdictBadge } from "./VerdictBadge";

type Props = { session: Session; current: boolean; onUnlink?: (evidenceId: string, requirementId: string) => void };

export function ProofGraph({ session, current, onUnlink }: Props) {
  const superseded = supersededIds(session.evidence);
  return (
    <section aria-labelledby="graph-label" className="border border-rule bg-sheet">
      <div className="border-b border-rule px-5 py-3">
        <h2 id="graph-label" className="label">
          Proof graph
        </h2>
        <p className="mt-1 text-sm">
          <span className="label mr-2 text-xs">Goal</span>
          {session.goal}
        </p>
      </div>
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1.6fr)] gap-4 border-b border-rule px-5 py-2 md:grid">
        <span className="label text-xs">Requirement</span>
        <span className="label text-xs">Evidence</span>
        <span className="label text-xs">Verdict</span>
      </div>
      <ol>
        {session.contract.requirements.map((req) => {
          const verdict = session.verdicts.find((v) => v.requirementId === req.id);
          const linked = session.evidence.filter((e) => e.links.includes(req.id));
          const status = !verdict ? "UNVERIFIED" : current ? verdict.status : "STALE";
          return (
            <li
              key={req.id}
              className="grid gap-3 border-b border-rule px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1.6fr)] md:gap-4"
              data-testid={`row-${req.id}`}
            >
              <div>
                <p className="text-sm">
                  <span className="mr-2 font-mono text-xs text-muted">{req.id}</span>
                  {req.text}
                </p>
                <p className="mt-1 text-xs text-muted">
                  expects <span className="font-mono">{req.expected}</span> · targets{" "}
                  <span className="font-mono">{req.targets.join(", ")}</span>
                </p>
              </div>
              <div className="flex flex-wrap content-start gap-1.5" aria-label={`Evidence linked to ${req.id}`}>
                <span className="text-muted md:hidden" aria-hidden>
                  →
                </span>
                {linked.length === 0 && <span className="text-xs text-muted">none</span>}
                {linked.map((e) => (
                  <span
                    key={e.id}
                    className={`border border-rule px-1.5 py-0.5 font-mono text-xs ${superseded.has(e.id) ? "text-muted line-through" : ""}`}
                    title={superseded.has(e.id) ? "Superseded" : undefined}
                  >
                    {e.id}
                  </span>
                ))}
              </div>
              <div>
                <VerdictBadge status={status} />
                {verdict && current && (
                  <p className="mt-2 text-sm leading-relaxed text-ink/90">
                    <RichText text={verdict.reason} />
                  </p>
                )}
                {verdict && current && verdict.status === "CONTRADICTED" && onUnlink && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {overLinks(req, session.contract, session.evidence).map((o) => (
                      <button
                        key={o.evidenceId}
                        type="button"
                        onClick={() => onUnlink(o.evidenceId, req.id)}
                        className="border border-ink px-2 py-1 text-xs font-medium hover:bg-ink hover:text-paper"
                      >
                        Unlink {o.evidenceId} from {req.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
