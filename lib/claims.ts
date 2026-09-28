// Concrete claims inside an agent's message: sentences with numbers, quoted
// strings or input→output pairs ("125.00 @ 18% → tip $22.50"). They can't
// prove anything, but they are exactly what to check next, so the Proof Gap
// lists them: "The agent claims: … Check it."

import { matchedTargets, splitSentences } from "./text";

const ARROW = /→|->|=>|⇒/;
const QUOTED = /"[^"]{2,}"|(^|[^A-Za-z])'[^']{2,}'(?![A-Za-z])/;
const NUMBER = /\d/;
// A leading "Verified:" / "Tested:" label adds nothing to the claim itself.
const LEADING_LABEL = /^(verified|tested|checked|confirmed|result|output|example)\s*:\s*/i;
const MAX_LENGTH = 120;

export function isConcreteClaim(sentence: string): boolean {
  return ARROW.test(sentence) || QUOTED.test(sentence) || NUMBER.test(sentence);
}

function tidyClaim(sentence: string): string {
  let s = sentence.replace(/^[-*+]\s+/, "").replace(LEADING_LABEL, "").replace(/[.;,\s]+$/, "").trim();
  if (s.length > MAX_LENGTH) s = `${s.slice(0, MAX_LENGTH - 1).trimEnd()}…`;
  return s;
}

/**
 * The concrete claims in `text` about a requirement with these target words.
 * Claims that mention a target come first; if none do, and `fallbackToAll` is
 * set (the message is linked only to this requirement), all concrete claims
 * are returned. At most `max`.
 */
export function claimFacts(text: string, targets: string[], { fallbackToAll = false, max = 3 } = {}): string[] {
  // per line, and never split inside a quoted UI message
  const lines = splitSentences(text);
  const concrete = [...new Set(lines.map(tidyClaim).filter((s) => s && isConcreteClaim(s)))];
  const onTopic = concrete.filter((s) => matchedTargets(s, targets).length > 0);
  return (onTopic.length > 0 ? onTopic : fallbackToAll ? concrete : []).slice(0, max);
}
