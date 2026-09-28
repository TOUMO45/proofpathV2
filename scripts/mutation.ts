// Mutation check: switch off one verifier rule at a time, run the test suite,
// and count how many tests fail. A rule whose removal fails no test is a rule
// nothing protects, so the script exits 1 if any mutation survives.
//
//   npm run mutation            print the table
//   npm run mutation -- --write also update README.md between the markers
//
// Source files are always restored, even if a run crashes.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Mutation = { rule: string; file: string; edits: [from: string, to: string][] };

const MUTATIONS: Mutation[] = [
  { rule: "Injection screen", file: "lib/verify/stance.ts", edits: [["if (injection) {", "if (false && injection) {"]] },
  { rule: "Hypothetical / modal screen", file: "lib/verify/stance.ts", edits: [["if (hypothetical) {", "if (false && hypothetical) {"]] },
  { rule: "Vague-approval screen", file: "lib/verify/stance.ts", edits: [["if (vague && !concrete) {", "if (false) {"]] },
  { rule: "Error signals", file: "lib/verify/stance.ts", edits: [["if (error) {", "if (false && error) {"]] },
  { rule: "Accepted input on a `rejects` requirement", file: "lib/verify/stance.ts", edits: [["if (through) {", "if (false && through) {"]] },
  { rule: "Scoped negation", file: "lib/verify/stance.ts", edits: [["if (neg) {", "if (false && neg) {"]] },
  {
    rule: "Support needs a concrete observation",
    file: "lib/verify/stance.ts",
    edits: [["if (onTopic && concrete && outcome) {", "if (onTopic && outcome) {"]],
  },
  {
    rule: "Support needs the expected outcome",
    file: "lib/verify/stance.ts",
    edits: [["if (onTopic && concrete && outcome) {", "if (onTopic && concrete) {"]],
  },
  {
    rule: "Conflicting evidence is CONTRADICTED",
    file: "lib/verify/index.ts",
    edits: [["if (contradicts.length > 0) {", "if (contradicts.length > 0 && supports.length === 0) {"]],
  },
  {
    rule: "Agent claims never prove on their own",
    file: "lib/verify/index.ts",
    edits: [['  if (e.kind !== "claim") return stance(req, e, linked);', "  if (true) return stance(req, e, linked);"]],
  },
  {
    rule: "Negation skips quoted UI text",
    file: "lib/verify/stance.ts",
    edits: [["[withoutQuotes(parsed.observed)]", "[parsed.observed]"]],
  },
  {
    rule: "A claim contradicts only on an unambiguous failure",
    file: "lib/verify/index.ts",
    edits: [["(!signal || isAppFailure(signal[1]))", "true"]],
  },
  {
    rule: "Text normalization (invisible chars, lookalikes, fullwidth)",
    file: "lib/text.ts",
    edits: [
      ['.normalize("NFKC")', ""],
      [String.raw`.replace(/\p{Cf}/gu, "")`, ""],
      ["    .replace(CONFUSABLE_RE, (c) => CONFUSABLES.get(c) ?? c)\n", ""],
    ],
  },
];

type Result = { rule: string; failed: number; total: number };

function runTests(): { failed: number; total: number } {
  const dir = mkdtempSync(path.join(tmpdir(), "proofpath-mutation-"));
  const out = path.join(dir, "result.json");
  try {
    spawnSync(`npx vitest run --reporter=json --outputFile="${out}"`, { shell: true, stdio: "ignore" });
    const json = JSON.parse(readFileSync(out, "utf8")) as { numTotalTests: number; numFailedTests: number };
    return { failed: json.numFailedTests, total: json.numTotalTests };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function applyEdits(source: string, m: Mutation): string {
  let out = source;
  for (const [from, to] of m.edits) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`Mutation "${m.rule}": expected "${from}" once in ${m.file}, found ${count}. Update scripts/mutation.ts.`);
    out = out.replace(from, to);
  }
  return out;
}

const baseline = runTests();
if (baseline.failed > 0) {
  console.error(`Baseline has ${baseline.failed} failing tests; fix those before a mutation run.`);
  process.exit(1);
}

const results: Result[] = [];
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, "utf8");
  try {
    writeFileSync(m.file, applyEdits(original, m));
    const r = runTests();
    results.push({ rule: m.rule, failed: r.failed, total: r.total });
    process.stderr.write(`${m.rule}: ${r.failed} failing\n`);
  } finally {
    writeFileSync(m.file, original);
  }
}

const table = [
  `| Rule switched off | Failing tests (of ${baseline.total}) |`,
  "|---|---|",
  ...results.map((r) => `| ${r.rule} | ${r.failed === 0 ? "**0 (survived)**" : r.failed} |`),
].join("\n");

console.log(table);

if (process.argv.includes("--write")) {
  const readme = readFileSync("README.md", "utf8");
  const start = "<!-- mutation-table:start -->";
  const end = "<!-- mutation-table:end -->";
  const a = readme.indexOf(start);
  const b = readme.indexOf(end);
  if (a < 0 || b < a) throw new Error("README.md is missing the mutation-table markers.");
  writeFileSync("README.md", `${readme.slice(0, a + start.length)}\n${table}\n${readme.slice(b)}`);
  console.error("README.md updated.");
}

if (results.some((r) => r.failed === 0)) process.exit(1);
