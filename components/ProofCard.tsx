"use client";

// Shown only at 100% coverage from current verdicts. prd.md > Proof Card.

import { useState } from "react";

function copyViaSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function ProofCard({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied("copied");
    } catch {
      // Some embedded browsers deny the Clipboard API; fall back to copying a
      // selected (off-screen) textarea.
      setCopied(copyViaSelection(markdown) ? "copied" : "failed");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "proof-card.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="proofcard-label" className="border-2 border-proven bg-sheet p-5" data-testid="proof-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="proofcard-label" className="label text-proven">
          Proof card · 100% proven
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">
            {copied === "copied" ? "Copied" : "Copy as Markdown"}
          </button>
          <button type="button" onClick={download} className="border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper">
            Download .md
          </button>
        </div>
      </div>
      {copied === "failed" && <p className="mt-2 text-sm text-contradicted">Clipboard blocked by the browser. Use Download .md.</p>}
      <pre className="mt-4 overflow-x-auto border border-rule bg-paper p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
        {markdown}
      </pre>
      <p className="mt-2 text-xs text-muted">Paste it into a PR description or review comment as a proof checklist. It is not a certificate.</p>
    </section>
  );
}
