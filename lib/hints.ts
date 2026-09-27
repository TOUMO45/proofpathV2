// Guidance for the evidence form. Hints only suggest; they never link,
// unlink or supersede anything by themselves.

import { demoSampleObserved } from "./fixtures/demo";
import { supersedableEvidence } from "./store";
import { matchedTargets } from "./text";
import type { EvidenceKind, Session } from "./types";
import { contradictingIds } from "./verify";

export type MissingLinkHint = { requirementId: string; matched: string[] };

/**
 * Unlinked requirements whose target words the observation already mentions
 * (same threshold as support): "This also mentions R4's targets. Link to R4 too?"
 */
export function missingLinkHints(session: Session, observed: string, links: string[]): MissingLinkHint[] {
  if (!observed.trim()) return [];
  return session.contract.requirements
    .filter((r) => !links.includes(r.id) && r.targets.length > 0)
    .map((r) => ({ requirementId: r.id, matched: matchedTargets(observed, r.targets) }))
    .filter((h) => {
      const req = session.contract.requirements.find((r) => r.id === h.requirementId)!;
      return h.matched.length >= Math.max(1, Math.min(2, req.targets.length));
    });
}

export type RetestPrompt = { requirementId: string; evidenceId: string };

/**
 * For each linked requirement whose last verdict is CONTRADICTED: the evidence
 * contradicting it, if a new item could supersede it. "R3 is contradicted by E3.
 * Is this a retest after a fix?"
 */
export function retestPrompts(session: Session, links: string[]): RetestPrompt[] {
  const supersedable = new Set(supersedableEvidence(session, links).map((e) => e.id));
  const out: RetestPrompt[] = [];
  for (const id of links) {
    if (session.verdicts.find((v) => v.requirementId === id)?.status !== "CONTRADICTED") continue;
    const req = session.contract.requirements.find((r) => r.id === id);
    if (!req) continue;
    for (const evidenceId of contradictingIds(req, session.contract, session.evidence)) {
      if (supersedable.has(evidenceId) && !out.some((p) => p.evidenceId === evidenceId)) out.push({ requirementId: id, evidenceId });
    }
  }
  return out;
}

/**
 * DEMO ONLY: the sample Observed text for "Show me a passing retest". Returns
 * undefined outside the demo, so it can never fill real evidence.
 */
export function demoSampleFor(session: Session, kind: EvidenceKind, links: string[]): string | undefined {
  if (!session.isDemo || kind !== "structured" || links.length === 0) return undefined;
  return demoSampleObserved[links[0]];
}
