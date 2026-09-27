import { describe, expect, it } from "vitest";
import {
  RESET_NOTICE,
  STORAGE_KEY,
  hasCurrentVerdicts,
  initialState,
  loadSaved,
  reducer,
  save,
  supersedableEvidence,
  validateDraft,
} from "@/lib/store";
import { demoFixEvidence, demoSession } from "@/lib/fixtures/demo";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("stale flag", () => {
  it("loading the demo starts stale, with no verdicts shown as current", () => {
    const s = reducer(initialState, { type: "loadDemo" });
    expect(s.session!.stale).toBe(true);
    expect(s.session!.verdicts).toEqual([]);
    expect(hasCurrentVerdicts(s.session!)).toBe(false);
  });

  it("verify clears stale and stores one verdict per requirement", () => {
    const s = reducer(reducer(initialState, { type: "loadDemo" }), { type: "verify" });
    expect(s.session!.stale).toBe(false);
    expect(s.session!.verdicts).toHaveLength(4);
    expect(hasCurrentVerdicts(s.session!)).toBe(true);
  });

  it("stale verdicts are never current, even if verdicts exist", () => {
    const verified = reducer(reducer(initialState, { type: "loadDemo" }), { type: "verify" }).session!;
    expect(hasCurrentVerdicts({ ...verified, stale: true })).toBe(false);
  });

  it("loading the demo computes evidence flags", () => {
    const s = reducer(initialState, { type: "loadDemo" });
    expect(s.session!.evidence.every((e) => Array.isArray(e.flags))).toBe(true);
    expect(s.session!.evidence.flatMap((e) => e.flags)).toEqual([]);
  });
});

describe("saved session", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const session = reducer(reducer(initialState, { type: "loadDemo" }), { type: "verify" }).session!;
    save(storage, session);
    const loaded = loadSaved(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.session).toEqual(session);
  });

  it("nothing saved → landing, no notice", () => {
    expect(loadSaved(memoryStorage())).toEqual({ session: null, notice: null });
  });

  it.each([
    ["not JSON", "{oops"],
    ["wrong shape", JSON.stringify({ goal: 42 })],
    ["evidence with no links", JSON.stringify({ ...demoSession(), evidence: [{ ...demoSession().evidence[0], links: [] }] })],
  ])("malformed saved state (%s) resets safely with a notice", (_label, raw) => {
    expect(loadSaved(memoryStorage({ [STORAGE_KEY]: raw }))).toEqual({ session: null, notice: RESET_NOTICE });
  });

  it("blocked storage does not crash", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSaved(throwing)).toEqual({ session: null, notice: null });
  });

  it("reset clears the saved session", () => {
    const storage = memoryStorage();
    save(storage, demoSession());
    save(storage, reducer(initialState, { type: "reset" }).session);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });
});

describe("adding, removing and superseding evidence", () => {
  const verifiedDemo = () => reducer(reducer(initialState, { type: "loadDemo" }), { type: "verify" });
  const observedR4 = { kind: "structured" as const, structured: { input: "valid", action: "Submitted the form", observed: "Confirmation message 'Thanks' shown" }, links: ["R4"] };

  it("adding evidence assigns the next ID, computes flags and makes verdicts stale", () => {
    const s = reducer(verifiedDemo(), { type: "addEvidence", draft: observedR4 }).session!;
    expect(s.evidence.at(-1)!.id).toBe("E4");
    expect(s.evidence.at(-1)!.flags).toEqual([]);
    expect(s.stale).toBe(true);
    expect(hasCurrentVerdicts(s)).toBe(false);
  });

  it("removing evidence makes verdicts stale", () => {
    const s = reducer(verifiedDemo(), { type: "removeEvidence", id: "E2" }).session!;
    expect(s.evidence.map((e) => e.id)).toEqual(["E1", "E3"]);
    expect(s.stale).toBe(true);
  });

  it("IDs are never reused after a removal", () => {
    let st = reducer(verifiedDemo(), { type: "addEvidence", draft: observedR4 }); // E4
    st = reducer(st, { type: "removeEvidence", id: "E4" });
    st = reducer(st, { type: "addEvidence", draft: observedR4 });
    expect(st.session!.evidence.at(-1)!.id).toBe("E5");
  });

  it("supersede is only allowed for evidence sharing a linked requirement", () => {
    const s = verifiedDemo().session!;
    expect(supersedableEvidence(s, ["R3"]).map((e) => e.id)).toEqual(["E3"]);
    expect(validateDraft(s, { ...observedR4, supersedes: "E3" })).toMatch(/shares a linked requirement/);
    expect(validateDraft(s, { ...observedR4, links: ["R3", "R4"], supersedes: "E3" })).toBeNull();
  });

  it("an invalid draft is ignored by the reducer", () => {
    const before = verifiedDemo();
    expect(reducer(before, { type: "addEvidence", draft: { ...observedR4, links: [] } })).toBe(before);
    expect(reducer(before, { type: "addEvidence", draft: { kind: "claim", text: "  ", links: ["R2"] } })).toBe(before);
  });

  it("already-superseded evidence can't be superseded again", () => {
    let st = reducer(verifiedDemo(), { type: "addEvidence", draft: { ...observedR4, links: ["R3"], supersedes: "E3" } });
    expect(supersedableEvidence(st.session!, ["R3"]).map((e) => e.id)).toEqual(["E4"]);
    st = reducer(st, { type: "addEvidence", draft: { ...observedR4, links: ["R3"], supersedes: "E3" } });
    expect(st.session!.evidence).toHaveLength(4);
  });

  it("the demo reaches 100% through the reducer: R2 and R4 evidence, plus a retest superseding E3", () => {
    let st = verifiedDemo();
    st = reducer(st, { type: "addEvidence", draft: { kind: "structured", structured: demoFixEvidence[0].structured!, links: ["R2"] } });
    st = reducer(st, { type: "addEvidence", draft: { kind: "structured", structured: demoFixEvidence[1].structured!, links: ["R3", "R4"], supersedes: "E3" } });
    st = reducer(st, { type: "verify" });
    expect(st.session!.verdicts.map((v) => v.status)).toEqual(["PROVEN", "PROVEN", "PROVEN", "PROVEN"]);
  });
});
