import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canSelect, filterCandidates, importPlan, splitCandidate, toggleSelected } from "@/lib/import/plan";
import { makeRequirement } from "@/lib/contract/generate";
import { approvalBlocker, initialState, reducer, type Action, type State } from "@/lib/store";

const prd = readFileSync(path.join(__dirname, "..", "devpost", "prd.md"), "utf8");
const run = (actions: Action[], start: State = initialState) => actions.reduce(reducer, start);

describe("plan import on this repo's own devpost/prd.md", () => {
  const result = importPlan(prd);

  it("by default lists only checkbox items: the acceptance criteria, still more than the 7 that can be picked", () => {
    const checkboxLines = prd.split("\n").filter((l) => /^\s*[-*+]\s+\[[ xX]\]\s+/.test(l)).length;
    expect(result.candidates.every((c) => c.checkbox)).toBe(true);
    expect(result.candidates.length).toBeLessThanOrEqual(checkboxLines);
    expect(result.candidates.length).toBeGreaterThan(checkboxLines - 3); // only exact duplicates are dropped
    expect(result.skippedPlainBullets).toBeGreaterThan(50);
    const all = importPlan(prd, { includePlainBullets: true });
    expect(all.candidates.filter((c) => c.checkbox)).toHaveLength(result.candidates.length);
    expect(all.candidates.some((c) => !c.checkbox)).toBe(true);
  });

  it("each candidate shows the heading it came from", () => {
    const c = result.candidates.find((x) => x.text === "Evidence linked to no requirement can't be added")!;
    expect(c.heading).toBe("Evidence");
    expect(result.candidates.every((x) => x.heading.length > 0)).toBe(true);
  });

  it("the filter narrows the list by text or heading", () => {
    const demo = filterCandidates(result.candidates, "demo");
    expect(demo.length).toBeGreaterThan(0);
    expect(demo.length).toBeLessThan(result.candidates.length);
    expect(demo.every((c) => /demo/i.test(c.text) || /demo/i.test(c.heading))).toBe(true);
    expect(filterCandidates(result.candidates, "proof card").some((c) => c.heading === "Proof Card")).toBe(true);
    expect(filterCandidates(result.candidates, "   ")).toHaveLength(result.candidates.length);
    expect(filterCandidates(result.candidates, "zzz-no-match")).toEqual([]);
  });

  it("lists the acceptance criteria, including a known one", () => {
    expect(result.title).toBe("ProofPath — Product Requirements");
    expect(result.candidates.length).toBeGreaterThan(7);
    expect(result.candidates.map((c) => c.text)).toContain(
      "Evidence linked to no requirement can't be added",
    );
  });

  it("flags items that fail the clean rules, with a reason, instead of dropping them", () => {
    const flagged = result.candidates.filter((c) => c.flags.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
    const joined = flagged.find((c) => c.flags.includes("two behaviors joined by 'and'"));
    expect(joined?.splitSuggestion).toBeDefined();
    expect(flagged.some((c) => c.flags.some((f) => f.startsWith("vague word")))).toBe(true);
  });

  it("strips markdown and never keeps frontmatter or code-block lines", () => {
    for (const c of result.candidates) {
      expect(c.text).not.toMatch(/\*\*|`|^\[ \]|status: approved/);
      expect(c.text).not.toMatch(/[,.;:\s]$/);
    }
    const spec = readFileSync(path.join(__dirname, "..", "devpost", "spec.md"), "utf8");
    expect(importPlan(spec, { includePlainBullets: true }).candidates.some((c) => c.text.includes("├──"))).toBe(false);
  });

  it("at most 7 can be selected; an 8th can't; deselecting always works", () => {
    let selected: string[] = [];
    for (const c of result.candidates.slice(0, 8)) selected = toggleSelected(selected, c.id);
    expect(selected).toHaveLength(7);
    expect(canSelect(selected, result.candidates[7].id)).toBe(false);
    expect(canSelect(selected, selected[0])).toBe(true);
    expect(toggleSelected(selected, selected[0])).toHaveLength(6);
  });

  it("Split into 2 replaces a flagged candidate with two clean ones", () => {
    const joined = result.candidates.find((c) => c.splitSuggestion)!;
    const after = splitCandidate(result.candidates, joined.id);
    expect(after.length).toBe(result.candidates.length + 1);
    expect(after.find((c) => c.id === joined.id)).toBeUndefined();
  });
});

describe("plan import: edge cases and the flow into the contract", () => {
  it("no bullet or checkbox items → an empty list (the UI falls back to manual entry)", () => {
    expect(importPlan("# Notes\n\nJust prose, no list items.\n").candidates).toEqual([]);
  });

  it("plain bullets only → no candidates by default, but they are counted and can be included", () => {
    const md = "# Plan\n- The export button downloads a CSV file\n- The CSV file contains every visible row\n";
    expect(importPlan(md)).toMatchObject({ candidates: [], skippedPlainBullets: 2 });
    expect(importPlan(md, { includePlainBullets: true }).candidates).toHaveLength(2);
  });

  it("removes exact duplicates", () => {
    const r = importPlan("- [ ] The export button downloads a CSV file\n- The export button downloads a CSV file.\n", { includePlainBullets: true });
    expect(r.candidates).toHaveLength(1);
  });

  it("nothing enters an approved contract until it passes the clean rules", () => {
    const md = "# Plan\n- [ ] The editor saves the file and shows a toast\n- [ ] The export button downloads a CSV file\n";
    const texts = importPlan(md).candidates.map((c) => c.text);
    let st = run([{ type: "createContract", goal: "Imported plan: Plan", requirements: texts.map((t, i) => makeRequirement(`R${i + 1}`, t)) }]);
    expect(approvalBlocker(st.session!)).toMatch(/flagged/);
    expect(run([{ type: "approveContract" }], st).session!.contract.approved).toBe(false);
    st = run([{ type: "splitRequirement", id: "R1" }, { type: "approveContract" }], st);
    expect(st.session!.contract.approved).toBe(true);
  });

  it("import → approve → agent claim → Verify → NOT PROVEN naming the hypothetical wording", () => {
    const md = "# Plan\n- [ ] The export button downloads a CSV file\n- [ ] The CSV file contains every visible row\n";
    const texts = importPlan(md).candidates.map((c) => c.text);
    const st = run([
      { type: "createContract", goal: "Imported plan: Plan", requirements: texts.map((t, i) => makeRequirement(`R${i + 1}`, t)) },
      { type: "approveContract" },
      { type: "addEvidence", draft: { kind: "claim", text: "Export is implemented. Clicking the button should download a CSV with all rows.", links: ["R1", "R2"] } },
      { type: "verify" },
    ]);
    for (const v of st.session!.verdicts) {
      expect(v.status).toBe("NOT_PROVEN");
      expect(v.reason).toContain('hypothetical wording ("should")');
    }
  });
});
