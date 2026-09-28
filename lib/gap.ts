// Proof Gap builder: for every requirement that isn't PROVEN, the smallest
// concrete test to run next. spec.md > Gap Builder (lib/gap).

import { claimFacts } from "./claims";
import { ownTargets, targetOccurrences } from "./text";
import type { Contract, Evidence, ExpectedOutcome, Requirement, Session, Verdict } from "./types";
import { supersededIds } from "./verify";

export type ProofGap = {
  requirementId: string;
  requirementText: string;
  status: Exclude<Verdict["status"], "PROVEN">;
  /** What to do. */
  action: string;
  /** What to record, and how. */
  observe: string;
  /** The claim the next piece of evidence has to support. */
  statement: string;
  /** Why the gap is open: the verdict's reason. */
  why: string;
  /** For a contradiction: the evidence a passing retest should supersede. */
  retestOf: string[];
  /** Concrete claims from linked agent messages: "The agent claims: … Check it." */
  agentClaims: string[];
};

const OBSERVE: Record<ExpectedOutcome, string> = {
  displays: "Record what is on screen in an `Observed:` line, quoting the exact text you see.",
  succeeds:
    "Record in an `Observed:` line what confirms it went through (message, status code, saved item) and whether any error appeared.",
  rejects: "Record in an `Observed:` line the message or block you saw, and that the input was not accepted.",
  persists: "Reload or restart first, then record in an `Observed:` line what is still there.",
};

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** What "Record this test" puts in the evidence form. Observed is never pre-filled. */
export type RecordPrefill = { requirementId: string; input: string; action: string };

const SUGGESTED_INPUT: Record<ExpectedOutcome, string> = {
  succeeds: "valid, realistic input",
  rejects: "the input that must be refused",
  displays: "none",
  persists: "a changed setting, then a reload",
};

/**
 * Input and Action for recording the gap's suggested test. The Action is the
 * "do" part of the proof template ("Fill in valid details, press Send"); the
 * Input is reused from the evidence being retested when there is one.
 * Observed stays empty: pre-filling what was seen would fabricate evidence.
 */
export function recordPrefill(gap: ProofGap, session: Session): RecordPrefill {
  const req = session.contract.requirements.find((r) => r.id === gap.requirementId)!;
  const doPart = gap.action.split(/,? and (?:observe|check that)\b|\. /i)[0].replace(/[.\s]+$/, "");
  const retested = session.evidence.find((e) => gap.retestOf.includes(e.id) && e.kind === "structured");
  return {
    requirementId: gap.requirementId,
    input: retested?.structured?.input ?? SUGGESTED_INPUT[req.expected],
    action: doPart,
  };
}

/**
 * The concrete claims in an agent's message that belong to this requirement:
 * each claim goes to the linked requirement(s) whose target words it matches
 * best, so "Negative amounts are rejected" lands on the rejects requirement,
 * not on every requirement that mentions an amount.
 */
function claimsFor(req: Requirement, e: Evidence, contract: Contract): string[] {
  const linked = contract.requirements.filter((r) => e.links.includes(r.id));
  const all = claimFacts(e.text ?? "", [], { fallbackToAll: true, max: 50 });
  return all.filter((fact) => {
    const scores = linked.map((r) => ({ id: r.id, n: targetOccurrences(fact, ownTargets(r.targets, r.shared)) }));
    const top = Math.max(0, ...scores.map((s) => s.n));
    if (top === 0) return linked.length === 1; // about nothing specific: only if the message is about this one requirement
    return scores.some((s) => s.id === req.id && s.n === top);
  });
}

export function buildGaps(contract: Contract, verdicts: Verdict[], evidence: Evidence[] = []): ProofGap[] {
  const gaps: ProofGap[] = [];
  const superseded = supersededIds(evidence);
  for (const req of contract.requirements) {
    const verdict = verdicts.find((v) => v.requirementId === req.id);
    if (!verdict || verdict.status === "PROVEN") continue;
    gaps.push({
      requirementId: req.id,
      requirementText: req.text,
      status: verdict.status,
      action: req.proofTemplate || `Run a test that shows: ${lowerFirst(req.text)}.`,
      observe:
        verdict.status === "CONTRADICTED"
          ? `Fix what the evidence shows first. Then run the test again and add it as a retest marked "Supersedes" the failing evidence. ${OBSERVE[req.expected]}`
          : OBSERVE[req.expected],
      statement: `Verify that ${lowerFirst(req.text.replace(/[.\s]+$/, ""))}.`,
      why: verdict.reason,
      retestOf: verdict.status === "CONTRADICTED" ? verdict.evidenceIds : [],
      agentClaims: [
        ...new Set(
          evidence
            .filter((e) => e.kind === "claim" && e.links.includes(req.id) && !superseded.has(e.id))
            .flatMap((e) => claimsFor(req, e, contract)),
        ),
      ].slice(0, 3),
    });
  }
  return gaps;
}

/**
 * The gaps to show in the Workspace. While verdicts are stale they are still
 * shown, dimmed and labeled "STALE: re-verify" (never as current), so several
 * gaps can be recorded before one Verify.
 */
export function gapsForDisplay(session: Session): { gaps: ProofGap[]; stale: boolean } {
  if (session.verdicts.length === 0) return { gaps: [], stale: false };
  return { gaps: buildGaps(session.contract, session.verdicts, session.evidence), stale: session.stale };
}
