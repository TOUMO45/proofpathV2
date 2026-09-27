import type { VerdictStatus } from "@/lib/types";

const STYLE: Record<VerdictStatus | "STALE" | "UNVERIFIED", { label: string; className: string }> = {
  PROVEN: { label: "PROVEN", className: "border-proven text-proven" },
  NOT_PROVEN: { label: "NOT PROVEN", className: "border-notproven text-notproven" },
  CONTRADICTED: { label: "CONTRADICTED", className: "border-contradicted text-contradicted" },
  STALE: { label: "STALE", className: "border-muted text-muted border-dashed" },
  UNVERIFIED: { label: "NOT VERIFIED", className: "border-rule text-muted" },
};

/** A verdict is always a text label; color is never the only signal. */
export function VerdictBadge({ status }: { status: VerdictStatus | "STALE" | "UNVERIFIED" }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-block whitespace-nowrap border px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${s.className}`}
    >
      {s.label}
    </span>
  );
}
