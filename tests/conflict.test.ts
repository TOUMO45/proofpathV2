import { describe, expect, it } from "vitest";
import { R2, R3, R4, test_, text, verdictFor } from "./helpers";
import { demoContract } from "@/lib/fixtures/demo";
import { verify } from "@/lib/verify";

describe("conflicting evidence is never PROVEN", () => {
  it("blocked in one item, accepted in another → CONTRADICTED naming both (v1 said PROVEN)", () => {
    const blocked = text("Action: entered an invalid email and pressed Send. Observed: blocked, validation message shown.", ["R2"]);
    const accepted = text(
      "Action: entered an invalid email and pressed Send. Observed: the invalid email was accepted and submitted successfully.",
      ["R2"],
    );
    const v = verdictFor(R2, [blocked, accepted]);
    expect(v.status).toBe("CONTRADICTED");
    expect(v.reason).toMatch(/^Conflicting evidence/);
    expect(v.reason).toContain(blocked.id);
    expect(v.reason).toContain(accepted.id);
    expect(v.evidenceIds).toEqual(expect.arrayContaining([blocked.id, accepted.id]));
  });

  it("a passing test plus a 500 on the same requirement → CONTRADICTED", () => {
    const ok = test_("valid", "Filled in valid details and pressed Send", "Submission completed, 'Thanks' shown", ["R3"]);
    const bad = test_("valid", "Filled in valid details and pressed Send", "Page shows 500 Internal Server Error", ["R3"]);
    expect(verdictFor(R3, [ok, bad]).status).toBe("CONTRADICTED");
  });
});

describe("one observation can prove several requirements, judged separately", () => {
  it("'form submitted, Thanks shown' proves R3 and R4 and contradicts neither", () => {
    const e = text("Pressed Send with valid details: form submitted, 'Thanks' shown.", ["R3", "R4"]);
    const verdicts = verify(demoContract, [e]);
    expect(verdicts.find((v) => v.requirementId === "R3")!.status).toBe("PROVEN");
    expect(verdicts.find((v) => v.requirementId === "R4")!.status).toBe("PROVEN");
  });

  it("an error sentence only contradicts the requirement it is about", () => {
    const e = test_(
      "valid details",
      "Opened /contact, filled in valid details and pressed Send",
      "Name, email and message fields are visible. After submit, the page shows 500 Internal Server Error.",
      ["R1", "R3"],
    );
    const verdicts = verify(demoContract, [e]);
    expect(verdicts.find((v) => v.requirementId === "R1")!.status).toBe("PROVEN");
    expect(verdicts.find((v) => v.requirementId === "R3")!.status).toBe("CONTRADICTED");
  });

  it("evidence linked to one requirement says nothing about another", () => {
    const e = test_("none", "Opened /contact", "Name, email and message fields are visible", ["R1"]);
    expect(verdictFor(R4, [e]).status).toBe("NOT_PROVEN");
  });
});
