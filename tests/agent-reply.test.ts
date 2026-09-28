// "Check an agent's reply", end to end with a real run: the learner's exact goal,
// the agent's exact final reply (tests/fixtures/tip-agent-reply.md, unchanged),
// and the learner's own three observations of the real calculator.
//
// goal → contract → approve → E1 = the agent reply → Verify = 0% →
// add the learner's 3 observations → Verify = 100% → Proof Card.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claimFacts } from "@/lib/claims";
import { generateContract } from "@/lib/contract/generate";
import { gapsForDisplay } from "@/lib/gap";
import { looksLikeProse } from "@/lib/import/plan";
import { buildProofCard } from "@/lib/proofcard";
import { initialState, reducer, type Action, type State } from "@/lib/store";
import { checkUpload } from "@/lib/upload";
import { AGENT_CLAIM_NOTE, coverage } from "@/lib/verify";

const FIXTURE = path.join(__dirname, "fixtures", "tip-agent-reply.md");
const REPLY = readFileSync(FIXTURE, "utf8");
const GOAL =
  "Build a single-page tip calculator in one HTML file: bill amount and tip % inputs, shows the tip and the total, and rejects a negative bill with an error message.";
const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);

function checkReply(goal: string, reply: string): State {
  const r = generateContract(goal);
  if (!r.ok) throw new Error(r.error);
  return run([{ type: "createContract", goal, requirements: r.requirements, pendingClaim: reply }]);
}
const approved = () => run([{ type: "approveContract" }], checkReply(GOAL, REPLY));

// The learner's own observations of the real calculator.
const observe = (links: string[], input: string, action: string, observed: string): Action => ({
  type: "addEvidence",
  draft: { kind: "structured", structured: { input, action, observed }, links },
});
const LEARNER_OBSERVATIONS: Action[] = [
  observe(["R1"], "none", "Opened tip-calculator.html in the browser", 'The page shows a "Bill amount" input and a "Tip percentage" input, with 15%, 18%, 20% and 25% buttons'),
  observe(["R2"], "bill = 125, tip = 18%", "Typed the bill and selected 18%", "The page shows Tip $22.50 and Total to pay $147.50"),
  observe(["R3"], "bill = -50, tip = 18%", "Typed -50 in the bill field", 'The error message "The bill can\'t be negative. Enter 0 or more." is shown and the total is cleared to —'),
];

describe("the goal becomes a clean contract", () => {
  it("three requirements; the colon's features are split, and targets lead with what distinguishes each", () => {
    const r = generateContract(GOAL);
    if (!r.ok) throw new Error(r.error);
    expect(r.requirements.map((q) => [q.text, q.expected])).toEqual([
      ["The single-page tip calculator has bill amount and tip % inputs", "displays"],
      ["The single-page tip calculator shows the tip and the total", "displays"],
      ["The single-page tip calculator rejects a negative bill with an error message", "rejects"],
    ]);
    expect(r.requirements[0].targets.slice(0, 3)).toEqual(["bill", "amount", "inputs"]); // the learner's earlier "missed bill and amount"
    for (const q of r.requirements) expect(q.flags).toEqual([]);
  });
});

describe("end to end: agent reply → 0% → the learner's observations → 100%", () => {
  it("before approval the reply waits in review and is not evidence yet", () => {
    const s = checkReply(GOAL, REPLY).session!;
    expect(s.contract.approved).toBe(false);
    expect(s.pendingClaim).toBe(REPLY);
    expect(s.evidence).toEqual([]);
  });

  it("approve adds E1 = the reply as an agent claim linked to every requirement, and runs Verify once", () => {
    const s = approved().session!;
    expect(s.pendingClaim).toBeUndefined();
    expect(s.evidence).toHaveLength(1);
    expect(s.evidence[0]).toMatchObject({ id: "E1", kind: "claim", text: REPLY.trim() }); // evidence text is trimmed
    expect(s.evidence[0].links).toEqual(["R1", "R2", "R3"]);
    expect(s.stale).toBe(false);
  });

  it("the agent's reply alone gives 0%: every requirement NOT PROVEN, each reason leading with the agent-claim rule", () => {
    const s = approved().session!;
    expect(coverage(s.verdicts)).toBe(0);
    for (const v of s.verdicts) {
      expect(v.status, v.reason).toBe("NOT_PROVEN");
      expect(v.reason.startsWith(`Not proven. E1: ${AGENT_CLAIM_NOTE}`), v.reason).toBe(true);
    }
  });

  it("the agent describing its error handling ('inline error', 'contradicted the error message') is not a reported failure", () => {
    for (const v of approved().session!.verdicts) expect(v.status).not.toBe("CONTRADICTED");
  });

  it("no reason quotes or mentions the unrelated 'Separately…' paragraph, 'couldn't', or a hypothetical", () => {
    for (const v of approved().session!.verdicts) {
      expect(v.reason).not.toMatch(/Separately|checklist|couldn't|6-ship|hypothetical/i);
    }
  });

  it("the Proof Gaps list the agent's concrete claims to check, e.g. the 125.00 @ 18% math under 'shows the tip and the total'", () => {
    const gaps = gapsForDisplay(approved().session!).gaps;
    const r2 = gaps.find((g) => g.requirementId === "R2")!;
    expect(r2.agentClaims.some((c) => c.includes("`125.00 @ 18%` → tip `$22.50`, total `147.50`"))).toBe(true);
    const r3 = gaps.find((g) => g.requirementId === "R3")!;
    expect(r3.agentClaims.some((c) => c.includes(`"The bill can't be negative. Enter 0 or more."`))).toBe(true);
    for (const g of gaps) for (const c of g.agentClaims) expect(c).not.toMatch(/Separately|checklist/);
  });

  it("the learner's own observations take it to 100%", () => {
    const s = run([...LEARNER_OBSERVATIONS, { type: "verify" }], approved()).session!;
    expect(s.verdicts.map((v) => [v.requirementId, v.status])).toEqual([
      ["R1", "PROVEN"],
      ["R2", "PROVEN"],
      ["R3", "PROVEN"],
    ]);
    expect(coverage(s.verdicts)).toBe(100);
    expect(s.verdicts.map((v) => v.evidenceIds)).toEqual([["E2"], ["E3"], ["E4"]]); // never E1
  });

  it("R3: the quoted UI message \"The bill can't be negative.\" is what the app displayed, not a negation", () => {
    const s = run([...LEARNER_OBSERVATIONS, { type: "verify" }], approved()).session!;
    const r3 = s.verdicts.find((v) => v.requirementId === "R3")!;
    expect(r3.status).toBe("PROVEN");
    expect(r3.reason).toContain("'The bill can't be negative. Enter 0 or more.'"); // quoted whole, not cut at the inner "."
  });

  it("the Proof Card lists R1–R3 as proven by the learner's observations (self-reported), and E1 never as a prover", () => {
    const s = run([...LEARNER_OBSERVATIONS, { type: "verify" }], approved()).session!;
    const card = buildProofCard(s, new Date("2026-09-28T00:00:00Z"))!;
    expect(card).toContain("- [x] **R1** The single-page tip calculator has bill amount and tip % inputs — proven by E2 (self-reported)");
    expect(card).toContain("- [x] **R2** The single-page tip calculator shows the tip and the total — proven by E3 (self-reported)");
    expect(card).toContain("- [x] **R3** The single-page tip calculator rejects a negative bill with an error message — proven by E4 (self-reported)");
    expect(card).not.toContain("E1 (");
    expect(card).not.toMatch(/agent claim/i);
  });
});

describe("upload path", () => {
  it("the reply as a .md file passes the upload check and gives the same verdicts as pasting it", () => {
    expect(checkUpload({ name: "tip-agent-reply.md", size: statSync(FIXTURE).size, type: "text/markdown" })).toEqual({ ok: true });
    const pasted = approved().session!.verdicts;
    const uploaded = run([{ type: "approveContract" }], checkReply(GOAL, readFileSync(FIXTURE, "utf8"))).session!.verdicts;
    expect(uploaded).toEqual(pasted);
  });

  it.each([
    [{ name: "reply.pdf", size: 1000, type: "application/pdf" }, /isn't a \.md or \.txt file/],
    [{ name: "reply.docx", size: 1000 }, /isn't a \.md or \.txt file/],
    [{ name: "reply.md", size: 1000, type: "image/png" }, /isn't plain text/],
    [{ name: "huge.md", size: 300 * 1024, type: "text/markdown" }, /300 KB; the limit is 200 KB/],
  ])("rejects %o with a clear message", (file, message) => {
    const r = checkUpload(file);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(message);
  });

  it("accepts exactly 200 KB and a .txt file", () => {
    expect(checkUpload({ name: "a.txt", size: 200 * 1024, type: "text/plain" }).ok).toBe(true);
  });

  it("uploaded text goes through the same normalization as pasted text (a zero-width 'would' is still caught)", () => {
    const zw = String.fromCodePoint(0x200b);
    const s = run([{ type: "approveContract" }], checkReply(GOAL, `The tip calculator wo${zw}uld reject a negative bill.`)).session!;
    expect(s.verdicts.find((v) => v.requirementId === "R3")!.reason).toContain('hypothetical wording ("would")');
    expect(s.evidence[0].flags).toContain("obfuscated");
  });
});

describe("prose pasted into the plan box", () => {
  it("the real agent reply has no checkbox items and reads like prose, so the plan box offers to check it as a reply", () => {
    expect(looksLikeProse(REPLY)).toBe(true);
  });

  it("a real plan with checkbox items does not", () => {
    expect(looksLikeProse("# Plan\n- [ ] The export button downloads a CSV file\n")).toBe(false);
  });

  it("a few words are not prose", () => {
    expect(looksLikeProse("dark mode toggle")).toBe(false);
  });
});

describe("concrete claims extraction", () => {
  it("finds numbers, quoted strings and arrows, keeps quoted messages whole, drops a 'Verified:' label", () => {
    const facts = claimFacts(REPLY, [], { fallbackToAll: true, max: 20 });
    expect(facts.some((f) => f.includes(`"The bill can't be negative. Enter 0 or more."`))).toBe(true);
    expect(facts.some((f) => f === "Enter 0 or more.")).toBe(false); // never a fragment split inside quotes
    expect(claimFacts("Verified: 125.00 @ 18% → tip $22.50.", ["tip"])).toEqual(["125.00 @ 18% → tip $22.50"]);
    expect(claimFacts("It works great. All good.", ["tip"], { fallbackToAll: true })).toEqual([]);
  });

  it("each claim goes to the requirement(s) it matches best", () => {
    const r = generateContract(GOAL);
    if (!r.ok) throw new Error(r.error);
    const st = run([
      { type: "createContract", goal: GOAL, requirements: r.requirements, pendingClaim: "The tip is $22.50 and the total is $147.50.\nA negative bill shows the message \"Bill can't be negative\"." },
      { type: "approveContract" },
    ]);
    const byReq = Object.fromEntries(gapsForDisplay(st.session!).gaps.map((g) => [g.requirementId, g.agentClaims]));
    expect(byReq.R2).toEqual(["The tip is $22.50 and the total is $147.50"]);
    expect(byReq.R3).toEqual([`A negative bill shows the message "Bill can't be negative"`]);
  });
});
