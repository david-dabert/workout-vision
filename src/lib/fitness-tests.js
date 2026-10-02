// Standardised fitness tests that are counts in a fixed time (David, 2 October 2026: tests a kinésithérapeute
// already uses, so the app's count has a protocol and a meaning). Two items of the Senior Fitness Test
// (Rikli & Jones): the 30-second chair stand and the 30-second arm curl. Each is counted by its movement's
// definition (core.ts LIFTS) and scored over a window that opens at the first rise.
//
// Protocol rules, as published for the 30-second chair stand (Jones, Rikli & Beam 1999, Res Q Exerc Sport
// 70(2):113-119) and applied alike to the arm curl in the same battery: the score is the number of full
// repetitions in 30 seconds; a repetition more than halfway up when time ends counts. Status: literature
// (protocol), not measured by us; the timing starts at the first rise because a video has no "go" signal
// (convention). No norm by age or sex is shown: the published tables could not be checked from here, and a
// norm from memory is not shown (R9).
export const FITNESS_TESTS = {
  chair_stand_test: {
    windowSec: 30, illustration: 'bodyweight_squat', view: 'side',
    fr: 'Lever de chaise, 30 secondes', en: '30-second chair stand',
    steps: {
      fr: ['Posez le téléphone à la verticale, sur le côté, pour qu’il vous voie de profil.', 'Asseyez-vous au milieu d’une chaise sans accoudoirs, bras croisés sur la poitrine, le corps entier dans le cadre.', 'Levez-vous complètement puis rasseyez-vous, autant de fois que possible pendant 30 secondes.'],
      en: ['Stand the phone upright at your side, so it sees you in profile.', 'Sit in the middle of a chair without armrests, arms crossed on your chest, your whole body in the frame.', 'Stand up fully and sit back down, as many times as you can in 30 seconds.'],
    },
  },
  arm_curl_test: {
    // The protocol's weights, 5 lb for women and 8 lb for men (Rikli & Jones 1999), are given in kilograms.
    // Status: literature, to be checked against the published manual before release.
    windowSec: 30, illustration: 'bicep_curl', view: 'side',
    fr: 'Flexions de bras, 30 secondes', en: '30-second arm curl',
    steps: {
      fr: ['Posez le téléphone sur le côté, le bras qui travaille face à l’objectif.', 'Asseyez-vous dos droit, un haltère dans la main : 2,3 kg pour une femme, 3,6 kg pour un homme.', 'Fléchissez le coude jusqu’en haut puis tendez le bras, autant de fois que possible pendant 30 secondes.'],
      en: ['Stand the phone at your side, working arm facing the lens.', 'Sit up straight with a dumbbell in hand: 2.3 kg for a woman, 3.6 kg for a man.', 'Curl all the way up and lower to a straight arm, as many times as you can in 30 seconds.'],
    },
  },
};

export const isTest = key => Object.hasOwn(FITNESS_TESTS, key);

/**
 * The test's score from the counted reps: the reps whose rise is past halfway within the window, the window
 * opening at the first rep's start. `complete` is false when the video ends before the window does.
 */
export function scoreTest(reps, videoEndSec, windowSec) {
  if (!reps.length) return { score: 0, reps: [], t0: null, complete: false, beyond: 0 };
  const t0 = reps[0].startTime, end = t0 + windowSec;
  const halfway = r => (Number.isFinite(r.concentricSec) ? r.startTime + r.concentricSec / 2 : (r.startTime + r.endTime) / 2);
  const kept = reps.filter(r => halfway(r) <= end);
  return { score: kept.length, reps: kept, t0, complete: Number.isFinite(videoEndSec) && videoEndSec >= end, beyond: reps.length - kept.length };
}
