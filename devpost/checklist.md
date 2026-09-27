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

- [ ] **5. Your own goal becomes a clean contract you review and approve**
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

- [ ] **6. Import a plan: ProofPath verifies from its own planning docs**
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
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

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
