# 050. An unknown address says so, and the level is set in one place
Status: done
Executor: fast (Antigravity)
Phase: 1 (defects)
Claim: a person following a broken link is told the page does not exist before reaching the home; the training level is no longer changed from inside the history.
Reference: `useHashRouter.js:34` sends any unknown address to the home silently; `History.jsx:154` changes the level inside the history. Review panel of 16 November 2026, navigation lens.
Eval: an e2e: `#nimporte-quoi` shows one line « Cette page n’existe pas » with the home; the history has no level control and the level stays settable where it is first asked (`level.js`). The patient and client links (`#kine-p=`, `#kine-r=`, `#programme=`, `#resultats=`) still open. Fails on main today.
Scope: `useHashRouter.js`, `History.jsx`, their tests. No new screen.
Stop: if the level cannot be set elsewhere without a new element, keep it and report on #190.
Needs from David: nothing; iPhone check after merge (R3).
