// Markdown plan → candidate requirements. prd.md > Plan Import.
// Deliberately simple: checkbox lines ("- [ ]", "- [x]") are candidates by
// default; plain bullets only when asked. Each runs through the same clean
// rules and remembers the heading it came from. No special parsing for
// particular files. It never truncates; the picker enforces "select up to 7".

import { MAX_REQUIREMENTS } from "../contract/generate";
import { checkClean, tidy } from "../contract/clean";
import { normalize, tokenize } from "../text";

export type Candidate = {
  id: string;
  text: string;
  flags: string[];
  splitSuggestion?: [string, string];
  /** The nearest heading above the item ("Plan Import"), for context in the list. */
  heading: string;
  checkbox: boolean;
};

export type ImportResult = {
  title: string;
  candidates: Candidate[];
  /** Plain bullets left out because includePlainBullets was off. */
  skippedPlainBullets: number;
};

export type ImportOptions = { includePlainBullets?: boolean };

const BULLET = /^\s*[-*+]\s+(\[[ xX]\]\s+)?(.+)$/;

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

function flagged(id: string, text: string, others: string[], heading: string, checkbox: boolean): Candidate {
  const r = checkClean(text, others);
  return { id, text, flags: r.reasons, ...(r.splitSuggestion ? { splitSuggestion: r.splitSuggestion } : {}), heading, checkbox };
}

export function importPlan(markdown: string, options: ImportOptions = {}): ImportResult {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  let section = "";
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";
  let skippedPlainBullets = 0;
  const items: { text: string; heading: string; checkbox: boolean }[] = [];

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
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (heading[1].length === 1 && !title) title = plain(heading[2]);
      section = plain(heading[2]);
      return;
    }
    const m = line.match(BULLET);
    if (!m) return;
    const checkbox = Boolean(m[1]);
    const text = tidy(plain(m[2]));
    if (tokenize(text).length === 0) return;
    if (!checkbox && !options.includePlainBullets) {
      skippedPlainBullets++;
      return;
    }
    const key = tokenize(text).join(" ");
    if (items.some((t) => tokenize(t.text).join(" ") === key)) return; // exact duplicates removed
    items.push({ text, heading: section, checkbox });
  });

  const texts = items.map((t) => t.text);
  const candidates = items.map((t, i) => flagged(`C${i + 1}`, t.text, texts.slice(0, i), t.heading, t.checkbox));
  return { title: title || "Imported plan", candidates, skippedPlainBullets };
}

/**
 * Text with no checkbox items that reads like prose: probably an agent's reply
 * pasted into the plan box (replies often have plain bullets, so those don't
 * rule it out). At least 12 words and at least one sentence end.
 */
export function looksLikeProse(markdown: string): boolean {
  if (importPlan(markdown).candidates.length > 0) return false;
  const words = tokenize(markdown).length;
  return words >= 12 && /[a-z][.!?](\s|$)/i.test(markdown);
}

/** Case-insensitive filter on the item text or the heading it came from. */
export function filterCandidates(candidates: Candidate[], query: string): Candidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => c.text.toLowerCase().includes(q) || c.heading.toLowerCase().includes(q));
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
  const a = flagged(`${id}a`, c.splitSuggestion[0], others, c.heading, c.checkbox);
  const b = flagged(`${id}b`, c.splitSuggestion[1], [...others, a.text], c.heading, c.checkbox);
  return [...candidates.slice(0, i), a, b, ...candidates.slice(i + 1)];
}
