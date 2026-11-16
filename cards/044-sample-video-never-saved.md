# 044. The sample video is marked « Exemple » and never saved as the person's set
Status: done
Executor: fast (Antigravity)
Phase: 1 (a defect; allowed by PLAN.md, THE FREEZE)
Claim: a person who tries the sample video on the filming screen sees its result marked « Exemple », and nothing of it reaches « Vos séries », « Vos progrès » or, on a #collecte phone, the collected sets.
Reference: `Film.jsx` `handleSampleVideo` hands the demo clip to `onFile` as an ordinary `File`, so it is saved and, on a #collecte phone, collected (`Result.jsx` `collectThisSet` needs only `videoFile` and `collectOn()`). Found by the review panel of 16 November 2026 (navigation lens). Sets filmed after 15 November are sealed (PLAN.md, THE DATA): a demo clip must never enter that pool.
Eval: a browser test on the production build (`npm run build:e2e`): run the sample on the filming screen, reach the result, tap the save action if one is shown; the history holds as many sets as before, the result shows « Exemple », and with `wv_collecte = '1'` no set is collected. A unit test that the sample's result carries a flag the save and collect paths read. Both fail on main today.
Baseline: never run.
Scope: `Film.jsx`, `Result.jsx` (Antigravity holds it, card 038), the analysis hand-off between them, their tests. No counting file, no new screen; the « Exemple » mark is a withdrawn claim, not a new element.
Stop: if the sample cannot be told from a filmed set without changing the analysis path, stop and report on #190.
Needs from David: nothing; his iPhone check after merge (R3).
