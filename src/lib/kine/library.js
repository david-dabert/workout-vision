// Olivier's reference exercises (physiotherapist, videos of 15 October 2026, with his consent for the app's tests).
// The instructions of exercises 1 to 3 are his own spoken explanation, transcribed (faster-whisper "medium", French)
// and set as steps; nothing is added to what he says. Exercise 4's video says only its angles (90, 120, 150 and 160
// degrees of elevation); its position and its pauses are what the video shows. Dosage, holds and tempo are his. Benefits are not stated in the videos and
// are not invented here (R9): the physiotherapist writes them per patient in the programme (KineWorkspace.jsx).
//
// The videos and their poses are not in this public repository. They are read from the media address of the build
// (VITE_KINE_MEDIA_URL, set by David) or chosen on the phone; see mediaUrl().
//
// `compare`: whether the app compares a patient's attempt with this reference (test/real-phone/reference/README.md).
// `measures`: what is compared, when not the default shoulder and elbow angles (src/lib/reference/compare.js):
// exercises 2 and 3 are compared on where a segment points, which their two pose readings agree on (16 October 2026);
// their joint angles do not (R8).
// `side`: the arm the reference works, for an exercise done with one arm. The physiotherapist sets the patient's side
// in the programme; the other side is compared as the reference seen in a mirror (compare.js, compareAttempt).

export const LIBRARY = Object.freeze([
  {
    id: 'mains-jointes',
    file: 'olivier-1-mains-jointes',
    compare: true,
    dosage: { reps: 10, sets: 5 },
    holds: [{ sec: 5 }, { sec: 3 }],
    fr: {
      title: 'Élévation mains jointes, coudes ouverts',
      position: 'Couché sur le dos, les doigts des deux mains joints.',
      steps: [
        'Élever les bras à la verticale.',
        'Plier les coudes pour descendre les mains sur le front.',
        'Tourner les mains vers le plafond et écarter les coudes.',
        'Maintenir la position, bien relâché, 5 secondes.',
        'Refermer les coudes au-dessus de la poitrine.',
        'Remonter les mains au-dessus des coudes, en formant un ovale entre les deux bras.',
        'Descendre en arrière au-dessus de la tête.',
        'Finir coudes tendus le temps d’une inspiration, et bloquer 3 secondes.',
        'Remonter à la verticale.',
      ],
      camera: 'Téléphone posé de profil, à hauteur de la table, le corps entier dans l’image.',
    },
    en: {
      title: 'Clasped-hands raise, elbows open',
      position: 'Lying on the back, the fingers of both hands interlaced.',
      steps: [
        'Raise the arms to vertical.',
        'Bend the elbows to bring the hands down to the forehead.',
        'Turn the hands to the ceiling and open the elbows.',
        'Hold, relaxed, for 5 seconds.',
        'Close the elbows above the chest.',
        'Raise the hands above the elbows, the arms forming an oval.',
        'Lower back over the head.',
        'Finish elbows straight for one breath in, and hold 3 seconds.',
        'Return to vertical.',
      ],
      camera: 'Phone side-on, at table height, the whole body in the picture.',
    },
  },
  {
    id: 'rotation-externe',
    file: 'olivier-2-rotation-externe',
    compare: true,
    // The forearm (left elbow to left wrist). Two readings of the reference (normal, and a copy 1.2 times slower) agree
    // to 2.6 degrees (90th percentile, its elbow angle to 29); below the horizontal the forearm crosses the face and the
    // pose is lost, so that position is not judged. Status: experimental (no patient attempt yet).
    measures: { joints: {}, directions: { leftForearm: { from: 13, to: 15 } } },
    side: 'left',
    dosage: { reps: 10, sets: 3 },
    holds: [{ sec: 3 }, { sec: 3 }],
    fr: {
      title: 'Rotation externe, couché sur le côté',
      position: 'Couché sur le côté droit, la main droite soutient l’avant-bras gauche.',
      steps: [
        'Partir de la position horizontale.',
        'Monter en rotation externe, au-dessus de l’horizontale, et maintenir 3 secondes.',
        'Descendre en dessous de l’horizontale et maintenir 3 secondes.',
        'Alterner au-dessus et en dessous de l’horizontale.',
      ],
      camera: 'Téléphone posé face au patient, à hauteur de la table, comme sur la vidéo de référence. La position sous l’horizontale, où l’avant-bras passe devant le visage, n’est pas jugée.',
    },
    en: {
      title: 'External rotation, side-lying',
      position: 'Lying on the right side, the right hand supporting the left forearm.',
      steps: [
        'Start from the horizontal.',
        'Rotate outwards, above the horizontal, and hold 3 seconds.',
        'Go below the horizontal and hold 3 seconds.',
        'Alternate above and below the horizontal.',
      ],
      camera: 'Phone facing the patient, at table height, as in the reference video. The position below the horizontal, where the forearm crosses the face, is not judged.',
    },
  },
  {
    id: 'abduction-horizontale',
    file: 'olivier-3-abduction-horizontale',
    // The arm (left shoulder to left wrist), not its joint angles: filmed from the head end, the straight arm read 149
    // degrees at the elbow in one reading and 95 in the other (16 October 2026, demo recording). Its direction, without
    // the moments when the lowered arm lies on the other one, agrees to 6.5 degrees between the two readings (90th
    // percentile). Status: experimental (no patient attempt yet).
    compare: true,
    measures: { joints: {}, directions: { leftArm: { from: 11, to: 15, apartFrom: 16 } } },
    side: 'left',
    dosage: { reps: 10, sets: 3 },
    holds: [{ sec: 5 }],
    tempo: { downSec: 5 },
    fr: {
      title: 'Descente du bras en 5 secondes, couché sur le côté',
      position: 'Couché sur le côté, le bras droit étendu, la tête soutenue.',
      steps: [
        'Partir le bras gauche à la verticale.',
        'Descendre lentement, en 5 secondes, en fixant l’omoplate.',
        'Rester dans le plan horizontal 5 secondes.',
        'Remonter à la verticale à vitesse normale, et recommencer.',
      ],
      camera: 'Téléphone posé dans l’axe de la tête, comme sur la vidéo de référence, le bras entier dans l’image. Les moments où les deux bras se superposent dans l’image ne sont pas jugés.',
    },
    en: {
      title: 'Arm lowered over 5 seconds, side-lying',
      position: 'Lying on the side, the right arm stretched out, the head supported.',
      steps: [
        'Start with the left arm vertical.',
        'Lower it slowly, over 5 seconds, keeping the shoulder blade fixed.',
        'Stay in the horizontal plane for 5 seconds.',
        'Return to vertical at normal speed, and repeat.',
      ],
      camera: 'Phone in line with the head, as in the reference video, the whole arm in the picture. The moments when the two arms overlap in the picture are not judged.',
    },
  },
  {
    id: 'elevation-paliers',
    file: 'olivier-4-elevation-paliers',
    compare: true,
    dosage: { reps: 1, sets: 1 },
    targets: [90, 120, 150, 160],
    fr: {
      title: 'Élévation par paliers\u00A0: 90°, 120°, 150°, 160°',
      position: 'Couché sur le dos, les bras le long du corps.',
      steps: [
        'Élever les bras tendus jusqu’à 90°, et marquer un temps.',
        'Monter à 120°, puis à 150°, en marquant un temps à chaque palier.',
        'Finir à 160° d’élévation.',
      ],
      camera: 'Téléphone posé de profil, à hauteur de la table, le corps entier dans l’image.',
    },
    en: {
      title: 'Raise in stages: 90°, 120°, 150°, 160°',
      position: 'Lying on the back, the arms by the sides.',
      steps: [
        'Raise the straight arms to 90°, and pause.',
        'Go to 120°, then 150°, pausing at each stage.',
        'Finish at 160° of elevation.',
      ],
      camera: 'Phone side-on, at table height, the whole body in the picture.',
    },
  },
]);

/**
 * Standardized Functional Mobility & Physical Therapy Screening Library.
 * Grounded in sports medicine and clinical physical therapy protocols (Squat University / Gray Cook FMS).
 */
export const MOBILITY_SCREENS = Object.freeze([
  {
    id: 'test-dorsiflexion-cheville',
    file: 'squat-u-dorsiflexion',
    category: 'mobility_screen',
    compare: true,
    dosage: { reps: 5, sets: 1 },
    targets: [35, 40],
    fr: {
      title: 'Bilan de flexion de cheville (Test genou-au-mur)',
      position: 'En fente semi-à-genoux face à un mur, pied perpendiculaire, talon au sol.',
      steps: [
        'Avancer le genou dans l’axe du 2e orteil vers le mur.',
        'Garder le talon strictement plaqué au sol sans le soulever.',
        'Maintenir la flexion maximale 3 secondes, puis relâcher.',
      ],
      camera: 'Téléphone posé de profil au sol, cadrant la cheville, le pied et le genou.',
    },
    en: {
      title: 'Ankle Dorsiflexion Screen (Knee-to-Wall Test)',
      position: 'In a half-kneeling lunge facing a wall, foot square, heel pinned to the floor.',
      steps: [
        'Drive the knee forward over the 2nd toe toward the wall.',
        'Keep the heel strictly pinned to the ground without lifting.',
        'Hold the terminal dorsiflexion for 3 seconds, then release.',
      ],
      camera: 'Phone placed side-on at floor level, framing the ankle, foot, and knee.',
    },
  },
  {
    id: 'test-rotation-hanche',
    file: 'squat-u-rotation-hanche',
    category: 'mobility_screen',
    compare: true,
    dosage: { reps: 5, sets: 1 },
    targets: [35, 45],
    fr: {
      title: 'Bilan de rotation de hanche (Conflit et mobilité capsulaire)',
      position: 'Assis sur une table haute, genoux à 90°, cuisses parallèles.',
      steps: [
        'Tourner le bas de jambe vers l’extérieur pour tester la rotation interne.',
        'Maintenir 3 secondes sans incliner le tronc.',
        'Tourner le bas de jambe vers l’intérieur pour tester la rotation externe.',
      ],
      camera: 'Téléphone posé face au patient à hauteur des genoux.',
    },
    en: {
      title: 'Hip Rotation Screen (Capsular Mobility & Impingement)',
      position: 'Seated on an elevated bench/table, knees at 90°, thighs parallel.',
      steps: [
        'Pivot the lower leg outward to assess internal rotation.',
        'Hold for 3 seconds without leaning the torso.',
        'Pivot the lower leg inward to assess external rotation.',
      ],
      camera: 'Phone placed facing the subject at knee height.',
    },
  },
  {
    id: 'test-mobilite-epaule-rachis',
    file: 'squat-u-epaule-rachis',
    category: 'mobility_screen',
    compare: true,
    dosage: { reps: 3, sets: 1 },
    targets: [170, 180],
    fr: {
      title: 'Bilan d’élévation d’épaule et extension thoracique',
      position: 'Debout, dos appuyé à un mur plat, talons à 10 cm du mur.',
      steps: [
        'Plaquer le bas du dos et les côtes contre le mur.',
        'Lever les deux bras tendus au-dessus de la tête jusqu’au mur.',
        'Ne pas cambrer le bas du dos pour tricher sur l’amplitude.',
      ],
      camera: 'Téléphone posé de profil à hauteur de poitrine.',
    },
    en: {
      title: 'Overhead Shoulder & Thoracic Extension Screen',
      position: 'Standing with upper back against a flat wall, heels 10 cm from the wall.',
      steps: [
        'Keep the lower back flat and ribs down against the wall.',
        'Raise straight arms overhead toward the wall.',
        'Do not hyperextend the lumbar spine to compensate for stiff shoulders.',
      ],
      camera: 'Phone placed side-on at chest height.',
    },
  },
  {
    id: 'test-stabilite-unipodale',
    file: 'squat-u-stabilite-unipodale',
    category: 'mobility_screen',
    compare: true,
    dosage: { reps: 5, sets: 1 },
    targets: [0, 5],
    fr: {
      title: 'Bilan de stabilité unipodale (Test de Trendelenburg & Valgus)',
      position: 'Debout sur une jambe, bras croisés sur la poitrine.',
      steps: [
        'Fléchir légèrement le genou d’appui à 30-45°.',
        'Garder le bassin parfaitement horizontal sans bascule.',
        'Maintenir le genou aligné avec le 2e orteil sans rentrée vers l’intérieur.',
      ],
      camera: 'Téléphone posé de face à hauteur du bassin.',
    },
    en: {
      title: 'Single-Leg Dynamic Stability Screen (Trendelenburg & Valgus)',
      position: 'Standing on one leg, arms folded across the chest.',
      steps: [
        'Lower into a single-leg mini squat (30-45° knee flexion).',
        'Maintain level hips without pelvic drop.',
        'Keep the knee tracking strictly over the 2nd toe without medial collapse.',
      ],
      camera: 'Phone placed front-on at hip height.',
    },
  },
  {
    id: 'test-aslr-chaine-posterieure',
    file: 'squat-u-aslr',
    category: 'mobility_screen',
    compare: true,
    dosage: { reps: 5, sets: 1 },
    targets: [80, 85],
    fr: {
      title: 'Bilan de souplesse de jambe tendue (ASLR Ischio-jambiers)',
      position: 'Couché sur le dos au sol, les deux jambes tendues, bras le long du corps.',
      steps: [
        'Lever une jambe tendue le plus haut possible sans plier le genou.',
        'La jambe opposée doit rester plaquée au sol sans se fléchir.',
        'Maintenir 2 secondes au point haut et redescendre sous contrôle.',
      ],
      camera: 'Téléphone posé de profil au sol au niveau du bassin.',
    },
    en: {
      title: 'Active Straight Leg Raise Screen (ASLR Hamstring Length)',
      position: 'Lying flat on the back, both legs extended straight, arms by sides.',
      steps: [
        'Raise one straight leg as high as possible without bending the knee.',
        'Keep the opposite leg pinned flat to the floor without knee flexion.',
        'Hold for 2 seconds at peak height and lower under control.',
      ],
      camera: 'Phone placed side-on at floor level aligned with hips.',
    },
  },
]);

export const ALL_EXERCISES = Object.freeze([...LIBRARY, ...MOBILITY_SCREENS]);

export const exerciseById = id => ALL_EXERCISES.find(e => e.id === id) ?? null;

// Where the references' media are served: the build's address (VITE_KINE_MEDIA_URL), or none.
export const MEDIA_BASE = (import.meta.env?.VITE_KINE_MEDIA_URL || '').replace(/\/?$/, '/');
export const hasMedia = () => MEDIA_BASE !== '/';

/** The URL of an exercise's video, poster or pose ('mp4', 'jpg', 'pose.json'); null with no media address. */
export function mediaUrl(exercise, kind = 'mp4') {
  return hasMedia() && exercise ? `${MEDIA_BASE}${exercise.file}.${kind}` : null;
}

