/**
 * Optimal Execution Blueprint & Coach's Prescription Engine ("Le Verdict du Coach")
 * 
 * Defines the gold-standard biomechanical criteria for exercises and evaluates an
 * athlete's completed set against this ideal. Instead of presenting raw disconnected metrics,
 * it synthesizes the telemetry into:
 * 1. An Execution Compliance Score (0-100%) against the biomechanical standard.
 * 2. Le Facteur Limitant (The #1 Mechanical Bottleneck).
 * 3. La Consigne pour la Série Suivante (The exact actionable prescription for Set N+1).
 * 
 * Strict Invariants:
 * - 100% Client-side purity (zero server latency or dependency).
 * - French typography gate compliance: non-breaking space (\u00A0) before ':', ';', '?', '!'.
 */

import { resolveKinematicAlias, KinematicMachineProfile } from '../biomechanics/kinematicAliasing';

export interface OptimalExecutionBlueprint {
  liftKey: string;
  canonicalNameEn: string;
  canonicalNameFr: string;
  primaryJoint: string;
  optimalStretchAngle: number;
  optimalEccentricRangeSec: [number, number]; // [min, max], e.g. [2.5, 3.5]
  stretchPauseOptimalSec: number; // e.g. 0.5s pause to eliminate myotatic stretch reflex
  continuousTensionRequired: boolean;
  maxAllowableLockoutDwellSec: number; // e.g. 0.6s
  setupAnchorFr: string;
  setupAnchorEn: string;
  executionCueFr: string;
  executionCueEn: string;
}

export interface CoachPrescription {
  executionComplianceScore: number; // 0 to 100%
  tier: 'flawless' | 'optimal' | 'moderate' | 'needs_work';
  tierLabelFr: string;
  tierLabelEn: string;
  limitingFactor: {
    category: 'stretch_depth' | 'momentum_bounce' | 'lockout_resting' | 'eccentric_tempo' | 'none';
    titleFr: string;
    titleEn: string;
    detailFr: string;
    detailEn: string;
    severity: 'low' | 'medium' | 'high';
  };
  nextSetPrescription: {
    cueFr: string;
    cueEn: string;
    mentalFocusFr: string;
    mentalFocusEn: string;
  };
}

export interface SetExecutionTelemetry {
  avgRomDeg: number;
  minAngleDeg?: number;
  maxAngleDeg?: number;
  avgEccentricSec: number;
  bounceCount: number;
  continuousTensionPercent: number;
  velocityLossPercent: number;
}

/**
 * Registry of Optimal Biomechanical Blueprints by archetype and machine
 */
export const OPTIMAL_BLUEPRINTS: Record<string, Partial<OptimalExecutionBlueprint>> = {
  squat: {
    optimalStretchAngle: 80,
    optimalEccentricRangeSec: [2.5, 3.5],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.6,
    setupAnchorFr: 'Pieds ancrés à largeur d’épaules, genoux alignés sur le 2e orteil, tronc verrouillé en gainage.',
    setupAnchorEn: 'Feet shoulder-width apart, knees tracking over second toe, brace core rigidly.',
    executionCueFr: 'Contrôlez la descente en 3s, marquez 0,5s au fond sans rebond, remontez sans bloquer les genoux en haut.',
    executionCueEn: 'Control 3s descent, pause 0.5s in the hole with zero bounce, drive up without locking out knees.',
  },
  pendulum_squat: {
    optimalStretchAngle: 75,
    optimalEccentricRangeSec: [2.5, 4.0],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.5,
    setupAnchorFr: 'Bassin plaqué au dossier, pieds positionnés au milieu du plateau pour isoler les quadriceps.',
    setupAnchorEn: 'Pelvis pinned to backpad, feet mid-plate for maximal isolated quad recruitment.',
    executionCueFr: 'Descendez profondément dans l’arc pendulaire, supprimez tout rebond en bas, gardez la charge sous tension.',
    executionCueEn: 'Sink deep into the pendulum arc, eliminate bottom bounce, keep quads under constant mechanical tension.',
  },
  hack_squat: {
    optimalStretchAngle: 75,
    optimalEccentricRangeSec: [2.5, 3.5],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.5,
    setupAnchorFr: 'Épaules calées sous les manchons, dos collé à 45°, pieds stables sans décollement des talons.',
    setupAnchorEn: 'Shoulders wedged into pads, back flat against 45° carriage, heels glued to platform.',
    executionCueFr: 'Fléchissez jusqu’à la flexion maximale sans décoller le bas du dos, stoppez 2 cm avant la butée haute.',
    executionCueEn: 'Descend to full quad stretch without lumbar lift, stop 2 cm short of top mechanical lockout.',
  },
  leg_press: {
    optimalStretchAngle: 80,
    optimalEccentricRangeSec: [2.5, 3.5],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.5,
    setupAnchorFr: 'Fessiers fermement verrouillés au siège avec les poignées, pieds écartés largeur du bassin.',
    setupAnchorEn: 'Glutes pulled hard into the seat using handles, feet hip-width on sled.',
    executionCueFr: 'Descendez sans rétroversion du bassin, poussez avec les quadriceps sans verrouiller les genoux en butée.',
    executionCueEn: 'Lower without pelvic butt-wink, press through quads and never snap knees into hyperextension.',
  },
  preacher_curl: {
    optimalStretchAngle: 160,
    optimalEccentricRangeSec: [2.5, 3.5],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.6,
    setupAnchorFr: 'Aisselles verrouillées au sommet du pupitre, triceps plaqués à plat contre la mousse.',
    setupAnchorEn: 'Armpits flush with top of pad, triceps locked flat against Scott surface.',
    executionCueFr: 'Étirez complètement les biceps en bas sous contrôle, contractez sans décoller les coudes ni cambrer.',
    executionCueEn: 'Achieve full lengthened biceps stretch under control, curl without lifting elbows or arching.',
  },
  machine_chest_supported_row: {
    optimalStretchAngle: 150,
    optimalEccentricRangeSec: [2.0, 3.0],
    stretchPauseOptimalSec: 0.5,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.6,
    setupAnchorFr: 'Sternum fermement collé au coussin d’appui, trapèzes relâchés vers le bas, pieds ancrés.',
    setupAnchorEn: 'Sternum glued to chest pad, traps depressed, feet driven firmly into floor.',
    executionCueFr: 'Laissez les omoplates s’écarter pour étirer les dorsaux, tirez avec les coudes sans décoller la poitrine.',
    executionCueEn: 'Allow scapulae to protract for full lat stretch, drive elbows back without chest separating from pad.',
  },
  bicep_curl: {
    optimalStretchAngle: 155,
    optimalEccentricRangeSec: [2.0, 3.0],
    stretchPauseOptimalSec: 0.3,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.7,
    setupAnchorFr: 'Coudes fixés le long du buste, cage thoracique ouverte, aucun balancier d’élan lombaire.',
    setupAnchorEn: 'Elbows pinned to flanks, proud chest, zero lumbar hip-swing momentum.',
    executionCueFr: 'Contrôlez l’extension complète des bras, montez en supination sans avancer les coudes vers l’avant.',
    executionCueEn: 'Control full arm extension, curl with full supination without dragging elbows forward.',
  },
  lateral_raise: {
    optimalStretchAngle: 85,
    optimalEccentricRangeSec: [2.0, 3.0],
    stretchPauseOptimalSec: 0.2,
    continuousTensionRequired: true,
    maxAllowableLockoutDwellSec: 0.5,
    setupAnchorFr: 'Buste légèrement incliné de 10° vers l’avant, omoplates fixées, bras dans le plan scapulaire (30° avant).',
    setupAnchorEn: 'Slight 10° forward torso lean, depressed scapulae, raise in the scapular plane (30° forward).',
    executionCueFr: 'Montez les coudes jusqu’à l’horizontale, redescendez en 3s sans laisser les haltères toucher les cuisses.',
    executionCueEn: 'Lead with elbows to parallel, lower over 3s without dumbbells resting against hips.',
  },
};

/**
 * Returns the resolved optimal execution blueprint for a given lift key.
 */
export function getOptimalExecutionBlueprint(liftKey: string): OptimalExecutionBlueprint {
  const profile: KinematicMachineProfile = resolveKinematicAlias(liftKey);
  const archetypeDefaults = OPTIMAL_BLUEPRINTS[liftKey] || OPTIMAL_BLUEPRINTS[profile.archetype] || OPTIMAL_BLUEPRINTS.squat;

  return {
    liftKey,
    canonicalNameEn: profile.canonicalNameEn,
    canonicalNameFr: profile.canonicalNameFr,
    primaryJoint: profile.primaryJoint,
    optimalStretchAngle: profile.optimalStretchAngle || archetypeDefaults.optimalStretchAngle || 80,
    optimalEccentricRangeSec: archetypeDefaults.optimalEccentricRangeSec || [2.5, 3.5],
    stretchPauseOptimalSec: archetypeDefaults.stretchPauseOptimalSec || 0.5,
    continuousTensionRequired: archetypeDefaults.continuousTensionRequired ?? true,
    maxAllowableLockoutDwellSec: archetypeDefaults.maxAllowableLockoutDwellSec || 0.6,
    setupAnchorFr: archetypeDefaults.setupAnchorFr || 'Alignement articulaire stable, posture gainée et ancrée.',
    setupAnchorEn: archetypeDefaults.setupAnchorEn || 'Stable joint alignment, braced posture firmly anchored.',
    executionCueFr: archetypeDefaults.executionCueFr || 'Contrôlez la phase excentrique, marquez l’étirement et gardez la tension continue.',
    executionCueEn: archetypeDefaults.executionCueEn || 'Control the eccentric phase, pause at stretch and maintain continuous tension.',
  };
}

/**
 * Evaluates an athlete's set execution against the optimal blueprint and generates
 * the Coach's Prescription for Set N+1.
 */
export function generateCoachPrescription(
  telemetry: SetExecutionTelemetry,
  liftKey: string,
  _fr = false
): CoachPrescription {
  const blueprint = getOptimalExecutionBlueprint(liftKey);
  const profile = resolveKinematicAlias(liftKey);
  const isHighRest = profile.restPosition === 'high';

  // 1. Stretch depth compliance
  let stretchDeduction = 0;
  let stretchShortfallDeg = 0;
  if (isHighRest && telemetry.minAngleDeg !== undefined) {
    if (telemetry.minAngleDeg > blueprint.optimalStretchAngle) {
      stretchShortfallDeg = telemetry.minAngleDeg - blueprint.optimalStretchAngle;
      stretchDeduction = Math.min(35, Math.round((stretchShortfallDeg / 20) * 35));
    }
  } else if (!isHighRest && telemetry.maxAngleDeg !== undefined) {
    if (telemetry.maxAngleDeg < blueprint.optimalStretchAngle) {
      stretchShortfallDeg = blueprint.optimalStretchAngle - telemetry.maxAngleDeg;
      stretchDeduction = Math.min(35, Math.round((stretchShortfallDeg / 20) * 35));
    }
  }

  // 2. Momentum bounce penalty
  const bounceDeduction = Math.min(30, telemetry.bounceCount * 12);

  // 3. Continuous tension penalty
  let tensionDeduction = 0;
  if (telemetry.continuousTensionPercent < 80) {
    tensionDeduction = Math.min(25, Math.round(((80 - telemetry.continuousTensionPercent) / 80) * 25));
  }

  // 4. Eccentric control penalty
  let eccentricDeduction = 0;
  if (telemetry.avgEccentricSec < blueprint.optimalEccentricRangeSec[0]) {
    const eccDiff = blueprint.optimalEccentricRangeSec[0] - telemetry.avgEccentricSec;
    eccentricDeduction = Math.min(20, Math.round((eccDiff / 1.5) * 20));
  }

  const rawScore = 100 - stretchDeduction - bounceDeduction - tensionDeduction - eccentricDeduction;
  const executionComplianceScore = Math.max(10, Math.min(100, rawScore));

  // Determine performance tier
  let tier: 'flawless' | 'optimal' | 'moderate' | 'needs_work' = 'optimal';
  let tierLabelFr = 'Exécution optimale';
  let tierLabelEn = 'Optimal Execution';

  if (executionComplianceScore >= 95) {
    tier = 'flawless';
    tierLabelFr = 'Maîtrise biomécanique parfaite';
    tierLabelEn = 'Flawless Biomechanical Mastery';
  } else if (executionComplianceScore >= 80) {
    tier = 'optimal';
    tierLabelFr = 'Exécution hautement stimulante';
    tierLabelEn = 'Optimal Stimulating Execution';
  } else if (executionComplianceScore >= 60) {
    tier = 'moderate';
    tierLabelFr = 'Exécution perfectible';
    tierLabelEn = 'Moderate Execution';
  } else {
    tier = 'needs_work';
    tierLabelFr = 'Correction technique requise';
    tierLabelEn = 'Technical Correction Required';
  }

  // Identify the single #1 limiting factor
  let limitingFactor: CoachPrescription['limitingFactor'] = {
    category: 'none',
    titleFr: 'Exécution conforme au standard d’élite',
    titleEn: 'Flawless Compliance with Elite Standards',
    detailFr: 'Amplitude complète sous tension, descente contrôlée et inversion propre sans aucun élan parasite.',
    detailEn: 'Full stretch excursion under tension, controlled descent, and clean reversal with zero parasitic momentum.',
    severity: 'low',
  };

  let nextSetPrescription: CoachPrescription['nextSetPrescription'] = {
    cueFr: 'Conservez exactement cette rigueur technique sur la série suivante\u00A0: tempo métronomique et tension continue.',
    cueEn: 'Maintain this exact technical discipline on your next set: metronomic tempo and continuous tension.',
    mentalFocusFr: 'Restez concentré sur la contraction intramusculaire.',
    mentalFocusEn: 'Maintain razor focus on intramuscular mind-muscle tension.',
  };

  // Rank limiting factors by mechanical severity
  if (bounceDeduction >= 20 || telemetry.bounceCount >= 2) {
    limitingFactor = {
      category: 'momentum_bounce',
      titleFr: 'Rebond d’élan au point de retournement',
      titleEn: 'Ballistic Turnaround Momentum Bounce',
      detailFr: `${telemetry.bounceCount} répétition(s) avec inversion brutale\u00A0: l’élasticité passive des tendons remplace la tension musculaire active dans la zone la plus hypertrophique.`,
      detailEn: `${telemetry.bounceCount} rep(s) exhibited violent reversal: passive tendon elasticity replaced active muscle tension in the prime hypertrophic zone.`,
      severity: 'high',
    };
    nextSetPrescription = {
      cueFr: 'Pour votre prochaine série\u00A0: Marquez 0,5s de pause morte au point bas (sur le clic audio). Supprimez tout rebond élastique et repartez à la seule force musculaire.',
      cueEn: 'For your next set: Hold a 0.5s dead-stop at the bottom (on the audio click). Eliminate all elastic rebound and drive upward using pure muscle contraction.',
      mentalFocusFr: 'Pause morte de 0,5s au fond · zéro rebond.',
      mentalFocusEn: '0.5s dead-stop in the hole · zero bounce.',
    };
  } else if (stretchDeduction >= 15 || stretchShortfallDeg >= 8) {
    limitingFactor = {
      category: 'stretch_depth',
      titleFr: 'Amplitude incomplète dans la zone d’étirement',
      titleEn: 'Incomplete Range in Stretch Zone',
      detailFr: `Amplitude écourtée de ~${Math.round(stretchShortfallDeg)}° par rapport à la cible d’étirement optimal (${blueprint.optimalStretchAngle}°). Vous perdez le stimulus d’hypertrophie médiée par l’étirement.`,
      detailEn: `Range cut short by ~${Math.round(stretchShortfallDeg)}° relative to the optimal stretch target (${blueprint.optimalStretchAngle}°). You are missing out on stretch-mediated hypertrophy.`,
      severity: 'medium',
    };
    nextSetPrescription = {
      cueFr: `Pour votre prochaine série\u00A0: Descendez jusqu’à entendre le déclic audio d’étirement optimal (${blueprint.optimalStretchAngle}°). Ajustez la charge de 5 à 10% si nécessaire pour valider la profondeur.`,
      cueEn: `For your next set: Descend until you hear the optimal stretch audio click (${blueprint.optimalStretchAngle}°). Drop load by 5-10% if needed to achieve full depth.`,
      mentalFocusFr: `Viser le déclic audio à ${blueprint.optimalStretchAngle}° sur chaque répétition.`,
      mentalFocusEn: `Target the audio click at ${blueprint.optimalStretchAngle}° on every single repetition.`,
    };
  } else if (tensionDeduction >= 15 || telemetry.continuousTensionPercent < 65) {
    limitingFactor = {
      category: 'lockout_resting',
      titleFr: 'Perte de tension continue au verrouillage',
      titleEn: 'Tension Dump at Lockout',
      detailFr: `Arrêts prolongés en butée osseuse haute (>1s)\u00A0: la charge repose sur le squelette plutôt que sur le muscle, interrompant l’ischémie et la tension mécanique.`,
      detailEn: `Extended resting at bone-stack lockout (>1s): load rests on skeletal joints rather than muscle fibers, breaking metabolic ischemia and continuous mechanical tension.`,
      severity: 'medium',
    };
    nextSetPrescription = {
      cueFr: 'Pour votre prochaine série\u00A0: Arrêtez votre montée 2 cm avant la butée articulaire haute. Enchaînez directement la descente suivante pour garder les fibres sous tension ininterrompue.',
      cueEn: 'For your next set: Stop your ascent 2 cm before bone lockout. Immediately initiate the next eccentric phase to maintain uninterrupted fiber tension.',
      mentalFocusFr: 'Arrêt 2 cm avant la butée haute · tension continue ininterrompue.',
      mentalFocusEn: 'Stop 2 cm short of top lockout · continuous uninterrupted tension.',
    };
  } else if (eccentricDeduction >= 12 || telemetry.avgEccentricSec < 1.8) {
    limitingFactor = {
      category: 'eccentric_tempo',
      titleFr: 'Descente précipitée sans contrôle excentrique',
      titleEn: 'Rushed Eccentric Lowering',
      detailFr: `Phase excentrique de ${telemetry.avgEccentricSec}s (recommandation\u00A0: 2,5 à 3,5s). Laisser tomber la charge réduit de moitié les micro-lésions hypertrophiques.`,
      detailEn: `Eccentric duration was ${telemetry.avgEccentricSec}s (optimal standard: 2.5 to 3.5s). Dropping the weight cuts mechanical micro-stimulus in half.`,
      severity: 'medium',
    };
    nextSetPrescription = {
      cueFr: 'Pour votre prochaine série\u00A0: Comptez 3 secondes pleines sur chaque descente. Résistez activement à la pesanteur avant d’initier la remontée.',
      cueEn: 'For your next set: Count 3 full seconds on every descent. Actively resist gravity before driving back up.',
      mentalFocusFr: 'Compter 3 secondes complètes sur la descente.',
      mentalFocusEn: 'Count 3 full seconds on every lowering phase.',
    };
  }

  return {
    executionComplianceScore,
    tier,
    tierLabelFr,
    tierLabelEn,
    limitingFactor,
    nextSetPrescription,
  };
}
