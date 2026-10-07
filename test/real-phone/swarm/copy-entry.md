# Copy for the entry screen, À propos and the drawn example (design review C2, 7 October 2026)

For David's approval, French and English. Register: vous (R10). **Status: pending David.** Nothing here is "done"
until David has read it on his iPhone (R3).

Decisions taken by David's delegate on 7 October 2026, applied in this change: the entry says what the app does
first; "Votre corps est un temple." moves to the head of À propos; the drawn example shows no rep times.

## New or changed strings

| Key | FR | EN | Where | Was (FR / EN) |
|---|---|---|---|---|
| entry.title | Filmez votre série. | Film your set. | Entry, serif headline (Entry.jsx, COPY.title) | Votre corps est un temple. / Your body is a temple. |
| entry.line | L’appli compte vos répétitions, sur votre téléphone. | The app counts your reps, on your phone. | Entry, under the headline (COPY.line) | Il est ici observé avec soin. / Here it is observed with care. |
| entry.privacy | La vidéo reste sur votre téléphone. | The video stays on your phone. | Entry, beside the lock (COPY.privacy) | Rien ne quitte votre téléphone sans votre accord. / Nothing leaves your phone unless you share it. |
| entry.privacy (counts on) | La vidéo reste sur votre téléphone. | The video stays on your phone. | Same place, when the build sends anonymous counts (COUNTED, eventsActive()) | Votre vidéo ne quitte votre téléphone que si vous la partagez. / Your video leaves your phone only if you share it. |
| entry.start | Commencer | Start | Entry, primary key: leads to the choice of exercise, not the camera | Entrer / Enter |
| entry.credit | Conçue à Bordeaux par David Dabert › | Made in Bordeaux by David Dabert › | Entry, foot: opens À propos | (new) |
| about.lead | Votre corps est un temple. | Your body is a temple. | À propos, serif opening line at the head of David's story, after the title (about-copy.js, lead) | (moved from the entry) |

Unchanged but re-placed: "Version de test" / "Test version" (entry status line, now plain caps text on the
2 px rule, no pill) and "Voir un exemple" / "See an example" (now a full-width outlined key, 58 pt).

## Removed strings

| Key | FR | EN | Why |
|---|---|---|---|
| demo.times | Durée de chaque répétition | Time of each rep | The drawn example's rep times are times of an animation, not measures of a person (R8). |
| (demo) experimental label | Mesures expérimentales : estimées par l’app, pas encore validées. | Experimental measures: estimated by the app, not yet validated. | Removed from the drawn example only, with the times it labelled; still shown beside measures on real sets. |
| entry line 2 | Il est ici observé avec soin. | Here it is observed with care. | Replaced by entry.line. |

## Notes for David

- "Votre corps est un temple." reopens copy you had approved on the entry (Entry.jsx). It is not deleted: it now
  opens your story on À propos. Your call (R10).
- "Commencer", not "Filmer une série": the key leads to the choice of exercise, not to the camera.
- The privacy line is true whether the anonymous count events are on or off: it speaks of the video only.
- "Conçue" agrees with "l’appli" (feminine). If you prefer "Conçu à Bordeaux", say so.
