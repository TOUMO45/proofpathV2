"use client";

// Screen switcher: Landing → Workspace. spec.md > File Structure.

import { useEffect, useReducer, useState } from "react";
import { ContractReview } from "@/components/ContractReview";
import { CoverageBar } from "@/components/CoverageBar";
import { EvidenceForm } from "@/components/EvidenceForm";
import { EvidenceList } from "@/components/EvidenceList";
import { GoalInput } from "@/components/GoalInput";
import { ImportPicker } from "@/components/ImportPicker";
import { ProofGapCard } from "@/components/ProofGapCard";
import { ProofCard } from "@/components/ProofCard";
import { ProofGraph } from "@/components/ProofGraph";
import { WorkspaceTopBar } from "@/components/WorkspaceTopBar";
import { generateContract, makeRequirement } from "@/lib/contract/generate";
import { gapsForDisplay, recordPrefill, type RecordPrefill } from "@/lib/gap";
import { buildProofCard } from "@/lib/proofcard";
import { hasCurrentVerdicts, initialState, loadSaved, reducer, save } from "@/lib/store";
import { coverage } from "@/lib/verify";

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // "Record this test": which gap the evidence form is pre-filled for. The
  // counter remounts the form so each click starts from a fresh pre-fill.
  const [record, setRecord] = useState<{ prefill: RecordPrefill; n: number } | null>(null);
  const [imported, setImported] = useState<string | null>(null); // pasted plan markdown
  const [replyDraft, setReplyDraft] = useState<string | undefined>(undefined); // plan-box text moved to "Check an agent's reply"
  useEffect(() => {
    const { session, notice } = loadSaved(browserStorage());
    dispatch({ type: "hydrate", session, notice });
  }, []);

  useEffect(() => {
    if (state.hydrated) save(browserStorage(), state.session);
  }, [state.hydrated, state.session]);

  const { session } = state;
  if (!state.hydrated) return <div className="min-h-screen" aria-busy="true" />;

  if (!session && imported) {
    return (
      <ImportPicker
        markdown={imported}
        onBack={() => setImported(null)}
        onTreatAsReply={(text) => {
          setReplyDraft(text);
          setImported(null);
        }}
        onUse={(goal, texts) => {
          const requirements = texts.map((t, i) => makeRequirement(`R${i + 1}`, t));
          setImported(null);
          dispatch({ type: "createContract", goal, requirements });
        }}
        onManual={(goal) => {
          setImported(null);
          dispatch({ type: "createContract", goal, requirements: [{ ...makeRequirement("R1", ""), text: "" }] });
        }}
      />
    );
  }

  if (!session) {
    return (
      <GoalInput
        onTryDemo={() => dispatch({ type: "loadDemo" })}
        onCreate={(goal) => {
          const result = generateContract(goal);
          if (!result.ok) return result.error;
          dispatch({ type: "createContract", goal: goal.trim(), requirements: result.requirements });
          return null;
        }}
        initialReply={replyDraft}
        key={replyDraft ? "with-reply" : "landing"}
        onCheckReply={(request, reply) => {
          if (!reply.trim()) return "Paste the agent's reply, or upload it as a .md / .txt file.";
          const result = generateContract(request);
          if (!result.ok) return result.error;
          setReplyDraft(undefined);
          dispatch({ type: "createContract", goal: request.trim(), requirements: result.requirements, pendingClaim: reply });
          return null;
        }}
        onImport={(markdown) => {
          if (!markdown.trim()) return "Paste a plan or upload a .md file first.";
          setImported(markdown);
          return null;
        }}
        notice={state.notice}
        onDismissNotice={() => dispatch({ type: "dismissNotice" })}
      />
    );
  }

  if (!session.contract.approved) return <ContractReview session={session} dispatch={dispatch} />;

  const current = hasCurrentVerdicts(session);
  const pct = current ? coverage(session.verdicts) : null;
  const proven = current ? session.verdicts.filter((v) => v.status === "PROVEN").length : 0;
  const { gaps, stale: gapsStale } = gapsForDisplay(session);
  const proofCard = buildProofCard(session);

  return (
    <div className="min-h-screen">
      <WorkspaceTopBar
        isDemo={session.isDemo}
        coverage={pct}
        step={pct === 100 ? "proof" : "evidence"}
        onReset={() => {
          setRecord(null);
          dispatch({ type: "reset" });
        }}
        onEditContract={() => {
          setRecord(null);
          dispatch({ type: "reopenContract" });
        }}
      />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {proofCard && <ProofCard markdown={proofCard} />}
          <CoverageBar
            proven={proven}
            total={session.contract.requirements.length}
            state={current ? "current" : session.verdicts.length ? "stale" : "unverified"}
          />
          <ProofGraph
            session={session}
            current={current}
            onUnlink={(evidenceId, requirementId) => dispatch({ type: "unlinkEvidence", evidenceId, requirementId })}
          />
          {gaps.length > 0 && (
            <section aria-labelledby="gaps-label" className="space-y-3">
              <h2 id="gaps-label" className="label">
                Proof gaps · {gaps.length} open{gapsStale ? " at the last Verify" : ""}
              </h2>
              {gaps.map((g) => (
                <ProofGapCard
                  key={g.requirementId}
                  gap={g}
                  stale={gapsStale}
                  onRecord={() => {
                    setRecord((prev) => ({ prefill: recordPrefill(g, session), n: (prev?.n ?? 0) + 1 }));
                    requestAnimationFrame(() => {
                      const form = document.getElementById("evidence-form");
                      form?.scrollIntoView({ behavior: "smooth", block: "start" });
                      form?.querySelector<HTMLInputElement>("[data-testid=observed-input]")?.focus({ preventScroll: true });
                    });
                  }}
                />
              ))}
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start" aria-labelledby="evidence-label">
          <div className="card p-4">
            <button
              type="button"
              onClick={() => dispatch({ type: "verify" })}
              className="w-full btn btn-primary px-4 py-3"
            >
              Verify
            </button>
            <p className="mt-2 text-xs text-muted">
              {current
                ? "Verdicts are current."
                : session.verdicts.length
                  ? "Evidence changed since the last run. Verify again."
                  : "Judge every requirement against its linked evidence."}
            </p>
          </div>
          <h2 id="evidence-label" className="label">
            Evidence · {session.evidence.length}
          </h2>
          <EvidenceList evidence={session.evidence} onRemove={(id) => dispatch({ type: "removeEvidence", id })} />
          <EvidenceForm
            key={record ? `record-${record.n}` : "blank"}
            session={session}
            prefill={record?.prefill}
            onAdd={(draft) => {
              dispatch({ type: "addEvidence", draft });
              setRecord(null);
            }}
          />
        </aside>
      </main>
    </div>
  );
}
