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

export const AGENT_CLAIM_NOTE = "Agent claim: a claim, not your observation. Verify it yourself";

/**
 * The stance that counts toward a verdict. An agent's claim is screened like
 * any text: it can be untrusted, hypothetical, or contradict a requirement
 * (it reported a failure). But it never supports one: with no human
 * observation, it is only a claim.
 */
export function effectiveStance(req: Requirement, e: Evidence, linked: Requirement[]): Stance {
  const s = stance(req, e, linked);
  if (e.kind !== "claim") return s;
  if (s.kind === "untrusted" || s.kind === "contradicts") return s;
  // keep the screens' own findings; they say more than the generic note
  if (s.kind === "neutral" && /^(hypothetical wording|vague approval)/.test(s.note)) return s;
  return { kind: "neutral", note: AGENT_CLAIM_NOTE, quote: s.quote };
}

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
    stance: effectiveStance(
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
    const linkQuestions = overLinks(req, contract, evidence)
      .map((o) => ` ${o.evidenceId} is linked to ${req.id} but observed "${o.quote}". Is this link intended?`)
      .join("");
    return {
      requirementId: req.id,
      status: "CONTRADICTED",
      reason: reason + linkQuestions + ignored,
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

function activeLinked(req: Requirement, evidence: Evidence[]): Evidence[] {
  const superseded = supersededIds(evidence);
  return evidence.filter((e) => e.links.includes(req.id) && !superseded.has(e.id));
}

function linkedReqs(contract: Contract, e: Evidence): Requirement[] {
  return contract.requirements.filter((r) => e.links.includes(r.id));
}

/** Active evidence that contradicts this requirement (for the "retest after a fix?" prompt). */
export function contradictingIds(req: Requirement, contract: Contract, evidence: Evidence[]): string[] {
  return activeLinked(req, evidence)
    .filter((e) => effectiveStance(req, e, linkedReqs(contract, e)).kind === "contradicts")
    .map((e) => e.id);
}

/**
 * Likely over-linking: evidence linked to several requirements that proves one
 * of them but contradicts this one ("blocked" proves a rejects requirement but
 * contradicts "valid submission succeeds"). The verdict stays CONTRADICTED;
 * the reason asks whether the link was intended.
 */
export function overLinks(req: Requirement, contract: Contract, evidence: Evidence[]): { evidenceId: string; quote: string }[] {
  const out: { evidenceId: string; quote: string }[] = [];
  for (const e of activeLinked(req, evidence)) {
    if (e.links.length < 2) continue;
    const reqs = linkedReqs(contract, e);
    const here = effectiveStance(req, e, reqs);
    if (here.kind !== "contradicts") continue;
    const provesOther = reqs.some((r) => r.id !== req.id && effectiveStance(r, e, reqs).kind === "supports");
    if (provesOther) out.push({ evidenceId: e.id, quote: here.quote });
  }
  return out;
}

export function verify(contract: Contract, evidence: Evidence[]): Verdict[] {
  return contract.requirements.map((req) => verifyRequirement(req, contract, evidence));
}

/** PROVEN ÷ total, as a whole percentage. Explicitly not a confidence score. */
export function coverage(verdicts: Verdict[]): number {
  if (verdicts.length === 0) return 0;
  return Math.round((100 * verdicts.filter((v) => v.status === "PROVEN").length) / verdicts.length);
}
