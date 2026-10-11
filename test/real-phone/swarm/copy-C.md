# C: the opener and the rest clock, new copy for David's approval (CLAUDE.md R10)

Drafted 29 September 2026. Register: vous. Nothing here is released before David approves it.
{n} is the count, {k} the number of reps marked ▾. The opener is built in src/components/experience/set-opener.js,
the rest clock in RestClock.jsx and rest-clock.js.

## C1. The opener: one sentence that sums up the set

It measures nothing new: the count, and what set-account.js already derives (the ▾ reps at the 85 % threshold,
experimental; the slowdown from four whole reps). It states one fact, the first that holds, in this order:
a correction, no rep, the ▾ reps, the slowdown, none shorter, the count alone.
No opener on a refused set or an unknown count (rule 8). Design pass, 29 September: shown on the coach report only; the result screen's numeral and account already say it. In the report, under the title, on the screen and on the PDF.

| key | FR | EN | where |
|---|---|---|---|
| opener.corrected | Vous avez compté {n} répétitions. (1 répétition) | You counted {n} reps. (1 rep) | result after a saved correction; report of a corrected set |
| opener.corrected.zero | Vous n’avez compté aucune répétition. | You counted no reps. | same, corrected to 0 |
| opener.none | Aucune répétition comptée. | No reps counted. | result and report, app counted 0 |
| opener.short.one | {n} répétitions, dont une plus courte que les autres. | {n} reps, one of them shorter than the others. | result and report |
| opener.short.many | {n} répétitions, dont {k} plus courtes que les autres. | {n} reps, {k} of them shorter than the others. | result and report |
| opener.slower | {n} répétitions, les deux dernières plus lentes que les deux premières. | {n} reps, the last two slower than the first two. | result and report, four whole reps or more |
| opener.faster | {n} répétitions, les deux dernières plus rapides que les deux premières. | {n} reps, the last two faster than the first two. | same |
| opener.same | {n} répétitions, les deux dernières aussi rapides que les deux premières. | {n} reps, the last two as fast as the first two. | same |
| opener.even | {n} répétitions, aucune plus courte que les autres. | {n} reps, none shorter than the others. | result and report, two or three whole reps |
| opener.count | Série de {n} répétitions. | A set of {n} reps. | set without rep details (entered by hand, older sets) |
| opener.count.one | Série d’une répétition. | A set of one rep. | same, one rep |

## C2. The rest clock

It counts the rest up from the moment the set is saved (a tap restarts it after a stop) and sets no length, so it makes no claim (the "Conseils généraux" note on rest stays
as approved). On the result screen, in the saved card under "Merci", above the report and the challenge.

| key | FR | EN | where |
|---|---|---|---|
| rest.start | Lancer le repos | Start rest | result, button, after the clock was stopped (the clock also runs when the phone could not save the set) |
| rest.label | Repos | Rest | result, above the running clock |
| rest.stop | Arrêter le repos | Stop rest | result, button under the clock |
| rest.spoken | 1 minute 30 secondes (heure, minute, seconde; zéro et un au singulier) | 1 minute 30 seconds (hour, minute, second) | result, read by screen readers in place of 1:30 |
