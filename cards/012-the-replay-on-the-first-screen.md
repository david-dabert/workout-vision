# 012. The first screen shows a real set being replayed
Status: blocked (on a video David chooses to show to every visitor)
Executor: fast
Claim: a visitor sees, before reading anything, a real person's set replayed with the skeleton and the count.
Reference: the lesson David drew on 12 November from another product's page: every claim shown as a real screen. The replay is three screens deep today; the first screen shows a figure of light.
Eval: a browser test: the first screen plays a short, muted, looped clip of a real replay within two seconds on a 4G profile, the first-paint budget still holds (`check:entry-budget`), and the picture test of the entry is taken again in CI.
Baseline: the figure of light (`entry-scene.js`).
Scope: `Entry.jsx` and one video asset under 1 MB, loaded after first paint.
Stop: if the clip cannot fit the budget, it plays under the fold.
Needs from David: one of his sets that he accepts to show publicly, or his word to use one already in `test/real-phone/`.
