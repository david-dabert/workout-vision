# Feature A: progress per exercise and personal bests, the words for David's approval (R10)

Written 29 September 2026, register "vous". Not released until David approves them.
Built in src/components/experience/progress.js (the bests' words) and ExerciseProgress.jsx (the rest);
the record tag is in History.jsx. The count shown is the one the user kept (after any correction),
the load is the one entered in the manual log, in kg. No projection, no estimated maximum, no grade.
In the French lines the space before ":" and between a number and its unit is a no-break space.

| Key | FR | EN | Where it appears |
|---|---|---|---|
| progress.head | Vos progrès | Your progress | History, heading of the progress block, above the days |
| progress.first | Première série de cet exercice. | First set of this exercise. | History, progress block, an exercise with a single set (nothing else is shown for it) |
| progress.trend.sr | Répétitions de vos {n} dernières séries : {8, 10, 12}. | Reps in your last {n} sets: {8, 10, 12}. | History, progress block, read by VoiceOver in place of the bars (not shown) |
| progress.best.reps | Record : {n} répétitions (1 répétition) | Best: {n} reps (1 rep) | History, progress block, most reps in one set |
| progress.best.load | Charge max : {kg} kg × {n} | Heaviest: {kg} kg × {n} | History, progress block, heaviest load entered, with the reps of the set that first lifted it; only where a load is stored |
| progress.best.atLoad | Record à {kg} kg : {n} répétitions | Best at {kg} kg: {n} reps | History, progress block, most reps at one load, only for a load entered on two sets or more, not repeated when it is the heaviest set's own |
| history.tag.best | Record | Best | History, list of sets, tag on a set that holds one of the records above |

Questions for David:
- "Record" for the tag and the lines, as a coach says "votre record". "Meilleure série" is the alternative.
- "Charge max" is gym shorthand; "Charge la plus lourde" is the longer alternative.
