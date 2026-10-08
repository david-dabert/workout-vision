// The words of the result screen rebuilt in the final direction (C4 of the design review, 7 October 2026: "Le noir
// mesure, le papier se souvient", screens 05, 05b and 05c), register vous (R10), for David's approval
// (test/real-phone/swarm/copy-result.md). The app is "l'appli"; a number that is not measured always carries a word
// ("à confirmer", "saisi par vous", "prévu"). French typography as in the rest of the app: typographic apostrophes,
// a no-break space before a question mark or a colon and between a number and its unit.
// Status of every line: pending David's approval (7 October 2026).
const NB = '\u00A0';
const reps = (n, fr) => (fr ? (n > 1 ? 'répétitions' : 'répétition') : (n === 1 ? 'rep' : 'reps'));

export const RESULT = {
  fr: {
    // The status line: the state of the count, then the lift and, for a set filmed from a programme, its place.
    toConfirm: 'À confirmer',
    saved: 'Enregistré',
    yourCount: 'À vous de compter',
    setOf: (k, n) => `Série ${k} / ${n}`,
    // The question over the numeral, until the count is confirmed (the words of the former card, kept).
    question: n => `C’est bien ${n}${NB}?`,
    // Under the numeral: where the number comes from. The length is the video's, measured (metadata.duration).
    source: (s, live) => (live
      ? (s ? `Compté par l’appli en direct, sur ${s}${NB}s.` : 'Compté par l’appli en direct.')
      : (s ? `Compté par l’appli sur votre vidéo de ${s}${NB}s.` : 'Compté par l’appli sur votre vidéo.')),
    typedBy: 'Saisi par vous',
    countedWas: n => `Compté par l’appli${NB}: ${n}.`,
    // The keys.
    yes: n => `Oui, ${n} ${reps(n, true)}`,
    saveN: n => `Enregistrer ${n} ${reps(n, true)}`,
    save: 'Enregistrer',
    replayVideo: 'Revoir la vidéo',
    replaySet: 'Revoir la série',
    refilm: 'Refilmer la série',
    // The day's table, for a set filmed from a programme.
    today: 'Aujourd’hui',
    plannedHead: (sets, r) => `Prévu${NB}: ${sets} ${sets > 1 ? 'séries' : 'série'} de ${r}`,
    setN: k => `Série ${k}`,
    word: { confirmed: 'confirmée', pending: 'à confirmer', corrected: 'corrigée', typed: 'saisie', yours: 'à vous de compter' },
    plannedValue: n => `prévu ${n}`,
    // Low confidence (05b): no number until the person gives one.
    noCount: 'L’appli n’a pas pu compter cette série.',
    notSure: 'L’appli n’a pas pu compter cette série avec certitude.',
    noneFound: 'L’appli n’a trouvé aucune répétition dans cette série. Elle ne peut pas dire si la série était vide ou si elle a manqué vos répétitions.',
    liveDiffers: n => `En direct, l’appli affichait ${n}. En relisant toute la série, elle ne trouve pas le même nombre.`,
    quickHint: `Touchez un nombre, ou corrigez avec –${NB}et${NB}+.`,
    typeHint: `Touchez le tiret pour saisir le nombre, ou utilisez –${NB}et${NB}+.`,
    planSays: n => `Votre programme prévoit ${n}.`,
    lastSet: n => `Votre série précédente${NB}: ${n}.`,
    empty: 'Aucun nombre choisi',
    // The question once the number is the person's (the words of the former card, kept).
    howMany: `Combien en avez-vous fait${NB}?`,
    // A refused set with PSC's proposal (8 October 2026, R8: a number to confirm, never a silent count, no grade, no
    // measure; test/real-phone/swarm/copy-proposal.md). Pending David's approval.
    proposal: n => `Proposition de l’appli${NB}: ${n}`,
    proposalNote: 'L’appli propose ce nombre sans avoir bien vu le mouvement. Vérifiez-le avant d’enregistrer.',
    confirmN: n => `Confirmer ${n} ${reps(n, true)}`,
    savedConfirmed: n => `Merci. ${n} ${n > 1 ? 'répétitions enregistrées' : 'répétition enregistrée'}, ${n > 1 ? 'confirmées' : 'confirmée'} par vous.`,
  },
  en: {
    toConfirm: 'To confirm',
    saved: 'Saved',
    yourCount: 'Your count',
    setOf: (k, n) => `Set ${k} / ${n}`,
    question: n => `Was it ${n}?`,
    source: (s, live) => (live
      ? (s ? `Counted by the app live, over ${s}${NB}s.` : 'Counted by the app live.')
      : (s ? `Counted by the app on your ${s}${NB}s video.` : 'Counted by the app on your video.')),
    typedBy: 'Typed by you',
    countedWas: n => `Counted by the app: ${n}.`,
    yes: n => `Yes, ${n} ${reps(n, false)}`,
    saveN: n => `Save ${n} ${reps(n, false)}`,
    save: 'Save',
    replayVideo: 'Watch the video again',
    replaySet: 'Replay the set',
    refilm: 'Record the set again',
    today: 'Today',
    plannedHead: (sets, r) => `Planned: ${sets} ${sets === 1 ? 'set' : 'sets'} of ${r}`,
    setN: k => `Set ${k}`,
    word: { confirmed: 'confirmed', pending: 'to confirm', corrected: 'corrected', typed: 'typed', yours: 'your count' },
    plannedValue: n => `planned ${n}`,
    noCount: 'The app could not count this set.',
    notSure: 'The app could not count this set with certainty.',
    noneFound: 'The app found no rep in this set. It cannot tell whether the set was empty or it missed your reps.',
    liveDiffers: n => `Live, the app showed ${n}. Reading the whole set again, it does not find the same number.`,
    quickHint: `Tap a number, or adjust with –${NB}and${NB}+.`,
    typeHint: `Tap the dash to type the number, or use –${NB}and${NB}+.`,
    planSays: n => `Your programme plans ${n}.`,
    lastSet: n => `Your previous set: ${n}.`,
    empty: 'No number chosen',
    howMany: 'How many did you do?',
    proposal: n => `The app’s proposal: ${n}`,
    proposalNote: 'The app suggests this number without having seen the movement clearly. Check it before saving.',
    confirmN: n => `Confirm ${n} ${reps(n, false)}`,
    savedConfirmed: n => `Thank you. ${n} ${n === 1 ? 'rep' : 'reps'} saved, confirmed by you.`,
  },
};
