# Keeping the sets: the words for David's approval (R10)

Written 2 October 2026, register "vous". Under David's standing order of 2 October they ship with the change;
David approves or corrects them, and a correction holds from then on.
Built in src/components/experience/KeepSets.jsx and keep-sets-view.js (history) and History.jsx (subtitle).

| Key | FR | EN | Where it appears |
|---|---|---|---|
| history.sub | Enregistrées sur ce téléphone, elles n’en sortent que si vous les partagez. | Saved on this phone, they leave it only if you share them. | History, under the title (replaces "Elles restent sur ce téléphone.") |
| keep.save | Sauvegarder | Back up | History, text button (read aloud: "Sauvegarder vos séries" / "Back up your sets") |
| keep.restore | Restaurer | Restore | History, text button (read aloud: "Restaurer une sauvegarde" / "Restore a backup") |
| keep.why | Sur iPhone, Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app. Ajoutez-la à l’écran d’accueil, ou gardez une sauvegarde. | On iPhone, Safari may erase your sets after seven days of use without opening the app. Add it to your home screen, or keep a backup. | History, under the two buttons, on an iPhone or iPad outside the home screen |
| keep.share.title | Sauvegarde de vos séries | Backup of your sets | Title handed to the share sheet |
| keep.share.failed | Le partage n’a pas abouti. Touchez à nouveau pour télécharger. | Sharing did not go through. Tap again to download. | Under the buttons, after a failed share |
| keep.download | Téléchargement de la sauvegarde lancé. | Download of the backup started. | Under the buttons, after a download |
| keep.restored | 2 séries restaurées. 1 était déjà sur ce téléphone. | 2 sets restored. 1 was already on this phone. | Under the buttons, after a restore (counts vary) |
| keep.unreadable | 1 série illisible n’a pas été restaurée. | 1 unreadable set was not restored. | Appended when the file holds damaged sets |
| keep.unlisted | Rouvrez vos séries pour les voir. | Open your sets again to see them. | Appended when the sets are written but the list could not be read again |
| keep.notbackup | Ce fichier n’est pas une sauvegarde de vos séries. | This file is not a backup of your sets. | When the file chosen is not a backup |
| keep.newer | Cette sauvegarde vient d’une version plus récente de l’app. Mettez l’app à jour, puis réessayez. | This backup comes from a newer version of the app. Update the app, then try again. | When the backup comes from a later version |
| keep.failed | La sauvegarde n’a pas pu être restaurée. Réessayez. | The backup could not be restored. Try again. | When the sets could not be written |

## Added 2 October 2026 (audit of the live path), for David's approval (R10)

| French | English | Where |
|---|---|---|
| Restaurer une sauvegarde | Restore a backup | First screen, under "Vos séries", when no set is on the phone |
| Ce fichier n’a pas pu être lu. S’il est dans iCloud, téléchargez-le, puis réessayez. | This file could not be read. If it is in iCloud, download it, then try again. | History, after a restore whose file the phone cannot read |
| 1 série n’a pas pu être restaurée. Réessayez. / N séries n’ont pas pu être restaurées. Réessayez. | 1 set could not be restored. Try again. / N sets could not be restored. Try again. | History, after a restore that stopped part-way, beside the sets restored |
| Votre accord est enregistré, mais cette série n’a pas pu être gardée sur ce téléphone. | Your choice is saved, but this set could not be kept on this phone. | Saved card, after "Oui, aider" when the phone refuses to keep the set |
| Votre niveau n’a pas pu être enregistré sur ce téléphone. | Your level could not be saved on this phone. | Saved card, after a level the phone refuses to store |
| Recharger la page | Reload the page | "L’analyse n’a pas pu démarrer.", in place of "Refilmer" |
