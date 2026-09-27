import { describe, expect, it } from "vitest";
import { demoContract, demoEvidence, demoFixEvidence, demoSession } from "@/lib/fixtures/demo";
import { coverage, verify } from "@/lib/verify";
import { quoteBest, stripWrappingQuotes } from "@/lib/text";
import { EvidenceSchema, SessionSchema } from "@/lib/types";

const status = (vs: ReturnType<typeof verify>) => Object.fromEntries(vs.map((v) => [v.requirementId, v.status]));

describe("built-in demo", () => {
  it("starts at exactly 25% with the three expected verdicts", () => {
    const vs = verify(demoContract, demoEvidence);
    expect(status(vs)).toEqual({ R1: "PROVEN", R2: "NOT_PROVEN", R3: "CONTRADICTED", R4: "NOT_PROVEN" });
    expect(coverage(vs)).toBe(25);
  });

  it("reaches 100% with a passing retest that supersedes E3", () => {
    const vs = verify(demoContract, [...demoEvidence, ...demoFixEvidence]);
    expect(status(vs)).toEqual({ R1: "PROVEN", R2: "PROVEN", R3: "PROVEN", R4: "PROVEN" });
    expect(coverage(vs)).toBe(100);
    expect(vs.find((v) => v.requirementId === "R3")!.evidenceIds).toEqual(["E5"]);
  });

  it("without supersede, the same retest leaves R3 CONTRADICTED", () => {
    const [e4, e5] = demoFixEvidence;
    const vs = verify(demoContract, [...demoEvidence, e4, { ...e5, supersedes: undefined }]);
    const r3 = vs.find((v) => v.requirementId === "R3")!;
    expect(r3.status).toBe("CONTRADICTED");
    expect(r3.reason).toContain("E3");
    expect(r3.reason).toContain("E5");
    expect(coverage(vs)).toBe(75);
  });

  it("the fixture is valid against the schemas", () => {
    for (const e of [...demoEvidence, ...demoFixEvidence]) expect(EvidenceSchema.safeParse(e).success).toBe(true);
    expect(SessionSchema.safeParse(demoSession()).success).toBe(true);
  });
});

describe("edge cases", () => {
  it("zero evidence → every requirement NOT_PROVEN with a clear reason", () => {
    for (const v of verify(demoContract, [])) {
      expect(v.status).toBe("NOT_PROVEN");
      expect(v.reason).toBe("No evidence linked to this requirement.");
      expect(v.evidenceIds).toEqual([]);
    }
  });

  it("superseded evidence counts toward nothing", () => {
    const vagueRetest = {
      ...demoFixEvidence[1],
      links: ["R3"],
      structured: { input: "", action: "Opened /contact", observed: "Page looks good" },
    };
    const r3 = verify(demoContract, [demoEvidence[2], vagueRetest]).find((v) => v.requirementId === "R3")!;
    expect(r3.status).toBe("NOT_PROVEN"); // E3's 500 no longer counts, and the vague retest proves nothing
    expect(r3.evidenceIds).not.toContain("E3");
  });

  it("only superseded evidence linked → NOT_PROVEN, saying so", () => {
    const retestForR4Only = { ...demoFixEvidence[1], links: ["R4"], supersedes: "E3" };
    const r3 = verify(demoContract, [demoEvidence[2], retestForR4Only]).find((v) => v.requirementId === "R3")!;
    expect(r3.status).toBe("NOT_PROVEN");
    expect(r3.reason).toMatch(/Only superseded evidence/);
  });
});

describe("reasons", () => {
  const extraRetest = { ...demoFixEvidence[1], id: "E6", supersedes: undefined };
  const verdicts = [
    ...verify(demoContract, demoEvidence),
    ...verify(demoContract, [...demoEvidence, ...demoFixEvidence, extraRetest]),
  ].filter((v) => v.evidenceIds.length > 0);

  it("every verdict with evidence quotes it and cites its IDs", () => {
    for (const v of verdicts) {
      expect(v.reason).toMatch(/"[^"]+"/);
      for (const id of v.evidenceIds) expect(v.reason).toContain(id);
    }
  });

  it("never shows doubled quotes", () => {
    for (const v of verdicts) expect(v.reason).not.toMatch(/""|"'|'"/);
  });

  it("quotes the sentence with the most target words, not the first quoted string", () => {
    const body = 'The "contact form" loaded. Pressed Send, submission completed and a confirmation appeared. Footer shows "Thanks!"';
    expect(quoteBest(body, ["submit", "send", "complete"])).toBe("Pressed Send, submission completed and a confirmation appeared");
  });

  it("strips wrapping quotes", () => {
    expect(stripWrappingQuotes("\"'Thanks!'\"")).toBe("Thanks!");
  });
});
