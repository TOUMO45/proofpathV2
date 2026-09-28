import { z } from "zod";

// Data model from spec.md > Data Model. Zod schemas are the source of truth;
// the TypeScript types are inferred from them.

export const ExpectedOutcomeSchema = z.enum(["succeeds", "rejects", "displays", "persists"]);
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;

export const RequirementSchema = z.object({
  id: z.string().regex(/^R\d+$/),
  text: z.string().min(1),
  proofTemplate: z.string(),
  expected: ExpectedOutcomeSchema,
  targets: z.array(z.string().min(1)),
  // Targets that come from the shared subject ("tip", "calculator"): they match
  // every requirement about it, so they only break ties when ranking.
  shared: z.array(z.string()).default([]),
  flags: z.array(z.string()),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const StructuredSchema = z.object({
  input: z.string(),
  action: z.string(),
  observed: z.string(),
});
export type Structured = z.infer<typeof StructuredSchema>;

// "claim" is an AI agent's own completion message, pasted as-is. The verifier
// treats it exactly like text; the UI labels it AGENT CLAIM.
export const EvidenceKindSchema = z.enum(["text", "structured", "claim"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceSchema = z
  .object({
    id: z.string().regex(/^E\d+$/),
    kind: EvidenceKindSchema,
    text: z.string().optional(),
    structured: StructuredSchema.optional(),
    links: z.array(z.string()).min(1, "Evidence must be linked to at least one requirement"),
    supersedes: z.string().optional(),
    flags: z.array(z.string()),
  })
  .refine((e) => (e.kind === "structured" ? e.structured !== undefined : typeof e.text === "string"), {
    message: "Evidence body does not match its kind",
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const VerdictStatusSchema = z.enum(["PROVEN", "NOT_PROVEN", "CONTRADICTED"]);
export type VerdictStatus = z.infer<typeof VerdictStatusSchema>;

export const VerdictSchema = z.object({
  requirementId: z.string(),
  status: VerdictStatusSchema,
  reason: z.string(),
  evidenceIds: z.array(z.string()),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const ContractSchema = z.object({
  requirements: z.array(RequirementSchema),
  approved: z.boolean(),
});
export type Contract = z.infer<typeof ContractSchema>;

// A requirement deleted after it had a verdict. Kept so the Proof Card can say
// so: deleting the failing requirement is not a way to reach 100%.
export const RemovedRequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  lastVerdict: VerdictStatusSchema,
  removedEvidence: z.array(z.string()),
});
export type RemovedRequirement = z.infer<typeof RemovedRequirementSchema>;

export const SessionSchema = z.object({
  goal: z.string(),
  contract: ContractSchema,
  evidence: z.array(EvidenceSchema),
  verdicts: z.array(VerdictSchema),
  stale: z.boolean(),
  isDemo: z.boolean(),
  nextEvidenceNumber: z.number().int().min(1),
  removedRequirements: z.array(RemovedRequirementSchema).default([]),
  // "Check an agent's reply": the reply waits here until the contract is
  // approved, then becomes E1 (an agent claim linked to every requirement).
  pendingClaim: z.string().optional(),
  // The RULES_VERSION that produced `verdicts`.
  rulesVersion: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;
