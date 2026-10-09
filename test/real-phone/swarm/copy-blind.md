# The blind question on the analysis screen: the words, awaiting David's approval (R10)

Written 9 October 2026 (pillar 1 of David's order of 9 October: "ask 'how many did you do?' before showing the app's
count; that answer is a blind label"). While the video is read, the person gives their count; the app's count waits
for the answer (src/lib/blind.js, src/components/experience/BlindAsk.jsx, CoreUpload.jsx). Shown only on a phone
carrying the #collecte flag, that is David's phone, so he reads every line in place before anyone else sees it.
Register "vous", glossary DIRECTIVES.md Part 7; the app is "l'appli", as on the result screen (copy-result.md). The
strings live in src/components/experience/blind-copy.js.

French typography as in the rest of the app: a no-break space (U+00A0) before "?".

| FR | EN | Where | Status |
|---|---|---|---|
| Combien en avez-vous fait ? | How many did you do? | The question, under the progress (the result screen's line, `howMany`, reused) | approved 9 October 2026, reused |
| L'appli affiche son compte après votre réponse. | The app shows its count after your answer. | Under the number | pending (9 October) |
| Valider | Done | Primary key, inactive until a number is chosen | pending (9 October) |
| Je ne sais pas | I don't know | Second key, always active: the set then carries no blind count | pending (9 October) |
| Nombre de répétitions | Number of reps | Spoken name of the number field (the result screen's, reused) | approved 9 October 2026, reused |
| Aucun nombre choisi | No number chosen | Spoken while no number is chosen (the result screen's, reused) | approved 9 October 2026, reused |
| Une de moins / Une de plus | One fewer / One more | Spoken names of − and + (the result screen's, reused) | approved 9 October 2026, reused |

After the answer, the result screen uses only approved lines: equal to the app's count, "C'est bien {N} ?" and "Oui,
{N} répétitions"; different, "Combien en avez-vous fait ?", the person's number with "Saisi par vous", "Compté par
l'appli : {N}." and "Enregistrer {N} répétitions"; on a refused set, the person's number in the slot, the app's
proposal still labelled "Proposition de l'appli : {N}".
