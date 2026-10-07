// The words of the note after the app restarted during a session (crashLog.js, Choice.jsx CrashNote), register vous
// (R10). Pending David's approval: test/real-phone/swarm/copy-crash.md lists them. French typography as in the rest of
// the app: curly apostrophes, U+00A0 before a colon.

// Where the app was, by the screen's name in the log (App.jsx marks it).
const SCREENS = {
  fr: { choice: 'choix de l’exercice', film: 'écran Filmer', analyze: 'analyse', live: 'en direct', guide: 'guide des exercices', history: 'vos séries', pro: 'espace pro', programme: 'programme', about: 'à propos' },
  en: { choice: 'choice of exercise', film: 'filming screen', analyze: 'analysis', live: 'live', guide: 'exercise guide', history: 'your sets', pro: 'pro space', programme: 'programme', about: 'about' },
};
// What the app was doing, by the phase in the log (CoreUpload.jsx marks it).
const PHASES = {
  fr: { waiting: 'l’ouverture de la vidéo', model: 'le chargement du modèle', extracting: 'la lecture de la vidéo', result: 'l’affichage du résultat', replay: 'le revisionnage de la série', report: 'le rapport', error: 'l’affichage d’une erreur' },
  en: { waiting: 'opening the video', model: 'loading the model', extracting: 'reading the video', result: 'the result', replay: 'the replay of the set', report: 'the report', error: 'an error screen' },
};

export const CRASH = {
  fr: { copy: 'Copier le détail', copied: 'Détail copié.', copyFailed: 'La copie n’a pas marché.', dismiss: 'Masquer', dismissLabel: 'Masquer cette note', kept: 'Le détail est gardé sur ce téléphone.' },
  en: { copy: 'Copy the details', copied: 'Details copied.', copyFailed: 'Copying did not work.', dismiss: 'Dismiss', dismissLabel: 'Dismiss this note', kept: 'The details are kept on this phone.' },
};

/** "L’appli a redémarré pendant ‹phase› (‹écran›)." from the incident's breadcrumbs, words it does not know left out. */
export function crashLine(incident, fr) {
  const l = fr ? 'fr' : 'en';
  const phase = PHASES[l][incident?.phase], screen = SCREENS[l][incident?.screen];
  const where = screen ? ` (${screen})` : '';
  const lead = fr ? 'L’appli a redémarré' : 'The app restarted';
  return phase ? `${lead} ${fr ? 'pendant' : 'during'} ${phase}${where}. ${CRASH[l].kept}` : `${lead}${where}. ${CRASH[l].kept}`;
}
