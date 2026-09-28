---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (chosen in `4-spec`: verification and a commit for every slice, minimal explanations)

## Slices

- [x] **1. The verifier refuses every known bluff, proven by tests**
  Becomes usable: `npm test` runs the adversarial suite against the real verifier, and `npm run demo:verify` prints the demo contract's verdict table (R1 PROVEN, R2 NOT PROVEN for hypothetical wording, R3 CONTRADICTED on a 500, R4 NOT PROVEN, coverage 25%). There's no UI yet.
  Why now: The verifier is the kernel and the riskiest part (v1 failed exactly here). This is the one layer-only slice: it independently proves the critical risk and leaves runnable evidence. Bootstrapping happens inside it, so every later slice lands in a working, tested project.
  PRD ref: `prd.md > Verification`, `prd.md > Built-in Demo`, `prd.md > Coverage and Proof Graph`
  Spec ref: `spec.md > Stack`, `spec.md > Verifier (lib/verify)`, `spec.md > Data Model`, `spec.md > Demo Fixture (lib/fixtures/demo.ts)`, `spec.md > File Structure`, `spec.md > Decisions and Open Issues`
  Build:
  - Scaffold Next.js + TypeScript + Tailwind with static export, plus Zod, Vitest and ESLint.
  - Add the scripts `lint`, `typecheck`, `test`, `build`, `verify:all` and `demo:verify`.
  - Implement `lib/types.ts` (data model + Zod schemas), `lib/text.ts` (tokenize, sentence split, quote stripping, target words) and `lib/verify/{screens,stance,index}.ts`, following the spec's screen order and aggregation. `expected` outcome handling includes `rejects`.
  - Add `lib/fixtures/demo.ts` (R1–R4, E1–E3), and a small script that prints the demo verdicts.
  - Write the tests `hypothetical`, `vague`, `conflict`, `error-signals`, `injection`, `negation-scope` and `demo`, covering:
    - every bluff in `prd.md > Verification`
    - the three good-evidence cases from `spec.md > Decisions and Open Issues`: "should" in Action, "no errors", "done in 2s"
    - a validation message on a `rejects` requirement
    - keyword stuffing with no observation
    - zero evidence
    - superseded evidence excluded
    - the demo at 25%, then a superseding retest (plus evidence for R2 and R4) → 100%, while the same retest without supersede leaves R3 CONTRADICTED
    - every verdict quoting evidence and citing IDs, with no doubled quotes
  Verify (mechanical): `npm run verify:all` passes (lint, typecheck, all tests, static build). `npm run demo:verify` prints exactly the four expected verdicts and 25%.
  Learner check: Run `npm test` and `npm run demo:verify`. Then try to fool it: add one bluff of your own to a test file (a hypothetical, a hidden instruction, a conflicting pair) and see whether the verifier holds.
  Commit: `Add deterministic verifier with adversarial test suite`

- [x] **2. Try the demo: see verdicts, coverage and Proof Gaps in the browser**
  Becomes usable: The Landing screen shows the headline and **Try the demo**. That opens the Workspace, labeled "Demo", with the contract, the preloaded evidence list, a **Verify** button, verdict badges with quoted reasons, a 25% coverage meter, the Proof Graph, and a Proof Gap card for each unproven requirement. The session survives a reload.
  Why now: It puts the kernel on screen as early as possible, in the audit-report look, so your early feedback can shape every UI slice after it.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > Coverage and Proof Graph`, `prd.md > Proof Gap`, `prd.md > Built-in Demo`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Session Store (lib/store)`, `spec.md > Gap Builder (lib/gap)`, `spec.md > UI Components (components/)`, `spec.md > Important Failure Modes`
  Build:
  - Theme tokens and page shell.
  - `lib/store.ts`: the reducer with `loadDemo`, `setVerdicts` and `reset`; the stale flag; `localStorage` save and load, Zod-validated with a safe reset and a notice.
  - `lib/gap.ts`.
  - Components: `GoalInput` (Try the demo only for now), `WorkspaceTopBar`, `EvidenceList` (read-only), `VerdictBadge`, `CoverageBar`, `ProofGraph`, `ProofGapCard`.
  - Backticks in reasons and gaps render as `<code>`.
  - Tests: `store.test` (stale set and cleared, malformed saved state resets) and a gap test (a card for every unproven requirement, none for proven ones).
  Verify (mechanical): `npm run verify:all` passes. Run the dev server, open the demo, press Verify, and confirm (via a browser read of the page) the 25% meter, the three expected verdict badges with text labels, 3 Proof Gap cards, the "Demo" label, and no console errors. Reload and confirm the session is restored.
  Learner check: Run `npm run dev`, open http://localhost:3000, press **Try the demo**, then **Verify**. Read each verdict's reason and Proof Gap. Does it look like an audit report, and does each reason tell you exactly why?
  Commit: `Show demo workspace with verdicts, coverage and Proof Gaps`

- [x] **3. Close the gaps: add evidence, supersede the failure, get the Proof Card**
  Becomes usable: In the demo you add text or structured evidence linked explicitly to requirements, mark a retest as "Supersedes E3", or remove evidence. Verdicts go stale until you verify again. At 100%, the Proof Card appears, with **Copy as Markdown** and **Download .md**, and it lists E3 as superseded.
  Why now: It completes the whole core loop on the demo, which is the full "oh, that's cool" beat, before any new input path is added.
  PRD ref: `prd.md > Evidence`, `prd.md > Proof Card`, `prd.md > Built-in Demo`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > UI Components (components/)`, `spec.md > Session Store (lib/store)`, `spec.md > Proof Card Builder (lib/proofcard.ts)`, `spec.md > Data Model`
  Build:
  - `EvidenceForm`: text or structured input; link checkboxes, with at least one required; an optional Supersedes select offering only evidence that shares a link.
  - Reducer actions `addEvidence` and `removeEvidence`, with never-reused IDs and stale set.
  - `EvidenceList`: superseded items struck through, untrusted badge, remove.
  - `lib/proofcard.ts` and `ProofCard`: copy and download, rendered only when not stale and at 100%.
  - Tests: `store.test` additions (supersede validity, IDs not reused, stale on add, supersede and remove) and a Proof Card test (content, superseded line, nothing when stale or under 100%).
  Verify (mechanical): `npm run verify:all` passes. In the browser, drive the demo to 100%: add evidence for R2 and R4, add a retest that supersedes E3, verify again. Confirm 100%, the Proof Card with the superseded line, the Copy as Markdown output, and no console errors.
  Learner check: In the demo, follow the Proof Gaps: add real evidence for R2 and R4, add a passing retest marked "Supersedes E3", and press Verify. Paste the copied Proof Card into a text editor. Is it something you'd put in a PR?
  Commit: `Add evidence form, supersede and Proof Card`

- [x] **4. It's live: CI on every push and a GitHub Pages deploy**
  Becomes usable: A public GitHub repo where every push runs `verify:all`, and a live URL where anyone can try the demo with no install.
  Why now: The deploy path (static export + basePath) is the next real risk, and a live demo now gives time for feedback (Discord) while features are still landing.
  PRD ref: `prd.md > What We're Building` (static deploy with no API key)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build:
  - `.github/workflows/ci.yml` (`verify:all` on every push) and `.github/workflows/pages.yml` (build the static export into `out/`, deploy with the official Pages actions).
  - `next.config.mjs`: `basePath` from the repo name in CI, `/` locally.
  - README: a mutation-testing table (screen switched off → failing tests), as requested at the slice-1 learner check. It's generated by a script (`npm run mutation`) that switches each screen off and runs the suite, so the numbers are measured, not typed.
  - The GitHub repo is created and pushed only with your explicit go-ahead. You switch Pages → Source to **GitHub Actions** yourself.
  - Before creating anything, confirm that you've renamed the v1 repo `TOUMO45/proofpath` to `proofpath-v1-prototype`. The new public repo is named `proofpath`.
  Verify (mechanical): Both workflows are green on GitHub (shown with `gh run list`). The live URL returns 200, its assets load under the basePath, and the demo reaches 25% on Verify with no console errors (via a browser read of the live page).
  Learner check: Open the live URL on your phone or another browser and run the demo from start to 100%.
  Commit: `Add CI and GitHub Pages deployment`

- [x] **5. Your own goal becomes a clean contract you review and approve**
  Becomes usable: You type a goal and get 3–7 draft requirements, each with its proof template, editable `expected` outcome and target words. Unclean requirements are flagged with a reason and a **Split into 2** suggestion, and flags block **Approve**. Approval unlocks evidence. **Edit contract** reopens it, marking verdicts stale, removing links to deleted requirements and keeping links to edited ones.
  Why now: The demo already proves the loop, so this opens it to real goals. It depends on the verifier (slice 1) and the evidence and Proof Card flow (slice 3).
  PRD ref: `prd.md > Goal to Contract`, `prd.md > Contract Review`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Contract Generator (lib/contract)`, `spec.md > Clean Checker (lib/contract/clean.ts)`, `spec.md > Session Store (lib/store)`, `spec.md > UI Components (components/)`
  Build:
  - `lib/contract/generate.ts`: clause splitting, classification, `expected`, templates, trailing-punctuation cleanup.
  - `lib/contract/clean.ts`.
  - `GoalInput` goal path: an inline message for a too-short goal, and a low-confidence warning for fewer than 3 requirements.
  - `ContractReview`, and the reducer actions for the contract (edit, add, remove, approve, reopen).
  - Tests:
    - `generate.test`: 5 non-demo goals, including "Add a dark mode toggle that persists after page reload", each giving at least 2 clean requirements; no vague words; no duplicates; no trailing ",.".
    - `clean.test`: two behaviors vs. a list checked in one observation; vague words; duplicates; split suggestion.
    - `store.test` additions for reopening.
  Verify (mechanical): `npm run verify:all` passes. In the browser, type the dark-mode goal, confirm at least 2 requirements, add "saves the file and shows a toast" by hand, confirm the flag blocks Approve, split it, approve, add evidence, verify, reopen, and confirm the verdicts go stale. No console errors.
  Learner check: Type a goal from something you've actually asked an agent to build. Are the requirements ones you'd accept as a contract? Try to slip a vague or double requirement past Contract Review.
  Commit: `Generate and review contracts from your own goal`

- [x] **6. Import a plan: ProofPath verifies from its own planning docs**
  Becomes usable: The "Paste a plan" tab lists every bullet and checkbox candidate found, with "needs edit" flags. You select up to 7, and they go to Contract Review. If nothing is found, you see a message and a manual-entry fallback.
  Why now: Last, by your decision in `scope.md > Build Order`. If time runs short, it moves to Later without affecting the rest.
  PRD ref: `prd.md > Plan Import`
  Spec ref: `spec.md > Plan Importer (lib/import)`, `spec.md > UI Components (components/)`
  Build: `lib/import/plan.ts`, the `ImportPicker` component, and the Paste-a-plan tab. `import.test` uses this repo's own `devpost/prd.md` as a fixture: all candidates listed, flagged ones included, at most 7 selectable, a no-bullets input gives an empty list.
  Verify (mechanical): `npm run verify:all` passes. In the browser, paste `devpost/prd.md`, confirm the candidates and flags appear, confirm an 8th selection is blocked, and carry 7 into Contract Review. CI is green after the push.
  Learner check: Paste your own `devpost/prd.md`, pick the requirements you'd verify ProofPath against, and walk one of them to PROVEN with real evidence from the running app.
  Commit: `Import candidate requirements from a markdown plan`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (demo workspace, look and feel, verdict and reason display). Feedback: keep the audit-report look, the reasons and the quoted evidence. Add an "Agent claim" evidence kind and "self-reported" labels on the Proof Card, both folded into slice 3.
- [x] Final kick-the-tires exploration and feedback completed — self-audit table; three rounds of learner feedback; a real-agent test (tip calculator) whose exact reply and three learner observations are now the end-to-end fixture.

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship (learner: "Final review approved" after the quoted-negation gate passed: 285 tests, 14 mutation rules with no survivors, CI and Pages green, localhost and live browser checks).

## Code Tour and App Map

- [x] Learning activity complete — prior practice connected (the learner's own real-world testing was the practice; see below)
- [x] Optional edit and transfer reflection addressed — edit not applicable (no code tour); reflection question offered at hand-off
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Focused alternative via prior practice. The learner's goal was acceptance criteria an agent can't satisfy with a bluff. Their real-agent test exposed four verifier bugs the existing tests missed, and their review of the quoted-negation fix exposed an evasion ("Payment not processed" in quotes). The resolution wrote the criterion in both directions (`tests/quoted-negation.test.ts`: R3 must stay PROVEN; the quoted failure must be CONTRADICTED), with both halves guarded in `scripts/mutation.ts`.
Route and stops: Reference route only (not toured): `components/EvidenceForm.tsx` submit → `lib/store.ts` addEvidence/verify → `lib/verify/index.ts` verifyRequirement/effectiveStance and `lib/verify/stance.ts` stance.
Edit outcome: Not applicable (no code tour; prior practice counted).
Reflection: Offered at hand-off (optional).
Activity mode: Prior practice connected, plus the app map at `devpost/app-map.html` (snapshot of commit 4dd46ab).

## Revisions

- Support also requires the observation to show the requirement's `expected` outcome (e.g. `succeeds` needs "submitted/completed/Thanks/200…", `displays` needs "visible/shown/…" or quoted text), not just target-word overlap plus a concrete observation. This is `prd.md > Verification`'s "matches that requirement's success condition" made mechanical. Without it, a structured test whose Action matched the targets but whose Observed said only "page loaded" would be PROVEN.
- For `rejects` requirements, a non-negated "accepted/submitted/successfully" in the observation is a contradiction. The spec's contradiction rules had no way to catch "the invalid email was accepted and submitted successfully".
- A negated *outcome word* also contradicts ("fields are not visible" on a `displays` requirement), not only a negated target word. A requirement's target words are nouns, so "not visible" slipped through.
- When one evidence item is linked to several requirements, an error sentence only counts against the requirement it's about. That's decided by target words in the sentence, then in Input/Action, and otherwise it counts against all of them. This implements `prd.md > Verification` ("an item only contradicts a requirement if what it observed contradicts THAT requirement's success condition").
- Quoted app text ("'We'll reply soon' shown") is ignored by the hypothetical and vague screens: it's what the app displayed, not the tester's wording.
- Toolchain: ESLint is pinned to 9, because `eslint-config-next` 16's bundled React plugins crash on ESLint 10. TypeScript is 6.0, because `typescript-eslint` doesn't support TypeScript 7 yet. The Vitest config is `.mts`.
- Evidence text is canonicalized before every screen (`lib/text.ts > normalize`): NFKC, invisible format characters removed, Cyrillic/Greek lookalikes mapped to Latin. Structured fields are included. The slice-1 learner check found that zero-width splits (`wo​uld`) and homoglyphs (`wоuld` with a Cyrillic о) gave false PROVENs, and fullwidth or homoglyph injections went unflagged. Covered by `tests/obfuscation.test.ts`.
- An "obfuscated text detected" flag and badge were added to evidence, at the learner's request after the slice-1 check, and folded into slice 2. The flag fires on invisible characters between letters, bidi controls, and lookalike or fullwidth letters in Latin words. It doesn't fire on emoji zero-width joiners or on all-Cyrillic words. The verdict logic is unchanged. `prd.md > States and Boundaries` and `spec.md > UI Components` are updated.
- NOT PROVEN amber is `#8A5A00`, not `#A86A00`: measured contrast on paper was 4.19:1, below the spec's own 4.5:1 rule.
- Special characters in source and tests are written as code points (`String.fromCodePoint(0x200b)`), never as raw characters, so no invisible or lookalike character hides in the repo.
- `next.config.mjs` sets `agentRules: false`: Next 16's `next dev` otherwise writes `AGENTS.md` and `CLAUDE.md` into the repo root.
- The store's `hydrated` flag lives in the reducer (not `useState`), because the React lint rule forbids calling `setState` inside an effect.
- An "Agent claim" evidence kind was added at the checkpoint-1 feedback and folded into slice 3. It's judged exactly like text and labeled AGENT CLAIM. When evidence has several hypothetical sentences, the reason now quotes the one most about the requirement ("should" for R2, "will" for R4), not the first. `prd.md > Evidence` and `spec.md > Data Model` are updated.
- The Proof Card labels every proving item "self-reported" or "agent claim" and ends with "ProofPath did not run any test itself" (checkpoint-1 feedback). `prd.md > Proof Card` is updated.
- Copy as Markdown falls back to copying a selected off-screen textarea when the Clipboard API is denied. The desktop app's browser pane refused `navigator.clipboard.writeText` ("Write permission denied"), and the fallback copy was verified there.
- The public repo is `TOUMO45/proofpathV2`, not `proofpath`. The learner archived v1 (`TOUMO45/proofpath`) and created `proofpathV2`, so the live URL is `https://toumo45.github.io/proofpathV2/`. The Pages workflow takes `basePath` from `actions/configure-pages`, so it follows the repo name.
- `npm run mutation` found a rule with no test: switching off "support needs the expected outcome" (added in slice 1) failed 0 tests. It now has two regression tests in `tests/vague.test.ts`, and the script exits 1 whenever any rule survives.
- The first Pages run failed at `configure-pages` ("Get Pages site failed") because Pages wasn't enabled yet. The workflow token can't enable it, so the learner set Source to GitHub Actions. The next run deployed.
- Slice 5 learner priorities, recorded here: (1) the goal tests include non-form goals: dark mode, a CSV→JSON CLI, and login lockout; (2) "Try the demo" stays the primary action on Landing, with the goal box below it; (3) an end-to-end test covers own goal → approve → agent claim → Verify → NOT PROVEN (`tests/flows.test.ts`).
- Removing a requirement also removes evidence that was linked only to it. Evidence must link to at least one requirement, and a saved session with an unlinked item would fail validation and reset. Contract Review warns before this happens. `prd.md > Contract Review` is updated.
- Failure words (crash, error, fail…) are never target words: with "crashing" as a target, "Observed: no crash" read as a negated target and gave a false CONTRADICTED. Covered in `tests/generate.test.ts` (it fails with the filter removed).
- Editing a requirement's text re-derives its target words and proof template. Targets can still be edited directly afterwards.
- Slice-4 learner check (live site, phone): reached 100% and the Proof Card after several tries. Every failure was the UI, not the verifier. Six guidance fixes were folded into slice 6 before plan import: Record this test, the over-linking hint with Unlink, visible Supersedes, the missing-link hint, the demo-only sample retest, and the audit trail for deleted requirements. See `prd.md > Guidance While Recording Evidence` and `prd.md > Audit Trail for Deleted Requirements`.
- The over-linking test fixture was corrected, not weakened. With "Blocked" as the observation, the sentence matches R2's own target word ("block"), so the relevance rule makes it neutral for R3, not a contradiction, and there is nothing to ask about. The test now uses "Submission refused", which is about R3 and contradicts it. A second test pins the neutral case.
- Adding evidence hides the Proof Gap cards (and their Record buttons) until the next Verify, because gaps come only from current verdicts. Recording several gaps therefore needs a Verify between them.
- Plan import on this repo's `devpost/prd.md` finds 150 candidates, 8 flagged. Noun-phrase bullets ("A Try the demo button") get `expected: succeeds`, where `displays` would fit better; it's editable in review.
- Final-review feedback, round 1 (learner decisions): (1) plan import lists only checkbox items by default, with an "Include plain bullets" toggle, a filter box and each item's source heading. `prd.md` now gives its acceptance criteria instead of 150 items. (2) A noun phrase with no finite verb is drafted as `displays`; base verbs inside names ("A Create Proof Plan button") don't count as verbs. (3) Proof Gaps stay visible while stale, dimmed with "STALE: re-verify", and Record still works. (4) Deleting a requirement keeps the current behavior, confirmed by the learner.
- UI refresh, a learner request during the final review: colors and button shapes from a reference image (pale lime paper, lime pills, rounded outlined buttons), plus motion tied to state changes (headline reveal, verdict pop, coverage bump and fill, Proof Card arrival). This replaces the planned "one blue accent, no gradients" look. `prd.md > Look and Feel` and `spec.md > Look and Feel` are revised. White-on-lime button text was rejected at about 2.4:1 contrast in favor of ink on lime (13.4:1). All motion is disabled under prefers-reduced-motion.
- Real-agent test (tip calculator), learner findings:
  - The generator produced "showses" and "rejectses", in requirement text and targets, when a goal started with an order and continued with already-inflected verbs. `thirdPerson` now keeps inflected verbs; tests cover shows/rejects/displays/saves/passes/fixes. The verb list gained common verbs (takes, calculates, …), which also stops "The tip calculator takes a bill amount" from being drafted as a noun phrase (`displays`). The "R1 missed bill and amount" finding couldn't be reproduced without the exact goal.
  - Tool instructions no longer use words the verifier rejects: "where it should appear" → "Open the screen with it", and "I will verify that" → "Verify that". `tests/wording.test.ts` scans every template and gap text.
  - New Landing path "Check an agent's reply" (request + reply, paste or upload): the reply becomes E1 on approval and Verify runs once. It comes with local-only uploads (.md/.txt, 200 KB) and the plan box redirect for prose.
  - Learner product decision: an agent claim never proves a requirement on its own. It's still screened, and it can still contradict. Its concrete claims are listed in the Proof Gap. It's in the mutation check.
- Linking a reply to every requirement exposed a relevance flaw: an error word in "Negative amounts are rejected" counted against "takes a bill amount" because both mention an amount. A sentence is now attributed to the linked requirement(s) it matches **best**. Proof Gap claims use the same rule.
- Success outcome words gained "accepted", "calculated", "computed", "converted", "updated" and "processed". A real observation for "takes a bill amount" ("amount accepted; tip calculated") was otherwise not recognized as success. "Accepted" on a `rejects` requirement still contradicts.
- The agent-reply fixture (`tests/fixtures/tip-agent-reply.md`) is reconstructed around the line the learner quoted, until the exact reply is supplied.
- Real agent-reply test, round 2 (learner findings): the verdicts were right (all NOT PROVEN), but every reason said "hypothetical wording ('couldn't')" and quoted the agent's unrelated "Separately…" paragraph. Fixed:
  - (1) Claim reasons always lead with the agent-claim rule; screen findings follow only when relevant.
  - (2) "couldn't" / "could not" are no longer hypothetical ("could" still is).
  - (3) Neutral and support quotes come only from sentences sharing target words, otherwise none. A contradiction or injection still quotes the failure or instruction it found, because that sentence is the evidence ("Page shows 500 Internal Server Error" shares no target word with R3).
  - (4) A fixture reconstructed around the quoted paragraph (`tests/fixtures/tip-agent-reply-separately.md`) until the exact reply is supplied.
- Claims are now judged without the wording screens (they are composed into the note instead), so a hypothetical sentence anywhere in a long reply can no longer hide a reported failure.
- Browser check found doubled quotes when a quoted sentence contained its own double quotes (`…"Amount must be positive""`). Inner double quotes now become single quotes in every quote, covered in `tests/claim-reason.test.ts`.
- Exact agent reply and goal supplied by the learner; both reconstructed fixtures are replaced by `tests/fixtures/tip-agent-reply.md` (verbatim). A new end-to-end test: goal → contract → approve → E1 = the reply → 0% → the learner's 3 observations → 100% → Proof Card with E2–E4 as self-reported provers and E1 never a prover. The exact text exposed:
  - The learner's R3 observation (the quoted UI message "The bill can't be negative.") came out CONTRADICTED: negation scanning read quoted, displayed text. Negation now skips quoted text (mutation-guarded).
  - Sentences were split at the "." inside a quoted message, and multi-line replies were flattened (a heading merged with the bullet under it). Splitting is now per line and never inside double quotes, and evidence parsing keeps line breaks.
  - The real reply made R1 and R2 CONTRADICTED because the agent described its error handling ("inline error …", "contradicted the error message"). A claim now contradicts only on an unambiguous failure: an app failure (5xx, exception, crash, hang, timeout, stack trace), accepted input on a rejects requirement, or a negation (mutation-guarded).
  - The learner's earlier "R1 missed bill and amount" is now reproduced and fixed. With "Build X: a, b, and c", the colon's features are behaviors of X, and target words list what distinguishes each requirement before the shared subject's words. "has … inputs" is `displays`.
  - Agent-claim text in Proof Gaps renders backticks as code.
- Learner review of the quoted-negation fix: skipping every quoted negation would let a failure hide in quotes ("Payment not processed" on "the payment is processed" was PROVEN; reproduced by a failing test first). Quoted negation is now skipped only on `rejects` requirements. Error signals and accepted input count inside quotes for all outcomes. Both directions are in the mutation check (`tests/quoted-negation.test.ts`).
- Learner incognito check: the fixes worked, but a normal window showed OLD saved verdicts labeled current. Verdicts are now stamped with `RULES_VERSION`; a saved session from other rules loads STALE with "Rules were updated since these verdicts. Re-verify." The version is shown in the footer and on the Proof Card.
- Relevance ranking (learner finding): quotes and AGENT CLAIMS lists picked weak matches because shared subject words (tip, calculator, page) match everything. Requirements now record `shared` subject targets. Ranking counts distinguishing words (repeats count), then concreteness, then shared words; subject-only matches are off topic. A one-word quote ("tick") no longer counts as a concrete claim. Claims are judged concrete on the whole line, before shortening (R1's "Bill amount + Tip % inputs…" had been dropped because its number came after character 120). Mutation-guarded.
- Agent replies keep their line breaks in the evidence list (`whitespace-pre-wrap`).
- The learner expected R2 not to quote "Done — tip-calculator.html…". That line is not in the reply as supplied, so the fixture can't exercise it until the full opening line is provided.
- Mutation-script incident: a run left `if (false && neg)` in `lib/verify/stance.ts` (scoped negation switched off). The next baseline caught it (8 failing tests), and it was never committed (every commit checked). The restore in `finally` had failed, most likely because the running dev server's watcher briefly locked the file on Windows, which crashed the script. The script now snapshots every touched file, retries restores, re-checks all files against their snapshots at the end (exit 2 with the file names otherwise), and restores on exit or interruption. A verified run left `lib/` byte-for-byte unchanged.
- Second fixture `tests/fixtures/tip-agent-reply-2.md`: the learner's exact opening line of the incognito reply ("Done — tip-calculator.html (single self-contained file…)") followed by the first reply's body, since only the opening line was supplied. The R2 "never quote the Done line" test fails without the relevance ranking, so it is load-bearing.
