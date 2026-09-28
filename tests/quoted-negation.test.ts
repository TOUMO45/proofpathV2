// Quoted text is what the app displayed. A validation message on a `rejects`
// requirement naturally says "can't" / "not" ("The bill can't be negative."), so
// negation inside quotes is skipped there, and only there. Everywhere else, a
// quoted message that negates the requirement still contradicts: otherwise a
// failure could be hidden just by quoting it.

import { describe, expect, it } from "vitest";
import { makeRequirement } from "@/lib/contract/generate";
import { verify } from "@/lib/verify";
import type { Evidence, Requirement } from "@/lib/types";

function verdict(req: Requirement, action: string, observed: string) {
  const e: Evidence = { id: "E1", kind: "structured", structured: { input: "", action, observed }, links: [req.id], flags: [] };
  return verify({ approved: true, requirements: [req] }, [e])[0];
}

describe("quoted negation", () => {
  it('succeeds: shows "Payment not processed" → CONTRADICTED (quoting a failure does not hide it)', () => {
    const req = makeRequirement("R1", "The payment is processed");
    expect(req.expected).toBe("succeeds");
    const v = verdict(req, "Paid with the test card", 'The page shows "Payment not processed"');
    expect(v.status).toBe("CONTRADICTED");
    expect(v.reason).toContain("negation");
  });

  it("succeeds: the same message without the negation proves it (control)", () => {
    const req = makeRequirement("R1", "The payment is processed");
    expect(verdict(req, "Paid with the test card", 'The page shows "Payment processed"').status).toBe("PROVEN");
  });

  it('displays: shows "Error 500" → CONTRADICTED (error signals count inside quotes)', () => {
    const req = makeRequirement("R1", "The confirmation message is shown after submitting");
    expect(req.expected).toBe("displays");
    const v = verdict(req, "Submitted the form", 'The page shows "Error 500" instead of the confirmation message');
    expect(v.status).toBe("CONTRADICTED");
  });

  it('rejects: shows "Invalid email was accepted" → CONTRADICTED (accepted input counts inside quotes)', () => {
    const req = makeRequirement("R1", "The form rejects an invalid email with a message");
    expect(req.expected).toBe("rejects");
    const v = verdict(req, "Entered an invalid email and pressed Send", 'The page shows "Invalid email was accepted"');
    expect(v.status).toBe("CONTRADICTED");
  });

  it("rejects: the learner's R3, \"The bill can't be negative. Enter 0 or more.\", is still PROVEN", () => {
    const req = makeRequirement("R3", "The single-page tip calculator rejects a negative bill with an error message", [], "The single-page tip calculator");
    const v = verdict(req, "Typed -50 in the bill field", 'The error message "The bill can\'t be negative. Enter 0 or more." is shown and the total is cleared to —');
    expect(v.status).toBe("PROVEN");
  });

  it("rejects: a negation outside the quotes still contradicts", () => {
    const req = makeRequirement("R3", "The single-page tip calculator rejects a negative bill with an error message", [], "The single-page tip calculator");
    const v = verdict(req, "Typed -50 in the bill field", 'The negative bill was not rejected; the page shows "Total $-9.00"');
    expect(v.status).toBe("CONTRADICTED");
  });
});
