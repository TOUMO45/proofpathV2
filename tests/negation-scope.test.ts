import { describe, expect, it } from "vitest";
import { R1, R2, R3, R4, test_, text, verdictFor } from "./helpers";

const send = "Filled in valid details and pressed Send";

describe("negation is scoped to what the requirement is about", () => {
  it("'without any delay' is not a contradiction (v1 said CONTRADICTED)", () => {
    const e = text('Action: pressed Send without any delay. Observed: submission completed, "Thanks" shown.', ["R3"]);
    expect(verdictFor(R3, [e]).status).toBe("PROVEN");
  });

  it("'did not submit' contradicts a submission requirement", () => {
    const v = verdictFor(R3, [test_("valid", send, "The form did not submit", ["R3"])]);
    expect(v.status).toBe("CONTRADICTED");
    expect(v.reason).toContain("negation");
  });

  it("'not visible' contradicts a displays requirement", () => {
    expect(verdictFor(R1, [test_("none", "Opened /contact", "The email field is not visible", ["R1"])]).status).toBe("CONTRADICTED");
  });

  it("'never received a confirmation' contradicts the confirmation requirement", () => {
    const e = test_("valid", "Submitted the form", "Never received a confirmation message", ["R4"]);
    expect(verdictFor(R4, [e]).status).toBe("CONTRADICTED");
  });

  it("'not rejected' contradicts a rejects requirement", () => {
    const e = test_("email=x", "Entered the invalid email and pressed Send", "The invalid email was not rejected", ["R2"]);
    expect(verdictFor(R2, [e]).status).toBe("CONTRADICTED");
  });

  it("'form not submitted' supports a rejects requirement", () => {
    const e = test_(
      "email=x",
      "Entered the invalid email and pressed Send",
      "Validation message shown for the invalid email; form not submitted",
      ["R2"],
    );
    expect(verdictFor(R2, [e]).status).toBe("PROVEN");
  });

  it("a negation about something else is ignored", () => {
    const e = test_("valid", send, "No page reload; submission completed and 'Thanks' shown", ["R3"]);
    expect(verdictFor(R3, [e]).status).toBe("PROVEN");
  });
});
