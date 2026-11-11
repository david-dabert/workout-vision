# 006. The audit: what the repository already holds and hides
Status: ready
Executor: careful
Claim: David and every agent know which features exist in the code, which a user can reach, and which are worth a card.
Reference: the code on main, not the documents: a feature exists when a file implements it, and is reachable when a screen of the production build leads to it.
Eval: a table committed as `docs/AUDIT-2026-11.md`, one row per feature found under `src/`: its files, reachable in production or not (and behind which switch), what it would need to pass gate 7 or its own eval, and a verdict among card, lab, leave. Every row names a file that exists; a script in the report lists files under `src/components` and `src/lib` that no row and no import reaches.
Baseline: no such table. STATE.md names four unreachable files; the count is unknown.
Scope: reading, and writing that one document and new cards. No code changes, nothing deleted.
Stop: the table is the result; a feature that cannot be understood from its code in ten minutes is written as such.
Needs from David: nothing.
