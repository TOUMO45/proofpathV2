"use client";

// Pick up to 7 candidates from a pasted plan. Checkbox items by default; plain
// bullets on request. Flagged items can be selected, but Contract Review won't
// approve them until they pass the clean rules.

import { useMemo, useState } from "react";
import { MAX_REQUIREMENTS } from "@/lib/contract/generate";
import { canSelect, filterCandidates, importPlan, splitCandidate, toggleSelected } from "@/lib/import/plan";

type Props = {
  markdown: string;
  onUse: (goal: string, texts: string[]) => void;
  onManual: (goal: string) => void;
  onBack: () => void;
};

export function ImportPicker({ markdown, onUse, onManual, onBack }: Props) {
  const [includePlain, setIncludePlain] = useState(false);
  const result = useMemo(() => importPlan(markdown, { includePlainBullets: includePlain }), [markdown, includePlain]);
  // Splits and selection belong to one result; switching the toggle starts over.
  const [edits, setEdits] = useState<{ key: boolean; candidates: typeof result.candidates; selected: string[] }>({
    key: includePlain,
    candidates: result.candidates,
    selected: [],
  });
  const current = edits.key === includePlain ? edits : { key: includePlain, candidates: result.candidates, selected: [] };
  const { candidates, selected } = current;
  const [query, setQuery] = useState("");
  const shown = filterCandidates(candidates, query);
  const goal = `Imported plan: ${result.title}`;

  const update = (patch: Partial<typeof current>) => setEdits({ ...current, ...patch });

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
          Checkbox items (<code>- [ ]</code>) are listed; plain bullets only if you include them. Select up to{" "}
          {MAX_REQUIREMENTS}. Items marked NEEDS EDIT can be split here or fixed in the next step; the contract can&apos;t be
          approved until they pass the clean rules.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-accent" checked={includePlain} onChange={(e) => setIncludePlain(e.target.checked)} />
          Include plain bullets
          {!includePlain && result.skippedPlainBullets > 0 && <span className="text-muted">({result.skippedPlainBullets} more)</span>}
        </label>
        {candidates.length > 0 && (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="label text-xs">Filter</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. demo, Proof Card, stale"
              className="w-full min-w-0 border border-rule bg-sheet px-2 py-1.5 focus:border-accent rounded-xl"
              data-testid="candidate-filter"
            />
          </label>
        )}
      </div>

      {candidates.length === 0 ? (
        <div role="status" className="card border-notproven p-4">
          <p className="font-medium">{includePlain || result.skippedPlainBullets === 0 ? "No bullet or checkbox items found." : "No checkbox items found."}</p>
          <p className="mt-1 text-sm text-muted">
            {!includePlain && result.skippedPlainBullets > 0
              ? `Tick "Include plain bullets" to list ${result.skippedPlainBullets} bullet item${result.skippedPlainBullets === 1 ? "" : "s"}, or write the requirements yourself.`
              : "Write the requirements yourself instead."}
          </p>
          <button
            type="button"
            onClick={() => onManual(goal)}
            className="mt-3 btn btn-secondary px-3 py-2 text-sm"
          >
            Enter requirements manually
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm" role="status">
            <span className="font-mono">{selected.length}</span> of {MAX_REQUIREMENTS} selected · {candidates.length} found
            {query.trim() && ` · ${shown.length} match "${query.trim()}"`}
          </p>
          <ul className="space-y-2">
            {shown.map((c) => {
              const checked = selected.includes(c.id);
              const disabled = !canSelect(selected, c.id);
              return (
                <li
                  key={c.id}
                  className={`card p-3 ${c.flags.length ? "border-l-4 !border-l-contradicted" : ""}`}
                  data-testid={`candidate-${c.id}`}
                >
                  <label className={`flex items-start gap-2 ${disabled ? "text-muted" : ""}`}>
                    <input
                      type="checkbox"
                      className="mt-1 accent-accent"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => update({ selected: toggleSelected(selected, c.id) })}
                    />
                    <span className="min-w-0">
                      <span className="block break-words">{c.text}</span>
                      {c.heading && <span className="mt-0.5 block text-xs text-muted">from: {c.heading}</span>}
                    </span>
                  </label>
                  {c.flags.length > 0 && (
                    <div className="mt-2 ml-6 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-contradicted bg-contradicted-tint px-2 font-mono text-[10px] font-semibold tracking-wider text-contradicted">
                        NEEDS EDIT
                      </span>
                      <span className="text-contradicted">{c.flags.join(" · ")}</span>
                      {c.splitSuggestion && (
                        <button
                          type="button"
                          onClick={() => update({ candidates: splitCandidate(candidates, c.id), selected: selected.filter((x) => x !== c.id) })}
                          className="btn btn-secondary px-2 py-0.5 text-xs"
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
          {shown.length === 0 && <p className="text-sm text-muted">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>}
          <div className="sticky bottom-0 border-t border-rule bg-paper py-4">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onUse(goal, candidates.filter((c) => selected.includes(c.id)).map((c) => c.text))}
              className="btn btn-primary px-5 py-3"
            >
              Review {selected.length || ""} selected
            </button>
          </div>
        </>
      )}
    </main>
  );
}
