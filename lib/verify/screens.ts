// The verifier's screens: fixed, inspectable patterns.
// spec.md > Verifier (lib/verify). Every pattern here is pinned by a test in tests/.

import type { ExpectedOutcome } from "../types";
import { contentWords, normalize, splitSentences, tokenize } from "../text";

export type Hit = { match: string; sentence: string };

function firstHit(text: string, patterns: RegExp[]): Hit | null {
  for (const sentence of splitSentences(text)) {
    for (const p of patterns) {
      const m = sentence.match(p);
      if (m) return { match: m[0], sentence };
    }
  }
  return null;
}

// 1. Injection: instructions aimed at the verifier. Reads every field.
const INJECTION: RegExp[] = [
  /\b(mark|record|set|output|treat|consider)\b[^.;]{0,40}\b(as|to)\s+(proven|verified|satisfied|passed)\b/i,
  /\b(mark|record|set)\s+(everything|all|every\s+\w+|each\s+\w+|this|it|them)\b[^.;]{0,30}\b(proven|verified|satisfied|passed)\b/i,
  /\b(every|all|each) (verdicts?|requirements?|criteria|checks)\b[^.;]{0,40}\b(proven|satisfied|met|verified)\b/i,
  /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(verifier|grader|judge|evaluator|reviewer|ai|model|assistant)\b/i,
  /^\s*(verifier|grader|judge|evaluator)\s*[:,]/i,
  /\b(ignore|disregard)\b[^.;]{0,30}\b(previous|prior|above|earlier|all|the)\b[^.;]{0,20}\b(instructions?|rules|evidence|checks)\b/i,
  /\bsystem prompt\b/i,
  /\byou are (an? )?(ai|assistant|verifier|language model)\b/i,
];

export function findInjection(text: string): Hit | null {
  return firstHit(text, INJECTION);
}

// 2. Hypothetical / modal wording: a prediction, not an observation.
const HYPOTHETICAL: RegExp[] = [
  /\b(would|should|will|could|might)(?:n't)?\b/i,
  /\bwon't\b/i,
  /\b\w+'(?:ll|d)\b/i,
  /\bif\b/i,
  /\b(expected|supposed|designed|meant|going) to\b/i,
];

/**
 * Replace quoted spans with a placeholder. Quoted text is what the app showed,
 * verbatim ("'We'll reply soon' shown"), so it must not trip the wording screens.
 */
export function withoutQuotes(text: string): string {
  return normalize(text)
    .replace(/"[^"]{2,}"/g, "QUOTED")
    .replace(/(^|[^A-Za-z])'([^']{2,}?)'(?![A-Za-z])/g, "$1QUOTED");
}

export function findHypothetical(text: string): Hit | null {
  return firstHit(withoutQuotes(text), HYPOTHETICAL);
}

// 3. Vague approval.
const VAGUE_PHRASES: RegExp[] = [
  /\b(it|everything|all)\s+(works|worked|is working)\b/i,
  /\bworks?\s+(fine|well|great|correctly|properly|as expected)\b/i,
  /\b(looks|seems)\s+(good|fine|great|ok|okay|right|correct)\b/i,
  /\ball good\b/i,
  /\blgtm\b/i,
  /\bno (issues|problems)\b/i,
  /\bas expected\b/i,
  /\bdone\b/i,
  /\b(good|nice|fine|properly|correctly)\b/i,
];

export function findVaguePhrase(text: string): Hit | null {
  return firstHit(withoutQuotes(text), VAGUE_PHRASES);
}

const VAGUE_WORDS = new Set(
  "works work working worked fine good great ok okay done correct correctly properly nice expected looks seems lgtm perfect well everything issues problems".split(
    " ",
  ),
);

const ACTION_VERBS =
  /\b(click(ed)?|press(ed)?|enter(ed)?|typ(e|ed)|submit(ted)?|open(ed)?|load(ed)?|reload(ed)?|refresh(ed)?|ran|run|navigat(e|ed)|upload(ed)?|toggl(e|ed)|fill(ed)?|sent|send|test(ed)?|tri(ed)|visit(ed)?|select(ed)?|chose|tapp(ed)|restart(ed)?|call(ed)?|request(ed)?|curl(ed)?|log(ged)? in)\b/i;

const RESULT_WORDS =
  /\b(show(s|n|ed)?|display(s|ed)?|appear(s|ed)?|visible|return(s|ed)?|redirect(s|ed)?|receiv(e|ed)|got|saw|rendered|persist(s|ed)?|remain(s|ed)?|stay(s|ed)?|still|chang(e|es|ed)|block(s|ed)?|reject(s|ed)?|accept(s|ed)?|sav(e|es|ed)|respond(s|ed)?|response|status|listed|contain(s|ed)?|read(s)?)\b/i;

/**
 * A concrete observation: something was done and a specific result was seen.
 * - Labeled evidence (structured, or "Observed:" text): the observed part has at
 *   least 2 non-vague content words, or quoted text, or a status code.
 * - Plain text: an action verb AND a result word/quote/status, plus at least 2
 *   non-vague content words.
 */
export function hasConcreteObservation(observed: string, labeled: boolean): boolean {
  const text = normalize(observed);
  const words = contentWords(text).filter((w) => !VAGUE_WORDS.has(w));
  const hasQuote = /["'][^"']{2,}["']/.test(text);
  const hasStatus = /\b[1-5]\d\d\b/.test(text);
  if (labeled) return words.length >= 2 || hasQuote || hasStatus;
  return ACTION_VERBS.test(text) && (RESULT_WORDS.test(text) || hasQuote || hasStatus) && words.length >= 2;
}

// Negation handling -------------------------------------------------------

const NEGATORS = new Set(["not", "no", "never", "without", "zero", "0", "nothing", "none", "cannot", "unable"]);

function isNegator(token: string): boolean {
  return NEGATORS.has(token) || token.endsWith("n't");
}

// Words skipped when looking for what a negator governs.
const NEGATION_FILLER = new Set(
  "any a an the be been being get got was were is are it its to do did does have has had console further more".split(" "),
);

/** True if one of the (up to) 3 tokens before index i is a negator. */
function negatedAt(tokens: string[], i: number): boolean {
  for (let j = Math.max(0, i - 3); j < i; j++) if (isNegator(tokens[j])) return true;
  return false;
}

const CLAUSE_BREAK = /[,;:.!?]|\s(?:and|but|then)\s/i;

function clauses(sentence: string): string[] {
  return sentence.split(CLAUSE_BREAK).map((c) => c.trim()).filter(Boolean);
}

/**
 * A negator that governs one of the requirement's target words in the same
 * clause: the first two non-filler words after the negator are checked.
 * "did not submit" governs "submit"; "without any delay" governs "delay".
 */
export function findNegatedTarget(
  sentence: string,
  isTarget: (word: string) => boolean,
): { negator: string; word: string } | null {
  for (const clause of clauses(sentence)) {
    const tokens = tokenize(clause);
    for (let i = 0; i < tokens.length; i++) {
      if (!isNegator(tokens[i])) continue;
      if (tokens[i] === "0" || tokens[i] === "zero") continue; // counts, handled as negated signals
      let seen = 0;
      for (let j = i + 1; j < tokens.length && seen < 2; j++) {
        if (NEGATION_FILLER.has(tokens[j])) continue;
        seen++;
        if (isTarget(tokens[j])) return { negator: tokens[i], word: tokens[j] };
      }
    }
  }
  return null;
}

// Error and outcome signals ----------------------------------------------

// Failures of the app itself: these contradict every expected outcome.
const APP_FAILURE =
  /^(5\d\d|exception|exceptions|crash|crashes|crashed|crashing|hang|hangs|hung|hanging|timeout|timeouts|timed|freeze|froze|frozen|undefined|nan|traceback|panic)$/;
// Signals that mean "it didn't succeed". A validation message on a `rejects`
// requirement is support, so these only contradict the other outcomes.
const FAILURE =
  /^(4\d\d|error|errors|fail|fails|failed|failing|failure|rejected|denied|blocked|broken|invalid|refused)$/;

export type Signal = { word: string; sentence: string };

/** Non-negated error signals in the observed text that contradict this outcome. */
export function findErrorSignals(observed: string, expected: ExpectedOutcome): Signal[] {
  const found: Signal[] = [];
  for (const sentence of splitSentences(observed)) {
    const tokens = tokenize(sentence);
    tokens.forEach((t, i) => {
      const appFailure = APP_FAILURE.test(t) || (t === "stack" && tokens[i + 1] === "trace");
      const failure = FAILURE.test(t);
      if (!appFailure && !(failure && expected !== "rejects")) return;
      if (negatedAt(tokens, i)) return; // "no errors", "0 errors", "without errors"
      if (t === "timed" && tokens[i + 1] !== "out") return;
      found.push({ word: t === "stack" ? "stack trace" : t === "timed" ? "timed out" : t, sentence });
    });
  }
  return found;
}

// Outcome words that mean the action went through. On a `rejects` requirement,
// a non-negated one means the invalid input was accepted: a contradiction.
const WENT_THROUGH =
  /^(accepted|submitted|succeeded|successful|successfully|success|saved|sent|completed|went|processed)$/;

export function findWentThrough(observed: string): Signal[] {
  const found: Signal[] = [];
  for (const sentence of splitSentences(observed)) {
    const tokens = tokenize(sentence);
    tokens.forEach((t, i) => {
      if (!WENT_THROUGH.test(t) || negatedAt(tokens, i)) return;
      if (t === "went" && tokens[i + 1] !== "through") return;
      found.push({ word: t === "went" ? "went through" : t, sentence });
    });
  }
  return found;
}

// What the observation must show for each expected outcome.
const OUTCOME_SIGNALS: Record<ExpectedOutcome, RegExp> = {
  succeeds:
    /\b(success(ful|fully)?|succeed(ed|s)?|submitted|sent|saved|completed?|thanks?|thank you|confirm(ed|ation)?|created|uploaded|200|201|204|ok|redirected|done in)\b/i,
  rejects:
    /\b(reject(ed|s)?|block(ed|s)?|prevent(ed|s)?|invalid|validation|error|not (submitted|accepted|saved|sent)|disabled|denied|refused|4\d\d|warning|required)\b/i,
  displays: /\b(visible|show(s|n|ed)?|display(s|ed)?|appear(s|ed)?|render(s|ed)?|present|listed|see|saw|contains?)\b|["'][^"']{2,}["']/i,
  persists:
    /\b(after (a |the )?(reload|refresh|restart)|reload(ed)?|refresh(ed)?|restart(ed)?|still|remain(s|ed)?|persist(s|ed)?|stay(s|ed)?|kept|retained)\b/i,
};

export function hasOutcomeSignal(observed: string, expected: ExpectedOutcome): boolean {
  return OUTCOME_SIGNALS[expected].test(normalize(observed));
}
