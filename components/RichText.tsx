// Renders reason and gap text: `backticks` become <code> (never raw backticks),
// and quoted evidence is set in monospace so quotes read as evidence.

import { Fragment } from "react";

function quotes(text: string, keyPrefix: string) {
  const parts = text.split(/("[^"]+")/g);
  return parts.map((p, i) =>
    /^"[^"]+"$/.test(p) ? (
      <span key={`${keyPrefix}-${i}`} className="font-mono text-[0.92em]">
        {p}
      </span>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{p}</Fragment>
    ),
  );
}

export function RichText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <code key={i}>{p}</code> : <Fragment key={i}>{quotes(p, String(i))}</Fragment>))}
    </>
  );
}
