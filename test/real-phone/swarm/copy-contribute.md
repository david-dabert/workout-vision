# Helping improve the count: the words for David's approval (R10)

Written 2 October 2026, register "vous". Under David's standing order of 2 October they ship with the change;
David approves or corrects them. All are in src/components/experience/contribute-copy.js.

| Key | FR | EN | Where it appears |
|---|---|---|---|
| ask | Aider à améliorer le comptage ? | Help improve the count? | Saved card, once, when the level is known and the person has not answered |
| what | À chaque série, l’app garde sur ce téléphone, pour que vous l’envoyiez : l’exercice ; son comptage, le vôtre (donné après avoir vu le sien) et si vous l’avez corrigé ; la position de vos articulations, dans l’espace et dans l’image, à chaque image analysée, avec son instant dans la vidéo, et le côté suivi ; la durée de la vidéo, la taille de son image, sa rotation, la façon dont elle a été lue, le nombre d’images analysées et les réglages de l’analyse ; le modèle de téléphone et de navigateur tels qu’ils se déclarent, le nombre de cœurs du processeur, la mémoire, l’écran (taille, densité de pixels, nombre de doigts reconnus) ; la version de l’app et du fichier. La date de la série reste sur le téléphone. Jamais la vidéo, ni votre nom. Vous les envoyez quand vous voulez. | After each set, the app keeps on this phone, for you to send: the exercise; its count, yours (given after seeing the app’s) and whether you corrected it; the position of your joints, in space and in the image, at each analysed frame, with its time in the video, and the side tracked; the video’s length, image size, rotation, how it was read, the number of frames analysed and the analysis settings; the phone and browser model as they state it, the processor’s core count, the memory, the screen (size, pixel density, number of touch points); the app and file version. The set’s date stays on the phone. Never the video, nor your name. You send them when you choose. | Saved card under the question; history under the section title. Replaced 3 October 2026, see below |
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

The file holds exactly what `what` lists (src/lib/contribute.js contribution() and deviceInfo(); src/lib/__tests__/contribute.test.js pins the list of fields). It holds no date or time of the sets and no identifier of the phone or the person: contributionsFile drops the set's key and its time of saving, which stay on the phone.

## Added 2 October 2026 (audit FINDING-016)

| Key | French | English | Where |
|---|---|---|---|
| stopFailed | L’arrêt n’a pas pu être enregistré sur ce téléphone. Réessayez. | Stopping could not be saved on this phone. Try again. | History, after "Arrêter et effacer" when the phone refuses to save |
| startFailed | Votre accord n’a pas pu être enregistré sur ce téléphone. Rien n’est gardé. | Your choice could not be saved on this phone. Nothing is kept. | Saved card or history, after a yes the phone refuses to save |

## Changed 3 October 2026 (third audit C10, C18, C38): pending David's approval (3 October)

The consent text now names every field the shared file carries. The earlier text left out the processor cores, the memory, the screen and touch points, the image size, the decoder, the rotation, the analysis settings and the side tracked. A non-breaking space stands before each ":" and ";" in French.

| Key | French | English | Where |
|---|---|---|---|
| what | À chaque série, l’app garde sur ce téléphone, pour que vous l’envoyiez : l’exercice ; son comptage, le vôtre (donné après avoir vu le sien) et si vous l’avez corrigé ; la position de vos articulations, dans l’espace et dans l’image, à chaque image analysée, avec son instant dans la vidéo, et le côté suivi ; la durée de la vidéo, la taille de son image, sa rotation, la façon dont elle a été lue, le nombre d’images analysées et les réglages de l’analyse ; le modèle de téléphone et de navigateur tels qu’ils se déclarent, le nombre de cœurs du processeur, la mémoire, l’écran (taille, densité de pixels, nombre de doigts reconnus) ; la version de l’app et du fichier. La date de la série reste sur le téléphone. Jamais la vidéo, ni votre nom. Vous les envoyez quand vous voulez. | After each set, the app keeps on this phone, for you to send: the exercise; its count, yours (given after seeing the app’s) and whether you corrected it; the position of your joints, in space and in the image, at each analysed frame, with its time in the video, and the side tracked; the video’s length, image size, rotation, how it was read, the number of frames analysed and the analysis settings; the phone and browser model as they state it, the processor’s core count, the memory, the screen (size, pixel density, number of touch points); the app and file version. The set’s date stays on the phone. Never the video, nor your name. You send them when you choose. | Saved card under "Aider à améliorer le comptage ?"; history under the section title |

Field by field (contribute.js), the words that name it: lift "l’exercice"; appCount "son comptage"; count "le vôtre"; labelKind "donné après avoir vu le sien"; corrected "si vous l’avez corrigé"; worldLandmarks, imageLandmarks "la position de vos articulations, dans l’espace et dans l’image, à chaque image analysée"; timestamps "son instant dans la vidéo"; arm "le côté suivi"; metadata.duration "la durée de la vidéo"; frame "la taille de son image"; metadata.rotationDecision "sa rotation"; metadata.extractionMethod "la façon dont elle a été lue"; metadata.sampleCount "le nombre d’images analysées"; extraction (fps, maxLongSide) "les réglages de l’analyse"; device.userAgent, device.platform "le modèle de téléphone et de navigateur tels qu’ils se déclarent"; device.cores "le nombre de cœurs du processeur"; device.memoryGb "la mémoire"; device.screen (width, height, pixelRatio) "l’écran (taille, densité de pixels)"; device.touchPoints "nombre de doigts reconnus"; version, kind, contributionVersion "la version de l’app et du fichier".
