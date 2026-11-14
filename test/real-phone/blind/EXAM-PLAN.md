# The testers' sealed exam: plan registered before any set is read

Written 14 November 2026 by Claude, on David's order of the day ("Tackle all five", item 5 of the review board), before a single tester set has arrived (`test/real-phone/blind/` holds no tester folder; `test/real-phone/testers/exposed.json` lists none).
Why: the public build halves have been read by many experiments, and the Countix held-out half was opened on 24 October (`public/exposed.json`). The testers' blind counts (#414, R1 as amended 25 October 2026) are the one pool of whole sets, filmed by people on phones, that no rule has yet been chosen on.
This file is changed only by adding a dated line below it. A rule edited after the pool is read is void.

## The pool

- Every set imported into `test/real-phone/blind/<tester>/` after this date whose `blind.count` is a whole number (a « Je ne sais pas » set has no label and is not scored), not listed in `test/real-phone/testers/exposed.json`.
- David's own blind sets are not in it: they stay his regression gate.

## When it is read

- Once, when the pool holds at least 30 labelled sets from at least 3 testers, or earlier on David's word, recorded here with its date.
- With `npm run exam:testers -- --record`. Every set read is written to `exposed.json` in the same commit and never scored again as an exam. From then on it joins `npm run scoreboard:blind`, a regression gate, never an exam.
- No counting change is chosen, tuned or compared on a set of the pool before that read. An agent that opens a set file of the pool before the read writes so here, and the read set leaves the pool.

## What is judged, fixed now

1. The core as it ships on the day of the read: exact, off by 3 or more, refused, and right when sure as the app ships (`test/real-phone/accuracy/sure.ts`). R16's aim is stated, not a pass mark: right when sure at least 90 %.
2. A candidate counter merged to `main` before the read (the learned counter's seed ensemble of the review board's item 3, or any other) is scored on the same read, on the same sets, against the core. It passes only if its exact count is at least the core's, it has no more sets off by 3 or more, and the paired exact test (McNemar, as `paired.ts`) is reported whatever it says. `tester-exam.mjs` scores the core only today: a candidate's score is added to it before the read, or the candidate is not judged on this pool.
3. With 30 sets one set is 3.3 points: a difference of one or two sets is reported as it is, never as a gain.

## Not decided here

- Whether a counter that passes is shown to users: that is a product card, with David's yes (METHOD.md, two lanes).
