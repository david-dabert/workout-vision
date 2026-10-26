import { useMemo } from 'react';
import { analyzeMovementOptimization } from '../../lib/coaching/movementOptimization';
import { getExercise } from '../../lib/exercises/index';
import './MovementOptimization.css';

/**
 * Movement Optimization Card
 * Displays ROM Score, Control & Tempo Index, Form Quality Badge,
 * and actionable Hypertrophy Coaching Summary on the Result screen.
 */
export default function MovementOptimizationCard({ reps = [], lift = 'squat', fr = false }) {
  const analysis = useMemo(() => {
    return analyzeMovementOptimization(reps, lift, fr);
  }, [reps, lift, fr]);

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
      </div>

      <div className="res-opt-disclaimer">
        * {fr ? 'Estimation indicative basée sur le travail mécanique de la série.' : 'Indicative estimate based on mechanical work.'}
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
  );
}
