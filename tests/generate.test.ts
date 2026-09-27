import { describe, expect, it } from "vitest";
import { MAX_REQUIREMENTS, classify, generateContract } from "@/lib/contract/generate";
import { checkClean } from "@/lib/contract/clean";
import { verify } from "@/lib/verify";
import type { Evidence, ExpectedOutcome, Requirement } from "@/lib/types";

function contract(goal: string): Requirement[] {
  const r = generateContract(goal);
  if (!r.ok) throw new Error(r.error);
  return r.requirements;
}

// Goals that are NOT forms. v1 turned each into a single requirement that repeated the goal.
const GOALS: { goal: string; expected: ExpectedOutcome[] }[] = [
  { goal: "Add a dark mode toggle that persists after page reload", expected: ["displays", "persists"] },
  { goal: "A CLI that converts CSV to JSON and handles empty files without crashing", expected: ["succeeds", "succeeds"] },
  {
    goal: "Users must not log in with a wrong password; after 5 failed attempts the account is locked",
    expected: ["rejects", "rejects"],
  },
  {
    goal: "Build a signup form that rejects duplicate emails and sends a welcome email after registration",
    expected: ["rejects", "succeeds"],
  },
  { goal: "Show a confirmation banner after saving, and keep the draft after page reload,.", expected: ["displays", "persists"] },
];

describe("goal → clean contract (5 non-demo goals)", () => {
  it.each(GOALS)("$goal", ({ goal, expected }) => {
    const reqs = contract(goal);
    expect(reqs.length).toBeGreaterThanOrEqual(2);
    expect(reqs.map((r) => r.expected)).toEqual(expected);
    const goalText = goal.replace(/[,.]+$/, "").toLowerCase();
    for (const [i, r] of reqs.entries()) {
      expect(r.flags, `${r.id} "${r.text}" should be clean`).toEqual([]);
      expect(checkClean(r.text, reqs.slice(0, i).map((o) => o.text)).ok).toBe(true);
      expect(r.text).not.toMatch(/[,.;:\s]$/); // no trailing ",." (v1 bug)
      expect(r.text.toLowerCase()).not.toBe(goalText); // not just the goal repeated
      expect(r.targets.length).toBeGreaterThanOrEqual(2);
      expect(r.proofTemplate.length).toBeGreaterThan(20);
    }
    expect(new Set(reqs.map((r) => r.text.toLowerCase())).size).toBe(reqs.length);
  });

  it("splits on 'that' / 'and' / ';' into readable requirements", () => {
    expect(contract(GOALS[0].goal).map((r) => r.text)).toEqual([
      "The dark mode toggle is visible",
      "The dark mode toggle persists after page reload",
    ]);
    expect(contract(GOALS[1].goal).map((r) => r.text)).toEqual([
      "The CLI converts CSV to JSON",
      "The CLI handles empty files without crashing",
    ]);
    expect(contract(GOALS[2].goal).map((r) => r.text)).toEqual([
      "Users must not log in with a wrong password",
      "After 5 failed attempts, the account is locked",
    ]);
  });

  it("keeps a noun list together: 'name, email and message fields'", () => {
    const reqs = contract("Show a contact form where name, email and message fields are visible");
    expect(reqs.some((r) => /name, email and message fields/.test(r.text))).toBe(true);
    expect(reqs.every((r) => r.flags.length === 0)).toBe(true);
  });

  it.each(["A Try the demo button", "The coverage meter", "A Create Proof Plan button"])(
    "a noun phrase with no verb is drafted as displays: %s",
    (text) => {
      expect(classify(text)).toBe("displays");
    },
  );

  it("a sentence with a verb is not affected by the noun-phrase rule", () => {
    expect(classify("The CLI converts CSV to JSON")).toBe("succeeds");
    expect(classify("The Create button saves the draft")).toBe("succeeds");
    expect(classify("Evidence linked to no requirement can't be added")).toBe("rejects");
  });

  it("an empty or too-short goal is an error, not a contract", () => {
    expect(generateContract("").ok).toBe(false);
    expect(generateContract("dark mode").ok).toBe(false);
  });

  it("fewer than 3 requirements is marked low confidence", () => {
    const r = generateContract(GOALS[0].goal);
    expect(r.ok && r.lowConfidence).toBe(true);
  });

  it(`never produces more than ${MAX_REQUIREMENTS} requirements`, () => {
    const goal = "Add a toggle that saves the theme, shows a toast, updates the header, changes the icon, stores the choice, sends an event, clears the cache and logs the change";
    expect(contract(goal).length).toBeLessThanOrEqual(MAX_REQUIREMENTS);
  });
});

describe("generated contracts judge real evidence correctly", () => {
  const ev = (links: string[], input: string, action: string, observed: string): Evidence => ({
    id: "E1",
    kind: "structured",
    structured: { input, action, observed },
    links,
    flags: [],
  });

  it("CLI: 'no crash' on an empty file is proof, not a contradiction", () => {
    const reqs = contract(GOALS[1].goal);
    const e = ev([reqs[1].id], "empty.csv (0 bytes)", "Ran csv2json on empty files", "No crash; exit code 0; output.json created with []");
    expect(verify({ approved: true, requirements: reqs }, [e])[1].status).toBe("PROVEN");
  });

  it("CLI: a crash on an empty file contradicts", () => {
    const reqs = contract(GOALS[1].goal);
    const e = ev([reqs[1].id], "empty.csv", "Ran csv2json on empty files", "Crashed with TypeError: Cannot read properties of undefined");
    expect(verify({ approved: true, requirements: reqs }, [e])[1].status).toBe("CONTRADICTED");
  });

  it("login: a refused wrong password is proof for a 'rejects' requirement", () => {
    const reqs = contract(GOALS[2].goal);
    const e = ev([reqs[0].id], "password=wrong123", "Tried to log in with a wrong password", "Message 'Invalid password' shown; still on the log in page");
    expect(verify({ approved: true, requirements: reqs }, [e])[0].status).toBe("PROVEN");
  });

  it("dark mode: still dark after reload is proof for the persists requirement", () => {
    const reqs = contract(GOALS[0].goal);
    const e = ev([reqs[1].id], "none", "Switched the dark mode toggle on, then reloaded the page", "After reload the page is still in dark mode");
    expect(verify({ approved: true, requirements: reqs }, [e])[1].status).toBe("PROVEN");
  });
});
