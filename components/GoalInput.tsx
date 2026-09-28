"use client";

// Landing. "Try the demo" is the primary action, so a first click shows the
// verifier working; your own goal is the second path below it.

import { useEffect, useRef, useState } from "react";
import { RULES_VERSION } from "@/lib/verify";
import { UploadLink } from "./UploadLink";

type Props = {
  onTryDemo: () => void;
  onCreate: (goal: string) => string | null;
  onImport: (markdown: string) => string | null;
  onCheckReply: (request: string, reply: string) => string | null;
  /** Text moved here from the plan box ("Is this an agent's reply?"). */
  initialReply?: string;
  notice: string | null;
  onDismissNotice: () => void;
};

export function GoalInput({ onTryDemo, onCreate, onImport, onCheckReply, initialReply, notice, onDismissNotice }: Props) {
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [planError, setPlanError] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [reply, setReply] = useState(initialReply ?? "");
  const [replyError, setReplyError] = useState<string | null>(null);
  const replySection = useRef<HTMLElement>(null);

  // Arriving from the plan box with a reply: show where it went.
  useEffect(() => {
    if (initialReply) replySection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialReply]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(onCreate(goal));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="font-semibold tracking-tight">ProofPath</span>
        <span className="pill">Verifier · deterministic · no AI judge</span>
      </header>

      {notice && (
        <div role="status" className="mt-8 flex items-start justify-between gap-4 rounded-xl border border-notproven bg-sheet p-3 text-sm">
          <span>{notice}</span>
          <button type="button" onClick={onDismissNotice} className="text-muted underline">
            Dismiss
          </button>
        </div>
      )}

      <section className="mt-16 sm:mt-24">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          <span className="reveal-line">Don&apos;t tell me it&apos;s done.</span>
          <span className="reveal-line">Show me the proof.</span>
        </h1>
        <p className="reveal-soft mt-6 max-w-xl text-lg text-muted">
          ProofPath turns a goal into a short contract of testable requirements, then judges each one against real
          evidence: <span className="font-mono text-proven">PROVEN</span>,{" "}
          <span className="font-mono text-notproven">NOT PROVEN</span> or{" "}
          <span className="font-mono text-contradicted">CONTRADICTED</span>, with the evidence quoted. It can&apos;t be
          talked into a verdict.
        </p>
        <div className="reveal-soft mt-10 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onTryDemo} className="btn btn-primary px-5 py-3">
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
            className="w-full border border-rule bg-sheet px-3 py-2 text-base focus:border-accent rounded-xl"
            aria-describedby={error ? "goal-error" : undefined}
          />
          {error && (
            <p id="goal-error" role="alert" className="text-sm text-contradicted">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-secondary px-4 py-2">
            Create Proof Plan
          </button>
        </form>
      </section>

      <section ref={replySection} className="mt-10 border-t border-rule pt-8" aria-labelledby="reply-label">
        <h2 id="reply-label" className="label">
          Or check an agent&apos;s reply
        </h2>
        <p className="mt-1 text-sm text-muted">
          What you asked for becomes the contract. The agent&apos;s reply is added as an agent claim: it can point you to
          what to check, but it can&apos;t prove anything by itself.
        </p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setReplyError(onCheckReply(request, reply));
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">What did you ask for?</span>
            <textarea
              id="reply-request"
              value={request}
              onChange={(e) => {
                setRequest(e.target.value);
                if (replyError) setReplyError(null);
              }}
              rows={2}
              placeholder="e.g. Build a tip calculator that takes a bill amount and a tip percentage, shows the tip and the total, and rejects negative amounts"
              className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2 text-base focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">What did the agent reply?</span>
            <textarea
              id="reply-text"
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                if (replyError) setReplyError(null);
              }}
              rows={5}
              placeholder="Paste the agent's final message here."
              className="mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2 font-mono text-[13px] focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap items-start gap-4">
            <button type="submit" className="btn btn-secondary px-4 py-2">
              Check the reply
            </button>
            <UploadLink
              onText={(t) => {
                setReply(t);
                setReplyError(null);
              }}
            />
          </div>
          {replyError && (
            <p role="alert" className="text-sm text-contradicted">
              {replyError}
            </p>
          )}
        </form>
      </section>

      <section className="mt-10 border-t border-rule pt-8" aria-labelledby="plan-label">
        <h2 id="plan-label" className="label">
          Or paste a plan (.md)
        </h2>
        <p className="mt-1 text-sm text-muted">
          A PRD, spec or checklist. Its checkbox items become candidates you can pick; plain bullets are optional.
        </p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPlanError(onImport(plan));
          }}
        >
          <label htmlFor="plan" className="sr-only">
            Plan markdown
          </label>
          <textarea
            id="plan"
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              if (planError) setPlanError(null);
            }}
            rows={4}
            placeholder={`# My plan
- [ ] The export button downloads a CSV file
- [ ] ...`}
            className="w-full border border-rule bg-sheet px-3 py-2 font-mono text-[13px] focus:border-accent rounded-xl"
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-secondary px-4 py-2">
              Find requirements
            </button>
            <UploadLink
              onText={(t) => {
                setPlan(t);
                setPlanError(null);
              }}
            />
          </div>
          {planError && (
            <p role="alert" className="text-sm text-contradicted">
              {planError}
            </p>
          )}
        </form>
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted">
        Runs entirely in your browser. No account, no API key, nothing sent anywhere. ·{" "}
        <span data-testid="rules-version">ProofPath rules v{RULES_VERSION}</span>
      </footer>
    </main>
  );
}
