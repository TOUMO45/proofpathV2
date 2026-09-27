"use client";

// Pick up to 7 candidates from a pasted plan. Flagged items can be selected,
// but Contract Review won't approve them until they pass the clean rules.

import { useState } from "react";
import { MAX_REQUIREMENTS } from "@/lib/contract/generate";
import { canSelect, splitCandidate, toggleSelected, type ImportResult } from "@/lib/import/plan";

type Props = {
  result: ImportResult;
  onUse: (goal: string, texts: string[]) => void;
  onManual: (goal: string) => void;
  onBack: () => void;
};

export function ImportPicker({ result, onUse, onManual, onBack }: Props) {
  const [candidates, setCandidates] = useState(result.candidates);
  const [selected, setSelected] = useState<string[]>([]);
  const goal = `Imported plan: ${result.title}`;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold tracking-tight">ProofPath</span>
        <button type="button" onClick={onBack} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          Back
        </button>
      </header>

      <section>
        <h1 className="label">Import a plan · pick what to verify</h1>
        <p className="mt-2 text-lg">{result.title}</p>
        <p className="mt-2 text-sm text-muted">
          Every bullet and checkbox item found is listed. Select up to {MAX_REQUIREMENTS}. Items marked NEEDS EDIT can be
          split here or fixed in the next step; the contract can&apos;t be approved until they pass the clean rules.
        </p>
      </section>

      {candidates.length === 0 ? (
        <div role="status" className="border border-notproven bg-sheet p-4">
          <p className="font-medium">No bullet or checkbox items found.</p>
          <p className="mt-1 text-sm text-muted">Write the requirements yourself instead.</p>
          <button
            type="button"
            onClick={() => onManual(goal)}
            className="mt-3 border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-paper"
          >
            Enter requirements manually
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm" role="status">
            <span className="font-mono">{selected.length}</span> of {MAX_REQUIREMENTS} selected · {candidates.length} found
          </p>
          <ul className="space-y-2">
            {candidates.map((c) => {
              const checked = selected.includes(c.id);
              const disabled = !canSelect(selected, c.id);
              return (
                <li key={c.id} className={`border bg-sheet p-3 ${c.flags.length ? "border-l-4 border-rule border-l-contradicted" : "border-rule"}`} data-testid={`candidate-${c.id}`}>
                  <label className={`flex items-start gap-2 ${disabled ? "text-muted" : ""}`}>
                    <input
                      type="checkbox"
                      className="mt-1 accent-accent"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => setSelected((s) => toggleSelected(s, c.id))}
                    />
                    <span>{c.text}</span>
                  </label>
                  {c.flags.length > 0 && (
                    <div className="mt-2 ml-6 flex flex-wrap items-center gap-2 text-sm">
                      <span className="border border-contradicted px-1 font-mono text-[10px] font-semibold tracking-wider text-contradicted">
                        NEEDS EDIT
                      </span>
                      <span className="text-contradicted">{c.flags.join(" · ")}</span>
                      {c.splitSuggestion && (
                        <button
                          type="button"
                          onClick={() => {
                            setCandidates((cs) => splitCandidate(cs, c.id));
                            setSelected((s) => s.filter((x) => x !== c.id));
                          }}
                          className="border border-ink px-2 py-0.5 text-xs font-medium hover:bg-ink hover:text-paper"
                        >
                          Split into 2
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-0 border-t border-rule bg-paper py-4">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onUse(goal, candidates.filter((c) => selected.includes(c.id)).map((c) => c.text))}
              className="bg-accent px-5 py-3 font-medium text-white hover:bg-accent/90 disabled:bg-rule disabled:text-muted"
            >
              Review {selected.length || ""} selected
            </button>
          </div>
        </>
      )}
    </main>
  );
}
