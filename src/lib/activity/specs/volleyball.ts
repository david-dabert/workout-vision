import type { ActivitySpec } from '../types';

/**
 * Volleyball, the first activity declared as data (docs/VISION.md): jumps counted as training load, each jump's height
 * from its flight time with the margin the sample rate allows, the last contact of a spike run-up where the samples
 * can time it, and a landing check from the front. Every number below carries its source and R9 status.
 *
 * MediaPipe pose indices: 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 toes (foot index).
 */
export const volleyball: ActivitySpec = {
  key: 'volleyball',
  name: { fr: 'Volley-ball', en: 'Volleyball' },
  tagline: {
    fr: 'Vos sauts comptés, leur hauteur et vos réceptions, avec la marge d’erreur de chaque valeur.',
    en: 'Your jumps counted, their height and your landings, each value with its margin of error.',
  },
  filming: [
    { fr: 'Posez le téléphone, immobile, à hauteur de hanche.', en: 'Set the phone down, still, at hip height.' },
    { fr: 'Le corps entier dans l’image, pieds compris, du premier appui à la dernière réception.', en: 'The whole body in the frame, feet included, from the first step to the last landing.' },
    { fr: 'De face pour lire les genoux à la réception, de profil pour l’élan.', en: 'From the front to read the knees on landing, from the side for the run-up.' },
  ],
  ground: 'feet',
  signals: {
    // The lowest of the heels and toes: the foot that touches the ground last at takeoff and first on landing.
    feet: { kind: 'lowest', points: [29, 30, 31, 32] },
    hip: { kind: 'height', points: [23, 24] },
    knees: { kind: 'width', points: [25, 26] },
    ankles: { kind: 'width', points: [27, 28] },
  },
  events: {
    flight: {
      kind: 'airborne', signal: 'feet',
      floor: { value: 0.03, source: 'UNSOURCED: about 2.5 cm on a 0.85 m leg, above the noise of a foot at rest on the synthetic jumps', status: 'experimental' },
      noiseK: { value: 4, source: 'UNSOURCED: four standard deviations of the foot\'s own noise on the ground', status: 'experimental' },
    },
    jump: {
      kind: 'jump', flight: 'flight', hip: 'hip',
      minRise: { value: 0.2, source: 'UNSOURCED: the hip of a 10 cm jump rises about 0.2 leg lengths above standing (8 cm on the toes plus the jump); a run-up stride rises far less', status: 'experimental' },
      minFlightSec: { value: 0.2, source: 'UNSOURCED: a 0.2 s flight is a 4.9 cm jump (h = g·t²/8), below any volleyball jump', status: 'experimental' },
    },
    stride: {
      kind: 'stride', flight: 'flight', jump: 'jump',
      minSamples: { value: 2, source: 'UNSOURCED: one sample above the ground band may be a foot point\'s noise', status: 'experimental' },
    },
    landing: {
      kind: 'landing', jump: 'jump', hip: 'hip',
      withinSec: { value: 0.8, source: 'UNSOURCED: the hip reaches its lowest well within 0.8 s of touchdown on the synthetic landings', status: 'experimental' },
    },
  },
  measures: [
    {
      key: 'jumps',
      label: { fr: 'Sauts', en: 'Jumps' },
      of: 'jump',
      formula: { kind: 'count' },
      formulaText: { fr: 'n = envols où le bassin monte (charge d’entraînement)', en: 'n = flights in which the hip rises (training load)' },
      unit: null,
      summary: 'count',
      source: 'Jump count as a load measure in volleyball: Bahr & Bahr, Br J Sports Med 2014;48(17):1322 (cited from the strategist\'s report of 14 October 2026, not re-read here)',
      status: 'experimental',
      error: {
        kind: 'none',
        note: { fr: 'Exact sur les sauts de synthèse\u00A0; pas encore mesuré sur une personne filmée\u00A0: à confirmer.', en: 'Exact on the synthetic jumps; not yet measured on a filmed person: to confirm.' },
      },
    },
    {
      key: 'height',
      label: { fr: 'Meilleur saut', en: 'Best jump' },
      each: { fr: 'Hauteur', en: 'Height' },
      of: 'jump',
      formula: { kind: 'flightHeight' },
      formulaText: { fr: 'h = g·t²/8, t le temps d’envol', en: 'h = g·t²/8, t the flight time' },
      unit: 'cm',
      summary: 'max',
      source: 'Flight-time method: Bosco, Luhtanen & Komi, Eur J Appl Physiol 1983;50:273-282; checked against a force plate with a phone app by Balsalobre-Fernández et al., J Sports Sci 2015 (cited from the strategist\'s report of 14 October 2026). It assumes the body lands as it took off; landing with bent legs lengthens t.',
      status: 'literature',
      error: {
        kind: 'sampling',
        note: { fr: 'Chaque contact tombe entre deux images lues, et les points des pieds bougent un peu d’une image à l’autre\u00A0: la marge tient compte des deux.', en: 'Each contact falls between two frames read, and the foot points jitter a little from frame to frame: the margin covers both.' },
      },
    },
    {
      key: 'approach',
      label: { fr: 'Dernier appui de l’élan', en: 'Last contact of the run-up' },
      of: 'jump',
      formula: {
        kind: 'contactBefore', before: 'stride',
        withinSec: { value: 1, source: 'UNSOURCED: the last stride of a run-up lands well under a second before takeoff', status: 'experimental' },
        maxRelError: { value: 0.25, source: 'UNSOURCED: a time known to more than a quarter of itself says nothing a coach can use', status: 'experimental' },
      },
      formulaText: { fr: 't = envol − pose du dernier pas', en: 't = takeoff − touchdown of the last stride' },
      unit: 's',
      summary: 'mean',
      source: 'UNSOURCED: coaching convention, the rhythm of the last steps of a spike run-up (strategist\'s report of 14 October 2026)',
      status: 'experimental',
      error: {
        kind: 'sampling',
        note: { fr: 'Deux contacts, chacun entre deux images\u00A0: lisible à partir de 60 images par seconde environ.', en: 'Two contacts, each between two frames: readable from about 60 frames a second.' },
      },
    },
    {
      key: 'landing',
      label: { fr: 'Genoux à la réception', en: 'Knees on landing' },
      of: 'landing',
      formula: {
        kind: 'widthRatio', num: 'knees', den: 'ankles',
        below: { value: 0.8, source: 'UNSOURCED: knees closer than the ankles by a fifth', status: 'experimental' },
      },
      formulaText: { fr: 'écart des genoux / écart des chevilles, au plus bas de la réception', en: 'knee gap / ankle gap, at the lowest point of the landing' },
      unit: null,
      summary: 'min',
      source: 'Knee-to-ankle separation ratio; its agreement with 3D analysis is reported by Ortiz et al., Open Access J Sports Med 2016 (cited from the strategist\'s report of 14 October 2026, not re-read here). The 0.8 flag is UNSOURCED.',
      status: 'experimental',
      error: {
        kind: 'none',
        note: { fr: 'Pas encore mesuré sur des réceptions filmées\u00A0: une indication à vérifier à l’œil, jamais un diagnostic.', en: 'Not yet measured on filmed landings: a pointer to check by eye, never a diagnosis.' },
      },
      view: 'front',
    },
  ],
};
