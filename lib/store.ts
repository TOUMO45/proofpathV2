// Session store: one reducer, one stale flag, one localStorage key.
// spec.md > Session Store (lib/store). Every action that changes the contract or
// the evidence sets stale = true; only "verify" clears it.

import { demoSession } from "./fixtures/demo";
import { SessionSchema, type Evidence, type Session } from "./types";
import { evidenceFlags, verify } from "./verify";

export const STORAGE_KEY = "proofpath.session.v1";

/** `hydrated` is false until the saved session has been read in the browser. */
export type State = { session: Session | null; notice: string | null; hydrated: boolean };

export type Action =
  | { type: "hydrate"; session: Session | null; notice: string | null }
  | { type: "loadDemo" }
  | { type: "verify" }
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
    case "reset":
      return { ...state, session: null, notice: null };
    case "dismissNotice":
      return { ...state, notice: null };
  }
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
