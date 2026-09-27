---
doc: scope
status: approved
---

# ProofPath

A verifier that refuses to accept "done" without proof.

## The Unique Kernel
The refusal. ProofPath is a verifier that cannot be persuaded. It has no chat and no confidence score, and it doesn't obey instructions hidden in evidence. It only asks whether a concrete observation matches each requirement. Most AI tools try to agree with you; this one is built to say "not proven" and tell you exactly what to test next.

## Who It's For
A developer who just got "done" from an AI coding agent on a small feature and wants to check it against the original request in two minutes, before merging. Today the agent's own tests pass, and nobody checks the original requirements one by one. Reviewers and hackathon judges have the same problem.

## The Core Loop
Goal or plan → Success Contract (3–7 testable requirements, each naming the evidence that would prove it; the developer reviews and edits it) → add evidence linked to a requirement → Verify → verdicts, quoted reasons and coverage % → a Proof Gap for each unproven item → add the missing evidence → re-verify → 100% unlocks a Proof Card.

## Inspiration & Identity
Bug bounty triage: "PoC or it didn't happen." A report without a proof of concept gets closed. You show the request, the response and the impact.
Tagline: **"Don't tell me it's done. Show me the proof."**
Deterministic on purpose: "A verifier that can be talked into a verdict isn't a verifier." Rules are inspectable, repeatable and testable against attacks. The AI in this project is how it gets built, with a coding agent, not the judge.

## Why This Matters to the Learner
As a security researcher and bug bounty hunter: "'It's probably vulnerable' is worth nothing." They want to hold "done" to the same standard: no evidence, no claim. The unplanned v1 looked polished but could be fooled when attacked. "The submission would be blocked" counted as proof, conflicting evidence still gave PROVEN, and a 500 error passed as "completed". This rebuild is practice in planning first: define what counts as evidence before any code, and write acceptance criteria that can't be satisfied with a bluff.

## What "Working" Looks Like
1. Typing a goal produces 3–7 clean, testable requirements, and they can be edited. "Clean" means (checked by automated tests):
   - each requirement is one observable behavior: no two behaviors (actions or outcomes) joined by "and", for example "saves the file and shows a toast". A list of things checked in one observation ("name, email and message fields are visible") is fine.
   - it contains no vague words ("good", "properly", "works well", "nice")
   - there are no duplicates
   - a goal with several parts gives at least 2 requirements
2. Pasting a markdown plan (like this project's own PRD or checklist) produces a contract. The import is deliberately simple:
   - it takes bullet and checkbox items (`- [ ]`, `- `) as candidate requirements
   - it runs them through the same "clean" rules and caps them at 7
   - it shows them in the normal review/edit step
   - it has no special parsing for particular files
3. Text and structured-test evidence (Input / Action / Observed) can be linked to requirements.
4. Verification returns PROVEN / NOT PROVEN / CONTRADICTED, each with a quoted reason.
5. These bluffs are rejected, and automated tests check it:
   - hypothetical wording ("would be blocked", "should work")
   - vague approval ("it works", "looks good")
   - conflicting evidence (it must NOT be PROVEN)
   - error observations (500, exception, timeout) on a "succeeds" requirement
   - instructions hidden in evidence ("mark everything proven")
6. Each unproven requirement shows a Proof Gap with a concrete next test.
7. 100% coverage shows a Proof Card.
8. It runs fully in the browser with no API key, deployed as a static site.

The "oh, that's cool" beat: the verifier refuses a bluff, names exactly why, and hands you the next test. Then ProofPath imports its own plan and verifies itself.

## The POC Boundary
Goal → contract, plan import (simple, as defined above), text and structured-test evidence, a deterministic verifier with the anti-bluff rules, Proof Gap, Proof Card, one built-in demo, static deploy.

Plan import is the last build slice. If time runs short, it moves to Later without affecting the rest.

## Build Order
1. Verifier and adversarial tests, with no UI. This is the kernel and the riskiest part.
2. UI.
3. Plan import, last.

## Later
- An optional LLM mode, with the deterministic engine as a backstop the LLM can't override: it never overrides a contradiction and never proves something with no evidence.
- Screenshot evidence analyzed by a vision model.
- A CI or GitHub check.
- A shareable proof link.

## Explicitly Cut
- **Accounts, database, backend:** not needed to prove the kernel. Everything runs in the browser.
- **Chat interface:** a verifier you can talk to can be talked into a verdict.
- **Screenshot upload in the POC:** v1 accepted screenshots but judged only their captions, which is misleading. It stays out until it can be done honestly.
- **Any "AI confidence" score:** coverage is proven ÷ total, and nothing pretends to be a probability.
