// The tool must not use, in its own instructions, the wording its verifier
// rejects as hypothetical ("should", "will", "would", "if"...).

import { describe, expect, it } from "vitest";
import { classify, generateContract, proofTemplateFor, thirdPerson } from "@/lib/contract/generate";
import { buildGaps } from "@/lib/gap";
import { demoContract, demoEvidence } from "@/lib/fixtures/demo";
import { verify } from "@/lib/verify";
import { findHypotheticals } from "@/lib/verify/screens";
import type { ExpectedOutcome } from "@/lib/types";

describe("the tool's own instructions use direct wording", () => {
  it.each<ExpectedOutcome>(["succeeds", "rejects", "displays", "persists"])("proof template for %s has no hypothetical wording", (expected) => {
    const template = proofTemplateFor("The tip is shown", expected);
    expect(findHypotheticals(template)).toEqual([]);
  });

  it("the displays template says 'Open the screen with it', not 'where it should appear'", () => {
    expect(proofTemplateFor("The tip is shown", "displays")).toMatch(/^Open the screen with it and check that/);
  });

  it("Proof Gap text (next test, record, claim) has no hypothetical wording", () => {
    for (const g of buildGaps(demoContract, verify(demoContract, demoEvidence))) {
      for (const text of [g.action, g.observe, g.statement]) expect(findHypotheticals(text), text).toEqual([]);
    }
  });
});

describe("verb inflection (real-agent test: 'showses', 'rejectses')", () => {
  it.each([
    ["shows", "shows"],
    ["rejects", "rejects"],
    ["displays", "displays"],
    ["saves", "saves"],
    ["passes", "passes"],
    ["fixes", "fixes"],
    ["show", "shows"],
    ["reject", "rejects"],
    ["pass", "passes"],
    ["fix", "fixes"],
    ["copy", "copies"],
  ])("%s → %s", (verb, expected) => {
    expect(thirdPerson(verb)).toBe(expected);
  });

  it("an imperative goal with already-inflected verbs keeps them, in text and targets", () => {
    const r = generateContract("Create a tip calculator, shows the tip for a bill amount, rejects negative amounts");
    if (!r.ok) throw new Error(r.error);
    const all = r.requirements.flatMap((q) => [q.text, ...q.targets]).join(" ");
    expect(all).not.toMatch(/showses|rejectses|saveses|passeses|fixeses/);
    expect(r.requirements.map((q) => q.text)).toEqual([
      "The tip calculator is available",
      "The app shows the tip for a bill amount",
      "The app rejects negative amounts",
    ]);
    expect(r.requirements[1].targets).toEqual(expect.arrayContaining(["shows", "bill", "amount"]));
    expect(r.requirements[2].targets).toContain("rejects");
  });

  it("'The tip calculator takes a bill amount' has a verb, so it is not drafted as a noun phrase", () => {
    expect(classify("The tip calculator takes a bill amount and a tip percentage")).toBe("succeeds");
  });
});
