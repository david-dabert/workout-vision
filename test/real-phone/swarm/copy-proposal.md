# The app's proposal on a refused set: the words for David's approval (R10)

Written 8 October 2026. Where the core refuses a set, PSC's count (src/lib/counting/psc.js, coreAnalysis.js
withProposal) opens the low-confidence screen (05b) as a number to confirm: never a silent count, never a grade, never
a measure (R8, delegated decision of David, 8 October). Register "vous", glossary DIRECTIVES.md Part 7 (série,
répétition); the app is "l'appli", as on the rest of the result screen (copy-result.md). The strings live in
src/components/experience/result-copy.js. Status of every line: **pending David's approval (8 October 2026)**.

French typography as in the rest of the app: a no-break space (U+00A0) before ":".

| FR | EN | Where | Status |
|---|---|---|---|
| L'appli n'a pas pu compter cette série avec certitude. | The app could not count this set with certainty. | Title of the refused screen when a proposal is shown (the line already written for 05b, `notSure`, reused) | pending (7 October), reused |
| Proposition de l'appli : {N} | The app's proposal: {N} | Caps under the number, for as long as the proposal is on screen (also once the person changed the number, as a reminder) | pending (8 October) |
| L'appli propose ce nombre sans avoir bien vu le mouvement. Vérifiez-le avant d'enregistrer. | The app suggests this number without having seen the movement clearly. Check it before saving. | Under the label, while the number is the proposal unchanged | pending (8 October) |
| Confirmer {N} répétitions / Confirmer 1 répétition | Confirm {N} reps / Confirm 1 rep | Primary key while the number is the proposal unchanged: the tap that saves it | pending (8 October) |
| Merci. {N} répétitions enregistrées, confirmées par vous. / Merci. 1 répétition enregistrée, confirmée par vous. | Thank you. {N} reps saved, confirmed by you. / Thank you. 1 rep saved, confirmed by you. | Saved card after a confirmed proposal | pending (8 October) |
| À confirmer | To confirm | Status line, left, while the number is the proposal unchanged (the line of screen 05, reused) | pending (7 October), reused |

Unchanged on this screen: the cause and its fix (refusal.js, Result.jsx), "Combien en avez-vous fait ?", the − and +
keys, "Saisi par vous" and "Enregistrer {N} répétitions" once the person changes the number, "Refilmer la série", and
the saved card's "saisies à la main" for a number typed by the person.
