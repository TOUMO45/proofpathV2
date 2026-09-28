// Session store: one reducer, one stale flag, one localStorage key.
// spec.md > Session Store (lib/store). Every action that changes the contract or
// the evidence sets stale = true; only "verify" clears it.

import { checkClean } from "./contract/clean";
import { MAX_REQUIREMENTS, makeRequirement, proofTemplateFor, targetsFor } from "./contract/generate";
import { demoSession } from "./fixtures/demo";
import {
  SessionSchema,
  type Evidence,
  type EvidenceKind,
  type ExpectedOutcome,
  type Requirement,
  type Session,
  type Structured,
} from "./types";
import { evidenceFlags, supersededIds, verify } from "./verify";

export type RequirementPatch = { text?: string; expected?: ExpectedOutcome; targets?: string[] };

/** Re-run the clean rules on every requirement (duplicates depend on the ones before it). */
export function reflag(requirements: Requirement[]): Requirement[] {
  return requirements.map((r, i) => ({
    ...r,
    flags: checkClean(
      r.text,
      requirements.slice(0, i).map((o) => o.text),
    ).reasons,
  }));
}

export function nextRequirementId(requirements: Requirement[]): string {
  const max = requirements.reduce((m, r) => Math.max(m, Number(r.id.slice(1)) || 0), 0);
  return `R${max + 1}`;
}

/** Approve is allowed only for 1–7 requirements that all pass the clean rules. */
export function approvalBlocker(session: Session): string | null {
  const reqs = session.contract.requirements;
  if (reqs.length === 0) return "Add at least one requirement.";
  if (reqs.length > MAX_REQUIREMENTS) return `A contract has at most ${MAX_REQUIREMENTS} requirements.`;
  const flagged = reqs.filter((r) => r.flags.length > 0).map((r) => r.id);
  if (flagged.length) return `Fix the flagged requirement${flagged.length > 1 ? "s" : ""} first: ${flagged.join(", ")}.`;
  if (reqs.some((r) => r.targets.length === 0)) return "Every requirement needs at least one target word.";
  return null;
}

/** Evidence that would be deleted with a requirement because it links to nothing else. */
export function evidenceOnlyLinkedTo(session: Session, requirementId: string): Evidence[] {
  return session.evidence.filter((e) => e.links.length === 1 && e.links[0] === requirementId);
}

function editContract(state: State, update: (reqs: Requirement[], s: Session) => Session): State {
  const s = state.session;
  if (!s || s.contract.approved) return state; // the contract is only editable while under review
  return { ...state, session: { ...update(s.contract.requirements, s), stale: true } };
}

export const STORAGE_KEY = "proofpath.session.v1";

/** `hydrated` is false until the saved session has been read in the browser. */
export type State = { session: Session | null; notice: string | null; hydrated: boolean };

export type Action =
  | { type: "hydrate"; session: Session | null; notice: string | null }
  | { type: "loadDemo" }
  | { type: "verify" }
  | { type: "addEvidence"; draft: EvidenceDraft }
  | { type: "removeEvidence"; id: string }
  | { type: "unlinkEvidence"; evidenceId: string; requirementId: string }
  | { type: "createContract"; goal: string; requirements: Requirement[]; pendingClaim?: string }
  | { type: "editRequirement"; id: string; patch: RequirementPatch }
  | { type: "addRequirement" }
  | { type: "removeRequirement"; id: string }
  | { type: "splitRequirement"; id: string }
  | { type: "approveContract" }
  | { type: "reopenContract" }
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
    case "unlinkEvidence": {
      const s = state.session;
      const e = s?.evidence.find((x) => x.id === action.evidenceId);
      // Evidence must keep at least one link; removing the last one is "Remove".
      if (!s || !e || !e.links.includes(action.requirementId) || e.links.length < 2) return state;
      const evidence = s.evidence.map((x) =>
        x.id === action.evidenceId ? { ...x, links: x.links.filter((l) => l !== action.requirementId) } : x,
      );
      return { ...state, session: { ...s, evidence, stale: true } };
    }
    case "removeEvidence": {
      if (!state.session) return state;
      const s = state.session;
      if (!s.evidence.some((e) => e.id === action.id)) return state;
      // IDs are never reused: nextEvidenceNumber does not go back down.
      return { ...state, session: { ...s, evidence: s.evidence.filter((e) => e.id !== action.id), stale: true } };
    }
    case "createContract":
      return {
        ...state,
        notice: null,
        session: {
          goal: action.goal,
          contract: { requirements: reflag(action.requirements), approved: false },
          evidence: [],
          verdicts: [],
          stale: true,
          isDemo: false,
          nextEvidenceNumber: 1,
          removedRequirements: [],
          ...(action.pendingClaim?.trim() ? { pendingClaim: action.pendingClaim } : {}),
        },
      };
    case "editRequirement":
      return editContract(state, (reqs, s) => {
        const next = reqs.map((r) => {
          if (r.id !== action.id) return r;
          const text = action.patch.text ?? r.text;
          const expected = action.patch.expected ?? r.expected;
          // Editing the text re-derives target words unless the patch sets them.
          const targets = action.patch.targets ?? (action.patch.text !== undefined ? targetsFor(text) : r.targets);
          return { ...r, text, expected, targets, proofTemplate: proofTemplateFor(text, expected) };
        });
        return { ...s, contract: { ...s.contract, requirements: reflag(next) } };
      });
    case "addRequirement":
      return editContract(state, (reqs, s) => {
        if (reqs.length >= MAX_REQUIREMENTS) return s;
        const blank: Requirement = { ...makeRequirement(nextRequirementId(reqs), ""), text: "" };
        return { ...s, contract: { ...s.contract, requirements: reflag([...reqs, blank]) } };
      });
    case "removeRequirement":
      return editContract(state, (reqs, s) => {
        // Links to a deleted requirement are removed; evidence left linked to
        // nothing is removed with it (evidence must prove something).
        const evidence = s.evidence
          .map((e) => ({ ...e, links: e.links.filter((l) => l !== action.id) }))
          .filter((e) => e.links.length > 0);
        const kept = new Set(evidence.map((e) => e.id));
        const cleaned = evidence.map((e) => (e.supersedes && !kept.has(e.supersedes) ? { ...e, supersedes: undefined } : e));
        // Audit trail: a requirement that already had a verdict leaves a record.
        const removed = reqs.find((r) => r.id === action.id);
        const lastVerdict = s.verdicts.find((v) => v.requirementId === action.id);
        const removedRequirements =
          removed && lastVerdict
            ? [
                ...s.removedRequirements,
                {
                  id: removed.id,
                  text: removed.text,
                  lastVerdict: lastVerdict.status,
                  removedEvidence: s.evidence.filter((e) => !kept.has(e.id)).map((e) => e.id),
                },
              ]
            : s.removedRequirements;
        return {
          ...s,
          evidence: cleaned,
          removedRequirements,
          verdicts: s.verdicts.filter((v) => v.requirementId !== action.id),
          contract: { ...s.contract, requirements: reflag(reqs.filter((r) => r.id !== action.id)) },
        };
      });
    case "splitRequirement":
      return editContract(state, (reqs, s) => {
        const i = reqs.findIndex((r) => r.id === action.id);
        if (i < 0 || reqs.length >= MAX_REQUIREMENTS) return s;
        const suggestion = checkClean(reqs[i].text).splitSuggestion;
        if (!suggestion) return s;
        const first = { ...makeRequirement(reqs[i].id, suggestion[0]) };
        const second = makeRequirement(nextRequirementId(reqs), suggestion[1]);
        const next = [...reqs.slice(0, i), first, second, ...reqs.slice(i + 1)];
        return { ...s, contract: { ...s.contract, requirements: reflag(next) } };
      });
    case "approveContract": {
      const s = state.session;
      if (!s || s.contract.approved || approvalBlocker(s)) return state;
      const approved: Session = { ...s, contract: { ...s.contract, approved: true }, stale: true };
      if (!approved.pendingClaim) return { ...state, session: approved };
      // The agent's reply becomes E1: an agent claim linked to every
      // requirement. Then Verify runs once, so the first screen shows verdicts.
      const { pendingClaim, ...rest } = approved;
      const withClaim = reducer(
        { ...state, session: rest },
        { type: "addEvidence", draft: { kind: "claim", text: pendingClaim, links: rest.contract.requirements.map((r) => r.id) } },
      );
      return reducer(withClaim, { type: "verify" });
    }
    case "reopenContract": {
      const s = state.session;
      if (!s || !s.contract.approved) return state;
      return { ...state, session: { ...s, contract: { ...s.contract, approved: false }, stale: true } };
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
