// Markdown plan → candidate requirements. prd.md > Plan Import.
// Deliberately simple: every bullet and checkbox line is a candidate, run
// through the same clean rules. No special parsing for particular files. It
// never truncates; the picker enforces "select up to 7".

import { MAX_REQUIREMENTS } from "../contract/generate";
import { checkClean, tidy } from "../contract/clean";
import { normalize, tokenize } from "../text";

export type Candidate = { id: string; text: string; flags: string[]; splitSuggestion?: [string, string] };

export type ImportResult = { title: string; candidates: Candidate[] };

const BULLET = /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/;

/** Strip inline markdown: links, emphasis, code ticks, HTML comments. */
function plain(text: string): string {
  return normalize(
    text
      .replace(/<!--.*?-->/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:])/g, "$1$2"),
  );
}

function flagged(id: string, text: string, others: string[]): Candidate {
  const r = checkClean(text, others);
  return { id, text, flags: r.reasons, ...(r.splitSuggestion ? { splitSuggestion: r.splitSuggestion } : {}) };
}

export function importPlan(markdown: string): ImportResult {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";
  const texts: string[] = [];

  lines.forEach((line, i) => {
    if (inFrontmatter) {
      if (i > 0 && line.trim() === "---") inFrontmatter = false;
      return;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const heading = line.match(/^#\s+(.+)$/);
    if (heading && !title) title = plain(heading[1]);
    const m = line.match(BULLET);
    if (!m) return;
    const text = tidy(plain(m[1]));
    if (tokenize(text).length === 0) return;
    const key = tokenize(text).join(" ");
    if (texts.some((t) => tokenize(t).join(" ") === key)) return; // exact duplicates removed
    texts.push(text);
  });

  const candidates = texts.map((t, i) => flagged(`C${i + 1}`, t, texts.slice(0, i)));
  return { title: title || "Imported plan", candidates };
}

/** Selecting is allowed while fewer than 7 are selected; deselecting always is. */
export function canSelect(selected: string[], id: string, max = MAX_REQUIREMENTS): boolean {
  return selected.includes(id) || selected.length < max;
}

export function toggleSelected(selected: string[], id: string, max = MAX_REQUIREMENTS): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return canSelect(selected, id, max) ? [...selected, id] : selected;
}

/** Replace a flagged candidate with its two-part split suggestion (you confirm by selecting). */
export function splitCandidate(candidates: Candidate[], id: string): Candidate[] {
  const i = candidates.findIndex((c) => c.id === id);
  const c = candidates[i];
  if (!c?.splitSuggestion) return candidates;
  const others = candidates.filter((x) => x.id !== id).map((x) => x.text);
  const a = flagged(`${id}a`, c.splitSuggestion[0], others);
  const b = flagged(`${id}b`, c.splitSuggestion[1], [...others, a.text]);
  return [...candidates.slice(0, i), a, b, ...candidates.slice(i + 1)];
}
