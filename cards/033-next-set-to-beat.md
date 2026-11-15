# 033. The next set to beat, by load and reps
Status: ready (after 032)
Executor: careful
Claim: After a saved set with its load, the saved screen names the next set to beat from the person's own history, labelled as a goal (« Objectif »), never as a measurement (R8).
Reference: STATE.md, the promise "What to do next": not kept. Card 011 names the record to beat as a count only. Double progression, accepted coaching practice: keep the load and add a rep until the top of a rep range, then add the smallest load step and start again at the bottom of the range. R9 status: convention; the range (8 to 12 reps) and the step (2.5 kg) are stated in code as UNSOURCED conventions David may change.
Eval, fixed before any code:
1. Unit tests on history fixtures: best at 60 kg is 9 reps: « Objectif : 10 répétitions à 60 kg »; best at 60 kg is 12 reps: « Objectif : 8 répétitions à 62,5 kg »; no load ever saved: card 011's line, unchanged; a single set: that set plus one rep.
2. An e2e test: a set saved with a load shows the goal line; a set saved without one shows card 011's line.
3. No goal line on a refused set or a count still to confirm (R8).
4. Screenshots at 390x844.
Baseline: no such line; card 011 shows « Votre record : N. À battre à la prochaine série. » from counts only.
Scope: `src/components/experience/moment.js` (the saved line), its tests, `result-copy.js`, the e2e test. It reads only loads the person saved (card 032).
Stop: if the line could name a load the person never entered, the rule is wrong.
Needs from David: his check on the iPhone (R3); he may change the range or the step.
