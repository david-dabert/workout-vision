/**
 * Clinical Physiotherapy & Joint Rehabilitation Catalog
 *
 * Categorized by anatomical region and joint complex:
 * - Shoulder & Rotator Cuff (Épaule & Coiffe des rotateurs)
 * - Spine & Lumbopelvic Core (Rachis & Lombo-Pelvien)
 * - Knee & ACL / Patellofemoral (Genou & LCA)
 * - Hip & Pelvis / Glute Complex (Hanche & Bassin)
 * - Ankle & Achilles / Foot (Cheville & Tendon d'Achille)
 *
 * Each exercise specifies camera view recommendations, clinical rationale,
 * and structured progression/regression paths.
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
  clinicalRationaleFr: string;
  clinicalRationaleEn: string;
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
    regionLabelFr: 'Épaule & Coiffe des rotateurs',
    regionLabelEn: 'Shoulder & Rotator Cuff',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Trapèze inférieur', 'Dentelé antérieur', 'Supra-épineux'],
    clinicalRationaleFr: 'Activation sélective du trapèze inférieur et du dentelé antérieur sans suractivation du trapèze supérieur. Réduit le conflit sous-acromial.',
    clinicalRationaleEn: 'Selective lower trapezius and serratus anterior activation with minimal upper trapezius dominance. Relieves subacromial impingement.',
    progression: 'Élévation Y sur banc incliné avec haltères légers (1-2 kg)',
    regression: 'Élévation bras à 90° (T-Raise) au sol sans charge',
  },
  {
    key: 'face_pull',
    nameFr: 'Tirage Visage (Face Pull)',
    nameEn: 'Cable Face Pull',
    region: 'shoulder',
    regionLabelFr: 'Épaule & Coiffe des rotateurs',
    regionLabelEn: 'Shoulder & Rotator Cuff',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Sous-épineux', 'Petit rond', 'Deltoïde postérieur', 'Rhomboïdes'],
    clinicalRationaleFr: 'Renforce la rotation externe gléno-humérale et la rétraction scapulaire pour contrer l’enroulement antérieur des épaules.',
    clinicalRationaleEn: 'Strengthens external rotators and scapular retractors, counteracting protracted forward shoulder posture.',
    progression: 'Face pull avec maintien isométrique de 3 secondes en contraction terminale',
    regression: 'Rotation externe avec élastique coude au corps',
  },
  {
    key: 'front_raise',
    nameFr: 'Élévation Antérieure (Front Raise)',
    nameEn: 'Front Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule & Coiffe des rotateurs',
    regionLabelEn: 'Shoulder & Rotator Cuff',
    targetJoint: 'shoulder',
    cameraView: 'side',
    primaryMuscles: ['Deltoïde antérieur', 'Dentelé antérieur'],
    clinicalRationaleFr: 'Contrôle moteur de la flexion gléno-humérale dans le plan sagittal avec sonnette externe de la scapula.',
    clinicalRationaleEn: 'Motor control of sagittal plane humeral flexion paired with scapular upward rotation.',
    progression: 'Élévation antérieure haltère avec descente excentrique lente (3 secondes)',
    regression: 'Élévation antérieure au bâton bilatéral assistée',
  },
  {
    key: 'lateral_raise',
    nameFr: 'Élévation Latérale dans le Plan Scapulaire',
    nameEn: 'Scaption / Lateral Raise',
    region: 'shoulder',
    regionLabelFr: 'Épaule & Coiffe des rotateurs',
    regionLabelEn: 'Shoulder & Rotator Cuff',
    targetJoint: 'shoulder',
    cameraView: 'front',
    primaryMuscles: ['Deltoïde moyen', 'Supra-épineux'],
    clinicalRationaleFr: 'Élévation dans le plan de la scapula (30° en avant du plan frontal) pour préserver le défilé sous-acromial.',
    clinicalRationaleEn: 'Scapular plane abduction (30° anterior to frontal plane) to maximize subacromial clearance.',
    progression: 'Élévation latérale élastique avec pause au sommet',
    regression: 'Abduction isométrique contre un mur sans charge',
  },

  // ─── Rachis & Lombo-Pelvien ───
  {
    key: 'back_extension',
    nameFr: 'Extension Lombaire au Banc (Back Extension)',
    nameEn: 'Bench Back Extension',
    region: 'spine',
    regionLabelFr: 'Rachis & Lombo-Pelvien',
    regionLabelEn: 'Spine & Lumbopelvic Core',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Érecteurs du rachis', 'Grand fessier', 'Ischio-jambiers'],
    clinicalRationaleFr: 'Renforcement de l’extension axiale lombo-pelvienne avec maintien de la neutralité rachidienne sous contrainte excentrique.',
    clinicalRationaleEn: 'Strengthens lumbopelvic extensor chain while maintaining neutral spinal alignment under eccentric load.',
    progression: 'Extension lombaire avec charge tenue contre la poitrine',
    regression: 'Extension lombaire au sol (Superman au sol avec amplitude réduite)',
  },
  {
    key: 'plank',
    nameFr: 'Gainage Ventral (Plank)',
    nameEn: 'Front Plank',
    region: 'spine',
    regionLabelFr: 'Rachis & Lombo-Pelvien',
    regionLabelEn: 'Spine & Lumbopelvic Core',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Transverse de l’abdomen', 'Oblique interne', 'Dentelé'],
    clinicalRationaleFr: 'Anti-extension lombaire et rigidité torsionnelle pour limiter les contraintes de cisaillement sur les disques L4-L5-S1.',
    clinicalRationaleEn: 'Anti-extension core stiffness to minimize shear stresses across L4-L5 and L5-S1 lumbar discs.',
    progression: 'Gainage ventral avec élévation alternée des membres (Bird Dog en planche)',
    regression: 'Gainage ventral sur les genoux',
  },
  {
    key: 'seated_row',
    nameFr: 'Tirage Horizontal Neutre (Seated Row)',
    nameEn: 'Seated Cable Row',
    region: 'spine',
    regionLabelFr: 'Rachis & Lombo-Pelvien',
    regionLabelEn: 'Spine & Lumbopelvic Core',
    targetJoint: 'elbow',
    cameraView: 'side',
    primaryMuscles: ['Rhomboïdes', 'Trapèze moyen', 'Grand dorsal'],
    clinicalRationaleFr: 'Rééducation de la posture cyphotique et renforcement des rétracteurs scapulaires en chaîne fermée assise.',
    clinicalRationaleEn: 'Postural thoracic extension reinforcement and scapular retraction in a stable seated chain.',
    progression: 'Tirage unilatéral avec contrôle anti-rotationnel du buste',
    regression: 'Tirage avec bande élastique assis au sol',
  },

  // ─── Genou & LCA / Fémoro-Patellaire ───
  {
    key: 'bulgarian_split_squat',
    nameFr: 'Fente Bulgare (Bulgarian Split Squat)',
    nameEn: 'Bulgarian Split Squat',
    region: 'knee',
    regionLabelFr: 'Genou & LCA / Fémoro-Patellaire',
    regionLabelEn: 'Knee & ACL / Patellofemoral',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Grand fessier', 'Moyen fessier'],
    clinicalRationaleFr: 'Contrôle unipodal de l’axe hanche-genou-cheville. Élimine le valgus dynamique et rééduque la stabilité après lésion du LCA.',
    clinicalRationaleEn: 'Single-leg motor control eliminating dynamic knee valgus; excellent for post-ACL and patellofemoral rehabilitation.',
    progression: 'Fente bulgare avec haltères et tempo excentrique 3-1-1',
    regression: 'Fente statique les deux pieds au sol',
  },
  {
    key: 'lunge',
    nameFr: 'Fente Arrière (Reverse Lunge)',
    nameEn: 'Reverse Lunge',
    region: 'knee',
    regionLabelFr: 'Genou & LCA / Fémoro-Patellaire',
    regionLabelEn: 'Knee & ACL / Patellofemoral',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Ischio-jambiers', 'Fessiers'],
    clinicalRationaleFr: 'Génère moins de contraintes de cisaillement fémoro-patellaire que la fente avant grâce au tibia plus vertical.',
    clinicalRationaleEn: 'Reduces patellofemoral shear forces compared to forward lunges by maintaining a more vertical tibial angle.',
    progression: 'Fente arrière marchée continue',
    regression: 'Fente arrière assistée avec appui sur un support stable',
  },
  {
    key: 'leg_extension',
    nameFr: 'Extension de Genou Guidée (Leg Extension)',
    nameEn: 'Leg Extension Machine',
    region: 'knee',
    regionLabelFr: 'Genou & LCA / Fémoro-Patellaire',
    regionLabelEn: 'Knee & ACL / Patellofemoral',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Vaste médial', 'Droit fémoral', 'Vaste latéral'],
    clinicalRationaleFr: 'Renforcement ciblé du vaste médial oblique pour le recentrage patellaire. Amplitude restreinte (90° à 45°) en phase post-opératoire.',
    clinicalRationaleEn: 'Isolated vastus medialis strengthening for patellar tracking; restricted ROM (90°-45°) for early post-op recovery.',
    progression: 'Extension de genou unilatérale avec tempo 3-0-1',
    regression: 'Écrasement de coussin sous le genou en isométrie (quadriceps setting)',
  },
  {
    key: 'leg_press',
    nameFr: 'Presse à Cuisses (Leg Press)',
    nameEn: 'Leg Press',
    region: 'knee',
    regionLabelFr: 'Genou & LCA / Fémoro-Patellaire',
    regionLabelEn: 'Knee & ACL / Patellofemoral',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Quadriceps', 'Grand fessier'],
    clinicalRationaleFr: 'Renforcement en chaîne cinétique fermée permettant un travail de charge élevé sans contrainte axiale sur le rachis.',
    clinicalRationaleEn: 'Closed kinetic chain lower-extremity loading with zero axial spinal compression.',
    progression: 'Presse à cuisses unilatérale (Single leg press)',
    regression: 'Presse horizontale avec amplitude limitée à 60° de flexion',
  },

  // ─── Hanche & Bassin / Fessiers ───
  {
    key: 'hip_thrust',
    nameFr: 'Relevé de Bassin (Hip Thrust)',
    nameEn: 'Barbell Hip Thrust',
    region: 'hip',
    regionLabelFr: 'Hanche & Bassin / Fessiers',
    regionLabelEn: 'Hip & Pelvis / Glute Complex',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Grand fessier', 'Ischio-jambiers'],
    clinicalRationaleFr: 'Pic de tension musculaire fessière en extension complète sans compression lombaire axiale. Idéal pour traiter l’amnésie fessière.',
    clinicalRationaleEn: 'Peak horizontal gluteus maximus tension in full extension with minimal spinal compression; resolves gluteal amnesia.',
    progression: 'Hip thrust unilatéral (Single leg hip thrust)',
    regression: 'Pont fessier au sol sans charge (Glute Bridge)',
  },
  {
    key: 'romanian_deadlift',
    nameFr: 'Soulevé de Terre Roumain (Romanian Deadlift)',
    nameEn: 'Romanian Deadlift (RDL)',
    region: 'hip',
    regionLabelFr: 'Hanche & Bassin / Fessiers',
    regionLabelEn: 'Hip & Pelvis / Glute Complex',
    targetJoint: 'hip',
    cameraView: 'side',
    primaryMuscles: ['Ischio-jambiers', 'Grand fessier', 'Érecteurs du rachis'],
    clinicalRationaleFr: 'Allongement sous charge excentrique des ischio-jambiers (protection préventive contre les déchirures du biceps fémoral).',
    clinicalRationaleEn: 'Lengthened eccentric hamstring loading; protective against biceps femoris strains and tears.',
    progression: 'Soulevé de terre roumain sur une jambe (Single Leg RDL)',
    regression: 'Soulevé de terre roumain avec haltères légers et genoux fléchis',
  },
  {
    key: 'leg_curl',
    nameFr: 'Flexion de Jambes Machine (Leg Curl)',
    nameEn: 'Lying / Seated Leg Curl',
    region: 'hip',
    regionLabelFr: 'Hanche & Bassin / Fessiers',
    regionLabelEn: 'Hip & Pelvis / Glute Complex',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Biceps fémoral', 'Semi-tendineux', 'Semi-membraneux'],
    clinicalRationaleFr: 'Renforce les fléchisseurs du genou en isolation pour équilibrer le ratio de force ischio-jambiers / quadriceps (ratio H/Q > 0.60).',
    clinicalRationaleEn: 'Isolated knee flexion strengthening to restore Hamstring-to-Quadriceps strength balance (H:Q ratio > 0.60).',
    progression: 'Leg curl unilatéral avec phase excentrique de 4 secondes',
    regression: 'Glisse-talons au sol avec serviette sur sol lisse',
  },

  // ─── Cheville & Tendon d'Achille ───
  {
    key: 'squat',
    nameFr: 'Squat avec Accent sur la Mobilité de Cheville',
    nameEn: 'Deep Squat with Ankle Dorsiflexion',
    region: 'ankle',
    regionLabelFr: 'Cheville & Tendon d’Achille',
    regionLabelEn: 'Ankle & Achilles Complex',
    targetJoint: 'knee',
    cameraView: 'side',
    primaryMuscles: ['Soléaire', 'Gastrocnémien', 'Quadriceps'],
    clinicalRationaleFr: 'Travail de la flexion dorsale talo-crurale sous charge fermée pour prévenir les entorses récidivantes et tendinopathies.',
    clinicalRationaleEn: 'Closed-chain talocrural dorsiflexion loading to restore mobility and rehabilitate recurrent sprains.',
    progression: 'Squat complet sans talons surélevés au poids de corps',
    regression: 'Squat avec cales sous les talons (talons surélevés de 2-3 cm)',
  },
];

export const PHYSIO_REGIONS = [
  { id: 'all', labelFr: 'Toutes les zones', labelEn: 'All Regions' },
  { id: 'shoulder', labelFr: 'Épaule & Coiffe', labelEn: 'Shoulder & Cuff' },
  { id: 'spine', labelFr: 'Rachis & Lombaire', labelEn: 'Spine & Core' },
  { id: 'knee', labelFr: 'Genou & LCA', labelEn: 'Knee & ACL' },
  { id: 'hip', labelFr: 'Hanche & Bassin', labelEn: 'Hip & Pelvis' },
  { id: 'ankle', labelFr: 'Cheville & Achille', labelEn: 'Ankle & Achilles' },
];
