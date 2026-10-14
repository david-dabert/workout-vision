// The words of the sports lab (SportsBiomechanics.jsx), register vous (R10), French typography as in the rest of the
// app: typographic apostrophes, a no-break space before a colon or a semicolon and between a number and its unit, no
// em dash. Status of every line: written 14 October 2026 in the honesty pass (audit SP-01 to SP-30), awaiting David's
// approval (R10).
//
// R9 status of the statements per sport:
// - clip: a plain description of the demonstration clip as it plays (validated: looked at on 14 October 2026).
// - later: what a phone video could measure once built and checked; nothing of it is measured today. Status:
//   experimental (the audit's target design of 14 October 2026, with its sampling-error estimates by frame rate).
// - never: what a single phone video cannot measure here, and why. Status: convention for the physics (a club or a
//   ball that is not tracked gives no speed; a rotation in the transverse plane needs 3D; a joint torque needs forces
//   measured in a laboratory, Fleisig et al. 1995, Am J Sports Med 23:233-239, status literature), validated for the
//   facts about the app (no club, ball or ski tracking exists in src).
const NB = ' ';

const SPORTS_FR = {
  golf: {
    name: 'Golf',
    clip: 'Un swing de golf, filmé de face.',
    later: [
      `Le tempo${NB}: la durée de la montée et de la descente, sur une vidéo filmée à 60${NB}images par seconde ou plus.`,
      'Le déplacement de la tête et du bassin pendant le swing, filmé de face.',
    ],
    never: [
      `La vitesse de la tête de club${NB}: le club n’est pas suivi.`,
      `Le X-factor, l’écart de rotation entre les épaules et le bassin${NB}: il faut une mesure en trois dimensions.`,
    ],
  },
  tennis: {
    name: 'Tennis',
    clip: 'Un service de tennis.',
    later: [
      'La flexion des genoux avant la poussée, filmée de côté.',
      `Le temps entre la position d’armé et la frappe, à 60${NB}images par seconde ou plus.`,
    ],
    never: [`La vitesse du service et l’enchaînement des segments du corps${NB}: il faut une capture en trois dimensions, très rapide.`],
  },
  padel: {
    name: 'Padel',
    clip: 'Une séance d’entraînement au padel.',
    later: ['La hauteur de frappe, rapportée à la taille du joueur, à partir d’une image où il se tient debout.'],
    never: [`Une hauteur en mètres sans repère d’échelle, et le rebond sur la vitre${NB}: la balle n’est pas suivie.`],
  },
  baseball: {
    name: 'Baseball',
    clip: 'Un lanceur de baseball sur le monticule.',
    later: ['La longueur de la foulée quand le pied avant touche le sol, rapportée à la taille, et le temps entre la levée de jambe et ce contact.'],
    never: [`La charge sur le coude ou sur un ligament${NB}: elle se mesure en laboratoire. L’appli ne juge pas la santé du bras${NB}; en cas de douleur, voyez un professionnel de santé.`],
  },
  cycling: {
    name: 'Cyclisme',
    clip: 'Un cycliste sur home trainer, filmé de côté.',
    later: ['La cadence, et la flexion du genou au point bas du pédalage, sur une vingtaine de tours filmés de côté.'],
    never: [`Un réglage de selle validé${NB}: un angle lu en vidéo ne se compare pas tel quel à une mesure au goniomètre, jambe immobile.`],
  },
  rowing: {
    name: 'Aviron',
    clip: 'Un rameur sur ergomètre, filmé de côté, au ralenti.',
    later: ['La cadence, et le rapport entre le temps de propulsion et le temps de retour, sur au moins dix coups filmés de côté.'],
    never: [`Un rythme lu sur une vidéo au ralenti${NB}: le temps y est étiré.`],
  },
  skiing: {
    name: 'Ski alpin',
    clip: 'Un skieur sur piste, filmé de dos par un autre skieur.',
    later: ['Le rythme des virages, filmé depuis un point fixe.'],
    never: [`L’angle de carre et les forces en virage${NB}: une caméra qui suit le skieur sur une pente inconnue ne permet de mesurer ni l’un ni les autres.`],
  },
  swimming: {
    name: 'Natation',
    clip: 'Un nageur en crawl, filmé depuis le bord.',
    later: ['La cadence de nage, sur une dizaine de cycles filmés depuis le bord.'],
    never: [`La prise d’appui sous l’eau, le roulis vu d’en haut et toute note de propulsion${NB}: rien de cela ne se voit sur cette vidéo.`],
  },
};

const SPORTS_EN = {
  golf: {
    name: 'Golf',
    clip: 'A golf swing, filmed face-on.',
    later: ['Tempo: how long the backswing and the downswing last, on a video filmed at 60 frames per second or more.', 'How the head and the pelvis move during the swing, filmed face-on.'],
    never: ['Clubhead speed: the club is not tracked.', 'The X-factor, the difference in rotation between shoulders and pelvis: it needs a 3D measurement.'],
  },
  tennis: {
    name: 'Tennis',
    clip: 'A tennis serve.',
    later: ['Knee bend before the drive up, filmed from the side.', 'The time from the trophy position to contact, at 60 frames per second or more.'],
    never: ['Serve speed and the sequence of body segments: they need very fast 3D capture.'],
  },
  padel: {
    name: 'Padel',
    clip: 'A padel training session.',
    later: ['Contact height relative to the player’s height, from a frame where they stand upright.'],
    never: ['A height in metres without a scale reference, and the rebound off the glass: the ball is not tracked.'],
  },
  baseball: {
    name: 'Baseball',
    clip: 'A baseball pitcher on the mound.',
    later: ['Stride length when the front foot lands, relative to height, and the time from leg lift to that contact.'],
    never: ['The load on the elbow or a ligament: it is measured in a laboratory. The app does not judge arm health; if it hurts, see a health professional.'],
  },
  cycling: {
    name: 'Cycling',
    clip: 'A cyclist on an indoor trainer, filmed from the side.',
    later: ['Cadence, and knee bend at the bottom of the pedal stroke, over about twenty revolutions filmed from the side.'],
    never: ['A validated saddle setting: an angle read on video does not compare as it is with a goniometer measurement on a still leg.'],
  },
  rowing: {
    name: 'Rowing',
    clip: 'A rower on an ergometer, filmed from the side, in slow motion.',
    later: ['Stroke rate, and the ratio of drive time to recovery time, over at least ten strokes filmed from the side.'],
    never: ['A rhythm read on a slow-motion video: time is stretched in it.'],
  },
  skiing: {
    name: 'Alpine skiing',
    clip: 'A skier on a piste, filmed from behind by another skier.',
    later: ['The rhythm of the turns, filmed from a fixed point.'],
    never: ['Edge angle and turning forces: a camera following the skier on an unknown slope can measure neither.'],
  },
  swimming: {
    name: 'Swimming',
    clip: 'A front-crawl swimmer, filmed from the poolside.',
    later: ['Stroke rate, over about ten cycles filmed from the poolside.'],
    never: ['The catch under water, body roll seen from above and any propulsion score: none of it shows on this video.'],
  },
};

export const SPORTS_COPY = {
  fr: {
    eyebrow: 'Sports de précision',
    title: 'Le geste, sport par sport',
    sub: 'Des clips de démonstration, ce qu’une vidéo de téléphone pourrait mesurer et ce qu’elle ne mesurera pas. L’appli ne lit pas encore vos vidéos de ces sports.',
    open: 'Ouvrir ma vidéo',
    close: 'Fermer la vidéo',
    ownHead: 'Pas de mesure sur votre vidéo',
    ownText: `L’appli ne lit pas encore les vidéos de ces sports${NB}: aucun chiffre n’est tiré de ce fichier.`,
    stays: `Il reste sur votre téléphone${NB}: rien n’est envoyé.`,
    railLabel: 'Sports',
    volleyball: 'Volley-ball',
    equine: 'Équitation',
    demoNote: `Clip de démonstration${NB}: l’appli ne lit rien sur cette vidéo.`,
    laterHead: 'Ce qu’une vidéo pourrait mesurer',
    laterTag: 'Pas encore mesuré',
    neverHead: 'Hors de portée d’une vidéo de téléphone',
    refHead: { golf: `Repère${NB}: le tempo`, rowing: `Repère${NB}: le rythme` },
    calcTag: 'Calcul',
    fromSliders: 'Les valeurs viennent des curseurs, pas d’une vidéo.',
    golfUp: 'Durée de la montée',
    golfDown: 'Durée de la descente',
    golfUpShort: 'Montée',
    golfDownShort: 'Descente',
    golfRatio: 'Tempo',
    golfRef: `Repère courant${NB}: 3${NB}:${NB}1, la montée trois fois plus longue que la descente (J.${NB}Novosel, Tour Tempo). Usage de coach.`,
    rowDrive: 'Durée de la propulsion',
    rowRecovery: 'Durée du retour',
    rowDriveShort: 'Propulsion',
    rowRecoveryShort: 'Retour',
    rowRatio: 'Rythme',
    rowRef: `Repère courant${NB}: 1${NB}:${NB}2, le retour deux fois plus long que la propulsion (Concept2). Usage de coach.`,
    noRatio: 'Pas de rapport',
    barLabel: (a, b) => `${a} puis ${b}, à l’échelle`,
    refMark: r => `repère ${r}`,
    sports: SPORTS_FR,
  },
  en: {
    eyebrow: 'Precision sports',
    title: 'The movement, sport by sport',
    sub: 'Demonstration clips, what a phone video could measure and what it will not. The app does not read your videos of these sports yet.',
    open: 'Open my video',
    close: 'Close the video',
    ownHead: 'No measurement on your video',
    ownText: 'The app does not read videos of these sports yet: no number is taken from this file.',
    stays: 'It stays on your phone: nothing is sent.',
    railLabel: 'Sports',
    volleyball: 'Volleyball',
    equine: 'Equestrian',
    demoNote: 'Demonstration clip: the app reads nothing from this video.',
    laterHead: 'What a video could measure',
    laterTag: 'Not measured yet',
    neverHead: 'Beyond a phone video',
    refHead: { golf: 'Reference: tempo', rowing: 'Reference: rhythm' },
    calcTag: 'Calculation',
    fromSliders: 'The values come from the sliders, not from a video.',
    golfUp: 'Backswing time',
    golfDown: 'Downswing time',
    golfUpShort: 'Backswing',
    golfDownShort: 'Downswing',
    golfRatio: 'Tempo',
    golfRef: 'Common reference: 3:1, a backswing three times as long as the downswing (J. Novosel, Tour Tempo). Coaching practice.',
    rowDrive: 'Drive time',
    rowRecovery: 'Recovery time',
    rowDriveShort: 'Drive',
    rowRecoveryShort: 'Recovery',
    rowRatio: 'Rhythm',
    rowRef: 'Common reference: 1:2, a recovery twice as long as the drive (Concept2). Coaching practice.',
    noRatio: 'No ratio',
    barLabel: (a, b) => `${a} then ${b}, to scale`,
    refMark: r => `reference ${r}`,
    sports: SPORTS_EN,
  },
};
