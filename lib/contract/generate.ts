// Goal → draft requirements. spec.md > Contract Generator.
// Deterministic: split the goal into clauses, give each one a subject, an
// expected outcome, target words and a proof template. The learner reviews and
// edits every draft in Contract Review; nothing is auto-approved.

import type { ExpectedOutcome, Requirement } from "../types";
import { contentWords, normalize, stem, tokenize } from "../text";
import { capitalize, checkClean, hasFiniteVerb, startsWithVerb, tidy } from "./clean";

export const MAX_REQUIREMENTS = 7;
export const MIN_GOAL_WORDS = 3;

export type GenerateResult =
  | { ok: true; requirements: Requirement[]; lowConfidence: boolean }
  | { ok: false; error: string };

const IMPERATIVE = /^(add|show|display|build|create|implement|make|write|develop|design|set up|provide|support)\s+(.+)$/i;
const SHOWS_SOMETHING = /^(add|show|display)$/i;
const RELATIVE = /\s+(?:that|which|who)\s+/i;
const CONDITION = /\s+(after|when|once|before|upon|while|on)\s+/i;
// Things you can see on a screen: "Add a dark mode toggle" → "The dark mode toggle is visible".
const UI_NOUNS = new Set(
  "button toggle switch field input form link page menu modal dialog banner message toast list icon tab badge dropdown checkbox box bar panel card table chart label tooltip counter indicator".split(
    " ",
  ),
);

function withoutArticle(np: string): string {
  return np.replace(/^(a|an|the|some)\s+/i, "").trim();
}

function theNP(np: string): string {
  return `The ${withoutArticle(np)}`;
}

/**
 * Third-person form for "The app ___": "show" → "shows", "fix" → "fixes",
 * "copy" → "copies". A verb that is already inflected ("shows", "rejects",
 * "passes", "fixes") is kept as is; a base form ending in "ss" ("pass") still
 * gets "es". (A real-agent test once produced "showses" and "rejectses".)
 */
export function thirdPerson(verb: string): string {
  const v = verb.toLowerCase();
  if (/(ss|sh|ch|x|z)es$/.test(v) || /ies$/.test(v)) return v; // passes, fixes, copies
  if (/[^s]s$/.test(v)) return v; // shows, rejects, displays, saves
  if (/(s|sh|ch|x|z)$/.test(v)) return `${v}es`; // pass → passes, fix → fixes
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

/**
 * Split a clause into behaviors at ", " / "and" wherever the next words start
 * with a verb: "converts CSV to JSON and handles empty files" → 2 behaviors,
 * while "name, email and message fields" stays one list.
 */
function splitBehaviors(clause: string): string[] {
  const t = normalize(clause);
  const parts: string[] = [];
  const re = /\s*,\s*(?:and\s+)?|\s+and\s+/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (startsWithVerb(t.slice(m.index + m[0].length))) {
      parts.push(t.slice(last, m.index));
      last = m.index + m[0].length;
    }
  }
  parts.push(t.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** "5 failed attempts the account is locked" style: add the comma back after a leading condition. */
function commaAfterLeadingCondition(text: string): string {
  return text.replace(/^(after|when|once|before|if)\s+(.+?)\s+(the|a|an|their|its|his|her|your)\s+/i, (_m, c, cond, det) => `${c} ${cond}, ${det} `);
}

export function classify(text: string): ExpectedOutcome {
  const t = normalize(text).toLowerCase();
  if (/\b(must not|cannot|can't|should not|not be able|rejects?|rejected|blocks?|blocked|prevents?|prevented|denied|denies|locks?|locked|invalid|wrong|disallow)/.test(t))
    return "rejects";
  if (/\b(persists?|persisted|after (a |the )?(page )?(reload|refresh|restart)|remembers?|survives?|still there|is kept|keeps? .* after)\b/.test(t))
    return "persists";
  if (/\b(visible|is shown|are shown|shows?|displays?|displayed|appears?|renders?|is available)\b/.test(t)) return "displays";
  // A noun phrase with no verb ("The coverage meter", "A Try the demo button")
  // names something on screen: the claim is that it's there.
  if (!hasFiniteVerb(t)) return "displays";
  return "succeeds";
}

// Words that say nothing about which behavior a piece of evidence is about.
const GENERIC = new Set(
  "the app users user it is are must can cannot should visible shown available able be not does without".split(" "),
);
// Failure words describe what must NOT happen. As target words, "no crash" in
// good evidence would read as a negated target (a false CONTRADICTED).
const FAILURE_WORD = /^(crash|crashes|crashing|crashed|error|errors|fail|fails|failed|failing|failure|exception|exceptions|hang|hangs|hanging|timeout|freeze|freezes)$/;

export function targetsFor(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of contentWords(text)) {
    if (GENERIC.has(w) || FAILURE_WORD.test(w) || /^\d+$/.test(w)) continue;
    const s = stem(w);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(w);
  }
  return out.slice(0, 6);
}

export function proofTemplateFor(text: string, expected: ExpectedOutcome): string {
  const claim = text.charAt(0).toLowerCase() + text.slice(1);
  switch (expected) {
    case "displays":
      return `Open the screen with it and check that ${claim}. Quote what you see.`;
    case "rejects":
      return `Try it with the input that must be refused and check that ${claim}. Record the message you get and that nothing went through.`;
    case "persists":
      return `Change it, then reload or restart, and check that ${claim}. Record what is still there.`;
    case "succeeds":
      return `Run it with realistic input and check that ${claim}. Record the output and whether any error appeared.`;
  }
}

export function makeRequirement(id: string, text: string, others: string[] = []): Requirement {
  const clean = tidy(text);
  const expected = classify(clean);
  const result = checkClean(clean, others);
  return { id, text: clean, proofTemplate: proofTemplateFor(clean, expected), expected, targets: targetsFor(clean), flags: result.reasons };
}

/** Behaviors of one sentence-level segment of the goal, as requirement texts. */
function behaviorsOf(segment: string): string[] {
  const out: string[] = [];
  let s = segment.trim();
  let imperativeVerb: string | null = null;

  const imp = s.match(IMPERATIVE);
  if (imp) {
    imperativeVerb = imp[1];
    s = imp[2];
  }

  const rel = s.split(RELATIVE);
  if (rel.length > 1) {
    // "a dark mode toggle that persists after page reload"
    const [npWithCond, ...relParts] = rel;
    const [np] = npWithCond.split(CONDITION);
    const subject = theNP(np);
    if (imperativeVerb && SHOWS_SOMETHING.test(imperativeVerb)) out.push(`${subject} is visible`);
    for (const b of splitBehaviors(relParts.join(" that "))) out.push(`${subject} ${b}`);
    return out;
  }

  if (imperativeVerb) {
    // "Show a confirmation banner after saving, and keep the draft after page reload"
    const [first, ...more] = splitBehaviors(s);
    const [np, ...cond] = first.split(CONDITION);
    const condText = cond.length ? ` ${first.slice(np.length).trim()}` : "";
    const head = withoutArticle(np).split(" ").pop()?.toLowerCase() ?? "";
    out.push(`${theNP(np)} ${UI_NOUNS.has(head) ? "is visible" : "is available"}${condText}`);
    for (const b of more) {
      const [verb, ...restWords] = b.split(" ");
      const next = tokenize(b);
      out.push(next.length && /^[a-z]+$/.test(verb) ? `The app ${thirdPerson(verb)} ${restWords.join(" ")}` : b);
    }
    return out;
  }

  // A sentence with its own subject: "the account is locked after 5 failed attempts".
  const parts = splitBehaviors(s);
  const subjectMatch = normalize(parts[0]).match(/^(.*?)\s+(is|are|can|cannot|must|should|does|do|will|has|have|gets)\b/i);
  const subject = subjectMatch ? subjectMatch[1] : "";
  out.push(commaAfterLeadingCondition(parts[0]));
  for (const b of parts.slice(1)) out.push(subject && /^[a-z]/.test(b) ? `${subject} ${b}` : b);
  return out;
}

export function generateContract(goal: string): GenerateResult {
  const text = normalize(goal).replace(/[\s,.;:!]+$/, "");
  if (tokenize(text).length < MIN_GOAL_WORDS) {
    return { ok: false, error: `Describe the goal in at least ${MIN_GOAL_WORDS} words, e.g. "Add a dark mode toggle that persists after page reload".` };
  }

  const segments = text.split(/\s*[;.!?]\s+|\s*;\s*/).map((s) => s.trim()).filter(Boolean);
  const texts: string[] = [];
  for (const seg of segments) {
    for (const b of behaviorsOf(seg)) {
      const t = tidy(b);
      if (t && !texts.some((x) => tokenize(x).join(" ") === tokenize(t).join(" "))) texts.push(t);
    }
  }

  const requirements: Requirement[] = [];
  for (const t of texts.slice(0, MAX_REQUIREMENTS)) {
    requirements.push(makeRequirement(`R${requirements.length + 1}`, t, requirements.map((r) => r.text)));
  }
  return { ok: true, requirements, lowConfidence: requirements.length < 3 };
}

export { capitalize };
