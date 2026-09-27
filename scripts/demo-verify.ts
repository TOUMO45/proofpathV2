// Prints the demo contract's verdicts: `npm run demo:verify`.
// Runs the real verifier on the labeled demo fixture.

import { demoContract, demoEvidence } from "../lib/fixtures/demo";
import { coverage, verify } from "../lib/verify";

const verdicts = verify(demoContract, demoEvidence);

console.log("ProofPath demo (fixture data): An AI agent says the contact form is done.\n");
for (const v of verdicts) {
  const req = demoContract.requirements.find((r) => r.id === v.requirementId)!;
  console.log(`${v.requirementId}  ${v.status.padEnd(12)}  ${req.text}`);
  console.log(`    ${v.reason}\n`);
}
console.log(`Coverage: ${coverage(verdicts)}% (PROVEN ÷ total, not a confidence score)`);
