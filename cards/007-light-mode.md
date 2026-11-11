# 007. Every screen reads on a phone in light mode
Status: ready
Executor: fast
Claim: a person whose phone is in light mode reads every label of the app.
Reference: the walk of 11 November 2026 (issue #190): after a set is saved, "Rapport de séance" showed no label, light text on a light button, because `--depth-1` turns light under the system's light scheme (`src/styles/_tokens.css`) while the experience stays dark (fixed in PR #377 for that one button).
Eval: a browser test with `colorScheme: 'light'` that walks entry, choice, film, result, saved, replay, history and the four kiné tabs, and fails when a visible text's colour and its own background differ by a contrast ratio under 3. It must fail on main before the fix on at least one element, or report that none is left.
Baseline: `--depth-*` is used 12 times in the stylesheets of the experience, the comparison and the kiné screens; each is a candidate.
Scope: stylesheets only. The experience stays dark-themed.
Stop: none.
Needs from David: nothing.
