// "Check an agent's reply": the request becomes the contract, the reply becomes
// E1 (an agent claim linked to every requirement), and Verify runs once.
//
// Fixture: tests/fixtures/tip-agent-reply.md is RECONSTRUCTED around the line
// the learner quoted from a real agent ("Verified: 125.00 @ 18% → tip $22.50").
// Replace it with the exact reply when available; the assertions should hold.

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
import { AGENT_CLAIM_NOTE } from "@/lib/verify";

const FIXTURE = path.join(__dirname, "fixtures", "tip-agent-reply.md");
const REPLY = readFileSync(FIXTURE, "utf8");
const REQUEST = "Build a tip calculator that takes a bill amount and a tip percentage, shows the tip and the total, and rejects negative amounts";
const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);

function checkReply(request: string, reply: string): State {
  const r = generateContract(request);
  if (!r.ok) throw new Error(r.error);
  return run([{ type: "createContract", goal: request, requirements: r.requirements, pendingClaim: reply }]);
}

describe("full path: request + pasted reply → contract → approve → E1 agent claim → verdicts", () => {
  it("the reply waits in review and is not evidence yet", () => {
    const st = checkReply(REQUEST, REPLY);
    expect(st.session!.contract.approved).toBe(false);
    expect(st.session!.pendingClaim).toBe(REPLY);
    expect(st.session!.evidence).toEqual([]);
  });

  it("approve adds E1 as an agent claim linked to every requirement and runs Verify once", () => {
    const st = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY));
    const s = st.session!;
    expect(s.pendingClaim).toBeUndefined();
    expect(s.evidence).toHaveLength(1);
    expect(s.evidence[0]).toMatchObject({ id: "E1", kind: "claim", text: REPLY.trim() }); // evidence text is trimmed
    expect(s.evidence[0].links).toEqual(s.contract.requirements.map((r) => r.id));
    expect(s.stale).toBe(false);
    expect(s.verdicts).toHaveLength(s.contract.requirements.length);
  });

  it("concrete past-tense claims prove nothing: every requirement is NOT PROVEN, 'a claim, not your observation'", () => {
    const s = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!;
    expect(s.contract.requirements.map((r) => r.text)).toEqual([
      "The tip calculator takes a bill amount and a tip percentage",
      "The tip calculator shows the tip and the total",
      "The tip calculator rejects negative amounts",
    ]);
    for (const v of s.verdicts) {
      expect(v.status, v.reason).toBe("NOT_PROVEN");
      expect(v.reason).toContain(AGENT_CLAIM_NOTE);
    }
  });

  it("'Negative amounts are rejected' is attributed to the rejects requirement, not read as a failure of 'takes a bill amount'", () => {
    const s = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!;
    expect(s.verdicts.find((v) => v.requirementId === "R1")!.status).not.toBe("CONTRADICTED");
  });

  it("each Proof Gap lists the agent's concrete claims to check", () => {
    const s = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!;
    const { gaps } = gapsForDisplay(s);
    const r2 = gaps.find((g) => g.requirementId === "R2")!;
    expect(r2.agentClaims).toContain("125.00 @ 18% → tip $22.50, total $147.50");
    const r3 = gaps.find((g) => g.requirementId === "R3")!;
    expect(r3.agentClaims).toContain('-5 → "Amount must be positive"');
  });

  it("each claim goes to the requirement it matches best, not every requirement that shares a word", () => {
    const s = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!;
    const byReq = Object.fromEntries(gapsForDisplay(s).gaps.map((g) => [g.requirementId, g.agentClaims]));
    expect(byReq.R1.some((c) => c.startsWith("Negative amounts are rejected"))).toBe(false);
    expect(byReq.R3.some((c) => c.startsWith("Negative amounts are rejected"))).toBe(true);
  });

  it("quotes never start with a bullet marker", () => {
    const s = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!;
    for (const v of s.verdicts) expect(v.reason).not.toMatch(/"- /);
  });

  it("the Proof Card never lists the agent claim as a prover, even once real observations reach 100%", () => {
    let st = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY));
    const observe = (links: string[], action: string, observed: string): Action => ({
      type: "addEvidence",
      draft: { kind: "structured", structured: { input: "bill=125.00, tip=18%", action, observed }, links },
    });
    st = run(
      [
        observe(["R1"], "Typed a bill amount of 125.00 and a tip percentage of 18", "Bill amount and tip percentage accepted; tip calculated as $22.50"),
        observe(["R2"], "Entered bill 125.00 and tip 18%", "Tip $22.50 and total $147.50 shown"),
        observe(["R3"], "Entered -5 as the bill amount", "Negative amount rejected: message 'Amount must be positive' shown"),
        { type: "verify" },
      ],
      st,
    );
    expect(st.session!.verdicts.map((v) => v.status)).toEqual(["PROVEN", "PROVEN", "PROVEN"]);
    const card = buildProofCard(st.session!, new Date("2026-09-28T00:00:00Z"))!;
    expect(card).not.toContain("E1");
    expect(card).not.toMatch(/agent claim/i);
  });
});

describe("upload path", () => {
  it("a .md fixture passes the upload check and produces the same result as pasting", () => {
    expect(checkUpload({ name: "tip-agent-reply.md", size: statSync(FIXTURE).size, type: "text/markdown" })).toEqual({ ok: true });
    const pasted = run([{ type: "approveContract" }], checkReply(REQUEST, REPLY)).session!.verdicts;
    const uploaded = run([{ type: "approveContract" }], checkReply(REQUEST, readFileSync(FIXTURE, "utf8"))).session!.verdicts;
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
    const st = run([{ type: "approveContract" }], checkReply(REQUEST, `The calculator wo${zw}uld reject negative amounts.`));
    for (const v of st.session!.verdicts) expect(v.reason).toContain('hypothetical wording ("would")');
    expect(st.session!.evidence[0].flags).toContain("obfuscated");
  });
});

describe("prose pasted into the plan box", () => {
  it("an agent's reply reads like prose, so the plan box offers to check it as a reply", () => {
    expect(looksLikeProse(REPLY)).toBe(true);
    expect(looksLikeProse("Done. I added dark mode and it persists after reload, verified in Chrome and Firefox.")).toBe(true);
  });

  it("a real plan with checkbox items does not", () => {
    expect(looksLikeProse("# Plan\n- [ ] The export button downloads a CSV file\n")).toBe(false);
  });

  it("a few words are not prose", () => {
    expect(looksLikeProse("dark mode toggle")).toBe(false);
  });
});

describe("concrete claims extraction", () => {
  it("finds numbers, quoted strings and arrows, drops the 'Verified:' label", () => {
    expect(claimFacts(REPLY, ["tip", "total"])).toEqual(["125.00 @ 18% → tip $22.50, total $147.50"]);
    expect(claimFacts("It works great. All good.", ["tip"], { fallbackToAll: true })).toEqual([]);
  });
});
