import { useMemo } from 'react';
import { analyzeMovementOptimization, analyzeContinuousBiomechanics } from '../../lib/coaching/movementOptimization';
import { getExercise } from '../../lib/exercises/index';
import './MovementOptimization.css';

/**
 * Movement Optimization Card
 * Displays ROM Score, Control & Tempo Index, Form Quality Badge,
 * Sticking Point Diagnostics, and actionable Hypertrophy Coaching Summary.
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
            {fr ? `Excentrique\u00A0: ${analysis.averageEccentricSec}s` : `Eccentric: ${analysis.averageEccentricSec}s`}
          </span>
        </div>

        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Perte de vitesse (VBT)' : 'Velocity Loss (VBT)'}
            </span>
            <span className="res-opt-val">{analysis.velocityLossPercent}%</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className={`res-opt-bar-fill ${analysis.fatigueTier === 'optimal_hypertrophy' ? 'is-good' : analysis.fatigueTier === 'failure' ? 'is-warn' : 'is-mid'}`}
              style={{ width: `${Math.min(100, Math.max(10, analysis.velocityLossPercent))}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr
              ? (analysis.fatigueTier === 'optimal_hypertrophy' ? 'Zone hypertrophie' : analysis.fatigueTier === 'failure' ? 'Échec musculaire' : 'Vitesse / Dynamique')
              : (analysis.fatigueTier === 'optimal_hypertrophy' ? 'Hypertrophy target' : analysis.fatigueTier === 'failure' ? 'Muscular failure' : 'Speed / Explosive')}
          </span>
        </div>

        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Travail mécanique' : 'Mechanical Work'}
            </span>
            <span className="res-opt-val">{analysis.mechanicalWorkKj} kJ</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className="res-opt-bar-fill is-good"
              style={{ width: `${Math.min(100, Math.max(15, analysis.mechanicalWorkKj * 20))}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr ? `Dépense est.\u00A0: ~${analysis.caloriesKcal} kcal*` : `Est. energy: ~${analysis.caloriesKcal} kcal*`}
          </span>
        </div>

        <div className="res-opt-metric" data-testid="concentric-power-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Puissance concentrique' : 'Concentric Power'}
            </span>
            <span className="res-opt-val">{analysis.averagePowerWatts} W</span>
          </div>
          <div className="res-opt-bar-track">
            <div
              className="res-opt-bar-fill is-good"
              style={{ width: `${Math.min(100, Math.max(15, (analysis.averagePowerWatts / Math.max(1, analysis.peakPowerWatts || 300)) * 100))}%` }}
            />
          </div>
          <span className="res-opt-sub">
            {fr
              ? `Pic\u00A0: ${analysis.peakPowerWatts} W (chute\u00A0: ${analysis.powerLossPercent}%)`
              : `Peak: ${analysis.peakPowerWatts} W (drop: ${analysis.powerLossPercent}%)`}
          </span>
        </div>

        <div className="res-opt-metric">
          <div className="res-opt-metric-head">
            <span className="res-opt-label">
              {fr ? 'Temps sous tension (TUT)' : 'Time Under Tension (TUT)'}
            </span>
            <span className="res-opt-val">{analysis.timeUnderTensionSec}s</span>
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
          </div>
        )}

        {analysis.lumbarKinetics && (
          <div className="res-opt-metric" data-testid="lumbar-kinetics-metric">
            <div className="res-opt-metric-head">
              <span className="res-opt-label">
                {fr ? 'Cisaillement lombaire (L5/S1)' : 'Lumbar Shear (L5/S1)'}
              </span>
              <span className="res-opt-val">
                {analysis.lumbarKinetics.peakShearForceN} N
              </span>
            </div>
            <div className="res-opt-bar-track">
              <div
                className={`res-opt-bar-fill ${analysis.lumbarKinetics.safetyTier === 'optimal' ? 'is-good' : analysis.lumbarKinetics.safetyTier === 'moderate' ? 'is-mid' : 'is-warn'}`}
                style={{ width: `${Math.min(100, Math.round((analysis.lumbarKinetics.peakShearForceN / 600) * 100))}%` }}
              />
            </div>
            <span className="res-opt-sub">
              {fr
                ? `Compression\u00A0: ${analysis.lumbarKinetics.peakCompressiveForceN} N (limite\u00A0: 3400 N)`
                : `Compression: ${analysis.lumbarKinetics.peakCompressiveForceN} N (limit: 3400 N)`}
            </span>
          </div>
        )}
      </div>

      <div className="res-opt-disclaimer">
        * {fr ? 'Estimation indicative basée sur le travail mécanique de la série.' : 'Indicative estimate based on mechanical work.'}
      </div>

      {analysis.repVelocityProfiles && analysis.repVelocityProfiles.length > 0 && (
        <div className="res-opt-vbt-section" data-testid="vbt-profile-strip">
          <div className="res-opt-vbt-header">
            <h4 className="res-opt-subtitle">
              {fr ? 'Profil de Vitesse par Répétition (VBT)' : 'Rep-by-Rep Velocity Profile (VBT)'}
            </h4>
            <span className="res-opt-vbt-legend">
              {fr ? 'Ralentissement vs rep la plus rapide' : 'Deceleration vs fastest rep'}
            </span>
          </div>

          <div className="res-opt-vbt-strip">
            {analysis.repVelocityProfiles.map(p => (
              <div key={p.repIndex} className={`res-opt-vbt-rep is-${p.tier}`} data-testid={`vbt-rep-${p.repIndex}`}>
                <div className="res-opt-vbt-rep-head">
                  <span className="res-opt-vbt-num">R{p.repIndex}</span>
                  <span className="res-opt-vbt-loss">{p.velocityLossPercent}%</span>
                </div>
                <div className="res-opt-vbt-bar-track">
                  <div
                    className={`res-opt-vbt-bar-fill is-${p.tier}`}
                    style={{ width: `${Math.max(12, Math.min(100, p.velocityLossPercent))}%` }}
                  />
                </div>
                <div className="res-opt-vbt-rep-times">
                  <span>{p.concentricSec > 0 ? `${p.concentricSec}s` : '—'}</span>
                  <span>{p.powerWatts ? `${p.powerWatts}W` : (p.romDegrees > 0 ? `${Math.round(p.romDegrees)}°` : '')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.stickingPointSummary && (
        <div className="res-opt-sticking" data-testid="sticking-point-box">
          <div className="res-opt-sticking-head">
            <span className="res-opt-sticking-badge">
              {fr ? 'Point de blocage' : 'Sticking Point'}
            </span>
            <span className="res-opt-sticking-title">
              {fr ? 'Ralentissement biomécanique' : 'Biomechanical Deceleration'}
            </span>
          </div>
          <p className="res-opt-sticking-desc">{analysis.stickingPointSummary}</p>
        </div>
      )}

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
  );
}
