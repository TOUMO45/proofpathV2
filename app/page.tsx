"use client";

// Screen switcher: Landing → Workspace. spec.md > File Structure.

import { useEffect, useReducer } from "react";
import { CoverageBar } from "@/components/CoverageBar";
import { EvidenceForm } from "@/components/EvidenceForm";
import { EvidenceList } from "@/components/EvidenceList";
import { GoalInput } from "@/components/GoalInput";
import { ProofGapCard } from "@/components/ProofGapCard";
import { ProofCard } from "@/components/ProofCard";
import { ProofGraph } from "@/components/ProofGraph";
import { WorkspaceTopBar } from "@/components/WorkspaceTopBar";
import { buildGaps } from "@/lib/gap";
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
  useEffect(() => {
    const { session, notice } = loadSaved(browserStorage());
    dispatch({ type: "hydrate", session, notice });
  }, []);

  useEffect(() => {
    if (state.hydrated) save(browserStorage(), state.session);
  }, [state.hydrated, state.session]);

  const { session } = state;
  if (!state.hydrated) return <div className="min-h-screen" aria-busy="true" />;

  if (!session) {
    return (
      <GoalInput
        onTryDemo={() => dispatch({ type: "loadDemo" })}
        notice={state.notice}
        onDismissNotice={() => dispatch({ type: "dismissNotice" })}
      />
    );
  }

  const current = hasCurrentVerdicts(session);
  const pct = current ? coverage(session.verdicts) : null;
  const proven = current ? session.verdicts.filter((v) => v.status === "PROVEN").length : 0;
  const gaps = current ? buildGaps(session.contract, session.verdicts) : [];
  const proofCard = buildProofCard(session);

  return (
    <div className="min-h-screen">
      <WorkspaceTopBar
        isDemo={session.isDemo}
        coverage={pct}
        step={pct === 100 ? "proof" : "evidence"}
        onReset={() => dispatch({ type: "reset" })}
      />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {proofCard && <ProofCard markdown={proofCard} />}
          <CoverageBar
            proven={proven}
            total={session.contract.requirements.length}
            state={current ? "current" : session.verdicts.length ? "stale" : "unverified"}
          />
          <ProofGraph session={session} current={current} />
          {gaps.length > 0 && (
            <section aria-labelledby="gaps-label" className="space-y-3">
              <h2 id="gaps-label" className="label">
                Proof gaps · {gaps.length} open
              </h2>
              {gaps.map((g) => (
                <ProofGapCard key={g.requirementId} gap={g} />
              ))}
            </section>
          )}
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start" aria-labelledby="evidence-label">
          <div className="border border-rule bg-sheet p-4">
            <button
              type="button"
              onClick={() => dispatch({ type: "verify" })}
              className="w-full bg-accent px-4 py-3 font-medium text-white hover:bg-accent/90"
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
          <EvidenceForm session={session} onAdd={(draft) => dispatch({ type: "addEvidence", draft })} />
        </aside>
      </main>
    </div>
  );
}
