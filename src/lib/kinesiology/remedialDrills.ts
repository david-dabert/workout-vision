/**
 * Remedial Drills & Corrective Rehabilitation Catalog
 *
 * Grounded in clinical physical therapy, sports kinesiology, and Squat University protocols.
 * Maps every functional mobility restriction, dynamic joint flaw, and asymmetry directly to
 * evidence-based corrective drills with dosage, tempo, biomechanical rationale, and re-test goals.
 */

export type DrillCategory =
  | 'joint_mobilization'
  | 'eccentric_loading'
  | 'neuromuscular_activation'
  | 'motor_control';

export interface DrillPrescription {
  sets: number;
  reps: number;
  holdSec?: number;
  tempo?: string;
}

export interface RemedialDrill {
  id: string;
  name: string;
  nameFr: string;
  category: DrillCategory;
  targetJoint: string;
  targetJointFr: string;
  targetMuscle: string;
  targetMuscleFr: string;
  prescription: DrillPrescription;
  rationale: string;
  rationaleFr: string;
  executionSteps: string[];
  executionStepsFr: string[];
  transferToLifts: string[];
  transferToLiftsFr: string[];
  retestGoal: string;
  retestGoalFr: string;
}

export const REMEDIAL_DRILLS: Record<string, RemedialDrill> = {
  // --- ANKLE & TIBIAL MOBILITY ---
  banded_talocrural_mobilization: {
    id: 'banded_talocrural_mobilization',
    name: 'Banded Talocrural Joint Mobilization',
    nameFr: 'Mobilisation talo-crurale élastique (MWM)',
    category: 'joint_mobilization',
    targetJoint: 'Ankle (Talocrural)',
    targetJointFr: 'Cheville (talo-crurale)',
    targetMuscle: 'Joint capsule & posterior talus glide',
    targetMuscleFr: 'Capsule articulaire et glissement postérieur du talus',
    prescription: { sets: 3, reps: 10, holdSec: 3, tempo: '2-3-1' },
    rationale:
      'Creates a posterior traction vector on the talus bone during anterior tibial translation, restoring normal arthrokinematics and removing anterior ankle pinch without heel elevation.',
    rationaleFr:
      'Crée une traction postérieure sur le talus lors de la translation antérieure du tibia, restaurant l’arthrocinématique normale et éliminant le pincement antérieur.',
    executionSteps: [
      'Anchor a heavy resistance band low behind you and loop it under your ankle malleoli.',
      'Step forward into a half-kneeling lunge so the band pulls backwards and down at a 45° angle.',
      'Keep the foot flat and drive the knee forward directly over the 2nd toe into terminal dorsiflexion.',
      'Hold the end-range stretch for 3 seconds while driving heel firmly into the ground, then return smoothly.',
    ],
    executionStepsFr: [
      'Fixer un élastique épais en bas derrière soi et le placer sous les malléoles de la cheville.',
      'Se placer en fente semi-à-genoux pour que l’élastique tire vers l’arrière et le bas à 45°.',
      'Garder le pied à plat et avancer le genou dans l’axe du 2e orteil jusqu’à la flexion maximale.',
      'Maintenir l’étirement maximal 3 secondes en pressant le talon au sol, puis relâcher.',
    ],
    transferToLifts: ['barbell_squat', 'hack_squat', 'leg_press', 'lunge'],
    transferToLiftsFr: ['Squat barre', 'Hack squat', 'Presse à cuisses', 'Fente'],
    retestGoal: 'Closed-kinetic-chain knee-to-wall distance >= 12 cm or tibial angle >= 35° without heel rise.',
    retestGoalFr: 'Distance genou-mur >= 12 cm ou angle tibial >= 35° sans décollement du talon.',
  },

  slant_board_eccentric_soleus_drop: {
    id: 'slant_board_eccentric_soleus_drop',
    name: 'Slant Board Eccentric Soleus Drop',
    nameFr: 'Descente excentrique du soléaire sur plan incliné',
    category: 'eccentric_loading',
    targetJoint: 'Ankle',
    targetJointFr: 'Cheville',
    targetMuscle: 'Soleus & Achilles tendon',
    targetMuscleFr: 'Soléaire et tendon d’Achille',
    prescription: { sets: 3, reps: 12, tempo: '4-1-1' },
    rationale:
      'Lengthens the deep soleus muscle under eccentric tension with a bent knee (decoupling it from gastrocnemius), directly expanding loaded squat depth.',
    rationaleFr:
      'Allonge le muscle soléaire profond sous tension excentrique genou fléchi (découplé des jumeaux), augmentant directement la profondeur de squat sous charge.',
    executionSteps: [
      'Stand on a slant board or step with the balls of your feet, knees bent at 20-30°.',
      'Lower your heels over a slow 4-second tempo until full comfortable stretch is reached.',
      'Pause for 1 second at the bottom, then press back up with both feet.',
    ],
    executionStepsFr: [
      'Se placer sur une marche ou plan incliné sur l’avant-pied, genoux fléchis à 20-30°.',
      'Descendre les talons sur un tempo lent de 4 secondes jusqu’à l’étirement complet.',
      'Marquer 1 seconde de pause en bas, puis remonter avec les deux pieds.',
    ],
    transferToLifts: ['barbell_squat', 'pendulum_squat', 'sissy_squat'],
    transferToLiftsFr: ['Squat barre', 'Pendulum squat', 'Sissy squat'],
    retestGoal: 'Elimination of compensatory forward trunk tilt during deep squat inflection.',
    retestGoalFr: 'Suppression de l’inclinaison compensatoire du buste au point bas du squat.',
  },

  // --- HIP MOBILITY & CAPSULAR INTEGRITY ---
  hip_90_90_pails_rails: {
    id: 'hip_90_90_pails_rails',
    name: '90/90 Hip Flow with PAILs/RAILs',
    nameFr: 'Flow de hanche 90/90 avec contractions PAILs/RAILs',
    category: 'joint_mobilization',
    targetJoint: 'Hip (Acetabulofemoral)',
    targetJointFr: 'Hanche (coxo-fémorale)',
    targetMuscle: 'Hip capsule, piriformis, obturators & gluteal rotators',
    targetMuscleFr: 'Capsule de hanche, piriforme, obturateurs et rotateurs',
    prescription: { sets: 2, reps: 5, holdSec: 10, tempo: 'Static+Isometric' },
    rationale:
      'Expands safe internal and external hip rotation capsular workspace, relieving femoroacetabular impingement (FAI) and preventing pelvic butt wink at parallel squat depth.',
    rationaleFr:
      'Élargit l’espace capsulaire en rotation interne et externe, soulageant le conflit fémoro-acétabulaire et prévenant la rétroversion pelvienne en bas de squat.',
    executionSteps: [
      'Sit on the ground with front leg bent at 90° and back leg bent at 90° (90/90 posture).',
      'Sit tall with upright spine and hinge forward from the hip over the front shin.',
      'Perform PAILs: drive front ankle and knee downwards into floor at 70% effort for 10 seconds.',
      'Perform RAILs: attempt to actively lift front ankle/shin off the floor using deep hip flexors for 10 seconds.',
    ],
    executionStepsFr: [
      'S’asseoir au sol, jambe avant fléchie à 90° et jambe arrière fléchie à 90° (posture 90/90).',
      'Redresser la colonne vertébrale et incliner le buste depuis la hanche au-dessus du tibia avant.',
      'Contraction PAILs\u00A0: presser la cheville et le genou avant dans le sol à 70% d’effort pendant 10 s.',
      'Contraction RAILs\u00A0: tenter de décoller activement la cheville/tibia du sol pendant 10 s.',
    ],
    transferToLifts: ['squat', 'deadlift', 'romanian_deadlift', 'hip_thrust'],
    transferToLiftsFr: ['Squat', 'Soulevé de terre', 'RDL', 'Hip thrust'],
    retestGoal: 'Active hip internal rotation >= 35° and external rotation >= 45° with zero pelvic twist.',
    retestGoalFr: 'Rotation interne de hanche >= 35° et rotation externe >= 45° sans bascule du bassin.',
  },

  clamshell_banded_neutral_pelvis: {
    id: 'clamshell_banded_neutral_pelvis',
    name: 'Side-Lying Banded Clamshell with Neutral Pelvis',
    nameFr: 'Coquillage élastique couché avec bassin verrouillé',
    category: 'neuromuscular_activation',
    targetJoint: 'Hip',
    targetJointFr: 'Hanche',
    targetMuscle: 'Gluteus medius & superior gluteus maximus',
    targetMuscleFr: 'Moyen fessier et faisceau supérieur du grand fessier',
    prescription: { sets: 3, reps: 15, holdSec: 2, tempo: '2-2-1' },
    rationale:
      'Isolates gluteus medius abductor and external rotator capacity while eliminating lumbar rotation compensation, preventing dynamic knee valgus collapse.',
    rationaleFr:
      'Isole le moyen fessier abducteur et rotateur externe tout en éliminant la compensation lombaire, prévenant le valgus dynamique du genou.',
    executionSteps: [
      'Lie on your side with hips at 45° and knees at 90°, elastic band placed just above knees.',
      'Place top hand on iliac crest to ensure pelvis does not roll backwards.',
      'Keeping feet pressed together, lift the top knee upward smoothly.',
      'Hold peak contraction for 2 seconds feeling the side glute, then lower under control.',
    ],
    executionStepsFr: [
      'Couché sur le côté, hanches à 45° et genoux à 90°, bande élastique au-dessus des genoux.',
      'Poser la main supérieure sur la crête iliaque pour interdire toute rotation arrière du bassin.',
      'Pieds joints, ouvrir le genou supérieur vers le haut de façon contrôlée.',
      'Maintenir la contraction 2 secondes dans le moyen fessier, puis redescendre.',
    ],
    transferToLifts: ['squat', 'leg_press', 'lunge', 'step_down'],
    transferToLiftsFr: ['Squat', 'Presse', 'Fente', 'Descente de marche'],
    retestGoal: 'Sustained pelvic level (< 5° tilt) during single-leg loaded stance.',
    retestGoalFr: 'Maintien de l’horizontalité du bassin (< 5° d’inclinaison) en appui monopodal.',
  },

  // --- THORACIC SPINE & OVERHEAD SHOULDER ---
  foam_roller_thoracic_extension: {
    id: 'foam_roller_thoracic_extension',
    name: 'Foam Roller Segmental Thoracic Extension',
    nameFr: 'Extension thoracique segmentaire sur rouleau',
    category: 'joint_mobilization',
    targetJoint: 'Thoracic Spine (T1-T12)',
    targetJointFr: 'Rachis thoracique (T1-T12)',
    targetMuscle: 'Thoracic facet joints & anterior costovertebral ligaments',
    targetMuscleFr: 'Articulations facettaires thoraciques et ligaments costo-vertébraux',
    prescription: { sets: 3, reps: 8, holdSec: 3, tempo: 'Controlled' },
    rationale:
      'Mobilizes stiff thoracic segments into extension while keeping the lumbar spine braced and neutral, allowing full 180° overhead reach without compensatory rib flare or lumbar hyper-lordosis.',
    rationaleFr:
      'Mobilise les segments thoraciques en extension tout en maintenant la colonne lombaire gainée, autorisant une élévation de 180° sans cambrure lombaire.',
    executionSteps: [
      'Position foam roller horizontally across mid-back (scapular line), knees bent, feet flat.',
      'Interlace fingers behind head to support neck; pull ribs down into abdominal brace.',
      'Gently extend upper spine back over the roller without letting lower back arch or hips leave ground.',
      'Breathe out fully at end range for 3 seconds, then return to neutral and repeat for 3 spine segments.',
    ],
    executionStepsFr: [
      'Placer le rouleau horizontalement sous le milieu du dos (ligne des omoplates), genoux fléchis.',
      'Doigts croisés derrière la tête pour soutenir la nuque\u00A0; serrer les abdos pour verrouiller les côtes.',
      'Étendre doucement le haut du dos sur le rouleau sans cambrer le bas du dos ni décoller le bassin.',
      'Expirer à fond en fin d’amplitude pendant 3 secondes, puis répéter sur 3 étages vertébraux.',
    ],
    transferToLifts: ['overhead_press', 'pull_up', 'lat_pulldown', 'snatch'],
    transferToLiftsFr: ['Développé couché/militaire', 'Tractions', 'Tirage vertical', 'Arraché'],
    retestGoal: 'Active shoulder elevation >= 170° with lumbar deviation < 10°.',
    retestGoalFr: 'Élévation active des bras >= 170° avec déviation lombaire < 10°.',
  },

  prone_trap3_y_raise: {
    id: 'prone_trap3_y_raise',
    name: 'Prone Lower Trapezius Y-Raise with Posterior Tilt',
    nameFr: 'Élévation en Y à plat ventre (Trapèze inférieur)',
    category: 'motor_control',
    targetJoint: 'Scapulothoracic',
    targetJointFr: 'Scapulo-thoracique',
    targetMuscle: 'Lower trapezius & serratus anterior',
    targetMuscleFr: 'Trapèze inférieur et grand dentelé',
    prescription: { sets: 3, reps: 10, holdSec: 3, tempo: '2-3-1' },
    rationale:
      'Activates lower trapezius upward rotation and posterior tilt of the scapula, establishing subacromial clearance and eliminating shoulder impingement during vertical pressing.',
    rationaleFr:
      'Active la sonnette externe et la bascule postérieure de la scapula, dégageant l’espace sous-acromial et éliminant le conflit d’épaule lors des poussées verticales.',
    executionSteps: [
      'Lie prone on a flat or 30° inclined bench, arms hanging in a "Y" position (thumbs pointing up).',
      'Engage glutes and abs to lock the pelvis flat to the bench.',
      'Retract and depress shoulder blades, then raise arms upward forming a 45° angle with torso.',
      'Hold at the top for 3 seconds squeezing between the lower shoulder blades, then descend smoothly.',
    ],
    executionStepsFr: [
      'Couché à plat ventre sur un banc incliné à 30°, bras en "Y" (pouces vers le plafond).',
      'Contracter fessiers et abdos pour plaquer le bassin contre le banc.',
      'Abaisser et resserrer les omoplates, puis monter les bras à 45° du tronc.',
      'Maintenir 3 secondes en haut en serrant le bas des omoplates, puis redescendre.',
    ],
    transferToLifts: ['overhead_press', 'incline_bench_press', 'handstand_pushup'],
    transferToLiftsFr: ['Développé militaire', 'Développé incliné', 'Pushup poirier'],
    retestGoal: 'Stable scapular upward rotation without upper trapezius shrugging.',
    retestGoalFr: 'Rotation supérieure stable de l’omoplate sans haussement du trapèze supérieur.',
  },

  // --- DYNAMIC KNEE STABILITY & VALGUS PREVENTION ---
  spanish_squat_isometric_lock: {
    id: 'spanish_squat_isometric_lock',
    name: 'Spanish Squat Heavy Isometric Lock',
    nameFr: 'Spanish squat isométrique lourd',
    category: 'motor_control',
    targetJoint: 'Knee (Tibiofemoral & Patellofemoral)',
    targetJointFr: 'Genou (tibio-fémoral et fémoro-patellaire)',
    targetMuscle: 'Quadriceps (VMO) & patellar tendon tension',
    targetMuscleFr: 'Quadriceps (vaste médial) et tendon rotulien',
    prescription: { sets: 4, reps: 1, holdSec: 45, tempo: 'Isometric' },
    rationale:
      'A heavy resistance band behind the knees offsets shear force on the patellar tendon, permitting vertical shin alignment and maximum VMO activation to eradicate dynamic knee valgus collapse.',
    rationaleFr:
      'L’élastique lourd derrière les genoux supprime les forces de cisaillement rotuliennes, permet des tibias verticaux et active le vaste médial pour éliminer le valgus.',
    executionSteps: [
      'Loop a heavy resistance band around an anchor and place the other end behind both knees (popliteal fossa).',
      'Step back until high band tension is created; position feet shoulder-width apart.',
      'Squat down to 70-90° knee flexion with an upright vertical torso.',
      'Hold statically for 45 seconds pushing knees out into the band and rooting big toe into the floor.',
    ],
    executionStepsFr: [
      'Fixer un élastique épais à un poteau et placer la boucle derrière les genoux (creux poplité).',
      'Reculer pour mettre une forte tension\u00A0; pieds largeur d’épaules.',
      'Descendre en squat à 70-90° de flexion de genou, buste parfaitement vertical.',
      'Maintenir la position isométrique 45 secondes en ouvrant les genoux et ancrant le gros orteil.',
    ],
    transferToLifts: ['squat', 'leg_press', 'hack_squat'],
    transferToLiftsFr: ['Squat', 'Presse', 'Hack squat'],
    retestGoal: 'Frontal knee-to-ankle alignment index >= 0.90 under 1RM load.',
    retestGoalFr: 'Indice d’alignement genou-cheville >= 0.90 sous charge maximale.',
  },

  // --- POSTERIOR CHAIN & HAMSTRING LENGTH ---
  active_slr_hamstring_floss: {
    id: 'active_slr_hamstring_floss',
    name: 'Supine Active Straight Leg Raise Neural Floss',
    nameFr: 'Mobilisation neurale et fémoro-jambière en élévation de jambe tendue',
    category: 'motor_control',
    targetJoint: 'Hip & Sciatic Nerve Pathway',
    targetJointFr: 'Hanche et trajet du nerf sciatique',
    targetMuscle: 'Hamstrings (biceps femoris, semitendinosus) & sciatic sheath',
    targetMuscleFr: 'Ischio-jambiers et gaine sciatique',
    prescription: { sets: 3, reps: 10, holdSec: 2, tempo: 'Smooth' },
    rationale:
      'Restores active hamstring extensibility while desensitizing neural mechanosensitivity, ensuring safe lumbar-pelvic rhythm during Romanian deadlifts.',
    rationaleFr:
      'Restaure l’extensibilité active des ischio-jambiers tout en désensibilisant le nerf sciatique, garantissant le rythme lombo-pelvien au soulevé de terre jambes tendues.',
    executionSteps: [
      'Lie flat on back with contralateral leg pinned straight into floor (toes to ceiling).',
      'Hold a strap or hands behind the thigh of the working leg with hip flexed at 90°.',
      'Actively extend the knee upward until tension is felt, then dorsiflex the ankle for 2 seconds.',
      'Bend knee slightly, plantarflex ankle, and repeat smoothly for 10 repetitions per side.',
    ],
    executionStepsFr: [
      'Couché sur le dos, la jambe opposée plaquée tendue au sol (orteils vers le plafond).',
      'Tenir une sangle ou les mains derrière la cuisse active avec la hanche à 90°.',
      'Étendre activement le genou vers le haut jusqu’à sentir la tension, puis fléchir la cheville 2 s.',
      'Fléchir légèrement le genou, pointer le pied, et répéter de manière fluide 10 fois par jambe.',
    ],
    transferToLifts: ['deadlift', 'romanian_deadlift', 'good_morning', 'back_extension'],
    transferToLiftsFr: ['Soulevé de terre', 'Soulevé de terre roumain', 'Good morning', 'Banc à lombaires'],
    retestGoal: 'Active straight leg raise angle >= 80° with contralateral knee locked straight.',
    retestGoalFr: 'Élévation de jambe tendue >= 80° avec genou opposé verrouillé tendu au sol.',
  },
};

/**
 * Returns the recommended remedial corrective drills for a specific diagnostic deficit key.
 */
export function getDrillsForDeficit(deficitKey: string): RemedialDrill[] {
  switch (deficitKey) {
    case 'ankle_dorsiflexion_restriction':
    case 'ankle_dorsiflexion_asymmetry':
      return [
        REMEDIAL_DRILLS.banded_talocrural_mobilization,
        REMEDIAL_DRILLS.slant_board_eccentric_soleus_drop,
      ];

    case 'hip_internal_rotation_deficit':
    case 'hip_external_rotation_deficit':
    case 'hip_mobility_restriction':
      return [
        REMEDIAL_DRILLS.hip_90_90_pails_rails,
        REMEDIAL_DRILLS.clamshell_banded_neutral_pelvis,
      ];

    case 'overhead_shoulder_restriction':
    case 'lumbar_overhead_compensation':
      return [
        REMEDIAL_DRILLS.foam_roller_thoracic_extension,
        REMEDIAL_DRILLS.prone_trap3_y_raise,
      ];

    case 'dynamic_knee_valgus':
    case 'trendelenburg_pelvic_drop':
      return [
        REMEDIAL_DRILLS.clamshell_banded_neutral_pelvis,
        REMEDIAL_DRILLS.spanish_squat_isometric_lock,
      ];

    case 'hamstring_aslr_restriction':
    case 'contralateral_hip_flexor_tightness':
      return [
        REMEDIAL_DRILLS.active_slr_hamstring_floss,
        REMEDIAL_DRILLS.hip_90_90_pails_rails,
      ];

    default:
      return [];
  }
}

/**
 * Assembles an individualized pre-workout priming protocol based on flagged deficits.
 */
export function getWarmupProtocolForDeficits(deficitKeys: string[]): RemedialDrill[] {
  const seen = new Set<string>();
  const drills: RemedialDrill[] = [];

  for (const key of deficitKeys) {
    const list = getDrillsForDeficit(key);
    for (const drill of list) {
      if (!seen.has(drill.id)) {
        seen.add(drill.id);
        drills.push(drill);
      }
    }
  }

  return drills;
}
