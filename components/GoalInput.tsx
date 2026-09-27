"use client";

// Landing. "Try the demo" is the primary action, so a first click shows the
// verifier working; your own goal is the second path below it.

import { useState } from "react";

type Props = {
  onTryDemo: () => void;
  onCreate: (goal: string) => string | null;
  notice: string | null;
  onDismissNotice: () => void;
};

export function GoalInput({ onTryDemo, onCreate, notice, onDismissNotice }: Props) {
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(onCreate(goal));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="font-semibold tracking-tight">ProofPath</span>
        <span className="label text-xs">Verifier · deterministic · no AI judge</span>
      </header>

      {notice && (
        <div role="status" className="mt-8 flex items-start justify-between gap-4 border border-notproven bg-sheet p-3 text-sm">
          <span>{notice}</span>
          <button type="button" onClick={onDismissNotice} className="text-muted underline">
            Dismiss
          </button>
        </div>
      )}

      <section className="mt-16 sm:mt-24">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Don&apos;t tell me it&apos;s done.
          <br />
          Show me the proof.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          ProofPath turns a goal into a short contract of testable requirements, then judges each one against real
          evidence: <span className="font-mono text-proven">PROVEN</span>,{" "}
          <span className="font-mono text-notproven">NOT PROVEN</span> or{" "}
          <span className="font-mono text-contradicted">CONTRADICTED</span>, with the evidence quoted. It can&apos;t be
          talked into a verdict.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onTryDemo} className="bg-accent px-5 py-3 font-medium text-white hover:bg-accent/90">
            Try the demo
          </button>
          <span className="text-sm text-muted">An AI agent says a contact form is done. Check it.</span>
        </div>
      </section>

      <section className="mt-14 border-t border-rule pt-8" aria-labelledby="own-goal-label">
        <h2 id="own-goal-label" className="label">
          Or check your own goal
        </h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <label htmlFor="goal" className="sr-only">
            Goal
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            placeholder="What did you ask the agent to build? e.g. Add a dark mode toggle that persists after page reload"
            className="w-full border border-rule bg-sheet px-3 py-2 text-base focus:border-accent"
            aria-describedby={error ? "goal-error" : undefined}
          />
          {error && (
            <p id="goal-error" role="alert" className="text-sm text-contradicted">
              {error}
            </p>
          )}
          <button type="submit" className="border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-paper">
            Create Proof Plan
          </button>
        </form>
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted">Runs entirely in your browser. No account, no API key, nothing sent anywhere.</footer>
    </main>
  );
}
