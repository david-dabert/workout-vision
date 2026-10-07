# Result screen in the final direction: the words for David's approval (R10)

Written 7 October 2026 (C4 of the design review, final direction "Le noir mesure, le papier se souvient", screens 05,
05b and 05c), register "vous", glossary DIRECTIVES.md Part 7 (série, répétition). The app is called "l'appli", as the
direction asks; the lines kept from before still say "l'app" (see the last table). Status of every new or changed line:
**pending David's approval (7 October 2026)**. The strings live in src/components/experience/result-copy.js, apart
from the refused screen's causes and fixes, which are unchanged in Result.jsx.

French typography as in the rest of the app today: a no-break space (U+00A0) before "?" and ":" and between a number
and its unit. The direction's narrow no-break space (U+202F) comes with step 4 of its build order (C3), for every
screen at once.

## Counted set, to confirm (screen 05)

| FR | EN | Where | Status |
|---|---|---|---|
| À confirmer | To confirm | Status line, left, with a gold ring; and under the numeral at reading size | pending (7 October) |
| {exercice} · Série {k} / {n} | {exercise} · Set {k} / {n} | Status line, right, for a set filmed from a programme | pending (7 October) |
| {exercice} · {bras droit…} | {exercise} · {right arm…} | Status line, right, without a programme (the limb words already approved) | pending (7 October) |
| C'est bien {N} ? | Was it {N}? | Serif question over the numeral, until the count is confirmed | already approved (the former card's question), moved |
| Compté par l'appli sur votre vidéo de {s} s. | Counted by the app on your {s} s video. | Under the numeral; {s} is the video's measured length | pending (7 October) |
| Compté par l'appli sur votre vidéo. | Counted by the app on your video. | The same, when the length could not be read | pending (7 October) |
| Compté par l'appli en direct, sur {s} s. / Compté par l'appli en direct. | Counted by the app live, over {s} s. / Counted by the app live. | The same, for a set counted live (no video is recorded) | pending (7 October) |
| Oui, {N} répétitions / Oui, 1 répétition | Yes, {N} reps / Yes, 1 rep | Primary key; replaces "Oui, c'est juste" | pending (7 October) |
| Revoir la vidéo | Watch the video again | Second key, opens the replay | pending (7 October) |
| Revoir la série | Replay the set | Second key for a set counted live (the replay shows the skeleton only) | pending (7 October) |

## Count changed with − or + (screen 05, corrected)

| FR | EN | Where | Status |
|---|---|---|---|
| Combien en avez-vous fait ? | How many did you do? | Serif question once the number is the person's | already approved, moved |
| Saisi par vous | Typed by you | Caps under a typed number (05c), and under a corrected count | pending (7 October) |
| Compté par l'appli : {N}. | Counted by the app: {N}. | Under a changed count, before it is saved | pending (7 October) |
| Enregistrer {N} répétitions / Enregistrer 1 répétition | Save {N} reps / Save 1 rep | Primary key once the number is the person's; replaces "Enregistrer" | pending (7 October) |
| Une de moins / Une de plus | One fewer / One more | − and + keys, read aloud only | already approved |

The "Non" key is gone: − and + sit beside the numeral, and the number is the person's as soon as they change it.

## After "Oui" (saved)

| FR | EN | Where | Status |
|---|---|---|---|
| Enregistré | Saved | Status line and under the numeral, with a filled square (the ring fills in 240 ms) | pending (7 October) |

Everything else on the saved screen (thanks, rest clock, Nouvelle série, Changer d'exercice, Rapport de séance, Défier
un ami, the level and contribution questions) is unchanged.

## The day's table, for a set filmed from a programme

| FR | EN | Where | Status |
|---|---|---|---|
| Aujourd'hui | Today | Table head, caps | pending (7 October) |
| Prévu : {n} séries de {r} / Prévu : 1 série de {r} | Planned: {n} sets of {r} / Planned: 1 set of {r} | Table head, right | pending (7 October) |
| Série {k} | Set {k} | Row name | pending (7 October) |
| confirmée | confirmed | Row word: a set the person confirmed as counted | pending (7 October) |
| à confirmer | to confirm | Row word: the set on screen | pending (7 October) |
| corrigée | corrected | Row word: a set whose count the person changed | pending (7 October) |
| saisie | typed | Row word: a set typed by hand after a refusal | pending (7 October) |
| prévu {r} | planned {r} | Row value of a set still to do, at caption size, never in gold | pending (7 October) |

## Low confidence (screens 05b and 05c)

Shown when the app refused the set, counted no rep in it, or (live) its final count is not the one the live screen
showed. No new threshold: the app's own signals only.

| FR | EN | Where | Status |
|---|---|---|---|
| À vous de compter | Your count | Status line, left, with a ring in the text colour | pending (7 October) |
| L'appli n'a pas pu compter cette série. | The app could not count this set. | Headline, refused set or no rep found; replaces "Nous n'avons pas pu compter cette série." | pending (7 October) |
| L'appli n'a pas pu compter cette série avec certitude. | The app could not count this set with certainty. | Headline, live count not the final one | pending (7 October) |
| L'appli n'a trouvé aucune répétition dans cette série. Elle ne peut pas dire si la série était vide ou si elle a manqué vos répétitions. | The app found no rep in this set. It cannot tell whether the set was empty or it missed your reps. | Cause line, no rep found | pending (7 October) |
| En direct, l'appli affichait {n}. En relisant toute la série, elle ne trouve pas le même nombre. | Live, the app showed {n}. Reading the whole set again, it does not find the same number. | Cause line, live count not the final one; replaces "En direct, l'app affichait {n}. Le compte final relit toute la série." | pending (7 October) |
| Touchez un nombre, ou corrigez avec – et +. (no-break spaces around « et ») | Tap a number, or adjust with – and +. | Under the empty slot, with quick keys | pending (7 October) |
| Touchez le tiret pour saisir le nombre, ou utilisez – et +. | Tap the dash to type the number, or use – and +. | Under the empty slot, with no quick keys (no plan, no previous set) | pending (7 October) |
| Votre programme prévoit {r}. | Your programme plans {r}. | Under the quick keys, centred on the plan | pending (7 October) |
| Votre série précédente : {n}. | Your previous set: {n}. | Under the quick keys when there is no plan: they are centred on the person's last set of this exercise | pending (7 October) |
| Aucun nombre choisi | No number chosen | Read aloud only, while the slot shows "–" | pending (7 October) |
| Enregistrer | Save | Primary key, dashed and inactive until a number is chosen | already approved |
| Refilmer la série | Record the set again | Second key; replaces "Refilmer" | pending (7 October) |
| à vous de compter | your count | Row word in the day's table (after the save the row takes its saved word) | pending (7 October) |

The refused set's causes ("Votre bras droit est sorti du cadre…") and fixes ("Placez-vous au centre de l'image…") are
the approved lines, unchanged; they now stand together in the cause block. "La correction", "Hors cadre" and
"Saisir mon nombre" are no longer shown: the count by hand is offered at once.

## Lines kept as they were, still saying "l'app"

"Compté par l'app : {N}. Corrigé : {M}." (saved card), "Mesures expérimentales : estimées par l'app, pas encore
validées." (under the cells), the support links. For David to decide whether they move to "l'appli" with C3.
