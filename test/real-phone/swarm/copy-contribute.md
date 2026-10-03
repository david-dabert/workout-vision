# Helping improve the count: the words for David's approval (R10)

Written 2 October 2026, register "vous". Under David's standing order of 2 October they ship with the change;
David approves or corrects them. All are in src/components/experience/contribute-copy.js.

| Key | FR | EN | Where it appears |
|---|---|---|---|
| ask | Aider à améliorer le comptage ? | Help improve the count? | Saved card, once, when the level is known and the person has not answered |
| what | À chaque série, l’app garde sur ce téléphone son comptage, le vôtre, la position de vos articulations au fil de la série, jamais la vidéo, sa durée et le type de téléphone. Vous les envoyez quand vous voulez. | After each set, the app keeps on this phone its count, yours, the position of your joints through the set, never the video, its length and the kind of phone. You send them when you choose. | Saved card under the question; history under the section title |
| yes / no | Oui, aider · Non merci | Yes, help · No thanks | Saved card |
| thanks | Merci. Vous pourrez arrêter à tout moment dans vos séries. | Thank you. You can stop at any time in your sets. | Saved card after yes |
| title | Aider à améliorer le comptage | Help improve the count | History, section eyebrow |
| waiting | 2 séries prêtes à envoyer, à pr.dabertdavid@gmail.com. / Aucune série à envoyer pour l’instant. | 2 sets ready to send, to pr.dabertdavid@gmail.com. / No set to send yet. | History |
| send | Envoyer | Send | History |
| sent | 2 séries partagées. Merci. | 2 sets shared. Thank you. | History, after the share sheet (the app cannot know the target was the address) |
| prepareFailed | Le fichier n’a pas pu être préparé. Rouvrez vos séries pour réessayer. | The file could not be prepared. Open your sets again to retry. | History, when the file cannot be built |
| eraseFailed | Les séries en attente n’ont pas pu être effacées. Réessayez. | The sets waiting could not be erased. Try again. | History, when erasing fails |
| downloaded | Fichier téléchargé. Envoyez-le à pr.dabertdavid@gmail.com. | File downloaded. Send it to pr.dabertdavid@gmail.com. | History, after a download |
| shareFailed | Le partage n’a pas abouti. Touchez à nouveau pour télécharger. | Sharing did not go through. Tap again to download. | History |
| stop | Arrêter et effacer | Stop and erase | History |
| stopped | C’est arrêté. Les séries en attente sont effacées. | Stopped. The sets waiting to be sent are erased. | History |
| start | Aider | Help | History, when not helping |
| shareTitle | Séries pour améliorer le comptage | Sets to improve the count | Title handed to the share sheet |

The file holds exactly what `what` lists: both counts, the side measured, the pose per sample (rounded to five decimals), the set's length, how the video was read, the phone's kind (agent, platform, cores, memory, screen) and the app version. It holds no date or time of the sets and no identifier of the phone or the person.

## Added 2 October 2026 (audit FINDING-016)

| Key | French | English | Where |
|---|---|---|---|
| stopFailed | L’arrêt n’a pas pu être enregistré sur ce téléphone. Réessayez. | Stopping could not be saved on this phone. Try again. | History, after "Arrêter et effacer" when the phone refuses to save |
| startFailed | Votre accord n’a pas pu être enregistré sur ce téléphone. Rien n’est gardé. | Your choice could not be saved on this phone. Nothing is kept. | Saved card or history, after a yes the phone refuses to save |
