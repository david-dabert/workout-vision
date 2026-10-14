import type { ActivitySpec } from '../types';

/**
 * Volleyball, the first activity declared as data (docs/VISION.md): jumps counted as training load, each jump's height
 * from its flight time with the margin the sample rate allows, the last contact of a spike run-up where the samples
 * can time it, and a landing check from the front. Every number below carries its source and R9 status.
 *
 * French: every French line of this file was written or reworded on 14 October 2026 and awaits David's approval (R10).
 *
 * MediaPipe pose indices: 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 toes (foot index).
 */
export const volleyball: ActivitySpec = {
  key: 'volleyball',
  name: { fr: 'Volley-ball', en: 'Volleyball' },
  tagline: {
    fr: 'Vos sauts comptés et leur hauteur, chaque mesure avec sa marge d’erreur.',
    en: 'Your jumps counted and their height, each measure with its margin of error.',
  },
  filming: [
    { fr: 'Posez le téléphone, immobile, à hauteur de hanche.', en: 'Set the phone down, still, at hip height.' },
    { fr: 'Le corps entier dans l’image, pieds compris, du premier appui à la dernière réception.', en: 'The whole body in the frame, feet included, from the first step to the last landing.' },
    { fr: 'De face pour voir les genoux à la réception, de profil pour l’élan.', en: 'From the front to see the knees on landing, from the side for the run-up.' },
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
      formulaText: { fr: 'n = décollages où le bassin monte (suivi de la charge d’entraînement)', en: 'n = takeoffs in which the hip rises (training load)' },
      unit: null,
      summary: 'count',
      source: 'Jump count as a training-load measure in volleyball (jumps counted on video): Bahr & Bahr, Br J Sports Med 2014;48(17):1322-1326',
      status: 'experimental',
      error: {
        kind: 'none',
        note: { fr: 'Exact sur les sauts de synthèse de 15\u00A0cm et plus (les plus petits ne sont pas comptés)\u00A0; pas encore mesuré sur une personne filmée.', en: 'Exact on the synthetic jumps of 15 cm and more (smaller ones are not counted); not yet measured on a filmed person.' },
      },
    },
    {
      key: 'height',
      label: { fr: 'Meilleur saut', en: 'Best jump' },
      each: { fr: 'Hauteur', en: 'Height' },
      of: 'jump',
      formula: {
        kind: 'flightHeight',
        maxRelError: { value: 0.25, source: 'UNSOURCED: as for the run-up, a height known to more than a quarter of itself says nothing a coach can use', status: 'experimental' },
      },
      formulaText: { fr: 'h = v₀²/2g avec v₀ = (g·t²/2 − Δ)/t\u00A0: t le temps de vol, Δ l’écart de hauteur de la hanche entre décollage et réception', en: 'h = v₀²/2g with v₀ = (g·t²/2 − Δ)/t: t the flight time, Δ how much lower the hip lands than it took off' },
      unit: 'cm',
      summary: 'max',
      source: 'Flight-time method, h = g·t²/8 (literature): Bosco, Luhtanen & Komi, Eur J Appl Physiol 1983;50:273-282. A phone video\'s flight time agrees with a force plate\'s flight time: Balsalobre-Fernández, Glaister & Lockey, J Sports Sci 2015;33(15):1574-1579. The method assumes the body lands as it took off; a lower landing lengthens t and overstates h. The correction for it is ours (experimental): Δ is read on the parabola of the hip\'s flight, which reduces the height to the rise from the takeoff to the top of the hip; it takes the hip for the body\'s centre of mass in the air, not yet measured on a filmed person.',
      status: 'experimental',
      error: {
        kind: 'sampling',
        note: { fr: 'Le décollage tombe entre deux images, et les points du corps bougent un peu d’une image à l’autre\u00A0: la marge tient compte des deux. Une réception plus basse que le décollage est corrigée par la courbe de la hanche.', en: 'The takeoff falls between two frames, and the body points jitter a little from frame to frame: the margin covers both. A landing lower than the takeoff is corrected from the hip\'s curve.' },
      },
    },
    {
      key: 'approach',
      label: { fr: 'Durée du dernier appui (moyenne)', en: 'Last contact time (mean)' },
      each: { fr: 'Dernier appui', en: 'Last contact' },
      of: 'jump',
      formula: {
        kind: 'contactBefore', before: 'stride',
        withinSec: { value: 1, source: 'UNSOURCED: the last stride of a run-up lands well under a second before takeoff', status: 'experimental' },
        maxRelError: { value: 0.25, source: 'UNSOURCED: a time known to more than a quarter of itself says nothing a coach can use', status: 'experimental' },
        minRate: { value: 20, source: 'UNSOURCED: a run-up stride\'s flight lasts about 0.1 s on the synthetic run-ups (not yet measured on filmed ones), so under 20 samples a second it spans fewer than the stride\'s 2 samples', status: 'experimental' },
      },
      formulaText: { fr: 't = décollage − pose du dernier appui', en: 't = takeoff − touchdown of the last step' },
      unit: 's',
      summary: 'mean',
      source: 'UNSOURCED: coaching convention, the rhythm of the last steps of a spike run-up',
      status: 'experimental',
      error: {
        kind: 'sampling',
        note: { fr: 'Deux contacts, chacun entre deux images\u00A0: fiable à partir d’environ 60\u00A0images par seconde.', en: 'Two contacts, each between two frames: reliable from about 60 frames a second.' },
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
      source: 'Knee-to-ankle separation ratio; its agreement with 3D analysis is reported by Ortiz et al., Open Access J Sports Med 2016;7:65-73. The 0.8 flag is UNSOURCED.',
      status: 'experimental',
      error: {
        kind: 'none',
        note: { fr: 'Pas encore mesuré sur des réceptions filmées\u00A0: une indication à vérifier à l’œil, jamais un diagnostic.', en: 'Not yet measured on filmed landings: a pointer to check by eye, never a diagnosis.' },
      },
      view: 'front',
    },
  ],
};
