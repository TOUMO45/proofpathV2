import { describe, expect, it } from "vitest";
import { generateContract } from "@/lib/contract/generate";
import { approvalBlocker, initialState, reducer, type Action, type State } from "@/lib/store";

const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);

function ownGoal(goal: string): State {
  const r = generateContract(goal);
  if (!r.ok) throw new Error(r.error);
  return run([{ type: "createContract", goal, requirements: r.requirements }]);
}

describe("real-world flow: your own goal, an agent's 'done' message", () => {
  it("own goal → approve → paste an agent claim → verify → NOT PROVEN, naming the hypothetical wording", () => {
    let st = ownGoal("Add a dark mode toggle that persists after page reload");
    expect(st.session!.contract.approved).toBe(false);
    expect(st.session!.isDemo).toBe(false);

    st = run([{ type: "approveContract" }], st);
    expect(st.session!.contract.approved).toBe(true);

    st = run(
      [
        {
          type: "addEvidence",
          draft: {
            kind: "claim",
            text: "I've added a dark mode toggle to the header. Your preference will persist after page reload.",
            links: ["R1", "R2"],
          },
        },
        { type: "verify" },
      ],
      st,
    );
    const verdicts = st.session!.verdicts;
    expect(verdicts.map((v) => v.status)).toEqual(["NOT_PROVEN", "NOT_PROVEN"]);
    // Every reason leads with the agent-claim rule; the "will" note is added only
    // where the modal sentence is about the requirement (R2: persists after reload).
    for (const v of verdicts) expect(v.reason).toMatch(/^Not proven\. E1: Agent claim: a claim, not your observation\. Verify it yourself/);
    expect(verdicts[0].reason).not.toContain('"will"');
    expect(verdicts[1].reason).toContain('hypothetical wording ("will")');
    expect(verdicts[1].reason).toContain('"Your preference will persist after page reload"');
    expect(st.session!.evidence[0].kind).toBe("claim");
  });

  it("then real observations replace the claim's promise with proof", () => {
    let st = ownGoal("Add a dark mode toggle that persists after page reload");
    st = run(
      [
        { type: "approveContract" },
        {
          type: "addEvidence",
          draft: {
            kind: "structured",
            structured: { input: "none", action: "Opened the settings page", observed: "Dark mode toggle is visible in the header" },
            links: ["R1"],
          },
        },
        {
          type: "addEvidence",
          draft: {
            kind: "structured",
            structured: { input: "none", action: "Turned the dark mode toggle on, then reloaded the page", observed: "Page is still dark after reload" },
            links: ["R2"],
          },
        },
        { type: "verify" },
      ],
      st,
    );
    expect(st.session!.verdicts.map((v) => v.status)).toEqual(["PROVEN", "PROVEN"]);
  });
});

describe("contract review", () => {
  it("a flagged requirement blocks approval until it is split", () => {
    let st = ownGoal("Add a dark mode toggle that persists after page reload");
    st = run([{ type: "addRequirement" }], st);
    const added = st.session!.contract.requirements.at(-1)!.id;
    st = run([{ type: "editRequirement", id: added, patch: { text: "The editor saves the file and shows a toast" } }], st);
    expect(approvalBlocker(st.session!)).toMatch(/flagged/);
    expect(run([{ type: "approveContract" }], st).session!.contract.approved).toBe(false);

    st = run([{ type: "splitRequirement", id: added }], st);
    const texts = st.session!.contract.requirements.map((r) => r.text);
    expect(texts).toContain("The editor saves the file");
    expect(texts).toContain("The editor shows a toast");
    expect(approvalBlocker(st.session!)).toBeNull();
    expect(run([{ type: "approveContract" }], st).session!.contract.approved).toBe(true);
  });

  it("evidence can't be added before approval", () => {
    const st = ownGoal("Add a dark mode toggle that persists after page reload");
    const after = run([{ type: "addEvidence", draft: { kind: "text", text: "Opened settings: the toggle is visible.", links: ["R1"] } }], st);
    expect(after.session!.evidence).toEqual([]);
  });

  it("the contract can't be edited while approved", () => {
    const st = run([{ type: "approveContract" }], ownGoal("Add a dark mode toggle that persists after page reload"));
    const after = run([{ type: "editRequirement", id: "R1", patch: { text: "Something else entirely" } }], st);
    expect(after).toBe(st);
  });

  it("editing a requirement's text re-derives its target words", () => {
    let st = ownGoal("Add a dark mode toggle that persists after page reload");
    st = run([{ type: "editRequirement", id: "R1", patch: { text: "The theme switch is visible in the header" } }], st);
    expect(st.session!.contract.requirements[0].targets).toEqual(["theme", "switch", "header"]);
  });
});

describe("Edit contract (reopen)", () => {
  function withEvidence(): State {
    return run(
      [
        { type: "approveContract" },
        { type: "addEvidence", draft: { kind: "text", text: "Opened settings: the dark mode toggle is visible.", links: ["R1"] } },
        { type: "addEvidence", draft: { kind: "text", text: "Toggled dark mode and reloaded the page: still dark.", links: ["R1", "R2"] } },
        { type: "verify" },
      ],
      ownGoal("Add a dark mode toggle that persists after page reload"),
    );
  }

  it("reopening makes all verdicts stale", () => {
    const st = run([{ type: "reopenContract" }], withEvidence());
    expect(st.session!.contract.approved).toBe(false);
    expect(st.session!.stale).toBe(true);
  });

  it("deleting a requirement removes its links; evidence linked only to it goes with it", () => {
    const st = run([{ type: "reopenContract" }, { type: "removeRequirement", id: "R1" }], withEvidence());
    expect(st.session!.evidence.map((e) => [e.id, e.links])).toEqual([["E2", ["R2"]]]);
  });

  it("editing a requirement keeps its links", () => {
    const st = run(
      [{ type: "reopenContract" }, { type: "editRequirement", id: "R1", patch: { text: "The dark mode switch is visible in the header" } }],
      withEvidence(),
    );
    expect(st.session!.evidence.map((e) => e.links)).toEqual([["R1"], ["R1", "R2"]]);
  });

  it("the clean rules apply again before re-approval", () => {
    let st = run([{ type: "reopenContract" }, { type: "editRequirement", id: "R1", patch: { text: "The toggle works properly" } }], withEvidence());
    expect(approvalBlocker(st.session!)).toMatch(/flagged/);
    st = run([{ type: "approveContract" }], st);
    expect(st.session!.contract.approved).toBe(false);
  });
});
