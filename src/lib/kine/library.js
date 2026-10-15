// Olivier's reference exercises (physiotherapist, videos of 15 October 2026, with his consent for the app's tests).
// The instructions of exercises 1 to 3 are his own spoken explanation, transcribed (faster-whisper "medium", French)
// and set as steps; nothing is added to what he says. Exercise 4's video says only its angles (90, 120, 150 and 160
// degrees of elevation); its position and its pauses are what the video shows. Dosage, holds and tempo are his. Benefits are not stated in the videos and
// are not invented here (R9): the physiotherapist writes them per patient in the programme (KineWorkspace.jsx).
//
// The videos and their poses are not in this public repository. They are read from the media address of the build
// (VITE_KINE_MEDIA_URL, set by David) or chosen on the phone; see mediaUrl().
//
// `compare`: whether the app compares a patient's attempt with this reference. Measured on the reference's own
// landmarks (test/real-phone/reference/README.md): exercise 2's forearm rotation is not an angle the app reads, so it
// has no comparison (R8).

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
    compare: false,
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
      camera: 'Vidéo de démonstration\u00A0: l’appli ne lit pas encore cette rotation de l’avant-bras.',
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
      camera: 'Demonstration video: the app does not read this forearm rotation yet.',
    },
  },
  {
    id: 'abduction-horizontale',
    file: 'olivier-3-abduction-horizontale',
    compare: true,
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
      camera: 'Téléphone posé dans l’axe de la tête, à hauteur de la table, comme sur la vidéo.',
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
      camera: 'Phone in line with the head, at table height, as in the video.',
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

export const exerciseById = id => LIBRARY.find(e => e.id === id) ?? null;

// Where the references' media are served: the build's address (VITE_KINE_MEDIA_URL), or none.
export const MEDIA_BASE = (import.meta.env?.VITE_KINE_MEDIA_URL || '').replace(/\/?$/, '/');
export const hasMedia = () => MEDIA_BASE !== '/';

/** The URL of an exercise's video, poster or pose ('mp4', 'jpg', 'pose.json'); null with no media address. */
export function mediaUrl(exercise, kind = 'mp4') {
  return hasMedia() && exercise ? `${MEDIA_BASE}${exercise.file}.${kind}` : null;
}
