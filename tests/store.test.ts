import { describe, expect, it } from "vitest";
import { RESET_NOTICE, STORAGE_KEY, hasCurrentVerdicts, initialState, loadSaved, reducer, save } from "@/lib/store";
import { demoSession } from "@/lib/fixtures/demo";

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
