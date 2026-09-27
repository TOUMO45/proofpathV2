import { describe, expect, it } from "vitest";
import { R2, R3, test_, text, verdictFor } from "./helpers";

const send = "Filled in valid details and pressed Send";

describe("error observations contradict a 'succeeds' requirement", () => {
  it("500 and a hang → CONTRADICTED (v1 said PROVEN)", () => {
    const e = text("Observed: the page shows a 500 Internal Server Error and the submission hangs.", ["R3"]);
    const v = verdictFor(R3, [e]);
    expect(v.status).toBe("CONTRADICTED");
    expect(v.reason).toContain('error signal ("500")');
  });

  it.each([
    "Submission completed but an exception appeared in the console",
    "Submission crashed the tab",
    "Submission timed out after 30s",
    "Submission request timeout, spinner stays",
    "Submission shows a stack trace",
    "Submission completed, total shows NaN",
    "Submission completed, name shows undefined",
    "Submission returned 404",
    "Submission failed with an error",
  ])("contradicts: %s", (observed) => {
    expect(verdictFor(R3, [test_("valid", send, observed, ["R3"])]).status).toBe("CONTRADICTED");
  });

  it.each([
    "No errors, 'Thanks' displayed",
    "0 errors; submission completed, 'Thanks' shown",
    "Submission completed without errors",
    "Submission completed, no exception in the console",
  ])("a negated error signal is not an error: %s", (observed) => {
    expect(verdictFor(R3, [test_("valid", send, observed, ["R3"])]).status).toBe("PROVEN");
  });
});

describe("a 'rejects' requirement expects an error message", () => {
  const entered = "Entered the invalid email and pressed Send";

  it("a validation error message is support, not a contradiction", () => {
    const e = test_("email=not-an-email", entered, "Error message 'Please enter a valid email' shown; form not submitted", ["R2"]);
    expect(verdictFor(R2, [e]).status).toBe("PROVEN");
  });

  it("a 422 validation response is support", () => {
    const e = test_("email=not-an-email", entered, "Server returned 422 with validation message 'invalid email'", ["R2"]);
    expect(verdictFor(R2, [e]).status).toBe("PROVEN");
  });

  it.each([
    "Page shows 500 Internal Server Error for the invalid email",
    "An exception was thrown for the invalid email",
    "The invalid email crashed the form",
  ])("app failures still contradict: %s", (observed) => {
    expect(verdictFor(R2, [test_("email=x", entered, observed, ["R2"])]).status).toBe("CONTRADICTED");
  });
});
