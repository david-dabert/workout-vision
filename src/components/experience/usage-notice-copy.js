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
    session_end: 'Fin de visite',
  },
  en: {
    open: 'App opened', guide_open: 'Guide opened', history_open: 'Sets opened', choose_lift: 'Movement chosen',
    film_start: 'Video chosen', analysis_start: 'Analysis started', analysis_done: 'Count shown',
    analysis_uncounted: 'No rep found', analysis_refused: 'Set not counted', analysis_failed: 'Analysis failed',
    analysis_partial: 'Video read in part', analysis_interrupted: 'Analysis interrupted', analysis_cancelled: 'Analysis cancelled',
    result_kept: 'Count kept', result_corrected: 'Count corrected', report_open: 'Report opened', share: 'Share',
    session_end: 'Visit ended',
  },
};

export const NOTICE = {
  fr: {
    back: 'Retour',
    kicker: 'Comptage anonyme',
    title: 'Ce que l’appli compte',
    lead: 'Des totaux par jour, pour voir ce qui sert. Rien qui vous désigne.',
    sent: 'Ce qui est envoyé',
    events: n => `Les ${n} étapes comptées`,
    never: 'Ce qui n’est jamais gardé',
    neverText: 'Ni vidéo, ni image, ni nom, ni adresse IP, ni identifiant d’appareil. Contre les abus, une empreinte de l’adresse IP est effacée sous trois minutes.',
    where: 'Où',
    whereText: host => `Au serveur de WorkoutVision, ${host}, hébergé chez Cloudflare. Les totaux ne sont transmis à personne.`,
    stop: 'Arrêter',
    stateOn: 'Actif sur ce téléphone.',
    stateOff: 'Désactivé sur ce téléphone.',
    stateBrowser: 'Votre navigateur demande aux sites de ne pas suivre (Global Privacy Control ou Do Not Track)\u00A0: l’appli n’envoie rien.',
    turnOff: 'Désactiver', turnOn: 'Réactiver',
    turnOffLabel: 'Désactiver le comptage anonyme', turnOnLabel: 'Réactiver le comptage anonyme',
    stopText: 'Le choix reste sur ce téléphone. Le réglage «\u00A0ne pas suivre\u00A0» du navigateur a le même effet.',
    none: 'Cette version de l’appli ne compte rien et n’envoie rien.',
  },
  en: {
    back: 'Back',
    kicker: 'Anonymous counts',
    title: 'What the app counts',
    lead: 'Daily totals, to see what is used. Nothing that points to you.',
    sent: 'What is sent',
    events: n => `The ${n} steps counted`,
    never: 'What is never kept',
    neverText: 'No video, no image, no name, no IP address, no device id. Against abuse, a fingerprint of the IP address is erased within three minutes.',
    where: 'Where',
    whereText: host => `To WorkoutVision’s server, ${host}, hosted by Cloudflare. The totals are passed to no one.`,
    stop: 'Turning it off',
    stateOn: 'On, on this phone.',
    stateOff: 'Off, on this phone.',
    stateBrowser: 'Your browser asks sites not to track (Global Privacy Control or Do Not Track): the app sends nothing.',
    turnOff: 'Turn off', turnOn: 'Turn on',
    turnOffLabel: 'Turn off anonymous counting', turnOnLabel: 'Turn anonymous counting back on',
    stopText: 'The choice stays on this phone. The browser’s “do not track” setting has the same effect.',
    none: 'This version of the app counts nothing and sends nothing.',
  },
};
