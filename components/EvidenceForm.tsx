"use client";

// Add evidence: a structured test, free text, or an AI agent's own claim.
// Links are always chosen explicitly; hints only suggest. prd.md > Evidence.
// "Record this test" remounts this form (via `key`) with Input/Action and one
// link pre-filled; Observed is never pre-filled.

import { useState } from "react";
import type { RecordPrefill } from "@/lib/gap";
import { demoSampleFor, missingLinkHints, retestPrompts } from "@/lib/hints";
import { UploadLink } from "./UploadLink";
import type { EvidenceDraft } from "@/lib/store";
import { supersedableEvidence, validateDraft } from "@/lib/store";
import type { EvidenceKind, Session } from "@/lib/types";

const KINDS: { id: EvidenceKind; label: string; hint: string }[] = [
  { id: "structured", label: "Structured test", hint: "What you did and what you saw." },
  { id: "text", label: "Text", hint: "A free-form observation." },
  { id: "claim", label: "Agent claim", hint: "Paste an AI agent's own \"done\" message, as-is." },
];

const input = "w-full rounded-lg border border-rule bg-paper px-2 py-1.5 font-mono text-[13px] focus:border-accent";

type Props = { session: Session; onAdd: (draft: EvidenceDraft) => void; prefill?: RecordPrefill };

export function EvidenceForm({ session, onAdd, prefill }: Props) {
  const [kind, setKind] = useState<EvidenceKind>("structured");
  const [text, setText] = useState("");
  const [structured, setStructured] = useState({ input: prefill?.input ?? "", action: prefill?.action ?? "", observed: "" });
  const [links, setLinks] = useState<string[]>(prefill ? [prefill.requirementId] : []);
  const [supersedes, setSupersedes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = supersedableEvidence(session, links);
  const supersedesValid = candidates.some((e) => e.id === supersedes);
  const observedText = kind === "structured" ? structured.observed : text;
  const linkHints = missingLinkHints(session, observedText, links);
  const retests = retestPrompts(session, links);
  const sample = demoSampleFor(session, kind, links);
  const usingSample = sample !== undefined && structured.observed === sample;

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
    <form id="evidence-form" onSubmit={submit} className="card space-y-3 p-4" aria-labelledby="add-evidence-label">
      <h2 id="add-evidence-label" className="label">
        {prefill ? `Record the test for ${prefill.requirementId}` : "Add evidence"}
      </h2>

      <div role="radiogroup" aria-label="Evidence kind" className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-medium transition-colors ${kind === k.id ? "border-ink bg-lime text-ink" : "border-rule bg-sheet text-ink hover:border-ink"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{KINDS.find((k) => k.id === kind)!.hint}</p>

      {kind === "structured" ? (
        <div className="space-y-2">
          {(["input", "action"] as const).map((f) => (
            <label key={f} className="block">
              <span className="label text-xs">{f}</span>
              <input
                className={input}
                value={structured[f]}
                onChange={(ev) => setStructured({ ...structured, [f]: ev.target.value })}
                placeholder={f === "input" ? "email=not-an-email" : "Entered the email and pressed Send"}
              />
            </label>
          ))}
          <label className="block">
            <span className="label text-xs">
              observed{" "}
              {usingSample && (
                <span className="pill ml-1 px-2 py-0 font-mono text-[10px] normal-case">
                  sample (demo)
                </span>
              )}
            </span>
            <input
              className={input}
              value={structured.observed}
              onChange={(ev) => setStructured({ ...structured, observed: ev.target.value })}
              placeholder="What did you actually see?"
              data-testid="observed-input"
            />
          </label>
          {sample && !usingSample && (
            <button
              type="button"
              onClick={() => setStructured({ ...structured, observed: sample })}
              className="text-xs text-accent underline underline-offset-2"
            >
              Show me a passing retest (demo sample)
            </button>
          )}
        </div>
      ) : (
        <div>
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
        {kind === "claim" && (
          <span className="mt-1 block">
            <UploadLink onText={setText} />
          </span>
        )}
        </div>
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

      {linkHints.map((h) => (
        <p key={h.requirementId} className="enter rounded-xl border border-rule bg-paper p-2 text-sm" data-testid={`link-hint-${h.requirementId}`}>
          This also mentions {h.requirementId}&apos;s targets ({h.matched.join(", ")}).{" "}
          <button type="button" onClick={() => toggleLink(h.requirementId)} className="text-accent underline underline-offset-2">
            Link to {h.requirementId} too?
          </button>
        </p>
      ))}

      {retests.map((p) => (
        <label key={p.evidenceId} className="enter flex items-start gap-2 rounded-xl border border-contradicted bg-paper p-2 text-sm" data-testid={`retest-${p.evidenceId}`}>
          <input
            type="checkbox"
            className="mt-1 accent-accent"
            checked={supersedes === p.evidenceId}
            onChange={(ev) => setSupersedes(ev.target.checked ? p.evidenceId : "")}
          />
          <span>
            {p.requirementId} is contradicted by {p.evidenceId}. Is this a retest after a fix?{" "}
            <span className="text-muted">(supersedes {p.evidenceId}, which is kept as an audit trail)</span>
          </span>
        </label>
      ))}

      <label className="block">
        <span className="label text-xs">Supersedes</span>
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
      <button type="submit" className="w-full btn btn-secondary px-3 py-2 text-sm">
        Add evidence
      </button>
    </form>
  );
}
