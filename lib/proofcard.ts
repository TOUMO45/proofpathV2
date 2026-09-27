// Proof Card: a Markdown proof checklist for a PR description or review comment.
// spec.md > Proof Card Builder. It claims nothing beyond "verified by ProofPath
// rules", and every item says where the evidence came from: the developer typed
// it ("self-reported") or pasted an AI agent's message ("agent claim").
// ProofPath never ran a test itself.

import type { Evidence, Session } from "./types";
import { coverage, supersededIds } from "./verify";
import { hasCurrentVerdicts } from "./store";

export function sourceLabel(e: Evidence): string {
  return e.kind === "claim" ? "agent claim" : "self-reported";
}

function summary(e: Evidence): string {
  const raw = e.kind === "structured" && e.structured ? e.structured.observed : (e.text ?? "");
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77).trimEnd()}...` : oneLine;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The Markdown card, or null unless verdicts are current and cover 100%. */
export function buildProofCard(session: Session, now: Date = new Date()): string | null {
  if (!hasCurrentVerdicts(session) || coverage(session.verdicts) !== 100) return null;

  const byId = new Map(session.evidence.map((e) => [e.id, e]));
  const superseded = supersededIds(session.evidence);
  const lines: string[] = [];

  lines.push("### ProofPath Proof Card", "");
  if (session.isDemo) lines.push("_Demo: fixture data._", "");
  lines.push(`**Goal:** ${session.goal}`, "");

  for (const req of session.contract.requirements) {
    const verdict = session.verdicts.find((v) => v.requirementId === req.id)!;
    const cited = verdict.evidenceIds
      .map((id) => byId.get(id))
      .filter((e): e is Evidence => Boolean(e))
      .map((e) => `${e.id} (${sourceLabel(e)})`);
    lines.push(`- [x] **${req.id}** ${req.text} — proven by ${cited.join(", ")}`);
  }

  const active = session.evidence.length - superseded.size;
  lines.push("", `**Evidence:** ${session.evidence.length} items (${active} counted, ${superseded.size} superseded)`);

  const supersedes = session.evidence.filter((e) => e.supersedes && byId.has(e.supersedes));
  if (supersedes.length > 0) {
    lines.push("", "**Superseded (kept as audit trail):**");
    for (const e of supersedes) {
      const old = byId.get(e.supersedes!)!;
      lines.push(`- ${old.id} ("${summary(old)}") superseded by ${e.id} retest`);
    }
  }

  lines.push(
    "",
    `Verified by ProofPath rules on ${isoDate(now)}. Evidence is self-reported; ProofPath did not run any test itself.`,
  );
  return lines.join("\n");
}
