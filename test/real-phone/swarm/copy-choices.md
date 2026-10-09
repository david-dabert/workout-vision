# The count's two neighbours in one tap: the words, awaiting David's approval (R10)

Written 9 October 2026 (pillar 2 of David's order of 9 October: "the right number recorded in one tap at most").
On a counted set, under "Oui, {N} répétitions", the two neighbours of the count, each saved in one tap
(src/components/experience/result-choices.js, Result.jsx). Shown only on a phone carrying the #collecte flag, so David
sees it in place first. Low-confidence screens are unchanged. The strings live in src/components/experience/result-copy.js.

| FR | EN | Where | Status |
|---|---|---|---|
| Ou : | Or: | Label before the two keys | pending (9 October) |
| {N-1} / {N+1} | {N-1} / {N+1} | The two keys, in numeric order; each spoken "Enregistrer {N} répétitions" (`saveN`, approved 9 October 2026) | numbers only |

What it measures (test/real-phone/accuracy/choices.txt, 9 October 2026): on 1177 real-world labelled sets the number
shown is exact on 560 (47.6 %) and the label is in [N, N+1, N-1] on 915 (77.7 %); with each Countix clip counted once,
379 and 586 of 730 (51.9 % and 80.3 %). Not measured: how often a tap on a neighbour saves a wrong number when N was
right. That needs blind counts (pillar 1).
