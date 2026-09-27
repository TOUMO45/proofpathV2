---
doc: spec
status: approved
---

# ProofPath — Technical Spec

## How This Works, In Plain Language
ProofPath is a single web page. Everything runs in your browser, with no server, no API key and no network calls after the page loads.

It has four pieces of logic. Each one is a **pure function**: text in, result out, with no access to the screen or the network. That makes each piece easy to test by feeding it attacks:

1. **Contract generator:** turns a typed goal into requirements, by splitting it into clauses and giving each one a template for the evidence that would prove it.
2. **Clean checker:** decides whether a requirement is clean (one behavior, no vague words, no duplicates). It flags the requirement with a reason if not, and suggests a split.
3. **Plan importer:** pulls bullet and checkbox items out of pasted markdown and runs them through the clean checker.
4. **Verifier:** judges each requirement against the evidence linked to it. It runs every piece of evidence through a fixed series of screens: injection → hypothetical → vague → contradiction → support. It then combines the results into PROVEN, NOT PROVEN or CONTRADICTED, with a quoted reason. A small **gap builder** turns each unproven requirement into a Proof Gap.

The screens (Landing, Contract Review, Workspace) only display what those functions return. The whole session (contract, evidence, verdicts and a **stale** flag) lives in one object in the page's memory, copied to `localStorage` (a sticky note the browser keeps for this one site) so it survives a reload.

**Why this shape:** the kernel is a verifier that can't be talked into a verdict. Keeping it as plain deterministic functions, with no LLM and no backend, means every bluff pattern can be pinned down by a test that runs on every push. v1 failed precisely because nobody attacked the engine systematically.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Landing.** You type a goal → `generateContract(goal)` returns draft requirements → each goes through `checkClean` → the session reducer stores them as a draft contract → Contract Review shows them. Pasting a plan works the same way, except `importPlan(markdown)` returns *all* candidates with their flags, and you tick up to 7 before Contract Review. **Try the demo** loads the demo fixture into the session instead.
2. **Contract Review.** Your edits dispatch actions to the reducer, and `checkClean` re-runs on every change. **Approve** is disabled while any requirement is flagged. Approving sets `contract.approved = true` and unlocks the evidence form.
3. **Adding evidence.** The form builds an Evidence object, which Zod checks. It must have at least one link, and a `supersedes` target must share a link. The reducer appends it with the next unused ID and sets `stale = true`.
4. **Verify.** `verify(contract, evidence)` runs → one verdict per requirement, each with its reason and cited IDs → `buildGaps` produces a Proof Gap for each unproven requirement → the reducer stores the verdicts and sets `stale = false` → coverage = PROVEN ÷ total.
5. **Retest.** You add new evidence marked "Supersedes E3" → E3 is shown struck through and excluded from judging → `stale = true` → you verify again.
6. **100%.** When `stale === false` and coverage is 100%, `buildProofCard` renders the Markdown checklist. **Copy as Markdown** uses the clipboard; **Download .md** creates a file in the browser.
7. **Reload.** On load, the saved session is read from `localStorage` and checked with Zod. If it's malformed, it's discarded and you land on the Landing screen.

## Stack
Chosen by the learner. Versions to confirm at scaffold time; I haven't looked any up during this planning session.

- **Next.js (App Router) + TypeScript**, as a **static export** (`output: 'export'`). A familiar stack from v1, and static export gives a free GitHub Pages deploy. **Tradeoff accepted:** no API routes, which matches the no-backend decision. Docs: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
- **Tailwind CSS**, for fast, consistent styling of the audit-report look. Docs: https://tailwindcss.com/docs. *Verify early:* Tailwind v4 is configured in CSS rather than `tailwind.config.ts`; use whatever the installed version expects.
- **Zod**, to validate contract, evidence and saved-state shapes, so a malformed save can't crash the app. Docs: https://zod.dev
- **Vitest**, for the adversarial test suite. It runs TypeScript directly and fits CI. Docs: https://vitest.dev
- **React `useReducer` + `localStorage`** for state. There's no state library, because one small session object doesn't need one.

## Where It Runs and How Someone Tries It
- **Runtime:** the browser only. It needs Node.js (current LTS) and npm to develop, and no API keys.
- **Local:** run `npm install`, then `npm run dev`, then open http://localhost:3000.
- **Checks:** `npm run verify:all` runs lint + typecheck + tests + static build.
- **Deploy (the learner chose this):** GitHub Pages through a GitHub Actions workflow on push to `main`.
  - The workflow runs `verify:all`, builds the static export into `out/`, and publishes it.
  - `basePath` comes from the repository name at build time, so that asset URLs work under `https://<user>.github.io/<repo>/`. Locally it's `/`.
  - One-time setup: repo Settings → Pages → Source: **GitHub Actions**.
- **For the demo recording:** open the live URL, or localhost, and press **Try the demo**. The submission still needs the video and the public repo; the live URL is extra.

## Look and Feel
From `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **Palette** (Tailwind theme tokens):
  - paper background `#FAF8F3`
  - ink `#16161A`
  - muted ink `#5A5A63`
  - rule lines `#DDD8CC`
  - one blue accent `#1F4FD1`
- **Verdict colors:**
  - PROVEN green `#1E7A46`
  - NOT PROVEN amber `#8A5A00` (5.58:1; the originally planned `#A86A00` measured 4.19:1)
  - CONTRADICTED red `#B42318`

  Each verdict always renders as a text badge ("PROVEN" etc.), never color alone. Verdict colors must reach at least 4.5:1 contrast on paper.
- **Type:**
  - a clean system sans for UI text
  - monospace (system mono stack) for evidence, quotes, evidence IDs and the Proof Card
  - section labels in small caps with wide letter-spacing
- **Density:** calm and document-like. Thin rules instead of shadows, square-ish corners, no gradients, sparkles or glow.
- **Copy tone:** flat and precise, like an audit finding. "NOT PROVEN — evidence uses hypothetical wording: 'would be blocked'."
- **Code in text:** backticks in any reason or gap text render as `<code>`, never as raw backticks.
- **Mode:** light only (dark mode is deferred).

## Components

### Contract Generator (`lib/contract`)
- Splits a goal into sentences (`;`, `.`), then into behaviors at "that/which" (a relative clause on a subject) and at ", " / "and" wherever the next word is a verb. "Name, email and message fields" stays one list. A condition ("after page reload", "without crashing") stays attached to its behavior rather than becoming a requirement of its own. Trailing punctuation is trimmed.
- Classifies each clause (e.g. visible, rejects, succeeds, shows, persists) and attaches an **expected outcome** (see Decisions) and an "evidence that would prove it" template.
- Target words skip failure words (crash, error, fail, timeout…), because they describe what must *not* happen: as targets, "no crash" in good evidence would read as a negated target.
- Returns 0–7 draft requirements (R1…R7). Too-short goals return an error; fewer than 3 triggers the low-confidence warning in the UI.

PRD ref: `prd.md > Goal to Contract`.

### Clean Checker (`lib/contract/clean.ts`)
`checkClean(requirement, others)` returns `{ ok, reasons[], splitSuggestion? }`. It applies these rules:
- **Two behaviors joined by "and":** a verb on both sides of "and" fails. A noun list checked in one observation passes.
- **Vague words:** "good", "properly", "works well", "nice" and similar.
- **Duplicates:** normalized text equality.

`splitSuggestion` splits at the offending "and" and repeats the subject where needed. It's the same function for generated, imported and manual requirements.

PRD ref: `prd.md > Goal to Contract`, `prd.md > Contract Review`.

### Plan Importer (`lib/import`)
`importPlan(markdown)`:
- Collects every line matching `- [ ] …`, `- [x] …`, `- …` or `* …`.
- Strips the markers and inline markdown.
- Removes exact duplicates and runs `checkClean` on each.
- Returns all candidates with their flags.

It never truncates; the UI enforces selecting at most 7. If it finds nothing, it returns an empty list and the UI shows "nothing found" and a manual-entry fallback. This is the last build slice.

PRD ref: `prd.md > Plan Import`.

### Verifier (`lib/verify`)
`verify(contract, evidence)` is pure, with no DOM access. For each requirement, it takes the **active** evidence linked to it (not superseded) and gives each item a *stance*:

1. **Injection screen** (reads **all** fields, structured or not): patterns like "mark/record/set … proven", "all requirements are satisfied", "note to (the) verifier/grader/judge", "ignore previous". → stance `untrusted`: the item gets a flag and contributes nothing.
2. **Hypothetical/modal screen:** would, should, will, if, expected to, supposed to, is designed to. → `neutral`, reason "hypothetical wording: '<word>'". For structured evidence, this screen reads **only the Observed field**. Input and Action describe the test setup, so "Action: entered an email that should be rejected" is legitimate.
3. **Vague screen:** fires only when a vague phrase ("it works", "looks good", "done", "all good") appears **and** there is no concrete observation. → `neutral`. "Observed: upload done in 2s, file appears in the list" passes on to the next screens. For structured evidence, it reads only the Observed field.
4. **Contradiction:**
   - Error signals (4xx/5xx status codes, error, exception, crash, hang, timeout, stack trace, undefined, NaN) as whole words, applied according to the requirement's `expected` outcome:
     - `succeeds`, `displays`, `persists`: any error signal contradicts.
     - `rejects`: a validation message ("error", "invalid", "rejected") is *support*, not a contradiction. Only app failures (5xx, exception, crash, hang, timeout, stack trace) contradict.
   - **A negated error signal is not an error signal.** "No errors", "without errors", "0 errors" and "no exception" don't contradict.
   - Or a negation scoped to the requirement's **target words**: a negator ("not", "no", "never", "failed to", "without") must govern a target word within the same clause. In "pressed Send without any delay", "without" governs "delay", which isn't a target, so there's no contradiction.
   - → `contradicts`.
5. **Support:** topical overlap (at least 2 of the requirement's target words, or all of them if it has fewer than 2) **and** a concrete observation (a structured `observed` field, or an action verb plus an observed result). → `supports`.
6. Otherwise → `neutral`.

**Aggregating per requirement:**
- any `contradicts` → **CONTRADICTED**, even with support. The reason names every contradicting and supporting ID.
- else any `supports` → **PROVEN**
- else **NOT PROVEN**. With zero linked evidence, the reason is "no evidence linked".

**Reasons:** the reason quotes the evidence sentence with the most target-word overlap, with wrapping quotes stripped so there are never doubled quotes. It cites evidence IDs.

PRD ref: `prd.md > Verification`.

### Gap Builder (`lib/gap`)
For each requirement that isn't PROVEN, it builds a Proof Gap from the requirement's template:
- **Action:** what to do.
- **Observe:** what you'd see.
- **"I will verify that …"**
- **Why it's open:** the verdict's reason.

PRD ref: `prd.md > Proof Gap`.

### Proof Card Builder (`lib/proofcard.ts`)
Pure: builds the Markdown string with:
- the goal
- each requirement with ✓ and the proving evidence ID(s)
- the evidence count
- the date
- the superseded items ("E3 (…) superseded by E4")
- the line "verified by ProofPath rules"

It returns nothing unless the verdicts are current and cover 100%.

PRD ref: `prd.md > Proof Card`.

### Session Store (`lib/store`)
- **`useReducer`**, with these actions:
  - `setDraftContract`, `editRequirement`, `addRequirement`, `removeRequirement`
  - `approveContract`, `reopenContract`
  - `addEvidence`, `removeEvidence`
  - `setVerdicts`, `loadDemo`, `reset`
- **Staleness:** every action that changes the contract or evidence sets `stale = true`, and only `setVerdicts` clears it.
- **IDs:** evidence IDs increment and are never reused, so E3 always means the same thing.
- **Persistence:** the session saves to `localStorage` after each change and is Zod-validated on load.

PRD ref: `prd.md > States and Boundaries`, `prd.md > Evidence`, `prd.md > Contract Review`.

### Evidence Guidance (`lib/hints.ts`, `lib/gap.ts > recordPrefill`)
- **`recordPrefill(gap, session)`** gives Input and Action for Record this test. Action is the "do" part of the proof template. Input is reused from the evidence being retested, or a generic suggestion by `expected`. There is no Observed field.
- **`missingLinkHints`** finds unlinked requirements whose targets the observation already meets (the support threshold).
- **`retestPrompts`** finds contradicting evidence (`verify > contradictingIds`) on linked CONTRADICTED requirements that can still be superseded.
- **`demoSampleFor`** returns the sample Observed only when `session.isDemo`.
- **`verify > overLinks`** finds multi-linked evidence that supports another linked requirement and contradicts this one. It's appended to the CONTRADICTED reason as "… Is this link intended?". The store action `unlinkEvidence` removes one link and never the last one.

PRD ref: `prd.md > Guidance While Recording Evidence`.

### UI Components (`components/`)
- **`GoalInput`:** Landing, with the goal textarea and the "Paste a plan" tab.
- **`ImportPicker`:** the candidate list with flags, selecting up to 7.
- **`ContractReview`:** edit, add, remove, flags, Split into 2, Approve. It shows each requirement's editable `expected` outcome and its target words, so you can see why a verdict lands the way it does.
- **`WorkspaceTopBar`:** the steps plus the coverage meter, with a Demo label when a demo is loaded.
- **`EvidenceForm`:** structured test, text or agent claim input, link checkboxes, and an optional Supersedes select.
- **`EvidenceList`:** superseded items struck through, an untrusted badge, and an "obfuscated text detected" badge.
- **`ProofGraph`:** Goal → Requirements → Evidence → Verdict, as plain HTML/CSS columns with connector lines. No graph library.
- **`CoverageBar`**, **`ProofGapCard`**, **`ProofCard`** (Copy / Download).
- **`VerdictBadge`:** a text badge in the verdict color.

PRD ref: `prd.md > Screens and Layout`.

### Demo Fixture (`lib/fixtures/demo.ts`)
- **Contract:** the contact-form contract R1–R4.
- **Evidence:**
  - E1: a structured fields test
  - E2: the "would be blocked" bluff
  - E3: a structured test with a 500 error on submit

It's labeled as a fixture in code and "Demo" in the UI. The expected results are asserted by tests.

PRD ref: `prd.md > Built-in Demo`.

## Data Model

```ts
type ExpectedOutcome = 'succeeds' | 'rejects' | 'displays' | 'persists'; // editable in Contract Review

type Requirement = {
  id: string;            // R1…R7
  text: string;
  proofTemplate: string; // "evidence that would prove it"
  expected: ExpectedOutcome;
  targets: string[];     // target words used for overlap/negation scope
  flags: string[];       // clean-rule failures
};

type Evidence = {
  id: string;            // E1, E2…, never reused
  kind: 'text' | 'structured' | 'claim'; // claim = an agent's pasted message, judged exactly like text
  text?: string;
  structured?: { input: string; action: string; observed: string };
  links: string[];       // requirement IDs, at least 1, always set explicitly
  supersedes?: string;   // evidence ID sharing ≥1 link
  flags: string[];       // e.g. 'untrusted'
};

type Verdict = {
  requirementId: string;
  status: 'PROVEN' | 'NOT_PROVEN' | 'CONTRADICTED';
  reason: string;        // with the quoted sentence
  evidenceIds: string[];
};

type Session = {
  goal: string;
  contract: { requirements: Requirement[]; approved: boolean };
  evidence: Evidence[];
  verdicts: Verdict[];
  stale: boolean;
  isDemo: boolean;
  nextEvidenceNumber: number;
  removedRequirements: { id: string; text: string; lastVerdict: VerdictStatus; removedEvidence: string[] }[]; // audit trail
};
```

**`supersededBy` is derived, not stored.** It's computed from the `supersedes` fields, so the two can never disagree. The session lives in memory while the page is open, and is saved to `localStorage` under one key after every change. When you come back, it's restored if it's valid, and reset if not.

## File Structure

```
proofpath-v2/
├── app/
│   ├── layout.tsx          # fonts, palette, page shell
│   ├── page.tsx            # screen switcher: Landing → Review → Workspace
│   └── globals.css         # Tailwind + theme tokens
├── components/             # UI only, no verification logic
│   ├── GoalInput.tsx
│   ├── ImportPicker.tsx
│   ├── ContractReview.tsx
│   ├── WorkspaceTopBar.tsx
│   ├── EvidenceForm.tsx
│   ├── EvidenceList.tsx
│   ├── ProofGraph.tsx
│   ├── CoverageBar.tsx
│   ├── ProofGapCard.tsx
│   ├── ProofCard.tsx
│   └── VerdictBadge.tsx
├── lib/                    # pure functions, no DOM
│   ├── types.ts            # data model + Zod schemas
│   ├── text.ts             # tokenizing, sentence split, quote stripping, target words
│   ├── contract/
│   │   ├── generate.ts     # goal → requirements
│   │   └── clean.ts        # clean rules + split suggestion
│   ├── import/plan.ts      # markdown → candidates
│   ├── verify/
│   │   ├── screens.ts      # injection, hypothetical, vague patterns
│   │   ├── stance.ts       # per requirement × evidence
│   │   └── index.ts        # aggregate → verdicts
│   ├── gap.ts
│   ├── proofcard.ts
│   ├── store.ts            # reducer, stale rules, localStorage load/save
│   └── fixtures/demo.ts    # labeled demo fixture
├── tests/                  # Vitest, one file per bluff pattern + flows
│   ├── hypothetical.test.ts  # incl. "should" in Action is not a bluff
│   ├── vague.test.ts         # incl. "done in 2s, file appears" passes
│   ├── conflict.test.ts
│   ├── error-signals.test.ts # incl. rejects vs succeeds, "no errors" → PROVEN
│   ├── injection.test.ts
│   ├── negation-scope.test.ts
│   ├── clean.test.ts
│   ├── generate.test.ts
│   ├── import.test.ts
│   ├── store.test.ts       # stale rules, supersede, reopen, malformed load
│   └── demo.test.ts        # 25% → supersede retest → 100%
├── .github/workflows/
│   ├── ci.yml              # verify:all on every push
│   └── pages.yml           # build + deploy to GitHub Pages
├── next.config.mjs         # output: 'export', basePath from env
├── package.json            # scripts: dev, lint, typecheck, test, build, verify:all
├── README.md
└── devpost/                # planning docs (learner-profile.md is gitignored)
```

## External Services and Dependencies
- **GitHub Actions + GitHub Pages:** free for public repos. No keys. Docs: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- **No runtime APIs.** There are no `fetch` calls, API routes or keys, so nothing can fail over the network.
- **npm packages:** next, react, react-dom, tailwindcss, zod, vitest, typescript, eslint. Versions are to be pinned by `package-lock.json` at scaffold time.

## Important Failure Modes
- **False PROVEN (the worst failure).** When no rule gives a clear `supports`, the stance is `neutral` and the verdict is NOT PROVEN. Every known bluff is a regression test, and CI blocks a merge on failure.
- **Malformed or old saved state.** Zod validation fails → the saved session is discarded → Landing screen, with a one-line notice "Saved session couldn't be read and was reset."
- **Plan import finds nothing.** A "No bullet or checkbox items found" message, and manual entry.
- **Broken asset paths on Pages.** `basePath` comes from the repo name. CI builds the export, and after deploy the live URL is checked manually.

## What Was Simplified and Why
- **Rule-based verifier** instead of an LLM judge. It's the kernel: deterministic, inspectable, testable against attacks. An LLM layer would add keys, cost and a persuadable judge.
- **`localStorage`** instead of a database or accounts. It's single-user, and survives a reload with no infrastructure.
- **A plain HTML/CSS Proof Graph** instead of a graph library. It has four fixed columns, so a library adds weight for nothing.
- **Simple plan import** (bullets and checkboxes only) instead of per-file parsing. It's cheap, predictable, and cut first if time runs short.
- **The demo uses fixture data**, labeled in code and UI. The verifier running on it is real, not simulated.

## Decisions and Open Issues

**Learner decisions:**
- **Stack:** Next.js + TypeScript + Tailwind static export on GitHub Pages; Zod; Vitest; `useReducer` + `localStorage`; no backend and no keys.
- **Verifier:**
  - screen order injection → hypothetical → vague → contradiction → support
  - aggregation: any contradiction → CONTRADICTED
  - support needs overlap **and** a concrete observation
- **Negation scope:** negation is scoped to the requirement's target words, not proximity. This fixes v1's "without any delay" false contradiction.
- **Reasons:** they quote the sentence with the most overlap, never raw backticks.
- **Staleness:** any change to the contract or evidence sets `stale`, and the Proof Card needs `stale === false` and 100% coverage.
- **Tests:** one test file per bluff pattern, plus a demo test for 25% → 100%, run in CI on every push.
- **Build mode for `5-build`:** fast mode, with verification and a commit for every slice and minimal explanations. The first slice is the verifier and adversarial tests, with no UI.

- **Expected outcome (resolved open issue 1):** each requirement carries an editable `expected` outcome. For `rejects`, a validation message is support; app failures (5xx, exception, crash, hang, timeout, stack trace) still contradict.
- **Three refinements that prevent false verdicts on good evidence**, each with a regression test:
  1. For structured evidence, the hypothetical and vague screens read only Observed. The injection screen reads every field.
  2. A negated error signal ("no errors", "without errors", "0 errors", "no exception") doesn't contradict. Test: "Observed: no errors, 'Thanks' displayed" → PROVEN for a `succeeds` requirement.
  3. The vague screen fires only for a vague phrase **without** a concrete observation. Test: "Observed: upload done in 2s, file appears in the list" is not stopped as vague.
- **Accepted agent additions:**
  - Contract Review shows `expected` and the target words.
  - "done" is on the vague list, under refinement 3.
  - The support threshold is at least 2 target words, tuned by tests.

**Derived implementation details (the agent's, following from the above):**
- Target-word extraction.
- Evidence IDs never reused.
- `supersededBy` derived, not stored.
- `basePath` from the repo name.
- The palette hex values.
- A plain HTML/CSS Proof Graph.

**One useful unknown (learning goal: acceptance criteria that can't be bluffed).**
The question is what "topical overlap" means in a rule. The current answer: each requirement carries explicit **target words**, which Contract Review shows. Support needs at least 2 of them, or all of them if there are fewer than 2, plus a concrete observation.

This will be checked during the build by the `negation-scope` and `conflict` tests and one keyword-stuffing test: text containing all the target words but no action or result must stay NOT PROVEN. If the threshold proves too loose or too strict on the demo and on 5 non-demo goals, adjust it with a test, never by weakening an existing one.

**Carried from the PRD:** none. `prd.md > Open Questions` is empty.
