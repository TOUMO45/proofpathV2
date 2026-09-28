"use client";

// "or upload a .md / .txt file": always the secondary option next to a paste
// box. Read locally (FileReader), 200 KB max, .md/.txt only; nothing is sent.

import { useState } from "react";
import { readTextFile } from "@/lib/upload";

type Props = { onText: (text: string) => void; label?: string };

export function UploadLink({ onText, label = "or upload a .md / .txt file" }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    const result = await readTextFile(file);
    if (result.ok) {
      setError(null);
      setLoaded(file.name);
      onText(result.text);
    } else {
      setLoaded(null);
      setError(result.error);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="cursor-pointer text-sm text-muted underline underline-offset-2 hover:text-ink">
        {label}
        <input
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="sr-only"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {loaded && !error && <span className="text-xs text-muted">Loaded {loaded} (read in your browser, not uploaded anywhere)</span>}
      {error && (
        <span role="alert" className="text-sm text-contradicted">
          {error}
        </span>
      )}
    </span>
  );
}
