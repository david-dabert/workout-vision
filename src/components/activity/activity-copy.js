// The words of the activity screen (ActivityScreen.jsx), register vous (R10), French typography as in the rest of the
// app: typographic apostrophes, a no-break space before a colon and between a number and its noun or unit, no em dash.
// Status of every French line below: written on 14 October 2026, reworded the same day after the honesty
// review of PR #161, awaiting David's approval (R10); `made` and `notApplicable` reworded or added after the second
// review the same day, with the same status. Demonstration video lines added 15 October 2026, approved by David on 15 October 2026 (R10).
// The names, taglines, formulas, error notes and refusals of an activity
// live in its specification (src/lib/activity/specs) and its engine, with the same status.
const NB = '\u00A0';

export const ACTIVITY_COPY = {
  fr: {
    eyebrow: 'Analyse du mouvement',
    // The demonstration video and its credit line (15 October 2026, David's request). Approved by David on 15 October 2026 (R10).
    viewRaw: 'Un service, filmé en match', // Approved by David on 15 October 2026 (R10)
    demoClip: 'Un service de volley-ball.', // Approved by David on 15 October 2026 (R10)
    demoNote: `Clip de démonstration${NB}: l’appli n’analyse rien sur cette vidéo.`, // Approved by David on 15 October 2026 (R10)
    creditAuthor: `Auteur${NB}: Shev123`, // Approved by David on 15 October 2026 (R10)
    creditLicense: `Licence${NB}: CC0 (domaine public)`, // Approved by David on 15 October 2026 (R10)
    creditFilePage: 'Page du fichier sur Wikimedia Commons', // Approved by David on 15 October 2026 (R10)
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Paris_Volley_-_Chaumont,_18_February_2014_-_43_-_Ace.webm', // Approved by David on 15 October 2026 (R10)
    syntheticHead: 'Des sauts de synthèse',
    synthetic: `Ces sauts ne sont pas filmés${NB}: c’est un corps simulé, dont on connaît chaque décollage et chaque réception. L’appli les analyse comme une vidéo, puis compare chaque valeur à la valeur réelle.`,
    notShown: `Limite de la démo${NB}: sur une vraie vidéo, la détection du corps se trompe aussi, et ces erreurs s’ajoutent aux marges.`,
    rateHead: 'Cadence de la vidéo',
    rate: r => `${r}${NB}i/s`,
    rateGroup: 'Images par seconde',
    made: (n, k, r) => `${n}${NB}sauts, dont ${k} avec trois pas d’élan, analysés à ${r}${NB}images par seconde. Chaque point du corps bouge d’environ un pixel${NB}: un bruit choisi pour la démo, pas encore mesuré sur une vraie vidéo.`,
    resultsHead: 'Ce que l’appli mesure',
    noNumber: 'Pas de chiffre',
    noMargin: 'Pas encore de marge d’erreur établie pour cette mesure, donc pas de chiffre.',
    truth: v => `Valeur réelle${NB}: ${v}`,
    inside: 'dans la marge',
    outside: 'hors de la marge',
    countRight: 'compte exact',
    countWrong: 'compte faux',
    none: 'Aucune',
    notApplicable: 'Sans objet',
    honest: 'Une mesure s’affiche avec sa marge d’erreur, un compte avec sa vérification. Quand l’appli ne peut pas mesurer, elle le dit, et dit pourquoi.',
    eachHead: 'Saut par saut',
    eventCol: 'Saut',
    event: k => `Saut${NB}${k}`,
    filmHead: 'Pour filmer',
    filmLater: 'L’analyse de vos propres vidéos de volley n’est pas encore disponible.',
    status: { validated: 'Validé sur nos vidéos', literature: 'Méthode publiée', convention: 'Usage de coach', experimental: 'Expérimental' },
  },
  en: {
    eyebrow: 'Movement analysis',
    viewRaw: 'A serve, filmed during a match',
    demoClip: 'A volleyball serve.',
    demoNote: 'Demonstration clip: the app analyses nothing on this video.',
    creditAuthor: 'Author: Shev123',
    creditLicense: 'Licence: CC0 (public domain)',
    creditFilePage: 'File page on Wikimedia Commons',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Paris_Volley_-_Chaumont,_18_February_2014_-_43_-_Ace.webm',
    syntheticHead: 'Synthetic jumps',
    synthetic: 'These jumps are not filmed: they are a simulated body whose every takeoff and landing is known. The app analyses them as it would a video, then compares each value with the true one.',
    notShown: 'The demo’s limit: on a real video, the body detection also errs, and those errors add to these margins.',
    rateHead: 'Video frame rate',
    rate: r => `${r} fps`,
    rateGroup: 'Frames per second',
    made: (n, k, r) => `${n} jumps, ${k} of them after a three-step run-up, analysed at ${r} frames a second. Every body point moves by about a pixel: a noise chosen for the demo, not yet measured on a real video.`,
    resultsHead: 'What the app measures',
    noNumber: 'No number',
    noMargin: 'No margin of error established for this measure yet, so no number.',
    truth: v => `True value: ${v}`,
    inside: 'within the margin',
    outside: 'outside the margin',
    countRight: 'count right',
    countWrong: 'count wrong',
    none: 'None',
    notApplicable: 'Not applicable',
    honest: 'A measure is shown with its margin of error, a count with its check. When the app cannot measure, it says so, and says why.',
    eachHead: 'Jump by jump',
    eventCol: 'Jump',
    event: k => `Jump ${k}`,
    filmHead: 'How to film',
    filmLater: 'Analysing your own volleyball videos is not available yet.',
    status: { validated: 'Validated on our videos', literature: 'Published method', convention: 'Coaching practice', experimental: 'Experimental' },
  },
};
