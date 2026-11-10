import { useMemo } from 'react';
import { analyzeMovementOptimization, analyzeContinuousBiomechanics } from '../../lib/coaching/movementOptimization';
import { calculateIntraSetVelocityLoss } from '../../lib/biomechanics/stickingPoint';
import { analyzeBilateralKinematicSymmetry } from '../../lib/biomechanics/bilateralSymmetry';
import { analyzeDynamicKneeValgus } from '../../lib/biomechanics/dynamicValgus';
import { analyzeKineticChainSequencing } from '../../lib/biomechanics/kineticChainSequencing';
import { analyzeLumbopelvicRhythm } from '../../lib/biomechanics/lumbopelvicRhythm';
import { analyzeBarbellTilt } from '../../lib/biomechanics/barbellTilt';
import { computeBarPathMetrics } from './BarPathTracer';
import { getExercise } from '../../lib/exercises/index';
import './MovementOptimization.css';

function getAnthropometricPrescription(profile, lift, fr) {
  if (!profile || !profile.height) return null;
  const h = Number(profile.height);
  const ratio = h >= 175 ? 1.09 : h <= 162 ? 0.94 : 1.02;
  const ratioType = h >= 175 ? 'long' : h <= 162 ? 'short' : 'balanced';

  const isSquat = /squat/i.test(lift);
  const isHinge = /deadlift|rdl|thrust/i.test(lift);
  const isPress = /press|bench|push/i.test(lift);

  let stance = '';
  let angle = '';
  let cue = '';

  if (isSquat) {
    if (ratioType === 'long') {
      stance = fr ? 'Stance large (1.2x épaules)' : 'Wide stance (1.2x shoulders)';
      angle = fr ? 'Pointes à 20-25°' : '20-25° foot flare';
      cue = fr
        ? 'Fémurs longs\u00A0: stance élargi et rotation externe pour réduire le bras de levier lombaire et maximiser le grand fessier.'
        : 'Long femurs: wider stance and external hip rotation to reduce lumbar moment arm and recruit gluteus maximus.';
    } else if (ratioType === 'short') {
      stance = fr ? 'Stance épaules (1.0x)' : 'Shoulder width (1.0x)';
      angle = fr ? 'Pointes à 10-15°' : '10-15° foot flare';
      cue = fr
        ? 'Leviers compacts\u00A0: genoux avançant librement sur les orteils, buste verticalisé et trajectoire axiale directe.'
        : 'Compact levers: knees track freely forward over toes, upright torso and direct axial bar path.';
    } else {
      stance = fr ? 'Stance standard (1.1x)' : 'Standard stance (1.1x)';
      angle = fr ? 'Pointes à 15°' : '15° foot flare';
      cue = fr
        ? 'Leviers équilibrés\u00A0: répartition homogène quadriceps et chaîne postérieure sans compensation axiale.'
        : 'Balanced levers: even distribution across quadriceps and posterior chain without spinal compensation.';
    }
  } else if (isHinge) {
    if (ratioType === 'long') {
      stance = fr ? 'Hanches hautes au départ' : 'Higher hip start';
      angle = fr ? 'Verrouillage dorsal actif' : 'Active lat lock';
      cue = fr
        ? 'Bras de levier fémoral étendu\u00A0: départ hanches hautes et verrouillage des dorsaux pour fixer la colonne lombaire.'
        : 'Extended femur lever: higher hip setup and lat engagement to maintain neutral lumbar spine.';
    } else {
      stance = fr ? 'Départ hanches compact' : 'Compact hip setup';
      angle = fr ? 'Poussée jambes dominante' : 'Quad-dominant drive';
      cue = fr
        ? 'Leviers compacts\u00A0: transfert de force immédiat du sol par extension simultanée genoux et hanches.'
        : 'Compact levers: immediate floor drive via synchronized knee and hip extension.';
    }
  } else if (isPress) {
    stance = fr ? 'Prise indexée aux épaules' : 'Shoulder-calibrated grip';
    angle = fr ? 'Coudes à 45° du buste' : '45° elbow tuck';
    cue = fr
      ? 'Protection acromio-claviculaire\u00A0: coudes convergents à 45° pour préserver la coiffe des rotateurs au pic de charge.'
      : 'Rotator cuff protection: 45° tucked elbows to safeguard anterior shoulder capsule under peak load.';
  } else {
    stance = fr ? 'Alignement morphologique actif' : 'Active morpho-alignment';
    angle = fr ? 'Gainage pelvien neutre' : 'Neutral pelvic bracing';
    cue = fr
      ? 'Trajectoire adaptée à votre envergure\u00A0: maintien de la courbure vertébrale physiologique sur toute l\'amplitude.'
      : 'Path matched to your levers: maintains physiological spinal alignment across full range of motion.';
  }

  return {
    ratio,
    ratioLabel: fr
      ? (ratioType === 'long' ? 'Ratio fémur/buste 1.09 (Fémurs longs)' : ratioType === 'short' ? 'Ratio fémur/buste 0.94 (Fémurs courts)' : 'Ratio fémur/buste 1.02 (Équilibré)')
      : (ratioType === 'long' ? 'Femur/torso ratio 1.09 (Long femurs)' : ratioType === 'short' ? 'Femur/torso ratio 0.94 (Short femurs)' : 'Femur/torso ratio 1.02 (Balanced)'),
    stance,
    angle,
    cue,
  };
}

/**
 * Movement Optimization Card
 * Displays ROM Score, Control & Tempo Index, Form Quality Badge,
 * actionable Hypertrophy Coaching Summary, and Anthropometric Leverage Guidance.
 */
export default function MovementOptimizationCard({ reps = [], lift = 'squat', fr = false, result = null }) {
  const analysis = useMemo(() => {
    if (result && Array.isArray(result.angles) && result.angles.length > 0) {
      const fps = 30;
      const timestamps = result.timestamps || result.angles.map((_, i) => i / fps);
      return analyzeContinuousBiomechanics(result.angles, timestamps, lift, fr);
    }
    return analyzeMovementOptimization(reps, lift, fr);
  }, [reps, lift, fr, result]);

  const exercise = useMemo(() => {
    return getExercise(lift);
  }, [lift]);

  const athleteProfile = useMemo(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('wv_athlete_profile') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const leveragePrescription = useMemo(() => {
    return getAnthropometricPrescription(athleteProfile, lift, fr);
  }, [athleteProfile, lift, fr]);

  const velocityLoss = useMemo(() => {
    if (analysis?.velocityLoss) return analysis.velocityLoss;
    if (Array.isArray(reps) && reps.length >= 2) {
      return calculateIntraSetVelocityLoss(reps);
    }
    return null;
  }, [analysis, reps]);

  const bilateralSymmetry = useMemo(() => {
    if (!result) return null;
    const landmarks = result.worldLandmarks || result.landmarks || result.imageLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return analyzeBilateralKinematicSymmetry(landmarks, timestamps, lift, reps);
    } catch {
      return null;
    }
  }, [result, lift, reps]);

  const dynamicValgus = useMemo(() => {
    if (!result) return null;
    const landmarks = result.landmarks || result.imageLandmarks || result.worldLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return analyzeDynamicKneeValgus(landmarks, timestamps, lift);
    } catch {
      return null;
    }
  }, [result, lift]);

  const barPath = useMemo(() => {
    if (!result) return null;
    const landmarks = result.landmarks || result.imageLandmarks || result.worldLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return computeBarPathMetrics(landmarks, timestamps);
    } catch {
      return null;
    }
  }, [result]);

  const kineticSequencing = useMemo(() => {
    if (!result) return null;
    const landmarks = result.worldLandmarks || result.landmarks || result.imageLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return analyzeKineticChainSequencing(landmarks, timestamps, lift, reps);
    } catch {
      return null;
    }
  }, [result, lift, reps]);

  const lumbopelvic = useMemo(() => {
    if (!result) return null;
    const landmarks = result.worldLandmarks || result.landmarks || result.imageLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return analyzeLumbopelvicRhythm(landmarks, timestamps, lift, reps);
    } catch {
      return null;
    }
  }, [result, lift, reps]);

  const barbellTilt = useMemo(() => {
    if (!result) return null;
    const landmarks = result.landmarks || result.imageLandmarks || result.worldLandmarks;
    if (!landmarks || !landmarks.length) return null;
    const timestamps = result.timestamps || null;
    try {
      return analyzeBarbellTilt(landmarks, timestamps, { lift });
    } catch {
      return null;
    }
  }, [result, lift]);

  const badgeText = fr ? analysis.formBadge.labelFr : analysis.formBadge.label;

  return (
    <div className="res-opt-card" data-testid="movement-optimization-card">
      <div className="res-opt-header">
        <h3 className="res-opt-title">
          {fr ? 'Optimisation Biomécanique' : 'Movement Optimization'}
        </h3>
        <span className={`res-opt-badge is-${analysis.formBadge.severity}`}>
          {badgeText}
        </span>
      </div>

      {leveragePrescription && (
        <div className="res-opt-leverage-banner" data-testid="anthropometric-leverage-banner">
          <div className="res-opt-leverage-head">
            <span className="res-opt-leverage-kicker">{fr ? 'Morpho-Anatomie Calibrée' : 'Calibrated Morpho-Anatomy'}</span>
            <span className="res-opt-leverage-ratio">{leveragePrescription.ratioLabel}</span>
          </div>
          <p className="res-opt-leverage-cue">{leveragePrescription.cue}</p>
          <div className="res-opt-leverage-tags">
            <span className="res-opt-tag-stance">{leveragePrescription.stance}</span>
            <span className="res-opt-tag-angle">{leveragePrescription.angle}</span>
          </div>
        </div>
      )}

      {analysis.coachPrescription && (
        <div className="res-opt-prescription-card" data-testid="coach-prescription-card">
          <div className="res-opt-prescription-header">
            <div className="res-opt-prescription-title-group">
              <span className="res-opt-prescription-kicker">
                {fr ? 'Le Verdict du Coach' : 'The Coach’s Prescription'}
              </span>
              <h4 className="res-opt-prescription-title">
                {fr ? analysis.coachPrescription.tierLabelFr : analysis.coachPrescription.tierLabelEn}
              </h4>
            </div>
          </div>

          {analysis.coachPrescription.limitingFactor.category !== 'none' && (
            <div className="res-opt-bottleneck-box" data-testid="coach-limiting-factor">
              <div className="res-opt-bottleneck-head">
                <span className="res-opt-bottleneck-badge">
                  {fr ? 'Facteur limitant #1' : 'Bottleneck #1'}
                </span>
                <span className="res-opt-bottleneck-title">
                  {fr
                    ? analysis.coachPrescription.limitingFactor.titleFr
                    : analysis.coachPrescription.limitingFactor.titleEn}
                </span>
              </div>
              <p className="res-opt-bottleneck-detail">
                {fr
                  ? analysis.coachPrescription.limitingFactor.detailFr
                  : analysis.coachPrescription.limitingFactor.detailEn}
              </p>
            </div>
          )}

          <div className="res-opt-next-set-banner" data-testid="next-set-prescription">
            <span className="res-opt-next-set-kicker">
              {fr ? 'Consigne pour la série suivante' : 'Prescription for Set N+1'}
            </span>
            <p className="res-opt-next-set-cue">
              {fr
                ? analysis.coachPrescription.nextSetPrescription.cueFr
                : analysis.coachPrescription.nextSetPrescription.cueEn}
            </p>
            <div className="res-opt-next-set-focus">
              <span className="res-opt-focus-label">{fr ? 'Focus mental\u00A0:' : 'Mental cue:'}</span>
              <span className="res-opt-focus-text">
                {fr
                  ? analysis.coachPrescription.nextSetPrescription.mentalFocusFr
                  : analysis.coachPrescription.nextSetPrescription.mentalFocusEn}
              </span>
            </div>
          </div>
        </div>
      )}

      <details className="res-opt-deep-dive" data-testid="res-opt-deep-dive">
        <summary className="res-opt-deep-summary press" data-testid="res-opt-deep-summary">
          <div className="res-opt-summary-left">
            <span className="res-opt-summary-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </span>
            <div className="res-opt-summary-text">
              <strong className="res-opt-summary-title">
                {fr ? 'Biomécanique détaillée & Cinématique' : 'Detailed Biomechanics & Kinematics'}
              </strong>
              <span className="res-opt-summary-sub">
                {fr ? 'Angles, amplitude et tempo' : 'Angles, range and tempo'}
              </span>
            </div>
          </div>
          <span className="res-opt-summary-badge">{fr ? 'Détails' : 'Details'}</span>
        </summary>
        <div className="res-opt-deep-content">
          {analysis.machineProfile && analysis.machineProfile.machineType !== 'free_planar' && (
            <div className="res-opt-machine-banner" data-testid="machine-profile-banner">
              <div className="res-opt-machine-badge">
                <span className="res-opt-machine-kicker">{fr ? 'Guidage mécanique' : 'Machine Guidance'}</span>
                <span className="res-opt-machine-name">
                  {fr ? analysis.machineProfile.canonicalNameFr : analysis.machineProfile.canonicalNameEn}
                </span>
              </div>
          <p className="res-opt-machine-cue">
            {fr
              ? (analysis.machineProfile.fixedSegment === 'torso_guided' ? 'Trajectoire pendulaire guidée · verrouillage du plan d’appui'
                : analysis.machineProfile.fixedSegment === 'torso_fixed' ? 'Dossier rigide 45° · focalisation quadriceps'
                : analysis.machineProfile.fixedSegment === 'sternum_fixed' ? 'Appui sternal · suppression du balancier lombaire'
                : analysis.machineProfile.fixedSegment === 'humerus_fixed' ? 'Pupitre Scott · verrouillage huméral et isolation biceps'
                : 'Guidage machine stabilisé · cinématique alignée')
              : (analysis.machineProfile.fixedSegment === 'torso_guided' ? 'Guided pendulum arc · footplate plane locked'
                : analysis.machineProfile.fixedSegment === 'torso_fixed' ? 'Fixed 45° backpad · quad-focused tracking'
                : analysis.machineProfile.fixedSegment === 'sternum_fixed' ? 'Sternal chest support · zero spinal cheating'
                : analysis.machineProfile.fixedSegment === 'humerus_fixed' ? 'Scott preacher pad · locked humerus isolation'
                : 'Stabilized machine guidance · aligned kinematics')}
          </p>
        </div>
      )}

      <div className="res-opt-metrics">
        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Score d’amplitude (ROM)' : 'ROM Stretch Score'}
            </span>
            <span className="res-opt-val">{analysis.romScore}%</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className={`res-opt-bar-fill ${analysis.romScore >= 90 ? 'is-good' : analysis.romScore < 75 ? 'is-warn' : 'is-mid'}`}
              style={{ width: `${Math.min(100, analysis.romScore)}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr ? `Moyenne\u00A0: ${analysis.averageRomDeg}°` : `Average: ${analysis.averageRomDeg}°`}
          </span>
          {/* R9 — Source: rep excursion `r.romDegrees` from `src/lib/counting/core.ts` (`summarizeCount` peak-to-trough joint angle on the user's video), compared against `ARCHETYPE_ROM_TARGETS` written in `src/lib/coaching/movementOptimization.ts` (and `REFERENCE_RANGES` in `src/lib/reference-ranges.js`). Status: convention (reference range written in the app). */}
          <span className="res-opt-explain">
            {fr ? 'Amplitude mesurée sur votre vidéo, comparée à une plage de référence écrite dans l’application.' : 'Range of motion measured on your video, compared with a reference range written in the app.'}
          </span>
        </div>

        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Contrôle & tempo' : 'Control & Tempo'}
            </span>
            <span className="res-opt-val">{analysis.controlIndex}%</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className={`res-opt-bar-fill ${analysis.controlIndex >= 80 ? 'is-good' : analysis.controlIndex < 60 ? 'is-warn' : 'is-mid'}`}
              style={{ width: `${Math.min(100, analysis.controlIndex)}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr ? `Excentrique\u00A0: ${analysis.averageEccentricSec}\u00A0s` : `Eccentric: ${analysis.averageEccentricSec}\u00A0s`}
          </span>
          {/* R9 — Source: `r.eccentricSec` per-rep lowering duration measured from turnaround timestamps in `src/lib/counting/core.ts` (`summarizeCount`) and scored against `TARGET_ECCENTRIC_SEC = 2.0` in `src/lib/coaching/movementOptimization.ts`. Status: experimental. */}
          <span className="res-opt-explain">
            {fr ? 'Durée moyenne de la phase de descente mesurée sur votre vidéo.' : 'Average duration of the lowering phase measured on your video.'}
          </span>
        </div>

        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Temps sous tension (TUT)' : 'Time Under Tension (TUT)'}
            </span>
            <span className="res-opt-val">{analysis.timeUnderTensionSec}\u00A0s</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className="res-opt-bar-fill is-mid"
              style={{ width: `${Math.min(100, Math.max(15, analysis.timeUnderTensionSec * 3))}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr ? `Cadence\u00A0: ${analysis.tempoCadence}` : `Tempo: ${analysis.tempoCadence}`}
          </span>
          {/* R9 — Source: sum of `(r.endTime - r.startTime)` across counted whole repetitions in `src/lib/counting/core.ts` (`summarizeCount`) and `src/lib/coaching/movementOptimization.ts`. Status: convention. */}
          <span className="res-opt-explain">
            {fr ? 'Durée cumulée des répétitions comptées sur votre vidéo.' : 'Cumulative duration of the repetitions counted on your video.'}
          </span>
        </div>

        {velocityLoss && (
          <div className="res-opt-metric" data-testid="velocity-loss-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Perte de vitesse intra-série' : 'Intra-Set Velocity Decline'}
              </span>
              <span className="res-opt-val">{velocityLoss.lossPercent}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${velocityLoss.lossPercent < 20 ? 'is-good' : velocityLoss.lossPercent <= 40 ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(8, velocityLoss.lossPercent))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? velocityLoss.cueFr : velocityLoss.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Ralentissement entre la répétition la plus rapide et la dernière répétition.'
                : 'Deceleration between the fastest repetition and the final repetition.'}
            </span>
          </div>
        )}

        {bilateralSymmetry && (
          <div className="res-opt-metric" data-testid="bilateral-symmetry-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Symétrie bilatérale' : 'Bilateral Symmetry'}
              </span>
              <span className="res-opt-val">{bilateralSymmetry.symmetryScore}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${bilateralSymmetry.symmetryScore >= 90 ? 'is-good' : bilateralSymmetry.symmetryScore >= 80 ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, bilateralSymmetry.symmetryScore))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? bilateralSymmetry.cueFr : bilateralSymmetry.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Indice de symétrie cinématique gauche/droite sur l’ensemble de la série.'
                : 'Left/right kinematic symmetry index across the entire repetition set.'}
            </span>
          </div>
        )}

        {dynamicValgus && (
          <div className="res-opt-metric" data-testid="dynamic-valgus-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Stabilité fémoro-tibiale (Valgus)' : 'Knee Valgus Stability'}
              </span>
              <span className="res-opt-val">{dynamicValgus.maxValgusDeg}°</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${!dynamicValgus.valgusRiskFlag ? 'is-good' : !dynamicValgus.severeRiskFlag ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, (dynamicValgus.maxValgusDeg / 15) * 100))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? dynamicValgus.cueFr : dynamicValgus.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Déviation médiale du genou mesurée dans le plan frontal.'
                : 'Frontal plane medial knee deviation.'}
            </span>
          </div>
        )}

        {kineticSequencing && (
          <div className="res-opt-metric" data-testid="kinetic-sequencing-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Coordination proximodistale' : 'Kinetic Chain Sequencing'}
              </span>
              <span className="res-opt-val">{kineticSequencing.kseiPercent}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${kineticSequencing.tier === 'optimal' ? 'is-good' : kineticSequencing.tier === 'moderate' ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, kineticSequencing.kseiPercent))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? kineticSequencing.cueFr : kineticSequencing.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Coordination temporelle entre l’extension des hanches et celle des genoux en phase de propulsion.'
                : 'Temporal coordination between hip and knee extension during concentric ascent.'}
            </span>
          </div>
        )}

        {lumbopelvic && (
          <div className="res-opt-metric" data-testid="lumbopelvic-stability-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Stabilité lombo-pelvienne' : 'Lumbopelvic Stability'}
              </span>
              <span className="res-opt-val">{lumbopelvic.lsiPercent}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${lumbopelvic.tier === 'neutral' ? 'is-good' : lumbopelvic.tier === 'moderate_flexion' ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, lumbopelvic.lsiPercent))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? lumbopelvic.cueFr : lumbopelvic.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Maintien du rachis lombaire neutre et absence de rétroversion pelvienne au point bas.'
                : 'Maintenance of neutral lumbar spine and absence of posterior pelvic tilt at turnaround.'}
            </span>
          </div>
        )}

        {barbellTilt && (
          <div className="res-opt-metric" data-testid="barbell-tilt-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Stabilité de la barre' : 'Barbell Planar Stability'}
              </span>
              <span className="res-opt-val">{barbellTilt.planarStabilityIndex}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${barbellTilt.verdict === 'optimal' ? 'is-good' : barbellTilt.verdict === 'mild_tilt' ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, barbellTilt.planarStabilityIndex))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? barbellTilt.cueFr : barbellTilt.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Maintien de l’horizontalité de la barre dans le plan frontal.'
                : 'Maintenance of horizontal bar orientation in the frontal plane.'}
            </span>
          </div>
        )}

        {barPath && (
          <div className="res-opt-metric" data-testid="bar-path-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Efficacité axiale de la barre' : 'Axial Bar Path Efficiency'}
              </span>
              <span className="res-opt-val">{barPath.verticalEfficiency}%</span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${barPath.isOptimal ? 'is-good' : barPath.verticalEfficiency >= 65 ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, barPath.verticalEfficiency))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr ? barPath.cueFr : barPath.cueEn}
            </span>
            <span className="res-opt-explain">
              {fr
                ? 'Ratio de verticalité entre la course utile et la dérive horizontale sagittale.'
                : 'Verticality ratio between displacement and sagittal drift.'}
            </span>
          </div>
        )}

        {analysis.formDistortionScore !== null && analysis.formDistortionScore !== undefined && (
          <div className="res-opt-metric" data-testid="form-fidelity-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Fidélité de trajectoire (expérimental)' : 'Path Fidelity (experimental)'}
              </span>
              <span className="res-opt-val">
                {Math.round(Math.max(0, 1 - analysis.formDistortionScore) * 100)}%
              </span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${analysis.formDistortionScore < 0.2 ? 'is-good' : analysis.formDistortionScore < 0.4 ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.round(Math.max(10, Math.min(100, (1 - analysis.formDistortionScore) * 100)))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {analysis.pathEfficiencyPercent !== null && analysis.pathEfficiencyPercent !== undefined
                ? (fr ? `Efficacité axiale\u00A0: ${analysis.pathEfficiencyPercent}%` : `Axial efficiency: ${analysis.pathEfficiencyPercent}%`)
                : (fr ? 'Modèle cinématique' : 'Kinematic template')}
            </span>
            {/* R9 — Source: `alignKineticTrajectory` DTW distance between each rep's angle slice (`result.angles` on the user's video) and `getCanonicalTemplate(lift)` in `src/lib/counting/KineticForcedAligner.ts` (hand-written template, UNSOURCED). Status: experimental. */}
            <span className="res-opt-explain">
              {fr ? 'Écart moyen de la courbe d’angle mesurée sur votre vidéo par rapport au profil type de l’exercice.' : 'Mean distance between the angle curve measured on your video and the exercise template.'}
            </span>
          </div>
        )}

        {analysis.hypertrophyReport && (
          <div className="res-opt-metric" data-testid="stretch-hypertrophy-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Tension d’étirement' : 'Stretch Hypertrophy'}
              </span>
              <span className="res-opt-val">
                {analysis.hypertrophyReport.avgStretchScore}%
              </span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${analysis.hypertrophyReport.avgStretchScore >= 85 ? 'is-good' : analysis.hypertrophyReport.avgStretchScore >= 65 ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.max(10, analysis.hypertrophyReport.avgStretchScore))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {analysis.hypertrophyReport.bounceCount === 0
                ? (fr ? 'Inversion contrôlée sans rebond' : 'Controlled reversal, zero bounce')
                : (fr ? `${analysis.hypertrophyReport.bounceCount} rebond(s) d’élan détecté(s)` : `${analysis.hypertrophyReport.bounceCount} momentum bounce(s) detected`)}
            </span>
          </div>
        )}
      </div>

      <div className="res-opt-coaching">
        <h4 className="res-opt-subtitle">
          {fr ? 'Recommandations hypertrophie' : 'Hypertrophic Stimulus Cues'}
        </h4>
        <ul className="res-opt-cues">
          {analysis.coachingPoints.map((point, i) => (
            <li key={i} className="res-opt-cue">
              <span className="res-opt-bullet" aria-hidden="true">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {exercise && (
        <div className="res-opt-target">
          <span className="res-opt-muscles-title">
            {fr ? 'Muscles cibles\u00A0:' : 'Target Muscles:'}
          </span>
          <span className="res-opt-muscles-list">
            {exercise.primary_muscles.map(m => m.replace(/_/g, ' ')).join(', ')}
          </span>
        </div>
      )}
        </div>
      </details>
    </div>
  );
}
