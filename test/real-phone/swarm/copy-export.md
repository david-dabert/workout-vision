# Export of the saved sets as spreadsheet files, the words for David's approval (R10)

Written 30 September 2026, register "vous". Not released until David approves them.
Built in src/components/experience/sets-csv.js (the files) and ExportSets.jsx (the action in the history).
In French the files use ";" between fields and the decimal comma; in English "," and the decimal point.
Both are UTF-8 with a byte order mark, so Excel reads the accents. In the French lines, the space before ":" is a no-break space.

## The action and its messages (History, under the subtitle, only when a set is saved)

| Key | FR | EN | Where it appears |
|---|---|---|---|
| export.action | Exporter vos séries | Export your sets | History, the text button under the subtitle |
| export.share.title | Vos séries | Your sets | Title handed to the share sheet with the files |
| export.done.two | Téléchargement lancé : vos séries et le détail des répétitions. | Download started: your sets and the rep-by-rep detail. | Under the action, after a download (no share sheet for files); the app cannot know what the browser saved |
| export.share.failed | Le partage n’a pas abouti. Touchez à nouveau pour télécharger vos fichiers. | Sharing did not go through. Tap again to download your files. | Under the action, when the share sheet failed or an earlier one never answered |
| export.done.one | Téléchargement de vos séries lancé. | Download of your sets started. | Same, when no set holds measured reps |
| export.error | L’export n’a pas pu être préparé. Réessayez. | The export could not be prepared. Try again. | Under the action, if the files could not be built |

## File names (ASCII, the day of the export)

| Key | FR | EN |
|---|---|---|
| export.file.sets | series-AAAA-MM-JJ.csv | sets-YYYY-MM-DD.csv |
| export.file.reps | repetitions-AAAA-MM-JJ.csv | reps-YYYY-MM-DD.csv |

## Columns of the sets file (one row per set, oldest first)

| Key | FR | EN | Content |
|---|---|---|---|
| col.date | Date | Date | Saved time in the phone's time zone, 2026-09-30 14:05:00, which spreadsheets read as a date |
| col.exercise | Exercice | Exercise | Exercise name in the phone language (exercise-info.js, else the history's naming) |
| col.reps | Répétitions | Reps | The count kept by the user (after any correction) |
| col.counted | Comptées par l’app | Counted by the app | countedBy() in sets.js; empty on a set entered by hand |
| col.corrected | Corrigée | Corrected | oui / non (yes / no): the app's count differs from the kept count, as the history's tag; empty on a set entered by hand |
| col.confirmed | Confirmée | Confirmed | oui / non (yes / no): confirmed() in progress.js |
| col.load | Charge (kg) | Load (kg) | The load entered, only when above 0 (storedLoad() in progress.js) |
| col.duration | Durée (s) | Duration (s) | The stored duration of the set, one decimal, only when above 0 |
| col.tempo | Tempo moyen | Average tempo | setTempo() in tempo.js, the set tempo of the result screen and the report, whole seconds, e.g. 2-1-1-0; only for reps measured with step 3c (repDetailsVersion 2) |
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

Wording:
Decided 30 September (David delegated the wording): "Exporter vos séries", without "(CSV)"; "Vitesse max",
as the gym says it. The separator and decimal mark follow the phone's locale, the words the app's language.
- "Corrigée" and "Confirmée" agree with "série"; "Comptées par l’app" with "répétitions".
