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
  primaryMuscles: string[];
  progression: string;
  regression: string;
}

export const PHYSIO_CATALOG: PhysioExerciseItem[] = [
  // ─── Épaule & Coiffe des rotateurs ───
  {
    key: 'prone_y_raise',
    nameFr: 'Élévation Y au Sol (Prone Y-Raise)',
    nameEn: 'Prone Y-Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Trapèze inférieur', 'Dentelé antérieur', 'Supra-épineux'],
    progression: 'Élévation Y sur banc incliné avec haltères légers (1-2 kg)',
    regression: 'Élévation bras à 90° (T-Raise) au sol sans charge',
  },
  {
    key: 'face_pull',
    nameFr: 'Tirage Visage (Face Pull)',
    nameEn: 'Cable Face Pull',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Sous-épineux', 'Petit rond', 'Deltoïde postérieur', 'Rhomboïdes'],
    progression: 'Face pull avec maintien isométrique de 3 secondes en contraction terminale',
    regression: 'Rotation externe avec élastique coude au corps',
  },
  {
    key: 'front_raise',
    nameFr: 'Élévation Antérieure (Front Raise)',
    nameEn: 'Front Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Deltoïde antérieur', 'Dentelé antérieur'],
    progression: 'Élévation antérieure haltère avec descente excentrique lente (3 secondes)',
    regression: 'Élévation antérieure au bâton bilatéral assistée',
  },
  {
    key: 'lateral_raise',
    nameFr: 'Élévation Latérale dans le Plan Scapulaire',
    nameEn: 'Scaption / Lateral Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule',
    regionLabelEn: 'Shoulder',
    targetJoint: 'shoulder',
    cameraView: 'front',
    primaryMuscles: ['Deltoïde moyen', 'Supra-épineux'],
    progression: 'Élévation latérale élastique avec pause au sommet',
    regression: 'Abduction isométrique contre un mur sans charge',
  },

  // ─── Rachis & Lombo-Pelvien ───
  {
    key: 'back_extension',
    nameFr: 'Extension Lombaire au Banc (Back Extension)',
    nameEn: 'Bench Back Extension',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Érecteurs du rachis', 'Grand fessier', 'Ischio-jambiers'],
    progression: 'Extension lombaire avec charge tenue contre la poitrine',
    regression: 'Extension lombaire au sol (Superman au sol avec amplitude réduite)',
  },
  {
    key: 'plank',
    nameFr: 'Gainage Ventral (Plank)',
    nameEn: 'Front Plank',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Transverse de l’abdomen', 'Oblique interne', 'Dentelé'],
    progression: 'Gainage ventral avec élévation alternée des membres (Bird Dog en planche)',
    regression: 'Gainage ventral sur les genoux',
  },
  {
    key: 'seated_row',
    nameFr: 'Tirage Horizontal Neutre (Seated Row)',
    nameEn: 'Seated Cable Row',
    region: 'spine',
    regionLabelFr: 'Rachis et tronc',
    regionLabelEn: 'Spine and trunk',
    targetJoint: 'elbow',
    cameraView: 'side',
    primaryMuscles: ['Rhomboïdes', 'Trapèze moyen', 'Grand dorsal'],
    progression: 'Tirage unilatéral avec contrôle anti-rotationnel du buste',
    regression: 'Tirage avec bande élastique assis au sol',
  },

  // ─── Genou & LCA / Fémoro-Patellaire ───
  {
    key: 'bulgarian_split_squat',
    nameFr: 'Fente Bulgare (Bulgarian Split Squat)',
    nameEn: 'Bulgarian Split Squat',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Grand fessier', 'Moyen fessier'],
    progression: 'Fente bulgare avec haltères et tempo excentrique 3-1-1',
    regression: 'Fente statique les deux pieds au sol',
  },
  {
    key: 'lunge',
    nameFr: 'Fente Arrière (Reverse Lunge)',
    nameEn: 'Reverse Lunge',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Ischio-jambiers', 'Fessiers'],
    progression: 'Fente arrière marchée continue',
    regression: 'Fente arrière assistée avec appui sur un support stable',
  },
  {
    key: 'leg_extension',
    nameFr: 'Extension de Genou Guidée (Leg Extension)',
    nameEn: 'Leg Extension Machine',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Vaste médial', 'Droit fémoral', 'Vaste latéral'],
    progression: 'Extension de genou unilatérale avec tempo 3-0-1',
    regression: 'Écrasement de coussin sous le genou en isométrie (quadriceps setting)',
  },
  {
    key: 'leg_press',
    nameFr: 'Presse à Cuisses (Leg Press)',
    nameEn: 'Leg Press',
    region: 'knee',
    regionLabelFr: 'Genou',
    regionLabelEn: 'Knee',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Grand fessier'],
    progression: 'Presse à cuisses unilatérale (Single leg press)',
    regression: 'Presse horizontale avec amplitude limitée à 60° de flexion',
  },

  // ─── Hanche & Bassin / Fessiers ───
  {
    key: 'hip_thrust',
    nameFr: 'Relevé de Bassin (Hip Thrust)',
    nameEn: 'Barbell Hip Thrust',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Grand fessier', 'Ischio-jambiers'],
    progression: 'Hip thrust unilatéral (Single leg hip thrust)',
    regression: 'Pont fessier au sol sans charge (Glute Bridge)',
  },
  {
    key: 'romanian_deadlift',
    nameFr: 'Soulevé de Terre Roumain (Romanian Deadlift)',
    nameEn: 'Romanian Deadlift (RDL)',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Ischio-jambiers', 'Grand fessier', 'Érecteurs du rachis'],
    progression: 'Soulevé de terre roumain sur une jambe (Single Leg RDL)',
    regression: 'Soulevé de terre roumain avec haltères légers et genoux fléchis',
  },
  {
    key: 'leg_curl',
    nameFr: 'Flexion de Jambes Machine (Leg Curl)',
    nameEn: 'Lying / Seated Leg Curl',
    region: 'hip',
    regionLabelFr: 'Hanche et bassin',
    regionLabelEn: 'Hip and pelvis',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Biceps fémoral', 'Semi-tendineux', 'Semi-membraneux'],
    progression: 'Leg curl unilatéral avec phase excentrique de 4 secondes',
    regression: 'Glisse-talons au sol avec serviette sur sol lisse',
  },

  // ─── Cheville & Tendon d'Achille ───
  {
    key: 'squat',
    nameFr: 'Squat avec Accent sur la Mobilité de Cheville',
    nameEn: 'Deep Squat with Ankle Dorsiflexion',
    region: 'ankle',
    regionLabelFr: 'Cheville',
    regionLabelEn: 'Ankle',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Soléaire', 'Gastrocnémien', 'Quadriceps'],
    progression: 'Squat complet sans talons surélevés au poids de corps',
    regression: 'Squat avec cales sous les talons (talons surélevés de 2-3 cm)',
  },
];

// Region names: French awaiting David's approval (R10).
export const PHYSIO_REGIONS = [
  { id: 'all', labelFr: 'Toutes les zones', labelEn: 'All Regions' },
  { id: 'shoulder', labelFr: 'Épaule', labelEn: 'Shoulder' },
  { id: 'spine', labelFr: 'Rachis et tronc', labelEn: 'Spine and trunk' },
  { id: 'knee', labelFr: 'Genou', labelEn: 'Knee' },
  { id: 'hip', labelFr: 'Hanche et bassin', labelEn: 'Hip and pelvis' },
  { id: 'ankle', labelFr: 'Cheville', labelEn: 'Ankle' },
];
