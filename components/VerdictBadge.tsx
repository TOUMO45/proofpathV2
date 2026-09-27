import type { VerdictStatus } from "@/lib/types";

const STYLE: Record<VerdictStatus | "STALE" | "UNVERIFIED", { label: string; className: string }> = {
  PROVEN: { label: "PROVEN", className: "border-proven bg-proven-tint text-proven" },
  NOT_PROVEN: { label: "NOT PROVEN", className: "border-notproven bg-notproven-tint text-notproven" },
  CONTRADICTED: { label: "CONTRADICTED", className: "border-contradicted bg-contradicted-tint text-contradicted" },
  STALE: { label: "STALE", className: "border-muted bg-[#eef1e4] text-muted border-dashed" },
  UNVERIFIED: { label: "NOT VERIFIED", className: "border-rule bg-sheet text-muted" },
};

/** A verdict is always a text label; color is never the only signal. */
export function VerdictBadge({ status }: { status: VerdictStatus | "STALE" | "UNVERIFIED" }) {
  const s = STYLE[status];
  return (
    <span
      // key on the status so a changed verdict re-mounts and pops
      key={status}
      className={`pop inline-block rounded-full border-[1.5px] px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
