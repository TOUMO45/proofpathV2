---
doc: prd
status: approved
---

# ProofPath — Product Requirements

A verifier that refuses to accept "done" without proof. It's for a developer who just got "done" from an AI coding agent on a small feature and wants to check it against the original request in two minutes, before merging.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`.

1. The developer opens ProofPath and lands on the headline "Don't tell me it's done. Show me the proof."
2. They type a goal, or switch to the "Paste a plan" tab and paste markdown. Then they press **Create Proof Plan**. Or they press **Try the demo**.
3. ProofPath drafts a Success Contract of 3–7 requirements. Each requirement states one observable behavior and the evidence that would prove it.
4. In Contract Review, the developer edits, adds or removes requirements, then approves the contract. Evidence stays locked until approval.
5. In the Workspace, they add evidence (free text or a structured test) and explicitly link each item to one or more requirements.
6. They press **Verify**. Each requirement gets PROVEN, NOT PROVEN or CONTRADICTED, with a reason that quotes the evidence and cites the evidence IDs used. Coverage updates.
7. Each requirement that isn't PROVEN gets a Proof Gap card: the smallest concrete test to run next.
8. They run that test, add the new evidence, and verify again. If it's a retest after a fix, they mark it as superseding the old evidence.
9. At 100% coverage, the Proof Card appears. They copy it as Markdown into a PR description or download it as a `.md` file.

## Screens and Layout
Source: `scope.md > The Core Loop`.

**1. Landing**
- The headline "Don't tell me it's done. Show me the proof."
- A goal textarea, with a "Paste a plan" tab next to it.
- A **Create Proof Plan** button.
- A **Try the demo** button.

**Contract Review** (a step between Landing and Workspace)
- The drafted requirements, each editable.
- Any "needs edit" flags, with their reasons.
- An **Approve** action. Evidence can't be added until the contract is approved.

**2. Workspace**
- **Top bar:** the steps Contract → Evidence → Proof, and a coverage meter.
- **Left (wide):**
  - coverage
  - the Proof Graph (Goal → Requirements → Evidence → Verdict)
  - Proof Gap cards
  - the Proof Card, when coverage reaches 100%
- **Right:** the evidence form, the evidence list and the **Verify** button.

The demo opens the same Workspace, clearly labeled **Demo**.

## Look and Feel
- Still an audit report in its content: flat, precise reasons with quoted evidence. The surface is livelier (learner decision at the final review, from a reference image: colors and button shapes only, not its content).
- Pale lime paper with a soft green glow at the edge, near-black text, olive for links and focus.
- Lime pill badges with a dark outline; rounded buttons outlined in ink (primary filled lime, secondary light) that press down when clicked. Rounded cards.
- Verdict colors: green PROVEN, amber NOT PROVEN, red CONTRADICTED, as tinted pills. Every verdict also has a text label; color is never the only signal, which matters more now that the buttons are also green-ish.
- Motion marks a change of state: the headline rises in once, a changed verdict pops, the coverage number bumps and its bar fills, new cards settle in, and the Proof Card arrives with one ring of light at 100%. All motion is off under reduced-motion settings.
- Monospace for evidence and quotes. Small-caps section labels.
- **Avoid:** sparkles or any "AI magic" look. (Gradients were originally cut; a soft background glow is now in, by the learner's decision.)
- Light mode. Dark mode is optional, later.

## Features and Behavior

### Goal to Contract
Source: `scope.md > What "Working" Looks Like` (item 1).

A typed goal becomes 3–7 requirements. Each one is **clean**:
- **One behavior.** Each requirement is one observable behavior, with no two behaviors (actions or outcomes) joined by "and". For example, "saves the file and shows a toast" fails. A list of things checked in one observation ("name, email and message fields are visible") is fine.
- **No vague words** ("good", "properly", "works well", "nice").
- **No duplicates.**
- **Multi-part goals split.** A goal with several parts gives at least 2 requirements.

Each requirement also shows the evidence that would prove it.

The clean rules apply to **every** requirement, whether it was generated, imported or written by hand. Any requirement that fails them is flagged with a "needs edit" badge and the reason.

- [ ] Typing a multi-part goal (e.g. "Add a dark mode toggle that persists after page reload") produces at least 2 requirements, none of which join two behaviors with "and".
- [ ] No generated requirement contains a listed vague word, and none duplicates another.
- [ ] An empty or too-short goal shows an inline message, and no contract is created.
- [ ] A goal that yields fewer than 3 requirements shows a "low confidence" warning. The developer can add or edit requirements manually.
- [ ] The clean rules are covered by automated tests.

### Plan Import
Source: `scope.md > What "Working" Looks Like` (item 2), `scope.md > The POC Boundary`.

Deliberately simple:
- It reads **checkbox items** (`- [ ]`, `- [x]`) from pasted markdown or an uploaded `.md` file as candidate requirements. An **Include plain bullets** toggle adds `- ` items. Frontmatter and fenced code blocks are skipped.
- Each candidate shows the heading it came from, in small muted text, and a **filter box** narrows the list by text or heading.
- It runs them through the same clean rules.
- It lists **every** candidate it finds, flagged ones included. It doesn't just take the first 7.
- The developer selects up to 7 of them for the contract.
- The selected items go to Contract Review.
- It does no special parsing for particular files.

Items that fail the clean rules are **flagged, never silently dropped or auto-split**. They get a "needs edit" badge with the reason (e.g. "two behaviors joined by 'and'"), plus a one-click **Split into 2** suggestion that the developer confirms or edits. Nothing enters the contract until it passes the clean rules.

This is the last build slice. If time runs short, it moves to Later.

- [ ] Pasting this project's own `prd.md` with the default settings lists only its acceptance-criteria checkboxes, flagged ones included, and at most 7 can be selected.
- [ ] The filter narrows the list.
- [ ] Import → select → approve → paste an agent claim → Verify gives NOT PROVEN, naming the hypothetical wording.
- [ ] An item like "- [ ] saves the file and shows a toast" appears with a "needs edit" badge and a Split into 2 suggestion. It can't be approved until it's fixed.
- [ ] Pasted markdown with no bullet or checkbox items tells the developer that nothing was found, and falls back to manual entry.
- [ ] Selecting an 8th candidate isn't possible.

### Check an Agent's Reply
Source: a real-agent test (tip calculator), where the natural move was to paste the agent's reply into "Paste a plan".

The third Landing path, below "Check your own goal":
- **What did you ask for?** The original request becomes the goal and generates the contract as usual.
- **What did the agent reply?** The agent's final message, pasted as text (default), or uploaded as a `.md`/`.txt` file (optional, never required).
- **Flow:** contract → Contract Review, which shows the reply as "added on approval" → Approve → the reply is added automatically as **E1**, an Agent claim linked to every requirement → Verify runs once.
- **Uploads** (here, in "Paste a plan" and in the Workspace's Agent claim tab): read locally in the browser (FileReader), `.md`/`.txt` only, 200 KB max, with a clear message otherwise. The text goes through the same normalization and screens as pasted text. Nothing is sent anywhere.
- **Wrong box:** if "Paste a plan" finds no checkbox items and the text reads like prose, it shows "No plan items found. Is this an agent's reply?" with a button that moves the text to this path.

- [ ] Request + pasted reply → contract → Approve → E1 agent claim linked to every requirement → verdicts shown without pressing Verify.
- [ ] A `.md` reply upload gives the same result as pasting it.
- [ ] A non-`.md`/`.txt` or over-200 KB file is rejected with a clear message.
- [ ] Prose pasted into "Paste a plan" offers the redirect.

### Contract Review
Source: `scope.md > The Core Loop`.

- The developer reviews, edits, adds and removes requirements before approving.
- The contract is never auto-approved.
- Evidence is locked until approval.
- A requirement that fails the clean rules blocks approval until it's fixed.
- **Edit contract:** after approval, the developer can reopen the contract.
  - Reopening makes all verdicts stale.
  - Links to a deleted requirement are removed. Evidence left linked to nothing is removed with it, and Contract Review warns before that happens ("Removing R1 also removes E3").
  - Links to an edited requirement are kept.
  - The clean rules apply again before re-approval.

- [ ] Before approval, the evidence form is unavailable.
- [ ] A requirement with a "needs edit" flag blocks approval.
- [ ] Editing a requirement's text is reflected in the Workspace after approval.
- [ ] Reopening the contract marks all verdicts stale.
- [ ] Deleting a requirement removes its links, and editing a requirement keeps them.

### Evidence
Source: `scope.md > What "Working" Looks Like` (item 3).

There are three kinds of evidence:
- **Text:** a free-form observation.
- **Structured test:** three fields, **Input / Action / Observed**.
- **Agent claim:** an AI agent's own "done" message, pasted as-is or uploaded as a `.md`/`.txt` file. It is screened like text (hypothetical, vague, injection, obfuscation), but **an agent claim can never make a requirement PROVEN on its own**. With no human observation, the verdict is NOT PROVEN, and the reason **always leads** with "Agent claim: a claim, not your observation. Verify it yourself." Other screen findings follow as secondary notes only when relevant: instruction-like or obfuscated text always, hypothetical wording only in a sentence about that requirement. A claim contradicts only when it reports an unambiguous failure (an app failure such as a 5xx, exception, crash, hang or timeout; accepted input on a rejects requirement; or a negation of what the requirement says). Agents describing their error handling ("inline error …") do not contradict. The UI labels it **AGENT CLAIM**. (Learner decision after a real-agent test: the agent wrote concrete past-tense claims, "Verified: 125.00 @ 18% → tip $22.50", that the old rules would have accepted as proof.)

Each item gets an ID (E1, E2, …).
- **Linking:** one item can link to several requirements, because real observations often cover several things. The developer always sets links explicitly; ProofPath never links automatically.
- **Superseding (retest after fix):** when adding evidence, the developer can mark it "Supersedes E3". This is only possible for evidence linked to at least one of the same requirements.
  - The superseded item stays visible, struck through, as an audit trail.
  - It no longer counts toward any verdict.
  - Supersede is the path the demo shows.
- **Removing:** the developer can still delete evidence items.
- **Staleness:** adding, superseding or removing evidence makes the current verdicts stale.

- [ ] Evidence linked to no requirement can't be added.
- [ ] Pasting "I've implemented validation that should reject invalid emails. The form will now show a confirmation." as an agent claim linked to R2 and R4 gives both NOT PROVEN, with reasons naming "should" and "will".
- [ ] Concrete wording that proves a requirement as the developer's text is NOT PROVEN as an agent claim, with "Agent claim: a claim, not your observation. Verify it yourself."
- [ ] An agent claim that reports a failure still contradicts.
- [ ] One evidence item can be linked to two requirements and appears under both in the Proof Graph.
- [ ] "Supersedes" only offers evidence that shares at least one linked requirement with the new item.
- [ ] A superseded item stays visible, struck through, and contributes nothing to any verdict.
- [ ] Adding, superseding or removing evidence marks the current verdicts as stale. Stale verdicts are never shown as current, and the developer must verify again.

### Guidance While Recording Evidence
Source: the slice-4 learner check. The verifier was right every time, but nothing guided the developer. These only suggest. They never link, unlink or supersede anything by themselves.

- **Record this test:** every Proof Gap card has this button. It opens the evidence form as a structured test, linked only to that requirement, with Input and Action pre-filled from the suggested test. Observed stays **empty**, with the placeholder "What did you actually see?", because pre-filling an observation would fabricate evidence.
- **Over-linking hint:** when evidence linked to several requirements proves one of them but contradicts another, the reason says so: "E4 is linked to R3 but observed "…". Is this link intended?". A one-click **Unlink E4 from R3** follows. Unlinking makes verdicts stale. When a sentence's words belong to another linked requirement, it is neutral for this one, not a contradiction, so nothing is asked.
- **Visible Supersedes:** when a linked requirement is currently CONTRADICTED, the form asks "R3 is contradicted by E3. Is this a retest after a fix?", with a checkbox that sets Supersedes.
- **Missing-link hint:** when the observation mentions an unlinked requirement's target words (same threshold as support), the form asks "This also mentions R4's targets (…). Link to R4 too?". The link is added only on click.
- **Demo only:** a "Show me a passing retest" link fills a sample Observed, labeled **sample (demo)**, so the demo can reach 100% in a few clicks. It never appears outside the demo.

- [ ] Record this test pre-links only its requirement and pre-fills Input and Action, never Observed.
- [ ] An evidence item that proves R2 but contradicts R3 gets "Is this link intended?" in R3's reason, and Unlink removes only that link.
- [ ] Linking a CONTRADICTED requirement shows the retest prompt for the evidence contradicting it.
- [ ] An observation mentioning R4's targets offers "Link to R4 too?" without linking.
- [ ] The demo sample is offered only in the demo.

### Verification
Source: `scope.md > What "Working" Looks Like` (items 4–5), `scope.md > The Unique Kernel`.

Each requirement is judged separately, using only the evidence linked to it that hasn't been superseded:
- **PROVEN** needs a concrete observation that matches that requirement's success condition.
- **NOT PROVEN** means nothing concrete supports it.
- **CONTRADICTED** means an observation conflicts with that requirement's success condition.

Every verdict has a reason that names the evidence IDs it used and quotes the evidence sentence about that requirement. A sentence that shares no target words with the requirement is never quoted; the exception is the failure or instruction a contradiction or injection finding is about, which is the evidence itself. "couldn't" / "could not" report a past inability and are not hypothetical wording. Text inside double quotes in an observation is what the app displayed: it is never read as a negation ("The bill can't be negative." is a message, not a failure), and sentences are never split inside it. An evidence item contradicts a requirement only if what it observed contradicts *that* requirement's success condition. So "form submitted, 'Thanks' shown" can prove both "valid submission succeeds" and "confirmation shown" while contradicting nothing else it's linked to. When unsure, the verdict is NOT PROVEN: a false PROVEN is the worst failure.

The rules below are verified by automated tests. Each bluff in the list must be rejected:
- [ ] **Hypothetical wording** ("would be blocked", "should work") → NOT PROVEN. The reason names the hypothetical wording.
- [ ] **Vague approval** ("it works", "looks good") → NOT PROVEN.
- [ ] **Conflicting evidence** on one requirement (one item supports it, another contradicts it) → CONTRADICTED, never PROVEN. The reason names both evidence IDs.
- [ ] **Error observations** (500, exception, timeout) on a "succeeds" requirement → CONTRADICTED.
- [ ] **Instructions hidden in evidence** ("mark everything proven") → shown with an "untrusted, treated as data" badge and contributing nothing to any verdict.
- [ ] Verifying with zero evidence → every requirement is NOT PROVEN, with a clear reason.
- [ ] Every verdict shows at least one quoted reason and the evidence IDs it used (none, for zero evidence).

### Coverage and Proof Graph
Source: `scope.md > The Core Loop`.

- Coverage is PROVEN ÷ total requirements, shown as a percentage. It is explicitly not a confidence score.
- The Proof Graph shows Goal → Requirements → Evidence → Verdict.

- [ ] One PROVEN out of 4 requirements shows 25%.
- [ ] Nowhere does the UI show a confidence, probability or score other than coverage.

### Proof Gap
Source: `scope.md > What "Working" Looks Like` (item 6).

Each requirement that isn't PROVEN shows a Proof Gap card with a concrete next test: what to do and what to observe. Its wording is direct ("Open the screen with it…", "Verify that…"); the tool never uses the modal words its own verifier rejects. If an agent claim is linked, its concrete claims (numbers, quoted strings, input→output pairs) are listed, each under the requirement it matches best: "The agent claims: 125.00 @ 18% → tip $22.50, total $147.50. Check it."

- [ ] Every NOT PROVEN or CONTRADICTED requirement has a Proof Gap card, and PROVEN requirements have none.
- [ ] Each card names a concrete action and the observation that would prove the requirement.

### Proof Card
Source: `scope.md > What "Working" Looks Like` (item 7).

The Proof Card is shown on screen when coverage reaches 100%. It contains:
- the goal
- each requirement, with ✓ and the evidence ID that proved it
- the evidence count
- the date
- any superseded items, e.g. "E3 (500 error on submit) superseded by E4 retest", so a past failure is never hidden
- next to each proving evidence ID, where it came from: "self-reported" (typed by the developer) or "agent claim", so the card never implies ProofPath tested anything itself

It says "verified by ProofPath rules" and nothing more. It isn't a certificate and makes no security claim. Every prover is labeled "self-reported"; an agent claim can never appear as a prover.

- **Main action:** **Copy as Markdown**, to paste into a PR description or review comment as a proof checklist.
- **Secondary action:** **Download .md**, with the same content.

- [ ] The Proof Card appears only at 100% coverage from current (not stale) verdicts.
- [ ] Copy as Markdown puts a checklist on the clipboard with the goal, the requirements, the evidence IDs, the count and the date.
- [ ] Download .md saves the same content as a file.
- [ ] If any evidence was superseded, the Proof Card lists it along with what superseded it.

### Audit Trail for Deleted Requirements
If a requirement that already had a verdict is deleted, its text, last verdict and removed evidence IDs are kept. The Proof Card then shows a **Contract changes after verification** section, e.g. `R3 "Submitting valid details succeeds" removed (was CONTRADICTED; E3 removed)`. Deleting a requirement that never had a verdict leaves no trace. This closes the "delete the failing requirement to get 100%" bluff.

- [ ] Demo → Verify → delete R3 → 100% → the Proof Card lists R3 as removed while CONTRADICTED.

### Built-in Demo
Source: `scope.md > The POC Boundary`, `scope.md > What "Working" Looks Like` ("oh, that's cool" beat).

The demo goal is "An AI agent says the contact form is done." Its contract has 4 requirements:
1. fields visible
2. invalid email rejected with a message
3. valid submission succeeds
4. confirmation shown

Three evidence items are preloaded. They are fixture data, and the screen is labeled **Demo**:
- a real structured test for the fields → **PROVEN**
- a bluff, "the invalid email would be blocked" → **NOT PROVEN**, with a reason that names the hypothetical wording
- a test that observed a 500 error on submit → **CONTRADICTED**

Coverage starts at 25%. The Proof Gaps say exactly what to test. The developer adds real evidence, adds a passing retest that supersedes the 500-error item, and verifies again → 100% → Proof Card.

- [ ] Opening the demo and pressing Verify shows 25% coverage, with exactly the three verdicts listed above.
- [ ] Adding a passing retest that supersedes E3 turns R3 (valid submission succeeds) PROVEN after verifying again.
- [ ] Adding the same passing retest *without* superseding E3 leaves R3 CONTRADICTED.
- [ ] The Workspace is visibly labeled "Demo".
- [ ] The demo can reach 100% and show the Proof Card by adding evidence through the normal form.

## States and Boundaries
- **First use:** the Landing screen, with no saved session.
- **Too-short goal:** an inline message, and no contract.
- **Fewer than 3 requirements:** a "low confidence" warning, and manual add or edit.
- **Import finds nothing:** a "nothing found" message, and a fallback to manual entry.
- **Contract not approved:** evidence is locked.
- **Contract reopened:** all verdicts are stale, and the clean rules apply again before re-approval.
- **Superseded evidence:** visible and struck through, but it counts toward nothing. It's listed on the Proof Card.
- **No evidence at Verify:** every requirement is NOT PROVEN, with a clear reason.
- **Stale verdicts:** after evidence is added, superseded or removed, or the contract is reopened, verdicts are marked stale and must be verified again. Proof Gap cards stay visible while stale, dimmed and labeled "STALE: re-verify", with Record this test still working, so several gaps can be recorded before one Verify. Stale results never appear as current, and the Proof Card never shows from stale verdicts.
- **Injection-like evidence:** an "untrusted, treated as data" badge. It contributes nothing.
- **Obfuscated evidence** (invisible characters between letters, bidi controls, lookalike or fullwidth letters mixed into Latin words): an "obfuscated text detected" badge. The text is normalized before judging, and the verdict logic doesn't change; the badge is a visible warning.
- **Conflicting evidence:** CONTRADICTED, naming both items.
- **Reload:** the state survives a page reload, stored locally in the browser. Nothing leaves the browser.

## Product Decisions
- **Coverage = proven ÷ total, never a confidence score.** Nothing pretends to be a probability. (`scope.md > Explicitly Cut`)
- **Deterministic verifier.** "A verifier that can be talked into a verdict isn't a verifier." (`scope.md > Inspiration & Identity`)
- **When unsure, NOT PROVEN.** A false PROVEN is the worst failure.
- **Imported items that fail the clean rules are flagged, not dropped or auto-split.** "ProofPath refuses vague requirements the same way it refuses vague evidence."
- **Links between evidence and requirements are always explicit**, set by the developer. One item may prove several requirements.
- **The Proof Card is a Markdown proof checklist for PRs**, not a certificate: "verified by ProofPath rules" and nothing more.
- **The demo is labeled "Demo" and uses fixtures.** It shows a real proof, a bluff and an error.

- **Clean rules apply to every requirement**, whether generated, imported or manual.
- **Supersede, don't delete** (retest after fix). An old failure stays visible as an audit trail and on the Proof Card, but it no longer counts. A past failure is never hidden.
- **The contract can be reopened.** Reopening makes all verdicts stale, and the clean rules gate re-approval.
- **Any change to evidence (adding, superseding or removing) makes verdicts stale.**
- **Plan import shows every candidate, and the developer selects up to 7.** Nothing is picked by position.

## What We're Building
- Goal to Contract, with the clean rules
- Contract Review, with approval and Edit contract
- text and structured-test evidence, with explicit multi-linking and Supersede
- the deterministic verifier and its anti-bluff rules, with automated tests
- coverage and the Proof Graph
- Proof Gap cards
- the Proof Card (Copy as Markdown, Download .md)
- the built-in Demo
- local persistence
- a static deploy with no API key
- Plan Import, as the last slice

## Deferred From the POC
- **Optional LLM mode:** needs an API key and a backstop design. It comes later, and it can never override a contradiction or prove something with no evidence.
- **Screenshot evidence analyzed by a vision model:** v1 judged only captions, which is misleading. It stays out until it can be done honestly.
- **CI or GitHub check:** a different surface. The POC proves the verifier first.
- **Shareable proof link:** it implies hosting or a backend. For now, Copy as Markdown covers sharing.

## Possible Later Enhancements
- Dark mode.

## Non-Goals
- **Judging code quality:** ProofPath checks requirements against evidence, not code.
- **Running tests itself:** the developer runs tests and reports what they observed.
- **Team collaboration, accounts, database, backend:** not needed to prove the kernel.
- **Chat interface:** a verifier you can talk to can be talked into a verdict.
- **Any "AI confidence" score.**

## Open Questions
None. Both earlier questions are resolved: supersede for retests, and Edit contract, both under Product Decisions.
