// The words of "Aider à améliorer le comptage" (contribute.js), in one place for David's approval (R10;
// test/real-phone/swarm/copy-contribute.md lists them).
import { REPORT_EMAIL } from '../../lib/reportLinks';

export const CONTRIBUTE = {
  fr: {
    title: 'Aider à améliorer le comptage',
    // Every field the file holds is named, grouped in plain words (contribute.js contribution() and deviceInfo();
    // contribute.test.js pins the list, so a new field fails until it is named here). The date of the set and its
    // key stay on the phone (contributionsFile drops them). "Jamais la vidéo" stays apart from the list (audit of
    // 3 October; third audit C10, C18, C38: the cores, memory, screen, image size, decoder, rotation and side were missing).
    what: 'À chaque série, l’app garde sur ce téléphone, pour que vous l’envoyiez\u00A0: l’exercice\u00A0; son comptage, le vôtre (donné après avoir vu le sien) et si vous l’avez corrigé\u00A0; la position de vos articulations, dans l’espace et dans l’image, à chaque image analysée, avec son instant dans la vidéo, et le côté suivi\u00A0; la durée de la vidéo, la taille de son image, sa rotation, la façon dont elle a été lue, le nombre d’images analysées et les réglages de l’analyse\u00A0; le modèle de téléphone et de navigateur tels qu’ils se déclarent, le nombre de cœurs du processeur, la mémoire, l’écran (taille, densité de pixels, nombre de doigts reconnus)\u00A0; la version de l’app et du fichier. La date de la série reste sur le téléphone. Jamais la vidéo, ni votre nom. Vous les envoyez quand vous voulez.',
    ask: 'Aider à améliorer le comptage\u00A0?',
    yes: 'Oui, aider',
    no: 'Non merci',
    thanks: 'Merci. Vous pourrez arrêter à tout moment dans vos séries.',
    waiting: n => (n ? `${n} ${n > 1 ? 'séries prêtes' : 'série prête'} à envoyer, à ${REPORT_EMAIL}.` : 'Aucune série à envoyer pour l’instant.'),
    send: 'Envoyer',
    sent: n => `${n} ${n > 1 ? 'séries partagées' : 'série partagée'}. Merci.`,
    prepareFailed: 'Le fichier n’a pas pu être préparé. Rouvrez vos séries pour réessayer.',
    eraseFailed: 'Les séries en attente n’ont pas pu être effacées. Réessayez.',
    downloaded: `Fichier téléchargé. Envoyez-le à ${REPORT_EMAIL}.`,
    shareFailed: 'Le partage n’a pas abouti. Touchez à nouveau pour télécharger.',
    stop: 'Arrêter et effacer',
    stopped: 'C’est arrêté. Les séries en attente sont effacées.',
    stopFailed: 'L’arrêt n’a pas pu être enregistré sur ce téléphone. Réessayez.',
    startFailed: 'Votre accord n’a pas pu être enregistré sur ce téléphone. Rien n’est gardé.',
    keepFailed: 'Votre accord est enregistré, mais cette série n’a pas pu être gardée sur ce téléphone.',
    start: 'Aider',
    shareTitle: 'Séries pour améliorer le comptage',
  },
  en: {
    title: 'Help improve the count',
    what: 'After each set, the app keeps on this phone, for you to send: the exercise; its count, yours (given after seeing the app’s) and whether you corrected it; the position of your joints, in space and in the image, at each analysed frame, with its time in the video, and the side tracked; the video’s length, image size, rotation, how it was read, the number of frames analysed and the analysis settings; the phone and browser model as they state it, the processor’s core count, the memory, the screen (size, pixel density, number of touch points); the app and file version. The set’s date stays on the phone. Never the video, nor your name. You send them when you choose.',
    ask: 'Help improve the count?',
    yes: 'Yes, help',
    no: 'No thanks',
    thanks: 'Thank you. You can stop at any time in your sets.',
    waiting: n => (n ? `${n} ${n === 1 ? 'set' : 'sets'} ready to send, to ${REPORT_EMAIL}.` : 'No set to send yet.'),
    send: 'Send',
    sent: n => `${n} ${n === 1 ? 'set' : 'sets'} shared. Thank you.`,
    prepareFailed: 'The file could not be prepared. Open your sets again to retry.',
    eraseFailed: 'The sets waiting could not be erased. Try again.',
    downloaded: `File downloaded. Send it to ${REPORT_EMAIL}.`,
    shareFailed: 'Sharing did not go through. Tap again to download.',
    stop: 'Stop and erase',
    stopped: 'Stopped. The sets waiting to be sent are erased.',
    stopFailed: 'Stopping could not be saved on this phone. Try again.',
    startFailed: 'Your choice could not be saved on this phone. Nothing is kept.',
    keepFailed: 'Your choice is saved, but this set could not be kept on this phone.',
    start: 'Help',
    shareTitle: 'Sets to improve the count',
  },
};
