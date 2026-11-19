# 064. Each offered exercise has one row saying how reliably it is counted, measured
Status: in progress
Executor: careful (Claude)
Phase: 1 (measurement only; no screen, no count). It serves David's product decision of 19 November 2026 (PLAN.md, top section), priority 1.
Claim: David, a coach or a physiotherapist can read, for every exercise the app offers, how many labelled sets it was measured on, how often its count was exact, and whether it passes; the app may later call an exercise reliable only where its row passes (R8).
Reference: human labels only (R1): David's labelled sets and videos on disk, David's phone files (`test/real-phone/phone-poses/`), the build halves of the public datasets (Countix cut to its labelled window, CFRep, MM-Fit). Synthetic sets (`test/real-phone/synth/sets/`) are shown beside, against their rendered truth, and decide nothing. Sealed sets and held-out halves are not read.
Eval: `npm run reliability` writes `test/real-phone/reliability/reliability.md`. One row per exercise as the data names it: its tier in the app (`src/lib/offer.js`, `tierOf`), labelled sets, exact, off by 3 or more (a refusal counts as a set not counted, not as off by 3), refused, exact share with its 95 % Wilson interval; among the sets the app shows as sure (`sure.ts`, as the app ships), how many and how many exact or off by 3 or more; synthetic samples and exact. A summary line: of the offered exercises, how many have at least one labelled set, and how many pass.
Status rule, fixed here before the table's first run (the thresholds of Phase 1's gate, PLAN.md, 15 November 2026; convention of this project, not a published bar):
- not measured: no labelled set;
- too few: fewer than 20 labelled sets that decide (a press set decides nothing, PLAN.md);
- fails: among the sets shown as sure, fewer than 9 in 10 exact, or any shown as sure off by 3 or more;
- passes on tuning data, exam pending: otherwise. No row reads "reliable": every set read here is tuning data (PLAN.md, THE DATA), and the lift rule asks for sets never seen. A row turns reliable only through the exam of sealed sets.
Baseline: never run.
Scope: a new bench under `test/real-phone/reliability/`, one script in package.json, this card, cards/README.md, STATE.md. Not `src/`, not the tiers, not the scoreboard's gates.
Stop: the table is the deliverable whatever it shows; no threshold is moved after the first run.
Loop (docs/OPERATING-LOOP.md): the defect does not live on David's phone (it is a missing measure); stored data only; nothing phone-facing.
Needs from David: nothing for the table. More rows pass only with more labelled sets: his and the testers' blind counts, and the sealed sets of Phase 1's gate.
