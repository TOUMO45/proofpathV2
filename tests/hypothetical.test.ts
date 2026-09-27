import { describe, expect, it } from "vitest";
import { R1, R2, R3, test_, text, verdictFor } from "./helpers";
import { demoEvidence } from "@/lib/fixtures/demo";

describe("hypothetical / modal wording is a prediction, not proof", () => {
  it("rejects 'would be blocked' (v1 counted this as PROVEN)", () => {
    const e = text(
      "If you enter an invalid email the submission would be blocked and a validation message appears.",
      ["R2"],
    );
    const v = verdictFor(R2, [e]);
    expect(v.status).toBe("NOT_PROVEN");
    expect(v.reason).toMatch(/hypothetical wording \("(if|would)"\)/i);
  });

  it("rejects the demo bluff E2 and names the word", () => {
    const v = verdictFor(R2, [demoEvidence[1]]);
    expect(v.status).toBe("NOT_PROVEN");
    expect(v.reason).toContain('hypothetical wording ("would")');
  });

  it.each([
    "Clicked Send with valid details; it should work and show 'Thanks'.",
    "Pressed Send with valid details and the submission will complete.",
    "Submitted valid details; the form is expected to complete the submission.",
    "Submitted valid details; the submission is supposed to succeed.",
    "Submitted valid details; the endpoint is designed to complete the submission.",
    "Clicked Send: the submission won't fail.",
  ])("rejects modal wording: %s", (body) => {
    expect(verdictFor(R3, [text(body, ["R3"])]).status).toBe("NOT_PROVEN");
  });

  it("reads only Observed for structured evidence: 'should' in Action is test setup", () => {
    const e = test_(
      "email=not-an-email",
      "Entered an email that should be rejected and pressed Send",
      "Validation message 'Please enter a valid email' shown; form not submitted",
      ["R2"],
    );
    expect(verdictFor(R2, [e]).status).toBe("PROVEN");
  });

  it("still catches modal wording inside Observed", () => {
    const e = test_("none", "Opened /contact", "The name, email and message fields should be visible", ["R1"]);
    expect(verdictFor(R1, [e]).status).toBe("NOT_PROVEN");
  });

  it("ignores modal words inside quoted app text", () => {
    const e = test_(
      "valid details",
      "Filled in valid details and pressed Send",
      "Submission completed; message \"Thanks! We'll reply soon\" shown",
      ["R3"],
    );
    expect(verdictFor(R3, [e]).status).toBe("PROVEN");
  });
});
