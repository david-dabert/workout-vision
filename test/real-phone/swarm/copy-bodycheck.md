# The body check on a counted set: the words for David's approval (R10)

Written 8 October 2026. When the joint the app counts does not move like the rest of the body
(src/lib/counting/bodyCheck.js, coreAnalysis.js withBodyCheck; agreement under 0.5), the result opens on the
low-confidence screen (05b) with the app's count as a number to confirm: never a silent count, never a grade, never a
measure (R8). The count read from the whole body (the spec-guided count) is not shown (decided 8 October, below); its
lines stay here for the day it is. The
pattern is the PSC proposal's (copy-proposal.md). Register "vous", glossary DIRECTIVES.md Part 7 (série, répétition);
the app is "l'appli", as on the rest of the result screen (copy-result.md). The strings live in
src/components/experience/result-copy.js. Status of every line: **approved by David (8 October 2026)**.

The cause speaks of the app's reading, never of the person's technique: the check measures where the app went wrong,
not how the set was done.

French typography as in the rest of the app: a no-break space (U+00A0) before ":".

| FR | EN | Where | Status |
|---|---|---|---|
| L'appli n'a pas pu compter cette série avec certitude. | The app could not count this set with certainty. | Title of the screen (the line already written for 05b, `notSure`, reused) | approved (8 October), reused |
| Sur cette série, l'angle {du coude / de l'épaule / du genou / de la hanche} ne bouge pas comme le reste de votre corps. L'appli a pu mal le lire. | In this set, the {elbow / shoulder / knee / hip} angle does not move like the rest of your body. The app may have misread it. | The cause, beside the circled "i" (`bodyCause`); "série", not "vidéo": a set counted live is checked too and has no video | approved (8 October) |
| Compté par l'appli : {N} | Counted by the app: {N} | Caps under the number when the whole body gives the same count, so there is one number to confirm (`bodyCounted`) | approved (8 October) |
| Deux comptes possibles | Two possible counts | Name of the two keys for screen readers (`bodyChoices`) | approved (8 October) |
| {N} D'après {le coude / l'épaule / le genou / la hanche} | {N} From the {elbow / shoulder / knee / hip} | First key: the app's count, read on the joint it follows (`byJoint`) | approved (8 October) |
| {M} D'après tout le corps | {M} From the whole body | Second key: the count read from the whole body (`byBody`) | approved (8 October) |
| Vérifiez ce nombre avant d'enregistrer. | Check this number before saving. | Under the number, while it is one of the app's counts unchanged (`bodyNote`) | approved (8 October) |
| Confirmer {N} répétitions / Confirmer 1 répétition | Confirm {N} reps / Confirm 1 rep | Primary key while the number is one of the app's counts unchanged (the proposal's line, `confirmN`, reused) | approved (8 October), reused |
| À confirmer | To confirm | Status line, left, while the number is one of the app's counts (reused) | approved (8 October), reused |

Unchanged on this screen: "Combien en avez-vous fait ?", the − and + keys, "Saisi par vous", "À vous de compter" and
"Enregistrer {N} répétitions" once the person gives another number, "Refilmer la série". Once saved: "Merci. Série
enregistrée sur votre téléphone." when the app's count is kept, "Compté par l'app : {N}. Corrigé : {M}." and "Merci.
Votre correction est notée sur votre téléphone." when another number is kept (the counted set's saved card, reused as
it stands: it says "l'app" where this screen says "l'appli", as other screens do; one word for the whole app is
David's call). Once saved, the screen shows no measure of the set (no rep cells, amplitude, tempo, short-rep mark, wave
or left against right) and the saved set keeps none, so the report and the history show none either: all are read on
the joint the check doubts (R8).

Questions for David:
- Decided 8 October, not a question: the second count is not shown (Result.jsx OFFER_BODY_SECOND = false). On the
  real-world sets it flags it was right 7 times in 79 where offered, the app's own count 19 times on the same sets
  (test/real-phone/accuracy/body-check.txt); on your videos it was right on both (chin-up 5, pendulum squat 7), on your
  stored back extensions on neither. It stays computed and saved with the set, to be measured again.
- (Kept for the day the second count is shown.) "D'après le genou" names the joint as a coach would, without the word
  "angle": is it clear enough beside "D'après tout le corps"?
