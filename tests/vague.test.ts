import { describe, expect, it } from "vitest";
import { R1, R3, contractOf, req, test_, text, verdictFor } from "./helpers";

describe("vague approval is not proof", () => {
  it.each(["It works.", "Looks good to me.", "LGTM", "Done.", "All good, everything works fine."])(
    "rejects %s",
    (body) => {
      const v = verdictFor(R3, [text(body, ["R3"])]);
      expect(v.status).toBe("NOT_PROVEN");
    },
  );

  it("names the vague phrase in the reason", () => {
    expect(verdictFor(R3, [text("Submission looks good.", ["R3"])]).reason).toMatch(/vague approval \("looks good"\)/);
  });

  it("rejects a vague Observed field", () => {
    const e = test_("valid details", "Submitted the form", "it works", ["R3"]);
    expect(verdictFor(R3, [e]).status).toBe("NOT_PROVEN");
  });

  it("does not stop 'done' when there is a concrete observation", () => {
    const upload = req({ id: "R9", text: "An uploaded file appears in the file list", expected: "displays", targets: ["upload", "file", "list"] });
    const e = test_("report.pdf", "Uploaded report.pdf", "upload done in 2s, file appears in the list", ["R9"]);
    const v = verdictFor(upload, [e], contractOf(upload));
    expect(v.status).toBe("PROVEN");
  });

  it("rejects keyword stuffing with no action/result structure (v1 counted this as PROVEN)", () => {
    const stuffed = text("contact form name email message fields visible present displayed validation confirmation", ["R1"]);
    const v = verdictFor(R1, [stuffed]);
    expect(v.status).toBe("NOT_PROVEN");
    expect(v.reason).toContain("no concrete observation");
  });

  it("an on-topic Action with an Observed that doesn't show the expected outcome is not proof", () => {
    // Target words come from the Action; the observation says nothing about success.
    const e = test_("valid details", "Filled in valid details and pressed Send to submit", "Page loaded", ["R3"]);
    const v = verdictFor(R3, [e]);
    expect(v.status).toBe("NOT_PROVEN");
    expect(v.reason).toContain("doesn't show the expected outcome (succeeds)");
  });

  it("a displays requirement needs something seen on screen, not just activity", () => {
    const e = test_("none", "Opened /contact to check the name, email and message fields", "Page loaded in 300ms", ["R1"]);
    expect(verdictFor(R1, [e]).status).toBe("NOT_PROVEN");
  });

  it("accepts the same facts written as a real observation", () => {
    const real = text("Opened /contact: the name, email and message fields are visible.", ["R1"]);
    expect(verdictFor(R1, [real]).status).toBe("PROVEN");
  });
});
