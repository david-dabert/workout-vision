# A count the sensitivity check moved: the words, awaiting David's approval (R10)

Written 10 October 2026 (stability study). After the count, the app recounts the set with nearby settings
(coreAnalysis.js withSensitivity: the threshold margin ×0.9, ×1 and ×1.1, each with the outlier window of 7 and of 9
samples). When a recount gives another number, the count stands on a knife edge of the counter's own settings, and the
result screen shows it as one to confirm, as it shows a count the body check flags: no grade, no measure (R8). Shown
only on a phone carrying the #collecte flag, so David reads it in place first. The string lives in
src/components/experience/result-copy.js.

| FR | EN | Where | Status |
|---|---|---|---|
| Sur cette série, le compte de l'appli est fragile : relu avec des réglages voisins, il change. | In this set, the app's count is fragile: read with nearby settings, it changes. | The cause line of the low-confidence screen | pending (10 October) |

Everything else on that screen is approved: "L'appli n'a pas pu compter cette série avec certitude.", "Compté par
l'appli : {N}", "Vérifiez ce nombre avant d'enregistrer.", "Confirmer {N} répétitions", − and +, "Refilmer la série".

What it measures (test/real-phone/stability/stability.txt and test/real-phone/accuracy/choices.txt, 10 October 2026):
- David's 14 videos read from six encodings, counted reads with the body check left aside: wrong counts shown as sure
  45 without the check, 14 with it; right counts shown as sure 20 and 12 (8 right counts ask instead).
- Public counted sets that decide: it marks 107 of 833 (73 wrong, 34 exact) and catches 18 of the 29 counts off by 3
  or more.
- Real-world sets (1177): the counts the app shows as sure are exact 59.2 % with it (789 sets) against 55.6 %
  without (894 sets); 296 sets ask against 191.

The decision is David's: more questions on the screen (R8) against fewer wrong numbers shown as sure.
