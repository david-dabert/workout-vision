/**
 * Strengthening exercises by body area (CoachSuite.jsx, Renforcement par zone).
 *
 * Honesty pass of 14 October 2026 (PHY-1): the "clinical rationale" of each exercise is gone. None carried a source or
 * a status (R9), and several claimed treatment effects ("réduit le conflit sous-acromial", "élimine le valgus
 * dynamique", "renforcement ciblé du vaste médial oblique", "amnésie fessière", the squat "pour prévenir les entorses
 * récidivantes"). Rehabilitation is the physiotherapist's field: the screen says these exercises do not replace one.
 * The region labels name a body area, not an injury ("Genou & LCA" became "Genou").
 * What is left, status convention (accepted coaching practice; UNSOURCED, not measured by us): the area, the camera
 * view the app's guide uses, the main muscles worked, and one easier and one harder variation.
 * Second review (14 October 2026): the French names in sentence case, without the English in brackets ("Tirage
 * Visage (Face Pull)" read as a translation); the muscles in lower case; English fields for the muscles and the two
 * variations, which English mode showed in French. French names awaiting David's approval (R10).
 */

export interface PhysioExerciseItem {
  key: string;
  nameFr: string;
  nameEn: string;
  region: 'shoulder' | 'spine' | 'knee' | 'hip' | 'ankle';
  regionLabelFr: string;
  regionLabelEn: string;
  targetJoint: string;
  cameraView: 'side' | 'front';
  /** French, lower case: they are read inside a sentence, after "Muscles travaillés". */
  primaryMuscles: string[];
  primaryMusclesEn: string[];
  progression: string;
  regression: string;
  progressionEn: string;
  regressionEn: string;
}

export const PHYSIO_CATALOG: PhysioExerciseItem[] = [
  // ─── Épaule & Coiffe des rotateurs ───
  {
    key: 'prone_y_raise',
    nameFr: 'Élévation en Y à plat ventre',
    nameEn: 'Prone Y-Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['trapèze inférieur', 'dentelé antérieur', 'supra-épineux'],
    primaryMusclesEn: ['lower trapezius', 'serratus anterior', 'supraspinatus'],
    progression: 'Élévation Y sur banc incliné avec haltères légers (1-2 kg)',
    regression: 'Élévation bras à 90° (T-Raise) au sol sans charge',
    progressionEn: 'Y-raise on an incline bench with light dumbbells (1 to 2 kg)',
    regressionEn: 'T-raise (arms at 90°) lying face down, no load',
  },
  {
    key: 'face_pull',
    nameFr: 'Face pull à la poulie',
    nameEn: 'Cable Face Pull',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['sous-épineux', 'petit rond', 'deltoïde postérieur', 'rhomboïdes'],
    primaryMusclesEn: ['infraspinatus', 'teres minor', 'rear deltoid', 'rhomboids'],
    progression: 'Face pull avec maintien isométrique de 3 secondes en contraction terminale',
    regression: 'Rotation externe avec élastique coude au corps',
    progressionEn: 'Face pull with a 3-second hold at the end of the pull',
    regressionEn: 'Band external rotation, elbow at the side',
  },
  {
    key: 'front_raise',
    nameFr: 'Élévation frontale',
    nameEn: 'Front Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['deltoïde antérieur', 'dentelé antérieur'],
    primaryMusclesEn: ['front deltoid', 'serratus anterior'],
    progression: 'Élévation antérieure haltère avec descente excentrique lente (3 secondes)',
    regression: 'Élévation antérieure au bâton bilatéral assistée',
    progressionEn: 'Dumbbell front raise, 3-second lowering',
    regressionEn: 'Front raise with a stick held in both hands',
  },
  {
    key: 'lateral_raise',
    nameFr: 'Élévation latérale dans le plan de l’omoplate',
    nameEn: 'Scaption / Lateral Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'front',
    primaryMuscles: ['deltoïde moyen', 'supra-épineux'],
    primaryMusclesEn: ['middle deltoid', 'supraspinatus'],
    progression: 'Élévation latérale élastique avec pause au sommet',
    regression: 'Abduction isométrique contre un mur sans charge',
    progressionEn: 'Band lateral raise with a pause at the top',
    regressionEn: 'Isometric abduction against a wall, no load',
  },

  // ─── Rachis & Lombo-Pelvien ───
  {
    key: 'back_extension',
    nameFr: 'Extension au banc à lombaires',
    nameEn: 'Bench Back Extension',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['érecteurs du rachis', 'grand fessier', 'ischio-jambiers'],
    primaryMusclesEn: ['spinal erectors', 'gluteus maximus', 'hamstrings'],
    progression: 'Extension lombaire avec charge tenue contre la poitrine',
    regression: 'Extension lombaire au sol (Superman au sol avec amplitude réduite)',
    progressionEn: 'Back extension holding a weight against the chest',
    regressionEn: 'Superman on the floor, small range',
  },
  {
    key: 'plank',
    nameFr: 'Gainage ventral (planche)',
    nameEn: 'Front Plank',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['transverse de l’abdomen', 'oblique interne', 'dentelé'],
    primaryMusclesEn: ['transversus abdominis', 'internal oblique', 'serratus anterior'],
    progression: 'Gainage ventral avec élévation alternée des membres (Bird Dog en planche)',
    regression: 'Gainage ventral sur les genoux',
    progressionEn: 'Plank lifting one arm or one leg at a time',
    regressionEn: 'Plank on the knees',
  },
  {
    key: 'seated_row',
    nameFr: 'Tirage horizontal à la poulie basse',
    nameEn: 'Seated Cable Row',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'elbow',
    cameraView: 'side',
    primaryMuscles: ['rhomboïdes', 'trapèze moyen', 'grand dorsal'],
    primaryMusclesEn: ['rhomboids', 'middle trapezius', 'latissimus dorsi'],
    progression: 'Tirage unilatéral avec contrôle anti-rotationnel du buste',
    regression: 'Tirage avec bande élastique assis au sol',
    progressionEn: 'One-arm row, chest kept from rotating',
    regressionEn: 'Band row sitting on the floor',
  },

  // ─── Genou & LCA / Fémoro-Patellaire ───
  {
    key: 'bulgarian_split_squat',
    nameFr: 'Fente bulgare',
    nameEn: 'Bulgarian Split Squat',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['quadriceps', 'grand fessier', 'moyen fessier'],
    primaryMusclesEn: ['quadriceps', 'gluteus maximus', 'gluteus medius'],
    progression: 'Fente bulgare avec haltères et tempo excentrique 3-1-1',
    regression: 'Fente statique les deux pieds au sol',
    progressionEn: 'Bulgarian split squat with dumbbells, 3-1-1 tempo',
    regressionEn: 'Static lunge, both feet on the floor',
  },
  {
    // The catalogue's reverse lunge: 'lunge' is a counting definition, not a guide key, so programmes dropped it
    // (assessment of 14 October 2026).
    key: 'reverse_lunge',
    nameFr: 'Fente arrière',
    nameEn: 'Reverse Lunge',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['quadriceps', 'ischio-jambiers', 'fessiers'],
    primaryMusclesEn: ['quadriceps', 'hamstrings', 'glutes'],
    progression: 'Fente arrière marchée continue',
    regression: 'Fente arrière assistée avec appui sur un support stable',
    progressionEn: 'Walking reverse lunges',
    regressionEn: 'Reverse lunge holding on to a stable support',
  },
  {
    key: 'leg_extension',
    nameFr: 'Extension des jambes à la machine',
    nameEn: 'Leg Extension Machine',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['vaste médial', 'droit fémoral', 'vaste latéral'],
    primaryMusclesEn: ['vastus medialis', 'rectus femoris', 'vastus lateralis'],
    progression: 'Extension de genou unilatérale avec tempo 3-0-1',
    regression: 'Écrasement de coussin sous le genou en isométrie (quadriceps setting)',
    progressionEn: 'One-leg extension, 3-0-1 tempo',
    regressionEn: 'Quadriceps setting: press the knee down on a cushion',
  },
  {
    key: 'leg_press',
    nameFr: 'Presse à cuisses',
    nameEn: 'Leg Press',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['quadriceps', 'grand fessier'],
    primaryMusclesEn: ['quadriceps', 'gluteus maximus'],
    progression: 'Presse à cuisses unilatérale (Single leg press)',
    regression: 'Presse horizontale avec amplitude limitée à 60° de flexion',
    progressionEn: 'One-leg press',
    regressionEn: 'Horizontal press, knees bent to 60° at most',
  },

  // ─── Hanche & Bassin / Fessiers ───
  {
    key: 'hip_thrust',
    nameFr: 'Hip thrust à la barre',
    nameEn: 'Barbell Hip Thrust',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['grand fessier', 'ischio-jambiers'],
    primaryMusclesEn: ['gluteus maximus', 'hamstrings'],
    progression: 'Hip thrust unilatéral (Single leg hip thrust)',
    regression: 'Pont fessier au sol sans charge (Glute Bridge)',
    progressionEn: 'One-leg hip thrust',
    regressionEn: 'Glute bridge on the floor, no load',
  },
  {
    key: 'romanian_deadlift',
    nameFr: 'Soulevé de terre roumain',
    nameEn: 'Romanian Deadlift (RDL)',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['ischio-jambiers', 'grand fessier', 'érecteurs du rachis'],
    primaryMusclesEn: ['hamstrings', 'gluteus maximus', 'spinal erectors'],
    progression: 'Soulevé de terre roumain sur une jambe (Single Leg RDL)',
    regression: 'Soulevé de terre roumain avec haltères légers et genoux fléchis',
    progressionEn: 'One-leg Romanian deadlift',
    regressionEn: 'Romanian deadlift with light dumbbells, knees a little more bent',
  },
  {
    key: 'leg_curl',
    nameFr: 'Leg curl à la machine',
    nameEn: 'Lying / Seated Leg Curl',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['biceps fémoral', 'semi-tendineux', 'semi-membraneux'],
    primaryMusclesEn: ['biceps femoris', 'semitendinosus', 'semimembranosus'],
    progression: 'Leg curl unilatéral avec phase excentrique de 4 secondes',
    regression: 'Glisse-talons au sol avec serviette sur sol lisse',
    progressionEn: 'One-leg curl, 4-second lowering',
    regressionEn: 'Heel slides on a towel, on a smooth floor',
  },

  // ─── Cheville & Tendon d'Achille ───
  {
    key: 'squat',
    nameFr: 'Squat profond, mobilité de cheville',
    nameEn: 'Deep Squat with Ankle Dorsiflexion',
    region: 'ankle',
    regionLabelFr: 'Cheville',
    regionLabelEn: 'Ankle',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['soléaire', 'gastrocnémien', 'quadriceps'],
    primaryMusclesEn: ['soleus', 'gastrocnemius', 'quadriceps'],
    progression: 'Squat complet sans talons surélevés au poids de corps',
    regression: 'Squat avec cales sous les talons (talons surélevés de 2-3 cm)',
    progressionEn: 'Full bodyweight squat, heels flat',
    regressionEn: 'Squat with a 2 to 3 cm wedge under the heels',
  },
];

// Region names: French awaiting David's approval (R10).
export const PHYSIO_REGIONS = [
  { id: 'all', labelFr: 'Toutes les zones', labelEn: 'All areas' },
  { id: 'shoulder', labelFr: 'Épaule', labelEn: 'Shoulder' },
  { id: 'spine', labelFr: 'Rachis et tronc', labelEn: 'Spine and trunk' },
  { id: 'knee', labelFr: 'Genou', labelEn: 'Knee' },
  { id: 'hip', labelFr: 'Hanche et bassin', labelEn: 'Hip and pelvis' },
  { id: 'ankle', labelFr: 'Cheville', labelEn: 'Ankle' },
];
