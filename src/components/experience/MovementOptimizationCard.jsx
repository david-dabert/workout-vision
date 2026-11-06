import { useMemo } from 'react';
import { analyzeMovementOptimization, analyzeContinuousBiomechanics } from '../../lib/coaching/movementOptimization';
import { getExercise } from '../../lib/exercises/index';
import './MovementOptimization.css';

/**
 * Movement Optimization Card
 * Displays ROM Score, Control & Tempo Index, Form Quality Badge,
 * and actionable Hypertrophy Coaching Summary.
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
          <span className="res-opt-explain">
            {fr ? 'Angle articulaire parcouru face à l’amplitude complète du mouvement.' : 'Joint angle range reached relative to full anatomical range.'}
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
          <span className="res-opt-explain">
            {fr ? 'Régularité de la phase de descente retenue sans chute libre.' : 'Smoothness of the lowering phase without dropping the weight.'}
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
          <span className="res-opt-explain">
            {fr ? 'Durée cumulée d’effort mécanique (descente - pause - montée).' : 'Total active mechanical work duration (lowering - pause - concentric).'}
          </span>
        </div>

        {analysis.formDistortionScore !== null && analysis.formDistortionScore !== undefined && (
          <div className="res-opt-metric" data-testid="form-fidelity-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Fidélité de trajectoire' : 'Path Fidelity'}
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
            <span className="res-opt-explain">
              {fr ? 'Stabilité du couloir de mouvement d’une répétition à l’autre.' : 'Consistency of the movement path from rep to rep.'}
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
            <span className="res-opt-explain">
              {fr ? 'Qualité du contrôle au point d’étirement maximal du muscle.' : 'Control quality at the muscle’s peak stretched position.'}
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
