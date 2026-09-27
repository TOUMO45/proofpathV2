import type { Evidence } from "@/lib/types";
import { supersededIds } from "@/lib/verify";

const FLAG_LABEL: Record<string, { text: string; title: string }> = {
  untrusted: { text: "UNTRUSTED · TREATED AS DATA", title: "Contains instruction-like text. It contributes nothing to any verdict." },
  obfuscated: {
    text: "OBFUSCATED TEXT DETECTED",
    title: "Contained invisible characters or lookalike letters. They were normalized before verification.",
  },
};

function Field({ name, value }: { name: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <span className="label text-xs">{name}</span>
      <span className="font-mono text-[13px] break-words">{value || "—"}</span>
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const superseded = supersededIds(evidence);
  const supersededBy = new Map(evidence.filter((e) => e.supersedes).map((e) => [e.supersedes!, e.id]));
  if (evidence.length === 0) return <p className="text-sm text-muted">No evidence yet.</p>;
  return (
    <ul className="space-y-3">
      {evidence.map((e) => {
        const isSuperseded = superseded.has(e.id);
        return (
          <li key={e.id} className="border border-rule bg-sheet p-3" data-testid={`evidence-${e.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{e.id}</span>
              <span className="text-xs text-muted">{e.kind === "structured" ? "structured test" : "text"}</span>
              <span className="text-xs text-muted">
                → <span className="font-mono">{e.links.join(", ")}</span>
              </span>
              {e.supersedes && <span className="text-xs text-muted">supersedes {e.supersedes}</span>}
              {e.flags.map((f) => (
                <span
                  key={f}
                  title={FLAG_LABEL[f]?.title}
                  className="border border-contradicted px-1 font-mono text-[10px] font-semibold tracking-wider text-contradicted"
                >
                  {FLAG_LABEL[f]?.text ?? f.toUpperCase()}
                </span>
              ))}
            </div>
            <div className={`mt-2 space-y-1 ${isSuperseded ? "text-muted line-through" : ""}`}>
              {e.kind === "structured" && e.structured ? (
                <>
                  <Field name="Input" value={e.structured.input} />
                  <Field name="Action" value={e.structured.action} />
                  <Field name="Observed" value={e.structured.observed} />
                </>
              ) : (
                <p className="font-mono text-[13px] break-words">{e.text}</p>
              )}
            </div>
            {isSuperseded && (
              <p className="mt-1 text-xs text-muted">Superseded by {supersededBy.get(e.id)}. Kept as an audit trail; counts toward nothing.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
