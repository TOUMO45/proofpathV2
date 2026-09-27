// Session store: one reducer, one stale flag, one localStorage key.
// spec.md > Session Store (lib/store). Every action that changes the contract or
// the evidence sets stale = true; only "verify" clears it.

import { demoSession } from "./fixtures/demo";
import { SessionSchema, type Evidence, type EvidenceKind, type Session, type Structured } from "./types";
import { evidenceFlags, supersededIds, verify } from "./verify";

export const STORAGE_KEY = "proofpath.session.v1";

/** `hydrated` is false until the saved session has been read in the browser. */
export type State = { session: Session | null; notice: string | null; hydrated: boolean };

export type Action =
  | { type: "hydrate"; session: Session | null; notice: string | null }
  | { type: "loadDemo" }
  | { type: "verify" }
  | { type: "addEvidence"; draft: EvidenceDraft }
  | { type: "removeEvidence"; id: string }
  | { type: "reset" }
  | { type: "dismissNotice" };

export const initialState: State = { session: null, notice: null, hydrated: false };

/** Recompute the badges shown on each evidence item (untrusted, obfuscated). */
export function withFlags(evidence: Evidence[]): Evidence[] {
  return evidence.map((e) => ({ ...e, flags: evidenceFlags(e) }));
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { session: action.session, notice: action.notice, hydrated: true };
    case "loadDemo": {
      const session = demoSession();
      return { ...state, session: { ...session, evidence: withFlags(session.evidence) }, notice: null };
    }
    case "verify": {
      if (!state.session) return state;
      const { contract, evidence } = state.session;
      return { ...state, session: { ...state.session, verdicts: verify(contract, evidence), stale: false } };
    }
    case "addEvidence": {
      if (!state.session || validateDraft(state.session, action.draft)) return state;
      const s = state.session;
      const { kind, text, structured, links, supersedes } = action.draft;
      const evidence: Evidence = {
        id: `E${s.nextEvidenceNumber}`,
        kind,
        ...(kind === "structured" ? { structured } : { text: text?.trim() }),
        links: [...links],
        ...(supersedes ? { supersedes } : {}),
        flags: [],
      };
      evidence.flags = evidenceFlags(evidence);
      return {
        ...state,
        session: { ...s, evidence: [...s.evidence, evidence], nextEvidenceNumber: s.nextEvidenceNumber + 1, stale: true },
      };
    }
    case "removeEvidence": {
      if (!state.session) return state;
      const s = state.session;
      if (!s.evidence.some((e) => e.id === action.id)) return state;
      // IDs are never reused: nextEvidenceNumber does not go back down.
      return { ...state, session: { ...s, evidence: s.evidence.filter((e) => e.id !== action.id), stale: true } };
    }
    case "reset":
      return { ...state, session: null, notice: null };
    case "dismissNotice":
      return { ...state, notice: null };
  }
}

/** What the evidence form submits. The store assigns the ID and the flags. */
export type EvidenceDraft = {
  kind: EvidenceKind;
  text?: string;
  structured?: Structured;
  links: string[];
  supersedes?: string;
};

/**
 * Evidence that can be superseded by a new item linked to `links`: present,
 * not already superseded, and sharing at least one linked requirement.
 */
export function supersedableEvidence(session: Session, links: string[]): Evidence[] {
  const superseded = supersededIds(session.evidence);
  return session.evidence.filter((e) => !superseded.has(e.id) && e.links.some((l) => links.includes(l)));
}

/** Why a draft can't be added, or null if it can. */
export function validateDraft(session: Session, draft: EvidenceDraft): string | null {
  if (!session.contract.approved) return "Approve the contract before adding evidence.";
  const reqIds = new Set(session.contract.requirements.map((r) => r.id));
  if (draft.links.length === 0) return "Link the evidence to at least one requirement.";
  if (draft.links.some((l) => !reqIds.has(l))) return "Evidence can only link to requirements in the contract.";
  if (draft.kind === "structured") {
    if (!draft.structured || !draft.structured.observed.trim()) return "A structured test needs an Observed line.";
  } else if (!draft.text || !draft.text.trim()) {
    return draft.kind === "claim" ? "Paste the agent's message." : "Write what you observed.";
  }
  if (draft.supersedes && !supersedableEvidence(session, draft.links).some((e) => e.id === draft.supersedes)) {
    return "Only evidence that shares a linked requirement (and isn't already superseded) can be superseded.";
  }
  return null;
}

/** Verdicts are shown as current only when they exist and nothing changed since. */
export function hasCurrentVerdicts(session: Session): boolean {
  return !session.stale && session.verdicts.length === session.contract.requirements.length;
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

export const RESET_NOTICE = "Saved session couldn't be read and was reset.";

/** Read and validate the saved session. Anything malformed resets safely. */
export function loadSaved(storage: ReadStorage | undefined): { session: Session | null; notice: string | null } {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return { session: null, notice: null };
  }
  if (raw === null) return { session: null, notice: null };
  try {
    const parsed = SessionSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { session: { ...parsed.data, evidence: withFlags(parsed.data.evidence) }, notice: null };
  } catch {
    // fall through: not JSON
  }
  return { session: null, notice: RESET_NOTICE };
}

export function save(storage: WriteStorage | undefined, session: Session | null): void {
  try {
    if (session) storage?.setItem(STORAGE_KEY, JSON.stringify(session));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // storage full or blocked: the session still works for this page view
  }
}
