# 011. Today's set against your own best set
Status: in review (lab lane)
Lab lane, 13 November 2026 (Claude), branch `card/011-best-set`: `BestSet.jsx` on the saved result, behind `measures.js` `BEST_SET_SHOWN = false`: today's set beside the best saved set of the same exercise (most reps), count, mean range and tempo, read from the saved reps. Eval `src/components/experience/__tests__/best-set.test.jsx` 0 of 4 before, 4 of 4 after. Found: a saved set keeps no landmarks (`saved-set.js`), so the engine's overlay cannot run on two saved sets; that needs the landmarks of a saved set kept on the phone (image landmarks and timestamps, `src/lib/landmarkCache.js` exists and is unused). The browser test the card names comes with the card that turns the switch on, after card 001, since CI runs only the production and e2e builds, where the switch is off.
Executor: fast
Claim: a person who has saved two sets of one exercise sees today's movement beside their best one, and has a reason to film again tomorrow.
Reference: the comparison built for the physiotherapist (`src/lib/reference/compare.js`, `ComparisonView.jsx`), which overlays a reference on an attempt and already runs on a real video (David, 11 November 2026).
Eval: lab lane first (METHOD.md): behind a switch that is off in production, a browser test with two synthetic sets of one exercise opens the comparison from the result screen with the earlier set as the reference, and shows the two ranges and tempos. It reaches users only when card 001 has passed, because both rest on the same engine.
Baseline: no path from an athlete's result to the comparison.
Scope: a new entry on the saved result, the switch, and the wiring. The engine's maths is not changed here. The landmarks of a saved set are kept on the phone only.
Stop: if a saved set does not keep enough to compare (its landmarks), record what must be stored and stop.
Needs from David: nothing.
