// DEMO FIXTURE — sample data, not a real project. prd.md > Built-in Demo.
// "An AI agent says the contact form is done." Three preloaded evidence items:
// a real structured test (PROVEN), a bluff (NOT PROVEN) and a 500 (CONTRADICTED).

import type { Contract, Evidence, Session } from "../types";

export const DEMO_GOAL = "An AI agent says the contact form is done.";

export const demoContract: Contract = {
  approved: true,
  requirements: [
    {
      id: "R1",
      text: "Name, email and message fields are visible on the contact form",
      proofTemplate: "Open the contact page and observe the name, email and message fields.",
      expected: "displays",
      targets: ["name", "email", "message", "field"],
      flags: [],
    },
    {
      id: "R2",
      text: "Submitting an invalid email is rejected with a validation message",
      proofTemplate: "Enter an invalid email, press Send, and observe the validation message and that nothing was submitted.",
      expected: "rejects",
      targets: ["invalid", "email", "reject", "validation", "message", "block"],
      flags: [],
    },
    {
      id: "R3",
      text: "Submitting valid details succeeds",
      proofTemplate: "Fill in valid details, press Send, and observe the submission complete with no errors.",
      expected: "succeeds",
      targets: ["submit", "send", "succeed", "complete", "thank"],
      flags: [],
    },
    {
      id: "R4",
      text: "A confirmation message is shown after submitting",
      proofTemplate: "Submit the form and observe the confirmation message text on screen.",
      expected: "displays",
      targets: ["confirmation", "thank", "message", "submit"],
      flags: [],
    },
  ],
};

export const demoEvidence: Evidence[] = [
  {
    id: "E1",
    kind: "structured",
    structured: {
      input: "none",
      action: "Opened /contact in Chrome",
      observed: "Name, email and message fields are visible",
    },
    links: ["R1"],
    flags: [],
  },
  {
    id: "E2",
    kind: "text",
    text: "Tested the form: the invalid email would be blocked and a validation message appears.",
    links: ["R2"],
    flags: [],
  },
  {
    id: "E3",
    kind: "structured",
    structured: {
      input: "name=Ada, email=ada@example.com, message=Hello",
      action: "Filled in valid details and pressed Send",
      observed: "Page shows 500 Internal Server Error; no confirmation",
    },
    links: ["R3"],
    flags: [],
  },
];

/** Evidence that closes the demo's Proof Gaps (used by tests and the demo walkthrough). */
export const demoFixEvidence: Evidence[] = [
  {
    id: "E4",
    kind: "structured",
    structured: {
      input: "email=not-an-email",
      action: "Entered the invalid email and pressed Send",
      observed: "Validation message 'Please enter a valid email' shown; form not submitted",
    },
    links: ["R2"],
    flags: [],
  },
  {
    id: "E5",
    kind: "structured",
    structured: {
      input: "name=Ada, email=ada@example.com, message=Hello",
      action: "Retest after the fix: filled in valid details and pressed Send",
      observed: "No errors; confirmation message 'Thanks, we received your message' shown",
    },
    links: ["R3", "R4"],
    supersedes: "E3",
    flags: [],
  },
];

export function demoSession(): Session {
  return {
    goal: DEMO_GOAL,
    contract: structuredClone(demoContract),
    evidence: structuredClone(demoEvidence),
    verdicts: [],
    stale: true,
    isDemo: true,
    nextEvidenceNumber: 4,
  };
}
