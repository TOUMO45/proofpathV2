import { describe, expect, it } from "vitest";
import { checkClean } from "@/lib/contract/clean";

describe("clean rules", () => {
  it("two behaviors joined by 'and' fail, with a split suggestion that repeats the subject", () => {
    const r = checkClean("The editor saves the file and shows a toast");
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("two behaviors joined by 'and'");
    expect(r.splitSuggestion).toEqual(["The editor saves the file", "The editor shows a toast"]);
  });

  it("a bare 'saves the file and shows a toast' also fails", () => {
    const r = checkClean("saves the file and shows a toast");
    expect(r.ok).toBe(false);
    expect(r.splitSuggestion).toEqual(["Saves the file", "Shows a toast"]);
  });

  it("two subjects joined by 'and' fail: 'the form saves and the toast appears'", () => {
    expect(checkClean("The form saves the draft and the toast appears").ok).toBe(false);
  });

  it("a list checked in one observation passes", () => {
    expect(checkClean("Name, email and message fields are visible").ok).toBe(true);
    expect(checkClean("The export includes the date and the amount").ok).toBe(true);
  });

  it.each(["good", "properly", "works well", "nice", "correctly", "user-friendly", "as expected"])("vague word '%s' fails", (w) => {
    const r = checkClean(`The upload works ${w === "works well" ? "well" : w} for large files`.replace("works well well", "works well"));
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.startsWith("vague word"))).toBe(true);
  });

  it("a duplicate fails, ignoring case and punctuation", () => {
    const r = checkClean("The CLI converts CSV to JSON.", ["the cli converts csv to json"]);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("duplicate of another requirement");
  });

  it("an empty requirement fails", () => {
    expect(checkClean("   ").ok).toBe(false);
  });
});
