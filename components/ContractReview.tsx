"use client";

// Review and edit the draft contract before any evidence. prd.md > Contract Review.
// Nothing is auto-approved; a flagged requirement blocks Approve.

import { MAX_REQUIREMENTS } from "@/lib/contract/generate";
import { checkClean } from "@/lib/contract/clean";
import { approvalBlocker, evidenceOnlyLinkedTo, type Action } from "@/lib/store";
import type { ExpectedOutcome, Session } from "@/lib/types";

const EXPECTED: { id: ExpectedOutcome; label: string }[] = [
  { id: "succeeds", label: "succeeds: it works when used" },
  { id: "rejects", label: "rejects: bad input is refused" },
  { id: "displays", label: "displays: something is on screen" },
  { id: "persists", label: "persists: survives reload/restart" },
];

const field = "w-full rounded-lg border border-rule bg-paper px-2 py-1.5 focus:border-accent";

export function ContractReview({ session, dispatch }: { session: Session; dispatch: (a: Action) => void }) {
  const reqs = session.contract.requirements;
  const blocker = approvalBlocker(session);
  const reopened = session.evidence.length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="font-semibold tracking-tight">ProofPath</span>
          <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
            <li aria-current="step" className="font-semibold text-accent">
              Contract
            </li>
            <li aria-hidden className="text-muted">
              →
            </li>
            <li className="text-muted">Evidence</li>
            <li aria-hidden className="text-muted">
              →
            </li>
            <li className="text-muted">Proof</li>
          </ol>
          <button type="button" onClick={() => dispatch({ type: "reset" })} className="ml-auto text-sm text-muted underline underline-offset-2 hover:text-ink">
            Start over
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <section>
          <h1 className="label">Success contract · review before evidence</h1>
          <p className="mt-2 text-lg">
            <span className="label mr-2 text-xs">Goal</span>
            {session.goal}
          </p>
          <p className="mt-2 text-sm text-muted">
            Each requirement is one observable behavior. Edit anything that doesn&apos;t match what you asked for. Target
            words are what evidence must mention; the expected outcome decides what counts as proof.
          </p>
        </section>

        {session.pendingClaim && (
          <section className="card p-4" aria-labelledby="pending-reply-label" data-testid="pending-reply">
            <h2 id="pending-reply-label" className="label">
              Agent&apos;s reply · added on approval
            </h2>
            <p className="mt-1 text-sm text-muted">
              When you approve, the reply becomes E1: an agent claim linked to every requirement, and Verify runs once.
              A claim can&apos;t prove anything by itself; its concrete claims show up in the Proof Gaps for you to check.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-rule bg-paper p-3 font-mono text-[12.5px] whitespace-pre-wrap">
              {session.pendingClaim}
            </pre>
          </section>
        )}

        {reqs.length < 3 && (
          <p role="status" className="rounded-xl border border-notproven bg-sheet p-3 text-sm">
            <span className="font-mono font-semibold text-notproven">LOW CONFIDENCE</span> Only {reqs.length} requirement
            {reqs.length === 1 ? "" : "s"} came out of this goal. Add what&apos;s missing, or edit these.
          </p>
        )}

        <ol className="space-y-4">
          {reqs.map((r) => {
            const suggestion = r.flags.length ? checkClean(r.text).splitSuggestion : undefined;
            const loses = reopened ? evidenceOnlyLinkedTo(session, r.id) : [];
            return (
              <li
                key={r.id}
                className={`card enter p-4 ${r.flags.length ? "border-l-4 !border-l-contradicted" : ""}`}
                data-testid={`req-${r.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{r.id}</span>
                  {r.flags.length > 0 && (
                    <span className="rounded-full border border-contradicted bg-contradicted-tint px-2 font-mono text-[10px] font-semibold tracking-wider text-contradicted">
                      NEEDS EDIT
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "removeRequirement", id: r.id })}
                    className="ml-auto text-xs text-muted underline underline-offset-2 hover:text-contradicted"
                    aria-label={`Remove ${r.id}`}
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 block">
                  <span className="sr-only">Requirement {r.id}</span>
                  <textarea
                    rows={2}
                    className={`${field} text-base`}
                    value={r.text}
                    placeholder="One observable behavior, e.g. The dark mode toggle persists after page reload"
                    onChange={(e) => dispatch({ type: "editRequirement", id: r.id, patch: { text: e.target.value } })}
                  />
                </label>
                {r.flags.length > 0 && (
                  <div className="mt-2 text-sm text-contradicted">
                    {r.flags.join(" · ")}
                    {suggestion && reqs.length < MAX_REQUIREMENTS && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-ink">
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "splitRequirement", id: r.id })}
                          className="btn btn-secondary px-2 py-1 text-xs"
                        >
                          Split into 2
                        </button>
                        <span className="text-xs text-muted">
                          → &ldquo;{suggestion[0]}&rdquo; and &ldquo;{suggestion[1]}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="label text-xs">Expected outcome</span>
                    <select
                      className={field}
                      value={r.expected}
                      onChange={(e) => dispatch({ type: "editRequirement", id: r.id, patch: { expected: e.target.value as ExpectedOutcome } })}
                    >
                      {EXPECTED.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="label text-xs">Target words (comma-separated)</span>
                    <input
                      className={`${field} font-mono text-[13px]`}
                      defaultValue={r.targets.join(", ")}
                      key={r.targets.join(",")}
                      onBlur={(e) =>
                        dispatch({
                          type: "editRequirement",
                          id: r.id,
                          patch: { targets: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) },
                        })
                      }
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted">
                  <span className="label mr-1">Proof</span>
                  {r.proofTemplate}
                </p>
                {loses.length > 0 && (
                  <p className="mt-2 text-xs text-notproven">
                    Removing {r.id} also removes {loses.map((e) => e.id).join(", ")} (linked only to {r.id}).
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => dispatch({ type: "addRequirement" })}
            disabled={reqs.length >= MAX_REQUIREMENTS}
            className="btn btn-secondary px-3 py-2 text-sm"
          >
            Add requirement
          </button>
          <span className="text-xs text-muted">
            {reqs.length} of {MAX_REQUIREMENTS}
          </span>
        </div>

        <div className="border-t border-rule pt-6">
          <button
            type="button"
            onClick={() => dispatch({ type: "approveContract" })}
            disabled={blocker !== null}
            className="btn btn-primary px-5 py-3"
          >
            Approve contract
          </button>
          <p className="mt-2 text-sm text-muted" role="status">
            {blocker ?? (reopened ? "Approving again keeps your evidence. Verdicts stay stale until you verify." : "Approving unlocks evidence.")}
          </p>
        </div>
      </main>
    </div>
  );
}
