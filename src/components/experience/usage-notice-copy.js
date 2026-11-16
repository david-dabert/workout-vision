// The notice of the anonymous usage counts (UsageNotice.jsx; PRIV-3 and WP2.3 of docs/SPEC-production.md).
// What is counted is generated from feedback-worker/usage-schema.js, the one list the app sends from and the worker
// accepts: a field or an event added there without its words here fails usage-notice-copy.test.js, and the notice
// never lists a field the schema does not have. French in "vous" (R10), new lines listed in the PR for David.
import { USAGE_EVENTS, COMMON_FIELDS, DURATION_BUCKETS } from '../../../feedback-worker/usage-schema.js';

/** Every field an event may carry, in the order the notice lists them: the event's name, its own fields, the common ones. */
export function schemaFields(events = USAGE_EVENTS, common = COMMON_FIELDS) {
  const own = [];
  for (const fields of Object.values(events)) for (const f of fields) if (!own.includes(f)) own.push(f);
  return ['event', ...own, ...common.filter(f => !own.includes(f))];
}

// The words of each field. durationBucket names its buckets from the schema, so the notice cannot drift from them.
const bucketsFr = () => DURATION_BUCKETS.map(b => ({ '<1': 'moins d’1', '1-5': '1 à 5', '5-15': '5 à 15', '>15': 'plus de 15' }[b] ?? b)).join(', ');
const bucketsEn = () => DURATION_BUCKETS.map(b => ({ '<1': 'under 1', '1-5': '1 to 5', '5-15': '5 to 15', '>15': 'over 15' }[b] ?? b)).join(', ');

export const FIELD_WORDS = {
  fr: {
    event: ['L’étape', 'appli ouverte, analyse lancée, comptage corrigé…'],
    lift: ['Le mouvement', 'celui choisi, par exemple squat'],
    tier: ['Son niveau', 'bêta ou expérimental'],
    durationBucket: ['La durée de visite', null], // filled below from the schema's buckets
    appVersion: ['La version', 'de l’appli'],
    lang: ['La langue', 'français ou anglais'],
  },
  en: {
    event: ['The step', 'app opened, analysis started, count corrected…'],
    lift: ['The movement', 'the one chosen, for example squat'],
    tier: ['Its tier', 'Beta or Experimental'],
    durationBucket: ['The visit’s length', null],
    appVersion: ['The version', 'of the app'],
    lang: ['The language', 'French or English'],
  },
};
FIELD_WORDS.fr.durationBucket[1] = `${bucketsFr()}\u00A0min`;
FIELD_WORDS.en.durationBucket[1] = `${bucketsEn()}\u00A0min`;

// Each event, in a few words, for the list under "Les étapes comptées".
export const EVENT_WORDS = {
  fr: {
    open: 'Appli ouverte', guide_open: 'Guide ouvert', history_open: 'Séries ouvertes', choose_lift: 'Mouvement choisi',
    film_start: 'Vidéo choisie', analysis_start: 'Analyse lancée', analysis_done: 'Comptage affiché',
    analysis_uncounted: 'Aucune répétition trouvée', analysis_refused: 'Série non comptée', analysis_failed: 'Analyse échouée',
    analysis_partial: 'Vidéo lue en partie', analysis_interrupted: 'Analyse interrompue', analysis_cancelled: 'Analyse annulée',
    result_kept: 'Comptage gardé', result_corrected: 'Comptage corrigé', report_open: 'Bilan ouvert', share: 'Partage',
    session_end: 'Fin de visite', pro_open: 'Espace pro ouvert', kine_open: 'Espace kiné ouvert',
  },
  en: {
    open: 'App opened', guide_open: 'Guide opened', history_open: 'Sets opened', choose_lift: 'Movement chosen',
    film_start: 'Video chosen', analysis_start: 'Analysis started', analysis_done: 'Count shown',
    analysis_uncounted: 'No rep found', analysis_refused: 'Set not counted', analysis_failed: 'Analysis failed',
    analysis_partial: 'Video read in part', analysis_interrupted: 'Analysis interrupted', analysis_cancelled: 'Analysis cancelled',
    result_kept: 'Count kept', result_corrected: 'Count corrected', report_open: 'Report opened', share: 'Share',
    session_end: 'Visit ended', pro_open: 'Espace pro opened', kine_open: 'Physio workspace opened',
  },
};

export const NOTICE = {
  fr: {
    back: 'Retour',
    kicker: 'Mesure d’audience',
    title: 'Ce que l’appli compte',
    // 16 November 2026 (David: "Yes to the tracking, build it"): the phone's random id (events.js).
    lead: 'Les étapes de chaque visite, avec un identifiant tiré au hasard sur ce téléphone, pour voir ce qui sert, qui revient et où l’on s’arrête. Rien qui donne votre nom.',
    sent: 'Ce qui est envoyé',
    events: n => `Les ${n} étapes comptées`,
    never: 'Ce qui n’est jamais gardé',
    neverText: 'Ni vidéo, ni image, ni nom, ni adresse IP. L’Espace kiné n’est compté qu’en totaux par jour, jamais avec l’identifiant. Une empreinte de l’adresse IP, qui sert à bloquer les abus, est effacée en moins de trois minutes.',
    idTitle: 'L’identifiant',
    idText: 'Tiré au hasard sur ce téléphone, il ne contient rien sur vous. Il est remplacé 13 mois après sa création, sans être prolongé par vos visites. Le serveur n’en garde qu’une empreinte chiffrée et efface les données au bout de 25 mois. Désactiver la mesure l’efface de ce téléphone.',
    where: 'Où',
    whereText: host => `Sur le serveur de WorkoutVision, ${host}, hébergé chez Cloudflare. Les données ne sont transmises à personne et ne servent qu’à mesurer l’usage de l’appli.`,
    stop: 'Arrêter',
    stateOn: 'Actif sur ce téléphone.',
    stateOff: 'Désactivé sur ce téléphone.',
    stateBrowser: 'Votre navigateur demande aux sites de ne pas suivre (Global Privacy Control ou Do Not Track)\u00A0: l’appli n’envoie rien.',
    turnOff: 'Désactiver', turnOn: 'Réactiver',
    turnOffLabel: 'Désactiver la mesure d’audience', turnOnLabel: 'Réactiver la mesure d’audience',
    stopText: 'Le choix reste sur ce téléphone. Le réglage «\u00A0ne pas suivre\u00A0» du navigateur a le même effet.',
    none: 'Cette version de l’appli ne compte rien et n’envoie rien.',
  },
  en: {
    back: 'Back',
    kicker: 'Usage counts',
    title: 'What the app counts',
    lead: 'The steps of each visit, with an id drawn at random on this phone, to see what is used, who comes back and where people stop. Nothing that gives your name.',
    sent: 'What is sent',
    events: n => `The ${n} steps counted`,
    never: 'What is never kept',
    neverText: 'No video, no image, no name, no IP address. The physio workspace is counted only in daily totals, never with the id. Against abuse, a fingerprint of the IP address is erased within three minutes.',
    idTitle: 'The id',
    idText: 'Drawn at random on this phone, it holds nothing about you. It is replaced 13 months after it was made, never extended by your visits. The server keeps only a keyed fingerprint of it and erases the data after 25 months. Turning the counts off erases it from this phone.',
    where: 'Where',
    whereText: host => `To WorkoutVision’s server, ${host}, hosted by Cloudflare. The data is passed to no one and used only to measure how the app is used.`,
    stop: 'Turning it off',
    stateOn: 'On, on this phone.',
    stateOff: 'Off, on this phone.',
    stateBrowser: 'Your browser asks sites not to track (Global Privacy Control or Do Not Track): the app sends nothing.',
    turnOff: 'Turn off', turnOn: 'Turn on',
    turnOffLabel: 'Turn off usage counts', turnOnLabel: 'Turn usage counts back on',
    stopText: 'The choice stays on this phone. The browser’s “do not track” setting has the same effect.',
    none: 'This version of the app counts nothing and sends nothing.',
  },
};
