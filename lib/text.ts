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

// Cyrillic and Greek letters that render like Latin ones ("wоuld" with a
// Cyrillic о). Mapped to Latin so no screen can be dodged by lookalikes.
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x",
  і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", ԝ: "w", ɡ: "g", һ: "h", ӏ: "l",
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X", І: "I", Ј: "J", Ѕ: "S",
  α: "a", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

/**
 * Canonical form of any evidence or requirement text. Runs before every screen:
 * - NFKC folds fullwidth and other compatibility forms ("ｍａｒｋ" → "mark")
 * - invisible format characters are removed (zero-width space/joiners, soft
 *   hyphen, bidi controls: "wo​uld" → "would")
 * - Cyrillic/Greek lookalikes become Latin
 * - curly quotes become straight quotes, whitespace collapses
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(CONFUSABLE_RE, (c) => CONFUSABLES[c])
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
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
  let q = stripWrappingQuotes(best.replace(/[.;,]+$/, ""));
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
