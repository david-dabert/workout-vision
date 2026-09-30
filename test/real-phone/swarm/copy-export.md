# Export of the saved sets as spreadsheet files, the words for David's approval (R10)

Written 30 September 2026, register "vous". Not released until David approves them.
Built in src/components/experience/sets-csv.js (the files) and ExportSets.jsx (the action in the history).
In French the files use ";" between fields and the decimal comma; in English "," and the decimal point.
Both are UTF-8 with a byte order mark, so Excel reads the accents. In the French lines, the space before ":" is a no-break space.

## The action and its messages (History, under the subtitle, only when a set is saved)

| Key | FR | EN | Where it appears |
|---|---|---|---|
| export.action | Exporter vos séries (CSV) | Export your sets (CSV) | History, the text button under the subtitle |
| export.share.title | Vos séries | Your sets | Title handed to the share sheet with the files |
| export.done.two | Deux fichiers téléchargés : vos séries et le détail des répétitions. | Two files downloaded: your sets and the rep-by-rep detail. | Under the action, after a download (no share sheet for files) |
| export.done.one | Fichier de vos séries téléchargé. | Your sets file downloaded. | Same, when no set holds measured reps |
| export.error | L’export n’a pas pu être préparé. Réessayez. | The export could not be prepared. Try again. | Under the action, if the files could not be built |

## File names (ASCII, the day of the export)

| Key | FR | EN |
|---|---|---|
| export.file.sets | series-AAAA-MM-JJ.csv | sets-YYYY-MM-DD.csv |
| export.file.reps | repetitions-AAAA-MM-JJ.csv | reps-YYYY-MM-DD.csv |

## Columns of the sets file (one row per set, oldest first)

| Key | FR | EN | Content |
|---|---|---|---|
| col.date | Date | Date | Saved time, ISO 8601 in the phone's time zone with its offset |
| col.exercise | Exercice | Exercise | Exercise name in the phone language (exercise-info.js, else the history's naming) |
| col.reps | Répétitions | Reps | The count kept by the user (after any correction) |
| col.counted | Comptées par l’app | Counted by the app | countedBy() in sets.js; empty on a set entered by hand |
| col.corrected | Corrigée | Corrected | oui / non (yes / no): the app's count differs from the kept count, as the history's tag; empty on a set entered by hand |
| col.confirmed | Confirmée | Confirmed | oui / non (yes / no): confirmed() in progress.js |
| col.load | Charge (kg) | Load (kg) | The load entered, only when above 0 (storedLoad() in progress.js) |
| col.duration | Durée (s) | Duration (s) | The stored duration of the set, one decimal, only when above 0 |
| col.tempo | Tempo moyen | Average tempo | averageTempo() in set-account.js, e.g. 2-0-1-1; only for reps measured with step 3c (repDetailsVersion 2) |
| col.speed | Variation de vitesse concentrique (%) | Concentric speed change (%) | setMeasures().speedChange in report-sheet.js; only with four whole reps |
| val.yes / val.no | oui / non | yes / no | |

## Columns of the reps file (one row per measured rep; given only when a set holds reps measured with step 3c)

| Key | FR | EN | Content |
|---|---|---|---|
| rcol.date | Date de la série | Set date | Same time as the set's row |
| rcol.exercise | Exercice | Exercise | |
| rcol.rep | Rép. | Rep | Rep number |
| rcol.range | Amplitude (°) | Range (°) | Whole degrees, as in the report |
| rcol.conc | Concentrique (s) | Concentric (s) | Two decimals; empty on a rep the video cut |
| rcol.ecc | Excentrique (s) | Eccentric (s) | Two decimals; empty on a rep the video cut |
| rcol.peak | Vitesse max (°/s) | Peak speed (°/s) | Whole °/s; empty on a rep the video cut |
| rcol.mean | Vitesse moyenne (°/s) | Mean speed (°/s) | Whole °/s; empty on a rep the video cut |
| rcol.cut | Coupée par la vidéo | Cut by the video | oui / non (yes / no): the video starts or ends inside the rep |

Questions for David:
- "Exporter vos séries (CSV)": "CSV" speaks to coaches and experts; "Exporter pour votre coach" is the warmer alternative, but the files serve the user too.
- "Vitesse max" is gym shorthand; "Vitesse de pointe" is the alternative (the report's table says "Pic").
- "Corrigée" and "Confirmée" agree with "série"; "Comptées par l’app" with "répétitions".
