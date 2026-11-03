// The words of the landing lab (DemoInteractiveLab.jsx), register vous (R10). Plain words first: the screen is the
// first thing a visitor opens after the entry, so no "Watts", "VBT", "sticking point" or "cinématique" here; those are
// not measured reliably on a phone video (R8) and are not what a first visit needs. French is written as a coach
// speaks in the gym (DIRECTIVES.md Part 7); a no-break space before a colon, a question mark or an exclamation mark.
const NB = '\u00A0';

// The joint the count reads, said as "of the elbow" in a sentence, and by name in the chip (Replay.jsx has the same).
export const JOINT_OF = {
  elbow: { fr: 'du coude', en: 'of the elbow' },
  shoulder: { fr: 'de l’épaule', en: 'of the shoulder' },
  knee: { fr: 'du genou', en: 'of the knee' },
  hip: { fr: 'de la hanche', en: 'of the hip' },
};
export const JOINT_NAME = {
  elbow: { fr: 'Coude', en: 'Elbow' },
  shoulder: { fr: 'Épaule', en: 'Shoulder' },
  knee: { fr: 'Genou', en: 'Knee' },
  hip: { fr: 'Hanche', en: 'Hip' },
};

export const LAB = {
  fr: {
    back: 'Retour',
    eyebrow: 'Exemple réel',
    title: 'Voyez ce que l’appli voit.',
    badge: name => `Série réelle${NB}· ${name}`,
    sub: (name, place, jointOf) => `Une vraie série de ${name.toLowerCase()}, filmée chez ${place}. L’appli suit le corps, compte chaque répétition et lit l’angle ${jointOf}.`,
    verdict: (app, label) => `L’appli en compte ${app}. David en a compté ${label}.`,
    caveat: 'Mesuré sur les points du corps enregistrés de cette série. Sur un autre téléphone ou une autre vidéo, le résultat peut varier.',
    hint: 'Touchez la ligne pour revoir une répétition.',
    play: 'Lire',
    pause: 'Pause',
    slow: 'Ralenti',
    timeline: 'Position dans la vidéo',
    effort: 'Temps fort',
    back_phase: 'Retour',
    factsLabel: 'Ce que l’appli a mesuré',
    reps: 'Répétitions',
    rom: 'Amplitude moyenne',
    pace: 'Durée d’une répétition',
    seconds: 's',
    coach: 'Voir l’analyse du coach',
    coachSub: 'Mesures expérimentales',
    start: 'Filmer ma propre série',
    again: 'Revoir depuis le début',
    plain: 'La mesure n’a pas pu se charger. La vidéo se lit seule, sans le squelette.',
    videoLabel: 'Série réelle, avec le squelette suivi par l’appli',
  },
  en: {
    back: 'Back',
    eyebrow: 'Real example',
    title: 'See what the app sees.',
    badge: name => `Real set · ${name}`,
    sub: (name, place, jointOf) => `A real set of ${name.toLowerCase()}, filmed at ${place}. The app tracks the body, counts each rep and reads the angle ${jointOf}.`,
    verdict: (app, label) => `The app counts ${app}. David counted ${label}.`,
    caveat: 'Measured on the body points saved from this set. On another phone or video, the result can differ.',
    hint: 'Tap the line to replay a rep.',
    play: 'Play',
    pause: 'Pause',
    slow: 'Slow motion',
    timeline: 'Position in the video',
    effort: 'Effort',
    back_phase: 'Return',
    factsLabel: 'What the app measured',
    reps: 'Reps',
    rom: 'Average range',
    pace: 'Time per rep',
    seconds: 's',
    coach: 'See the coach’s analysis',
    coachSub: 'Experimental measures',
    start: 'Film my own set',
    again: 'Watch from the start',
    plain: 'The measure could not load. The video plays alone, without the skeleton.',
    videoLabel: 'A real set, with the skeleton the app tracked',
  },
};
