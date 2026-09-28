import { describe, expect, it } from "vitest";
import { buildProofCard } from "@/lib/proofcard";
import { demoContract, demoEvidence, demoFixEvidence, demoSession } from "@/lib/fixtures/demo";
import { verify } from "@/lib/verify";
import type { Session } from "@/lib/types";

const NOW = new Date("2026-09-27T12:00:00Z");

function verified(evidence = [...demoEvidence, ...demoFixEvidence]): Session {
  return { ...demoSession(), evidence, verdicts: verify(demoContract, evidence), stale: false };
}

describe("Proof Card", () => {
  it("lists the goal, every requirement with its proving evidence, the count and the date", () => {
    const card = buildProofCard(verified(), NOW)!;
    expect(card).toContain("**Goal:** An AI agent says the contact form is done.");
    expect(card).toContain("- [x] **R1** Name, email and message fields are visible on the contact form — proven by E1 (self-reported)");
    expect(card).toContain("- [x] **R3** Submitting valid details succeeds — proven by E5 (self-reported)");
    expect(card).toContain("**Evidence:** 5 items (4 counted, 1 superseded)");
    expect(card).toContain("Verified by ProofPath rules on 2026-09-27.");
  });

  it("never implies ProofPath tested anything itself", () => {
    const card = buildProofCard(verified(), NOW)!;
    expect(card).toContain("Evidence is self-reported; ProofPath did not run any test itself.");
    expect(card).not.toMatch(/certif|guarantee|secure/i);
  });

  it("lists superseded evidence so a past failure is never hidden", () => {
    expect(buildProofCard(verified(), NOW)).toContain(
      '- E3 ("Page shows 500 Internal Server Error; no confirmation") superseded by E5 retest',
    );
  });

  it("an agent claim can never appear as a prover: with only a claim for R2 there is no card", () => {
    const text = "Entered the invalid email and pressed Send: validation message 'Please enter a valid email' shown, form not submitted.";
    const claim = { ...demoFixEvidence[0], id: "E7", kind: "claim" as const, structured: undefined, text };
    const evidence = [demoEvidence[0], claim, demoFixEvidence[1], demoEvidence[2]];
    expect(buildProofCard(verified(evidence), NOW)).toBeNull();
    // the same words typed as the developer's own observation do prove R2
    const card = buildProofCard(verified([demoEvidence[0], { ...claim, kind: "text" as const }, demoFixEvidence[1], demoEvidence[2]]), NOW)!;
    expect(card).toContain("proven by E7 (self-reported)");
    expect(card).not.toContain("agent claim");
  });

  it("marks demo fixture data", () => {
    expect(buildProofCard(verified(), NOW)).toContain("_Demo: fixture data._");
  });

  it("is not shown when verdicts are stale", () => {
    expect(buildProofCard({ ...verified(), stale: true }, NOW)).toBeNull();
  });

  it("is not shown below 100%", () => {
    expect(buildProofCard(verified(demoEvidence), NOW)).toBeNull();
  });
});
