import { describe, expect, it } from "vitest";
import { buildGaps } from "@/lib/gap";
import { demoContract, demoEvidence, demoFixEvidence } from "@/lib/fixtures/demo";
import { verify } from "@/lib/verify";

describe("proof gaps", () => {
  it("one card for every unproven requirement, none for proven ones", () => {
    const verdicts = verify(demoContract, demoEvidence);
    const gaps = buildGaps(demoContract, verdicts);
    expect(gaps.map((g) => g.requirementId)).toEqual(["R2", "R3", "R4"]);
  });

  it("each card names a concrete action and what to observe", () => {
    for (const g of buildGaps(demoContract, verify(demoContract, demoEvidence))) {
      expect(g.action.length).toBeGreaterThan(10);
      expect(g.observe).toContain("`Observed:`");
      expect(g.statement).toMatch(/^I will verify that /);
      expect(g.why.length).toBeGreaterThan(0);
    }
  });

  it("a contradiction asks for a retest that supersedes the failing evidence", () => {
    const r3 = buildGaps(demoContract, verify(demoContract, demoEvidence)).find((g) => g.requirementId === "R3")!;
    expect(r3.status).toBe("CONTRADICTED");
    expect(r3.retestOf).toEqual(["E3"]);
    expect(r3.observe).toMatch(/Supersedes/);
  });

  it("no gaps at 100%", () => {
    expect(buildGaps(demoContract, verify(demoContract, [...demoEvidence, ...demoFixEvidence]))).toEqual([]);
  });
});
