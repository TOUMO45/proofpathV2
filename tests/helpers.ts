// Small builders so each test reads as "this evidence, against this requirement".
import type { Contract, Evidence, Requirement } from "@/lib/types";
import { demoContract } from "@/lib/fixtures/demo";
import { verify } from "@/lib/verify";

export const [R1, R2, R3, R4] = demoContract.requirements;

let n = 100;
export function text(body: string, links: string[], extra: Partial<Evidence> = {}): Evidence {
  return { id: `E${n++}`, kind: "text", text: body, links, flags: [], ...extra };
}

export function test_(input: string, action: string, observed: string, links: string[], extra: Partial<Evidence> = {}): Evidence {
  return { id: `E${n++}`, kind: "structured", structured: { input, action, observed }, links, flags: [], ...extra };
}

export function req(partial: Partial<Requirement> & Pick<Requirement, "id" | "text" | "expected" | "targets">): Requirement {
  return { proofTemplate: "", flags: [], ...partial };
}

export function contractOf(...requirements: Requirement[]): Contract {
  return { approved: true, requirements };
}

/** Verdict for one requirement given some evidence (contract defaults to the demo's). */
export function verdictFor(r: Requirement, evidence: Evidence[], contract: Contract = demoContract) {
  const c = contract.requirements.some((x) => x.id === r.id) ? contract : contractOf(r);
  return verify(c, evidence).find((v) => v.requirementId === r.id)!;
}
