// Text helpers shared by the verifier, the contract generator and the importer.
// Pure functions: no DOM, no network.

import type { Evidence } from "./types";

const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at for with by from as is are was were be been being it its this that these " +
    "those then than there here i we you they he she my our your their me us them do does did done has have had " +
    "so if into onto up down out over under again any all some each every both no not nor only own same too very " +
    "can will just should would could may might must also after before when while where which who what how why"
  ).split(" "),
);

// Irregular forms that suffix stripping can't reach.
const IRREGULAR: Record<string, string> = {
  shown: "show",
  sent: "send",
  submission: "submit",
  submissions: "submit",
  confirmation: "confirm",
  confirmations: "confirm",
  thanks: "thank",
  hung: "hang",
  visibility: "visible",
};

// Cyrillic and Greek letters that render like Latin ones ("would" spelled with
// a Cyrillic o). Written as code points so no lookalike hides in this file.
// [code point, Latin letter]
const CONFUSABLE_PAIRS: [number, string][] = [
  // Cyrillic lowercase: a b e e k m h o p c t y x i i j s d q w h l
  [0x0430, "a"], [0x0432, "b"], [0x0435, "e"], [0x0451, "e"], [0x043a, "k"], [0x043c, "m"], [0x043d, "h"],
  [0x043e, "o"], [0x0440, "p"], [0x0441, "c"], [0x0442, "t"], [0x0443, "y"], [0x0445, "x"], [0x0456, "i"],
  [0x0457, "i"], [0x0458, "j"], [0x0455, "s"], [0x0501, "d"], [0x051b, "q"], [0x051d, "w"], [0x04bb, "h"], [0x04cf, "l"],
  // Latin script g (U+0261)
  [0x0261, "g"],
  // Cyrillic uppercase: A B E K M H O P C T Y X I J S
  [0x0410, "A"], [0x0412, "B"], [0x0415, "E"], [0x041a, "K"], [0x041c, "M"], [0x041d, "H"], [0x041e, "O"],
  [0x0420, "P"], [0x0421, "C"], [0x0422, "T"], [0x0423, "Y"], [0x0425, "X"], [0x0406, "I"], [0x0408, "J"], [0x0405, "S"],
  // Greek lowercase: a e i k v o p t u x
  [0x03b1, "a"], [0x03b5, "e"], [0x03b9, "i"], [0x03ba, "k"], [0x03bd, "v"], [0x03bf, "o"], [0x03c1, "p"],
  [0x03c4, "t"], [0x03c5, "u"], [0x03c7, "x"],
  // Greek uppercase: A B E Z H I K M N O P T Y X
  [0x0391, "A"], [0x0392, "B"], [0x0395, "E"], [0x0396, "Z"], [0x0397, "H"], [0x0399, "I"], [0x039a, "K"],
  [0x039c, "M"], [0x039d, "N"], [0x039f, "O"], [0x03a1, "P"], [0x03a4, "T"], [0x03a5, "Y"], [0x03a7, "X"],
];
const CONFUSABLES = new Map(CONFUSABLE_PAIRS.map(([cp, latin]) => [String.fromCodePoint(cp), latin]));
const CONFUSABLE_CLASS = CONFUSABLE_PAIRS.map(([cp]) => `\\u{${cp.toString(16)}}`).join("");
const CONFUSABLE_RE = new RegExp(`[${CONFUSABLE_CLASS}]`, "gu");
// A lookalike or fullwidth Latin letter (U+FF21-FF3A, U+FF41-FF5A).
const LOOKALIKE_RE = new RegExp(`[${CONFUSABLE_CLASS}\\u{ff21}-\\u{ff3a}\\u{ff41}-\\u{ff5a}]`, "u");
const FULLWIDTH_WORD_RE = /^[\u{ff21}-\u{ff3a}\u{ff41}-\u{ff5a}]+$/u;
// Bidi embedding/override/isolate controls (U+202A-202E, U+2066-2069).
const BIDI_RE = /[\u{202a}-\u{202e}\u{2066}-\u{2069}]/u;
// Letters plus the zero-width characters that can hide inside a word
// (U+200B-200D zero-width space/non-joiner/joiner, U+2060 word joiner, U+FEFF).
const WORD_RE = /[\p{L}\u{200b}-\u{200d}\u{2060}\u{feff}]+/gu;

/**
 * True when normalize() would have to undo an attempt to hide something:
 * - an invisible format character between two letters/digits ("wo" + U+200B + "uld"),
 *   but not a zero-width joiner inside an emoji sequence
 * - a bidi control character (can reorder what a reader sees)
 * - a word mixing Latin letters with lookalike letters, or written in fullwidth
 *   letters, but not a word written entirely in Cyrillic or Greek
 */
export function hasObfuscation(text: string): boolean {
  if (/[\p{L}\p{N}]\p{Cf}+[\p{L}\p{N}]/u.test(text)) return true;
  if (BIDI_RE.test(text)) return true;
  const words = text.match(WORD_RE) ?? [];
  return words.some((w) => LOOKALIKE_RE.test(w) && (/[A-Za-z]/.test(w) || FULLWIDTH_WORD_RE.test(w)));
}

/**
 * Canonical form of any evidence or requirement text. Runs before every screen:
 * - NFKC folds fullwidth and other compatibility forms (fullwidth "mark" -> "mark")
 * - invisible format characters (Unicode category Cf) are removed: zero-width
 *   space/joiners, soft hyphen, bidi controls
 * - Cyrillic/Greek lookalikes become Latin
 * - curly quotes become straight quotes, whitespace collapses
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(CONFUSABLE_RE, (c) => CONFUSABLES.get(c) ?? c)
    .replace(/[\u{2018}\u{2019}\u{201b}]/gu, "'")
    .replace(/[\u{201c}\u{201d}\u{201f}]/gu, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase word tokens, keeping contractions ("didn't") and numbers ("500"). */
export function tokenize(text: string): string[] {
  return normalize(text).toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

export function stem(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  for (const suffix of ["ing", "ed", "es", "s", "ly"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
      const base = w.slice(0, -suffix.length);
      return IRREGULAR[base] ?? base;
    }
  }
  return w;
}

/**
 * Two words match when their stems are equal, or when they share a prefix of at
 * least 5 letters and differ in length by at most 3 ("succeed" / "successful").
 * The length limit stops "valid" from matching "validation".
 */
export function wordsMatch(a: string, b: string): boolean {
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb) return true;
  const [short, long] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  return short.length >= 5 && long.startsWith(short) && long.length - short.length <= 3;
}

export function contentWords(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t));
}

/** The target words that appear in the text (each target counted once). */
export function matchedTargets(text: string, targets: string[]): string[] {
  const words = tokenize(text);
  return targets.filter((t) => words.some((w) => wordsMatch(w, t)));
}

export function splitSentences(text: string): string[] {
  return normalize(text)
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strip quote characters that wrap the whole string, so a reason never shows doubled quotes. */
export function stripWrappingQuotes(text: string): string {
  let s = text.trim();
  while (s.length >= 2 && /^["'`]/.test(s) && s[s.length - 1] === s[0]) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Quote the sentence with the most target-word overlap (ties: the first one),
 * trimmed of wrapping quotes and trailing punctuation, capped at 160 characters.
 * If no sentence shares a target word, quote nothing: an unrelated sentence
 * would only mislead.
 */
export function quoteBest(text: string, targets: string[]): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  let best = sentences[0];
  let bestScore = -1;
  for (const s of sentences) {
    const score = matchedTargets(s, targets).length;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (bestScore <= 0) return "";
  let q = stripWrappingQuotes(best.replace(/^[-*+]\s+/, "").replace(/[.;,]+$/, ""));
  if (q.length > 160) q = q.slice(0, 157).trimEnd() + "…";
  return q;
}

/** Evidence split into setup (input/action) and what was observed. */
export type ParsedEvidence = {
  setup: string;
  observed: string;
  all: string;
  /** True when the observation is explicitly labeled (structured, or "Observed:" in text). */
  labeled: boolean;
};

const LABEL = /\b(input|action|observed)\s*:/gi;

export function parseEvidence(e: Evidence): ParsedEvidence {
  if (e.kind === "structured" && e.structured) {
    const [input, action, observed] = [e.structured.input, e.structured.action, e.structured.observed].map(normalize);
    const setup = [input, action].filter((s) => s.trim()).join(". ");
    return { setup, observed, all: [setup, observed].filter(Boolean).join(". "), labeled: true };
  }
  const text = normalize(e.text ?? "");
  const parts: Record<string, string> = {};
  const matches = [...text.matchAll(LABEL)];
  if (matches.some((m) => m[1].toLowerCase() === "observed")) {
    matches.forEach((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const key = m[1].toLowerCase();
      parts[key] = [parts[key], text.slice(start, end).trim()].filter(Boolean).join(" ");
    });
    const setup = [parts.input, parts.action].filter(Boolean).join(". ");
    return { setup, observed: parts.observed ?? "", all: text, labeled: true };
  }
  return { setup: "", observed: text, all: text, labeled: false };
}
