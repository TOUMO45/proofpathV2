Done — tip-calculator.html (single self-contained file, no dependencies beyond an optional Google Fonts link).

What it does

* Bill amount + Tip % inputs (text inputs with `inputmode="decimal"` so validation is under my control rather than the browser's), plus 15/18/20/25% preset chips.
* Live results: Tip on the check, Total as the oversized figure on the right, with bill and tip-rate breakdown below.
* Negative bill → inline error "The bill can't be negative. Enter 0 or more." — red rule, `role="alert"`, input preserved (never makes you retype), totals cleared to `—`. Same treatment for negative/over-100% tip, non-numeric input, and empty fields.

Verified, not assumed

* Math: `125.00 @ 18%` → tip `$22.50`, total `147.50`; `84.37 @ 20%` → `101.24`.
* Error/recovery paths driven through 9 state transitions (negative → letters → empty → valid → zero tip → over-100% → bad tip → recovered → zero bill). One bug found and fixed: the hint under the total contradicted the error message; it now hides whenever an error is showing.
* Screenshots of empty, filled, error, and a 390px mobile render. Fixed two visual defects: the empty-state em dash at 148px looked like a solid white bar (now a quiet small placeholder with the `$` hidden), and the check's tear-off edge cast heavy black triangles (now a subtle perforation).
* Lighthouse: accessibility 100, best practices 100, SEO 100 (initial run was 98 — missing `main` landmark, added; also caught that an edit had silently replaced the viewport meta tag, restored).
* Motion is limited to one "tick" on total change and disabled under `prefers-reduced-motion`; visible brass focus rings throughout.

The file is open in the Review pane. I stopped the temporary local server I used for testing.
Separately: your previous message ("Final Review", "start 6-ship") referenced a checklist I couldn't find — this workspace was empty, so nothing to tick. If that lives elsewhere, point me at it.
