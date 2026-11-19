# 065. The result screen asks when the counted joint made full cycles the counter left out
Status: failed, 19 November 2026 (rule and eval fixed in 9cd9e62b before the first run; run once; does not ship; TRIED.md)
Executor: careful (Claude)
Phase: 1 (Phase 1 gate 3: none shown as sure off by 3 or more). Card 064's next change; bound by the avoidance rule of docs/metacognition-log.md (19 November 2026).
Claim: a set whose counted joint angle makes two or more full cycles outside every counted rep is asked to confirm, not shown as sure. No count changes.

## What the diagnosis found (`test/real-phone/sure-asks/diagnosis.txt`)
- Card 064's table counted a set as sure on the body check alone (`table.test.ts`, its `add`), not as the app ships. 8 of its 11 sets shown as sure and off by 3 or more are already asked by the app: 6 by the sensitivity check (`coreAnalysis.js` `sensitivityAsks`), 4 by pose doubt (`doubt.js`), 2 by both. Among them the one squat (CFRep `squat_diag_m3_12_0`, 9 for 12: recounts 10, 9, 10, 9, 11, 11 ask). Fixed in this branch: the table now reads sure as `sure.ts` does on every phone.
- As the app ships, 3 public build sets are shown as sure and off by 3 or more; none is a squat:
  - push-up, Countix `07eq1ZyNg_U_000018_0`, 5 for 11: the elbow makes a deep dip (to about 105 degrees, from 162) and a shallow one (to 137 to 147) in turn; the counter counts the 5 deep ones. Recounts all 5, coverage 1, body check agreement 0.62 (not flagged).
  - dumbbell row, MM-Fit `w13-dumbbell_rows-31581-31942`, 6 for 10: two cycles of 24 and 32 degrees in the 4.3 s before the first counted rep (counted reps about 45 degrees). Every check passes, the whole-set rule of card 018 too.
  - dumbbell row, MM-Fit `w13-dumbbell_rows-34932-35258`, 7 for 10: the open last rise marks it (`tailOpen`), which asks on David's #collecte phone only "until he chooses" (card 039). That choice is David's; this card does not make it, it only reports the measure.
- The two first share one mechanism: full cycles of the counted joint outside every counted rep, at roughly 40 % of a counted rep's range. Card 003 closed splitting such cycles into the count (they are more often a two-humped rep than two reps); card 039 closed counting cycles before the first rep (David's movements before a set come on the beat). Both were counting rules. This card only asks: a wrong question costs coverage, never a count.

## The rule (fixed here; experimental, R9)
On the core's smoothed angle of the counted joint (`summarizeCount` `smoothedAngles`), with at least 2 counted reps:
1. R: the median, over counted reps, of the angle's range (max minus min) inside the rep.
2. Orientation: the rep moves away from rest downward when the median over reps of (angle at the rep's start minus its minimum inside the rep) is at least the median of (its maximum inside the rep minus the angle at its start); upward otherwise.
3. Segments: the maximal runs of samples whose time is outside every counted rep's [startTime, endTime], over the whole clip (what the screen counts).
4. In each segment, cycles are counted by hysteresis on the oriented angle (deeper is higher): from the running low, a rise of at least P x R starts a cycle; from its running high, a return of at least P x R completes it. Lost samples are skipped. A cycle cut by the segment's edge does not count.
5. The screen asks when the cycles of all segments total K or more.
P = 0.4: the prominence card 039 used for shallow cycles before the first rep (40 % of the median rep), taken as it is; K = 2: one extra cycle can be the set-up or the rack (convention, UNSOURCED). Both are fixed here and are not moved after the first run. Disclosed: the two traces above were seen before P and K were fixed.
Not used for a both-sides lift's second side, a fitness test, a refused set or a set counted none.

## Eval (fixed here, before the first run)
Bench: `test/real-phone/sure-asks/uncounted.test.ts` (`SURE_ASKS=1`), on each suite: shown as sure as the app ships, then with this rule asking too; exact among them; off by 3 or more among them.
- Chosen on: the public build sets (Countix cut to its labelled window, CFRep, MM-Fit; 949 deciding as the scoreboard reads them). Passes there when: off by 3 or more while sure falls below 4; the exact share among the sure does not fall; the number shown as sure falls by at most 10 % (607 to no fewer than 547).
- Confirmed on: RepCount-A's build half (benchmark-only, another camera and population; read by no choice of this card; its held-out half stays sealed). Passes there when: off by 3 or more while sure does not rise; the exact share among the sure does not fall; the number shown as sure falls by at most 10 %.
- David's sets (tuning data, never chosen on): no count changes (`npm run scoreboard` before and after, R2); at most 1 of his 11 stored sets shown as sure and at most 1 of his 8 videos shown as sure turn to asked.
- `npm run scoreboard`, `scoreboard:public` and `synth` before and after, per-set diff pasted (R2).
- All of these, or the rule does not ship: it goes to TRIED.md with its numbers and a reopen condition.
- What a pass would prove: fewer wrong counts shown as sure on tuning data and on one other dataset. Phase 1 gate 3 ("none shown as sure off by 3 or more") is decided only by the sealed sets' exam.

Scope: `src/lib/coreAnalysis.js` (the cycles, a new field on the result), `Result.jsx` (asks), `test/real-phone/accuracy/sure.ts` (models it), the bench, card 064's table fix, TRIED.md, STATE.md. Not `src/lib/counting/`, not the scoreboard's gates.
Stop: if the eval fails, no second rule on these sets in this card.
Needs from David: nothing. The open last rise everywhere stays his choice (card 039).

## Result (19 November 2026, run once; `test/real-phone/sure-asks/uncounted.txt`)
- Public, as the scoreboard reads it (chosen on): off by 3 or more while sure 4 -> 0; exact among the sure 378 of 607 (62.3 %) -> 371 of 584 (63.5 %); shown as sure -3.8 %. Passes. The 23 sets turned to asked: 7 exact, 12 off by 1 or 2, 4 off by 3 or more.
- RepCount-A build (confirmation): off by 3 or more while sure 4 -> 1; exact share 53.8 % -> 57.1 %; shown as sure 39 -> 35, -10.3 % against the limit of 10 %. Fails, by less than one set.
- David's stored sets: 0 of 11 sure sets turned to asked. David's videos: 3 of 8 sure sets turned to asked, all exact (lying biceps curl, machine seated back extension, sissy squat), against the limit of 1. Fails. They are the three sets card 039 found with movements before the set on the set's beat.
- No count changed: `npm run scoreboard` (13 of 15 exact before and after), `scoreboard:public` (470 of 949 before and after, 0 became off by 3 or more) and `synth` identical before and after; the rule was never wired into the app (`src/` unchanged; the function lives in the bench, `uncounted.js`).
- Verdict: fails the card's eval on two of its three suites. Not shipped. No second rule on these sets (the card's stop).
- What it showed: on public video the rule finds what it was built for (all 4 errors of 3 or more shown as sure, at 3.8 % of the sure), and on RepCount-A it removes 3 of 4. On David's own videos, filmed rest to rest by one person with a phone, it costs most: his movements before a set come on the set's beat in the counted joint itself. The same wall as cards 018 and 039: what separates an error on public clips is what David does before and after every set.
