// Proof Gap builder: for every requirement that isn't PROVEN, the smallest
// concrete test to run next. spec.md > Gap Builder (lib/gap).

import type { Contract, ExpectedOutcome, Verdict } from "./types";

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

export function buildGaps(contract: Contract, verdicts: Verdict[]): ProofGap[] {
  const gaps: ProofGap[] = [];
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
      statement: `I will verify that ${lowerFirst(req.text.replace(/[.\s]+$/, ""))}.`,
      why: verdict.reason,
      retestOf: verdict.status === "CONTRADICTED" ? verdict.evidenceIds : [],
    });
  }
  return gaps;
}
