// Clean checker: a requirement is one observable behavior, with no vague words
// and no duplicate. spec.md > Clean Checker. The same rules apply to generated,
// imported and hand-written requirements.

import { normalize, tokenize } from "../text";

export type CleanResult = { ok: boolean; reasons: string[]; splitSuggestion?: [string, string] };

// Verbs that start a behavior. Words that are more often nouns in requirements
// (email, list, log, set, output, filter, search, count, display, show, lock,
// reset, export, import, upload, download, print) are left out of the "starts a
// second behavior" check so "name, email and message fields" stays one list.
const BEHAVIOR_VERBS = new Set(
  (
    "shows displays persists saves converts handles sends rejects blocks locks loads returns redirects validates " +
    "updates creates deletes lists stores remembers switches toggles appears logs submits accepts opens closes " +
    "changes keeps supports allows lets exports imports renders sorts filters searches counts clears resets " +
    "prevents warns notifies prints writes reads parses outputs crashes fails works runs starts stops refreshes " +
    "disables enables hides reveals marks moves copies downloads uploads emails " +
    "takes calculates computes adds removes gives uses makes rounds formats splits applies passes fixes " +
    "tracks generates produces includes contains requires asks prompts " +
    "save convert handle send reject block load return redirect validate update create delete store remember " +
    "switch toggle appear submit accept open close change keep support allow render sort clear prevent warn notify " +
    "write read parse crash fail work run start stop refresh disable enable hide reveal mark move copy " +
    "is are was were can cannot must does do has have gets becomes stays remains"
  ).split(" "),
);

const VAGUE: { pattern: RegExp; word: string }[] = [
  "good",
  "properly",
  "works well",
  "work well",
  "nice",
  "nicely",
  "correctly",
  "fine",
  "great",
  "smoothly",
  "seamless",
  "seamlessly",
  "intuitive",
  "user-friendly",
  "user friendly",
  "better",
  "appropriate",
  "appropriately",
  "as expected",
  "robust",
].map((w) => ({ word: w, pattern: new RegExp(`\\b${w.replace(/[-\s]/g, "[-\\s]")}\\b`, "i") }));

function isVerb(word: string | undefined): boolean {
  return word !== undefined && BEHAVIOR_VERBS.has(word.toLowerCase());
}

const AUXILIARY = new Set(
  "is are was were be been can can't cannot must should will won't does doesn't do don't has have had isn't aren't wasn't".split(" "),
);

/**
 * True if the text states something happening: an auxiliary ("is", "can't") or
 * a third-person verb ("shows", "converts"). Base forms inside names don't
 * count, so "A Try the demo button" and "A Create Proof Plan button" have no verb.
 */
export function hasFiniteVerb(text: string): boolean {
  return tokenize(text).some((w) => AUXILIARY.has(w) || (w.endsWith("s") && isVerb(w)));
}

/** True if the text starts with a verb, i.e. it begins a new behavior ("shows a toast"). */
export function startsWithVerb(text: string): boolean {
  return isVerb(tokenize(text)[0]);
}

/** Split "X and Y" where both sides carry a behavior; null if it's one behavior. */
export function findJoinedBehaviors(text: string): { left: string; right: string } | null {
  const t = normalize(text);
  const re = /\s*,?\s+and\s+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const left = t.slice(0, m.index);
    const right = t.slice(m.index + m[0].length);
    const rightWords = tokenize(right);
    const leftHasVerb = tokenize(left).some(isVerb);
    // "... and shows a toast"
    const rightStartsWithVerb = isVerb(rightWords[0]);
    // "... and the toast appears": determiner + up to 3 words + verb
    const rightHasSubjectVerb =
      /^(the|a|an|its|their|this|that|his|her)$/.test(rightWords[0] ?? "") && rightWords.slice(1, 5).some(isVerb);
    if (leftHasVerb && (rightStartsWithVerb || rightHasSubjectVerb)) return { left, right };
  }
  return null;
}

/** Words before the first verb: the subject a split-off behavior should repeat. */
function subjectOf(clause: string): string {
  const words = normalize(clause).split(" ");
  const i = words.findIndex((w) => isVerb(w.replace(/[^\w'-]/g, "")));
  return i > 0 ? words.slice(0, i).join(" ") : "";
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function tidy(text: string): string {
  return capitalize(normalize(text).replace(/[\s,.;:!]+$/, "").replace(/^[\s,.;:-]+/, ""));
}

function canonical(text: string): string {
  return tokenize(text).join(" ");
}

export function checkClean(text: string, others: string[] = []): CleanResult {
  const reasons: string[] = [];
  let splitSuggestion: [string, string] | undefined;
  const t = normalize(text);

  if (tokenize(t).length === 0) return { ok: false, reasons: ["empty requirement"] };

  const joined = findJoinedBehaviors(t);
  if (joined) {
    reasons.push("two behaviors joined by 'and'");
    const subject = subjectOf(joined.left);
    const rightStartsWithVerb = isVerb(tokenize(joined.right)[0]);
    splitSuggestion = [tidy(joined.left), tidy(rightStartsWithVerb && subject ? `${subject} ${joined.right}` : joined.right)];
  }

  for (const v of VAGUE) {
    if (v.pattern.test(t)) reasons.push(`vague word: "${v.word}"`);
  }

  if (others.some((o) => canonical(o) === canonical(t))) reasons.push("duplicate of another requirement");

  return { ok: reasons.length === 0, reasons, ...(splitSuggestion ? { splitSuggestion } : {}) };
}
