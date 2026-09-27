type Props = { onTryDemo: () => void; notice: string | null; onDismissNotice: () => void };

export function GoalInput({ onTryDemo, notice, onDismissNotice }: Props) {
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
          <button
            type="button"
            onClick={onTryDemo}
            className="bg-accent px-5 py-3 font-medium text-white hover:bg-accent/90"
          >
            Try the demo
          </button>
          <span className="text-sm text-muted">An AI agent says a contact form is done. Check it.</span>
        </div>
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted">Runs entirely in your browser. No account, no API key, nothing sent anywhere.</footer>
    </main>
  );
}
