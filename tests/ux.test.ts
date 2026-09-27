// Slice 6 part A: guidance from the slice-4 learner check. The verifier was right
// every time; these make the UI say what to do next, without ever deciding for you.

import { describe, expect, it } from "vitest";
import { buildGaps, recordPrefill } from "@/lib/gap";
import { demoContract, demoSampleObserved, demoSession } from "@/lib/fixtures/demo";
import { demoSampleFor, missingLinkHints, retestPrompts } from "@/lib/hints";
import { buildProofCard } from "@/lib/proofcard";
import { initialState, reducer, type Action, type State } from "@/lib/store";
import { overLinks, verify } from "@/lib/verify";

const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);
const verifiedDemo = () => run([{ type: "loadDemo" }, { type: "verify" }]);
const statusOf = (st: State, id: string) => st.session!.verdicts.find((v) => v.requirementId === id)!.status;

describe("1. Record this test", () => {
  it("pre-links only that requirement and pre-fills Input and Action from the suggested test", () => {
    const s = verifiedDemo().session!;
    const gaps = buildGaps(s.contract, s.verdicts);
    const r2 = recordPrefill(gaps.find((g) => g.requirementId === "R2")!, s);
    expect(r2).toEqual({ requirementId: "R2", input: "the input that must be refused", action: "Enter an invalid email, press Send" });
  });

  it("for a contradiction, reuses the Input of the evidence being retested", () => {
    const s = verifiedDemo().session!;
    const r3 = recordPrefill(buildGaps(s.contract, s.verdicts).find((g) => g.requirementId === "R3")!, s);
    expect(r3.input).toBe("name=Ada, email=ada@example.com, message=Hello");
    expect(r3.action).toBe("Fill in valid details, press Send");
  });

  it("never pre-fills an observation (that would fabricate evidence)", () => {
    const s = verifiedDemo().session!;
    for (const g of buildGaps(s.contract, s.verdicts)) expect(Object.keys(recordPrefill(g, s))).not.toContain("observed");
  });
});

describe("2. Over-linking hint", () => {
  const blockedTest = {
    kind: "structured" as const,
    // "refused" proves the rejects requirement (R2) and, because the sentence is
    // about the submission (R3's target), contradicts "valid details succeed".
    structured: { input: "email=x", action: "Entered the invalid email and pressed Send", observed: "Submission refused; message 'Please enter a valid email' shown" },
    links: ["R2", "R3"],
  };

  it("names the link in the reason and offers to unlink it", () => {
    const st = run([{ type: "addEvidence", draft: blockedTest }, { type: "verify" }], verifiedDemo());
    const r3 = st.session!.verdicts.find((v) => v.requirementId === "R3")!;
    expect(statusOf(st, "R2")).toBe("PROVEN");
    expect(r3.status).toBe("CONTRADICTED");
    expect(r3.reason).toContain('E4 is linked to R3 but observed "Submission refused"');
    expect(r3.reason).toContain("Is this link intended?");
    expect(overLinks(demoContract.requirements[2], st.session!.contract, st.session!.evidence).map((o) => o.evidenceId)).toEqual(["E4"]);
  });

  it("'Unlink E4 from R3' removes only that link and makes verdicts stale", () => {
    const st = run(
      [{ type: "addEvidence", draft: blockedTest }, { type: "verify" }, { type: "unlinkEvidence", evidenceId: "E4", requirementId: "R3" }],
      verifiedDemo(),
    );
    expect(st.session!.evidence.find((e) => e.id === "E4")!.links).toEqual(["R2"]);
    expect(st.session!.stale).toBe(true);
    const after = run([{ type: "verify" }], st);
    expect(after.session!.verdicts.find((v) => v.requirementId === "R3")!.evidenceIds).not.toContain("E4");
  });

  it("a single-link contradiction (the demo's 500) asks nothing", () => {
    const r3 = verifiedDemo().session!.verdicts.find((v) => v.requirementId === "R3")!;
    expect(r3.reason).not.toContain("Is this link intended?");
  });

  it("the last link can't be unlinked", () => {
    const st = verifiedDemo();
    expect(run([{ type: "unlinkEvidence", evidenceId: "E3", requirementId: "R3" }], st)).toBe(st);
  });
});

describe("3. Visible Supersedes", () => {
  it("linking a CONTRADICTED requirement prompts a retest of the evidence contradicting it", () => {
    const s = verifiedDemo().session!;
    expect(retestPrompts(s, ["R3"])).toEqual([{ requirementId: "R3", evidenceId: "E3" }]);
    expect(retestPrompts(s, ["R2"])).toEqual([]);
    expect(retestPrompts(s, [])).toEqual([]);
  });

  it("no prompt once E3 is already superseded", () => {
    const st = run(
      [
        {
          type: "addEvidence",
          draft: { kind: "structured", structured: { input: "x", action: "Pressed Send", observed: demoSampleObserved.R3 }, links: ["R3"], supersedes: "E3" },
        },
        { type: "verify" },
      ],
      verifiedDemo(),
    );
    expect(retestPrompts(st.session!, ["R3"])).toEqual([]);
  });
});

describe("4. Missing-link hint", () => {
  it("suggests an unlinked requirement whose targets the observation mentions, and links nothing by itself", () => {
    const s = verifiedDemo().session!;
    const hints = missingLinkHints(s, "Confirmation message 'Thanks, we received your message' shown", ["R3"]);
    expect(hints.map((h) => h.requirementId)).toContain("R4");
    expect(hints.find((h) => h.requirementId === "R4")!.matched).toEqual(["confirmation", "thank", "message"]);
  });

  it("no hint for a requirement already linked, or an empty observation", () => {
    const s = verifiedDemo().session!;
    expect(missingLinkHints(s, "Confirmation message 'Thanks' shown", ["R3", "R4"]).map((h) => h.requirementId)).not.toContain("R4");
    expect(missingLinkHints(s, "   ", [])).toEqual([]);
  });
});

describe("5. Demo-only sample retest", () => {
  it("is offered in the demo, for structured evidence with a link", () => {
    expect(demoSampleFor(demoSession(), "structured", ["R3"])).toBe(demoSampleObserved.R3);
    expect(demoSampleFor(demoSession(), "text", ["R3"])).toBeUndefined();
    expect(demoSampleFor(demoSession(), "structured", [])).toBeUndefined();
  });

  it("never appears outside the demo", () => {
    expect(demoSampleFor({ ...demoSession(), isDemo: false }, "structured", ["R3"])).toBeUndefined();
  });

  it("with Record this test + samples + the retest prompt, the demo reaches 100% in a few clicks", () => {
    let st = verifiedDemo();
    const s = st.session!;
    const gaps = buildGaps(s.contract, s.verdicts);
    const p2 = recordPrefill(gaps.find((g) => g.requirementId === "R2")!, s);
    const p3 = recordPrefill(gaps.find((g) => g.requirementId === "R3")!, s);
    st = run(
      [
        { type: "addEvidence", draft: { kind: "structured", structured: { input: p2.input, action: p2.action, observed: demoSampleObserved.R2 }, links: ["R2"] } },
        {
          type: "addEvidence",
          draft: { kind: "structured", structured: { input: p3.input, action: p3.action, observed: demoSampleObserved.R3 }, links: ["R3", "R4"], supersedes: "E3" },
        },
        { type: "verify" },
      ],
      st,
    );
    expect(st.session!.verdicts.map((v) => v.status)).toEqual(["PROVEN", "PROVEN", "PROVEN", "PROVEN"]);
  });
});

describe("6. Audit trail for deleted requirements", () => {
  it("demo → Verify → delete R3 → 100% → the Proof Card lists R3 as removed while CONTRADICTED", () => {
    let st = verifiedDemo();
    st = run(
      [
        { type: "addEvidence", draft: { kind: "structured", structured: { input: "email=x", action: "Entered the invalid email and pressed Send", observed: demoSampleObserved.R2 }, links: ["R2"] } },
        { type: "addEvidence", draft: { kind: "structured", structured: { input: "valid", action: "Submitted the form", observed: demoSampleObserved.R4 }, links: ["R4"] } },
        { type: "verify" },
      ],
      st,
    );
    expect(statusOf(st, "R3")).toBe("CONTRADICTED");
    st = run([{ type: "reopenContract" }, { type: "removeRequirement", id: "R3" }, { type: "approveContract" }, { type: "verify" }], st);
    expect(st.session!.verdicts.every((v) => v.status === "PROVEN")).toBe(true);
    const card = buildProofCard(st.session!, new Date("2026-09-27T00:00:00Z"))!;
    expect(card).toContain("**Contract changes after verification:**");
    expect(card).toContain('- R3 "Submitting valid details succeeds" removed (was CONTRADICTED; E3 removed)');
  });

  it("deleting a requirement that never had a verdict leaves no trace", () => {
    const st = run([{ type: "reopenContract" }, { type: "removeRequirement", id: "R4" }], run([{ type: "loadDemo" }]));
    expect(st.session!.removedRequirements).toEqual([]);
  });

  it("no 'Contract changes' section when nothing was removed", () => {
    const s = demoSession();
    const evidence = [...s.evidence];
    const full = run([{ type: "loadDemo" }]).session!;
    expect(full.removedRequirements).toEqual([]);
    const card = buildProofCard({ ...s, evidence, verdicts: verify(s.contract, evidence).map((v) => ({ ...v, status: "PROVEN" as const })), stale: false });
    expect(card).not.toContain("Contract changes");
  });
});

describe("over-linking: what is NOT flagged", () => {
  it("an observation whose words belong to another linked requirement is neutral for this one, not a contradiction", () => {
    // "Blocked" is one of R2's target words, so the sentence is about R2.
    const st = run(
      [
        {
          type: "addEvidence",
          draft: {
            kind: "structured",
            structured: { input: "email=x", action: "Entered the invalid email and pressed Send", observed: "Blocked; validation message 'Please enter a valid email' shown" },
            links: ["R2", "R3"],
          },
        },
        { type: "verify" },
      ],
      verifiedDemo(),
    );
    expect(statusOf(st, "R2")).toBe("PROVEN");
    const r3 = st.session!.verdicts.find((v) => v.requirementId === "R3")!;
    expect(r3.reason).not.toContain("E4 is linked");
    expect(r3.evidenceIds).not.toContain("E4");
  });
});
