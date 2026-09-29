# Copy for feature B: the example on the entry screen

For David's approval, French and English. Register: vous. Nothing ships until approved.
`N` is the count the counting core gives for the example set (5 today, see demo.test.js).

| Key | FR | EN | Where |
|---|---|---|---|
| entry.demo | Voir un exemple | See an example | Entry, under Enter (Entry.jsx, COPY[6]) |
| demo.tag | Exemple | Example | Example screen, pill top right; also the screen's accessible name |
| demo.close | Fermer l’exemple | Close the example | Example screen, close button (accessible label only) |
| demo.eyebrow | Squat dessiné | Drawn squat | Example screen, above the text |
| demo.sub | Un squat dessiné pour l’exemple, compté par l’app comme votre série le sera. | A squat drawn for the example, counted by the app as your set will be. | Example screen, under the eyebrow |
| demo.word (1) | Répétition | Rep | Under the counter, 0 or 1 rep (FR: 0 and 1 singular) |
| demo.word (n) | Répétitions | Reps | Under the counter, 2 reps or more |
| demo.done | Fin de série : N répétitions comptées. | End of set: N reps counted. | End of the example, above the rep times; read out by VoiceOver |
| demo.done (1) | Fin de série : 1 répétition comptée. | End of set: 1 rep counted. | Same, if the count were 1 |
| demo.times | Durée de chaque répétition | Time of each rep | End of the example, above the rep times |
| demo.go | À vous | Your turn | End of the example, main button: goes on to the choice of lift |
| demo.again | Revoir l’exemple | Watch again | End of the example, second button (not shown under Reduce Motion) |

Rep times are written as the core measures them, one decimal, French comma: `1,9 s` / `1.9 s`.
