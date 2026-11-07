// Standardised fitness tests that are counts in a fixed time (David, 2 October 2026: published, standardised tests,
// so the app's count has a protocol and a meaning). Offered for self-assessment by healthy adults (wellness use),
// not for clinical use, diagnosis or rehabilitation (BACKLOG.md, note of 6 October). Two items of the Senior Fitness Test
// (Rikli & Jones): the 30-second chair stand and the 30-second arm curl. Each is counted by its movement's
// definition (core.ts LIFTS) and scored over a window that opens at the first rise.
//
// Protocol rules, as published for the 30-second chair stand (Jones, Rikli & Beam 1999, Res Q Exerc Sport
// 70(2):113-119) and applied alike to the arm curl in the same battery: the score is the number of full
// repetitions in 30 seconds; a repetition more than halfway up when time ends counts. Status: literature
// (protocol), not measured by us; the timing starts at the first rise because a video has no "go" signal
// (convention). No norm by age or sex is shown: the published tables could not be checked from here, and a
// norm from memory is not shown (R9).
// The list alone, without the counting code that scores it (fitness-tests.js): the choice of lift and the router read it
// at the first paint, and importing it from fitness-tests.js brought the whole counting core into the page's first
// chunk (Phase 5 of David's order of 6 November 2026, PLAN.md).

export const FITNESS_TESTS = {
  chair_stand_test: {
    windowSec: 30, illustration: 'bodyweight_squat', view: 'side',
    fr: 'Lever de chaise, 30 secondes', en: '30-second chair stand',
    steps: {
      fr: ['Posez le téléphone à la verticale, sur le côté, pour qu’il vous voie de profil.', 'Asseyez-vous au milieu d’une chaise sans accoudoirs, bras croisés sur la poitrine, le corps entier dans le cadre.', 'Levez-vous complètement et rasseyez-vous, le plus de fois possible en 30\u00A0secondes\u00A0; filmez quelques secondes de plus.'],
      en: ['Stand the phone upright at your side, so it sees you in profile.', 'Sit in the middle of a chair without armrests, arms crossed on your chest, your whole body in the frame.', 'Stand up fully and sit back down, as many times as you can in 30 seconds; keep filming a few seconds more.'],
    },
  },
  arm_curl_test: {
    // The protocol's weights, 5 lb for women and 8 lb for men (Rikli & Jones 1999), are given in kilograms.
    // Status: literature, to be checked against the published manual before release.
    windowSec: 30, illustration: 'bicep_curl', view: 'side',
    fr: 'Flexions de bras, 30 secondes', en: '30-second arm curl',
    steps: {
      fr: ['Posez le téléphone sur le côté, le bras qui travaille face à l’objectif.', 'Asseyez-vous dos droit, un haltère dans la main\u00A0: 2,3\u00A0kg pour une femme, 3,6\u00A0kg pour un homme.', 'Pliez puis tendez le bras en entier, le plus de fois possible en 30\u00A0secondes\u00A0; filmez quelques secondes de plus.'],
      en: ['Stand the phone at your side, working arm facing the lens.', 'Sit up straight with a dumbbell in hand: 2.3\u00A0kg for a woman, 3.6\u00A0kg for a man.', 'Curl all the way up and down, as many times as you can in 30 seconds; keep filming a few seconds more.'],
    },
  },
};

export const isTest = key => Object.hasOwn(FITNESS_TESTS, key);
