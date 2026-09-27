"use client";

// Add evidence: a structured test, free text, or an AI agent's own claim.
// Links are always chosen explicitly; "Supersedes" is the retest-after-fix path.
// prd.md > Evidence.

import { useState } from "react";
import type { EvidenceDraft } from "@/lib/store";
import { supersedableEvidence, validateDraft } from "@/lib/store";
import type { EvidenceKind, Session } from "@/lib/types";

const KINDS: { id: EvidenceKind; label: string; hint: string }[] = [
  { id: "structured", label: "Structured test", hint: "What you did and what you saw." },
  { id: "text", label: "Text", hint: "A free-form observation." },
  { id: "claim", label: "Agent claim", hint: "Paste an AI agent's own \"done\" message, as-is." },
];

const input = "w-full border border-rule bg-paper px-2 py-1.5 font-mono text-[13px] focus:border-accent";

export function EvidenceForm({ session, onAdd }: { session: Session; onAdd: (draft: EvidenceDraft) => void }) {
  const [kind, setKind] = useState<EvidenceKind>("structured");
  const [text, setText] = useState("");
  const [structured, setStructured] = useState({ input: "", action: "", observed: "" });
  const [links, setLinks] = useState<string[]>([]);
  const [supersedes, setSupersedes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = supersedableEvidence(session, links);
  const supersedesValid = candidates.some((e) => e.id === supersedes);

  function toggleLink(id: string) {
    setLinks((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const draft: EvidenceDraft = {
      kind,
      ...(kind === "structured" ? { structured } : { text }),
      links,
      ...(supersedesValid ? { supersedes } : {}),
    };
    const problem = validateDraft(session, draft);
    if (problem) {
      setError(problem);
      return;
    }
    onAdd(draft);
    setText("");
    setStructured({ input: "", action: "", observed: "" });
    setLinks([]);
    setSupersedes("");
    setError(null);
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-rule bg-sheet p-4" aria-labelledby="add-evidence-label">
      <h2 id="add-evidence-label" className="label">
        Add evidence
      </h2>

      <div role="radiogroup" aria-label="Evidence kind" className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`border px-2 py-1 text-xs ${kind === k.id ? "border-accent bg-accent text-white" : "border-rule text-ink hover:border-ink"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{KINDS.find((k) => k.id === kind)!.hint}</p>

      {kind === "structured" ? (
        <div className="space-y-2">
          {(["input", "action", "observed"] as const).map((f) => (
            <label key={f} className="block">
              <span className="label text-xs">{f}</span>
              <input
                className={input}
                value={structured[f]}
                onChange={(ev) => setStructured({ ...structured, [f]: ev.target.value })}
                placeholder={
                  f === "input" ? "email=not-an-email" : f === "action" ? "Entered the email and pressed Send" : "Message 'Please enter a valid email' shown"
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <label className="block">
          <span className="label text-xs">{kind === "claim" ? "Agent's message" : "Observation"}</span>
          <textarea
            className={`${input} min-h-24`}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder={
              kind === "claim"
                ? "I've implemented validation that should reject invalid emails..."
                : "Opened /contact: the name, email and message fields are visible."
            }
          />
        </label>
      )}

      <fieldset>
        <legend className="label text-xs">Proves (link at least one)</legend>
        <div className="mt-1 space-y-1">
          {session.contract.requirements.map((r) => (
            <label key={r.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-accent" checked={links.includes(r.id)} onChange={() => toggleLink(r.id)} />
              <span>
                <span className="font-mono text-xs text-muted">{r.id}</span> {r.text}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label text-xs">Supersedes (retest after a fix)</span>
        <select
          className={input}
          value={supersedesValid ? supersedes : ""}
          onChange={(ev) => setSupersedes(ev.target.value)}
          disabled={candidates.length === 0}
        >
          <option value="">{links.length === 0 ? "Link a requirement first" : candidates.length ? "Nothing" : "No evidence shares these links"}</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} (linked to {e.links.join(", ")})
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p role="alert" className="text-sm text-contradicted">
          {error}
        </p>
      )}
      <button type="submit" className="w-full border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
        Add evidence
      </button>
    </form>
  );
}
