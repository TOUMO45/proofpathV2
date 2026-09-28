// One piece of evidence against one requirement: which way does it point?
// spec.md > Verifier (lib/verify), screens 1–6, in this exact order.

import type { Evidence, ExpectedOutcome, Requirement } from "../types";
import { matchedTargets, parseEvidence, quoteBest, stripWrappingQuotes, wordsMatch } from "../text";
import {
  findErrorSignals,
  findHypotheticals,
  findInjection,
  findNegatedTarget,
  findVaguePhrase,
  findWentThrough,
  hasConcreteObservation,
  hasOutcomeSignal,
} from "./screens";

export type StanceKind = "untrusted" | "neutral" | "contradicts" | "supports";

export type Stance = {
  kind: StanceKind;
  /** Why, in audit-finding language. */
  note: string;
  /** The evidence sentence the note is about (no wrapping quotes). */
  quote: string;
};

// Outcome words whose negation contradicts the outcome even when they are not
// target words: "fields are not visible" contradicts a `displays` requirement.
const OUTCOME_WORDS: Record<ExpectedOutcome, string[]> = {
  succeeds: ["submit", "send", "save", "complete", "succeed", "success", "work"],
  rejects: ["reject", "block", "prevent", "stop"],
  displays: ["visible", "show", "display", "appear", "render"],
  persists: ["persist", "remain", "stay", "keep", "kept", "save"],
};

function clip(sentence: string): string {
  let q = stripWrappingQuotes(sentence.replace(/^[-*+]\s+/, "").replace(/[.;,]+$/, ""));
  if (q.length > 160) q = q.slice(0, 157).trimEnd() + "…";
  return q;
}

/**
 * @param linked every requirement this evidence is linked to (including `req`).
 *   Used to decide which requirement an error sentence is about, so one
 *   observation only contradicts the requirement whose success condition it breaks.
 */
export function stance(req: Requirement, evidence: Evidence, linked: Requirement[]): Stance {
  const parsed = parseEvidence(evidence);

  // 1. Injection: reads every field. Untrusted evidence contributes nothing.
  const injection = findInjection(parsed.all);
  if (injection) {
    return {
      kind: "untrusted",
      note: `instruction-like text ("${injection.match}"), treated as data and ignored`,
      quote: clip(injection.sentence),
    };
  }

  // Structured (or "Observed:"-labeled) evidence: the wording screens read only
  // what was observed. Input/Action describe the test setup.
  const wordingText = parsed.labeled ? parsed.observed : parsed.all;

  // 2. Hypothetical / modal wording. With several such sentences, cite the one
  // most about this requirement ("should reject invalid emails" for R2,
  // "will now show a confirmation" for R4); ties go to the first.
  const hypotheticals = findHypotheticals(wordingText);
  const hypothetical = hypotheticals.reduce<(typeof hypotheticals)[number] | null>(
    (best, h) =>
      !best || matchedTargets(h.sentence, req.targets).length > matchedTargets(best.sentence, req.targets).length ? h : best,
    null,
  );
  if (hypothetical) {
    return {
      kind: "neutral",
      note: `hypothetical wording ("${hypothetical.match}") is a prediction, not an observation`,
      quote: clip(hypothetical.sentence),
    };
  }

  // 3. Vague approval with no concrete observation behind it.
  const concrete = hasConcreteObservation(parsed.observed, parsed.labeled);
  const vague = findVaguePhrase(wordingText);
  if (vague && !concrete) {
    return {
      kind: "neutral",
      note: `vague approval ("${vague.match}") with no concrete observation`,
      quote: clip(vague.sentence),
    };
  }

  // 4. Contradiction.
  const isTarget = (w: string) => req.targets.some((t) => wordsMatch(w, t));
  // Which linked requirement(s) a sentence is about: the one(s) whose target
  // words it matches best. "Negative amounts are rejected" is about "rejects
  // negative amounts" (3 matches), not "takes a bill amount" (1 match).
  const bestMatches = (text: string): Requirement[] => {
    const scored = linked.map((r) => ({ r, n: matchedTargets(text, r.targets).length }));
    const top = Math.max(0, ...scored.map((s) => s.n));
    return top === 0 ? [] : scored.filter((s) => s.n === top).map((s) => s.r);
  };
  const aboutThisRequirement = (sentence: string): boolean => {
    const bySentence = bestMatches(sentence);
    if (bySentence.length > 0) return bySentence.some((r) => r.id === req.id);
    const bySetup = bestMatches(parsed.setup);
    if (bySetup.length > 0) return bySetup.some((r) => r.id === req.id);
    return true; // nothing says which requirement it's about: it counts against all of them
  };

  const error = findErrorSignals(parsed.observed, req.expected).find((s) => aboutThisRequirement(s.sentence));
  if (error) {
    return { kind: "contradicts", note: `error signal ("${error.word}") in the observation`, quote: clip(error.sentence) };
  }

  if (req.expected === "rejects") {
    const through = findWentThrough(parsed.observed).find((s) => aboutThisRequirement(s.sentence));
    if (through) {
      return {
        kind: "contradicts",
        note: `the input went through ("${through.word}") instead of being rejected`,
        quote: clip(through.sentence),
      };
    }
  }

  for (const sentence of parsed.observed ? [parsed.observed] : []) {
    const negTarget = findNegatedTarget(sentence, isTarget);
    const isOutcome = (w: string) => OUTCOME_WORDS[req.expected].some((o) => wordsMatch(w, o));
    const negOutcome = negTarget ? null : findNegatedTarget(sentence, isOutcome);
    const neg = negTarget ?? negOutcome;
    if (neg) {
      const quote = quoteBest(sentence, [neg.word]);
      if (negOutcome && !aboutThisRequirement(quote)) continue;
      return { kind: "contradicts", note: `negation ("${neg.negator} … ${neg.word}")`, quote: clip(quote) };
    }
  }

  // 5. Support: on topic AND a concrete observation of the expected outcome.
  const matched = matchedTargets(parsed.all, req.targets);
  const needed = Math.max(1, Math.min(2, req.targets.length));
  const onTopic = req.targets.length > 0 && matched.length >= needed;
  const outcome = hasOutcomeSignal(parsed.observed, req.expected);
  if (onTopic && concrete && outcome) {
    return { kind: "supports", note: "observed", quote: quoteBest(parsed.observed || parsed.all, req.targets) };
  }

  // 6. Neutral, with the specific reason support failed.
  const quote = quoteBest(parsed.observed || parsed.all, req.targets);
  if (!concrete) {
    return {
      kind: "neutral",
      note: "no concrete observation (needs an action and an observed result, or an Observed: line)",
      quote,
    };
  }
  if (!onTopic) {
    return {
      kind: "neutral",
      note: `doesn't address this requirement (matched ${matched.length} of ${needed} needed target words: ${req.targets.join(", ")})`,
      quote,
    };
  }
  return { kind: "neutral", note: `the observation doesn't show the expected outcome (${req.expected})`, quote };
}
