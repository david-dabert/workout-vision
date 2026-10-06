# Collecting David's sets from the result screen: the words for David's approval (R10)

Written 6 October 2026, register "vous". Shown on David's phone only, once the app was opened at #collecte
(src/lib/phoneCollect.js). Built in src/components/experience/collect-copy.js (one place), shown by Choice.jsx
(confirmation line) and CollectHistory.jsx (history section). David approves or corrects them; a correction holds from
then on.

| Key | FR | EN | Where it appears |
|---|---|---|---|
| on | Collecte activée sur ce téléphone : chaque série gardée garde aussi son fichier de repères. | Collection is on for this phone: each set you keep also keeps its landmark file. | First screen, one line, after opening the app at #collecte |
| off | Collecte désactivée sur ce téléphone. | Collection is off for this phone. | First screen, one line, after opening the app at #collecte-off |
| failed | Ce téléphone n’a pas pu enregistrer le réglage de la collecte. | This phone could not store the collection setting. | First screen, when the phone refuses to store the switch |
| title | Séries collectées | Collected sets | History, section heading (flag on only) |
| none | Aucune série collectée pour l’instant. | No collected set yet. | History, when no file waits |
| send | Envoyer les séries collectées (3) | Send collected sets (3) | History, text button; the number is the files waiting |
| shareTitle | Séries collectées | Collected sets | Title handed to the share sheet |
| shared | 3 séries partagées. Les effacer de ce téléphone ? / 1 série partagée. Les effacer de ce téléphone ? | 3 sets shared. Clear them from this phone? / 1 set shared. Clear them from this phone? | History, after the share sheet closes on a share |
| downloaded | 3 fichiers téléchargés. Les effacer de ce téléphone ? / Fichier téléchargé. Les effacer de ce téléphone ? | 3 files downloaded. Clear them from this phone? / File downloaded. Clear them from this phone? | History, after the download fallback |
| clear | Effacer | Clear | History, text button after a share or download |
| keep | Garder | Keep | History, text button after a share or download |
| cleared | Séries collectées effacées de ce téléphone. | Collected sets cleared from this phone. | History, after "Effacer" |
| kept | Les séries restent sur ce téléphone. | The sets stay on this phone. | History, after "Garder" |
| shareFailed | Le partage n’a pas abouti. Touchez à nouveau pour télécharger. | Sharing did not go through. Tap again to download. | History, after a share that failed (same words as the backup) |
| readFailed | Les séries collectées n’ont pas pu être lues. Rouvrez vos séries pour réessayer. | The collected sets could not be read. Open your sets again to retry. | History, when the stored files cannot be read |
| clearFailed | Les séries n’ont pas pu être effacées. Réessayez. | The sets could not be cleared. Try again. | History, when clearing fails |
