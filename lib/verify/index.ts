// Aggregate per-evidence stances into one verdict per requirement.
// spec.md > Verifier (lib/verify): any contradiction → CONTRADICTED (even with
// support); else any support → PROVEN; else NOT_PROVEN.

import type { Contract, Evidence, Requirement, Verdict } from "../types";
import { findInjection } from "./screens";
import { hasObfuscation, parseEvidence } from "../text";
import { stance, type Stance } from "./stance";

export { stance } from "./stance";

/** IDs of evidence superseded by other evidence that is still present. */
export function supersededIds(evidence: Evidence[]): Set<string> {
  return new Set(evidence.map((e) => e.supersedes).filter((id): id is string => Boolean(id)));
}

/**
 * Flags the UI shows as badges on an evidence item. Neither changes a verdict by
 * itself: "untrusted" evidence is already ignored by the verifier, and
 * "obfuscated" is a visible warning that someone tried to hide characters.
 */
export function evidenceFlags(e: Evidence): string[] {
  const flags: string[] = [];
  if (findInjection(parseEvidence(e).all)) flags.push("untrusted");
  const raw = e.kind === "structured" && e.structured ? Object.values(e.structured).join("\n") : (e.text ?? "");
  if (hasObfuscation(raw)) flags.push("obfuscated");
  return flags;
}

type Judged = { evidence: Evidence; stance: Stance };

function cite(j: Judged): string {
  return `${j.evidence.id}: ${j.stance.note} — "${j.stance.quote}"`;
}

function ids(list: Judged[]): string {
  return list.map((j) => j.evidence.id).join(", ");
}

export function verifyRequirement(req: Requirement, contract: Contract, evidence: Evidence[]): Verdict {
  const superseded = supersededIds(evidence);
  const linkedEvidence = evidence.filter((e) => e.links.includes(req.id));
  const active = linkedEvidence.filter((e) => !superseded.has(e.id));

  if (linkedEvidence.length === 0) {
    return { requirementId: req.id, status: "NOT_PROVEN", reason: "No evidence linked to this requirement.", evidenceIds: [] };
  }
  if (active.length === 0) {
    return {
      requirementId: req.id,
      status: "NOT_PROVEN",
      reason: `Only superseded evidence is linked (${linkedEvidence.map((e) => e.id).join(", ")}).`,
      evidenceIds: [],
    };
  }

  const judged: Judged[] = active.map((e) => ({
    evidence: e,
    stance: stance(
      req,
      e,
      contract.requirements.filter((r) => e.links.includes(r.id)),
    ),
  }));
  const contradicts = judged.filter((j) => j.stance.kind === "contradicts");
  const supports = judged.filter((j) => j.stance.kind === "supports");
  const untrusted = judged.filter((j) => j.stance.kind === "untrusted");
  const ignored = untrusted.length
    ? ` Ignored as untrusted: ${untrusted.map((j) => j.evidence.id).join(", ")} (instruction-like text, treated as data).`
    : "";

  if (contradicts.length > 0) {
    const reason =
      supports.length > 0
        ? `Conflicting evidence: ${ids(supports)} supports it but ${ids(contradicts)} contradicts it. ` +
          [...contradicts, ...supports].map(cite).join("; ") +
          "."
        : `Contradicted by ${contradicts.map(cite).join("; ")}.`;
    return {
      requirementId: req.id,
      status: "CONTRADICTED",
      reason: reason + ignored,
      evidenceIds: [...contradicts, ...supports].map((j) => j.evidence.id),
    };
  }

  if (supports.length > 0) {
    return {
      requirementId: req.id,
      status: "PROVEN",
      reason: `Proven by ${supports.map((j) => `${j.evidence.id}, which observed "${j.stance.quote}"`).join("; ")}.` + ignored,
      evidenceIds: supports.map((j) => j.evidence.id),
    };
  }

  const neutral = judged.filter((j) => j.stance.kind === "neutral");
  const parts = neutral.map(cite);
  return {
    requirementId: req.id,
    status: "NOT_PROVEN",
    reason: (parts.length ? `Not proven. ${parts.join("; ")}.` : "Not proven: no usable evidence.") + ignored,
    evidenceIds: judged.map((j) => j.evidence.id),
  };
}

export function verify(contract: Contract, evidence: Evidence[]): Verdict[] {
  return contract.requirements.map((req) => verifyRequirement(req, contract, evidence));
}

/** PROVEN ÷ total, as a whole percentage. Explicitly not a confidence score. */
export function coverage(verdicts: Verdict[]): number {
  if (verdicts.length === 0) return 0;
  return Math.round((100 * verdicts.filter((v) => v.status === "PROVEN").length) / verdicts.length);
}
