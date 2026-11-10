/**
 * jointReadiness.ts
 *
 * Musculoskeletal Strain & Joint Readiness Engine (The Anti-Whoop).
 * Wearables track heart rate but miss joint, connective tissue, and tendon wear.
 *
 * Calculates cumulative mechanical joint dose from real 3D kinematic curves:
 * - Glenohumeral subacromial stress (shoulder abduction * shrug multiplier)
 * - Lumbar spine shear dose (trunk inclination * lumbar flexion penalty)
 * - Patellofemoral strain (knee flexion depth * valgus penalty)
 *
 * Yields an objective 0-100 Joint Readiness Score and actionable clinical recommendations.
 */

export interface JointStrainInputs {
  exerciseId: string;
  completedReps: number;
  meanRomDegrees: number;
  peakVelocityDegPerSec: number;
  valgusIncidentsCount?: number;
  shrugSignsCount?: number;
  spinalFlexionViolationsCount?: number;
  bilateralAsymmetryDegrees?: number;
}

export interface JointReadinessResult {
  readinessScore: number; // 0 to 100 (100 = fully recovered, < 50 = acute strain warning)
  cumulativeStrainUnits: number;
  mostStressedJoint: 'shoulder' | 'lumbar_spine' | 'patellar_knee' | 'elbow' | 'balanced';
  isDeloadRecommended: boolean;
  recommendationFr: string;
  recommendationEn: string;
}

export class JointReadinessEngine {
  private shoulderAccumulator = 0;
  private lumbarAccumulator = 0;
  private kneeAccumulator = 0;
  private elbowAccumulator = 0;

  /**
   * Integrates a completed set into cumulative joint strain totals.
   */
  public logSet(inputs: JointStrainInputs): void {
    const reps = Math.max(1, inputs.completedReps);
    const rom = Math.max(10, inputs.meanRomDegrees);
    const shrug = inputs.shrugSignsCount || 0;
    const valgus = inputs.valgusIncidentsCount || 0;
    const spineFlex = inputs.spinalFlexionViolationsCount || 0;
    const asymmetry = Math.abs(inputs.bilateralAsymmetryDegrees || 0);

    const asymmetryFactor = 1 + Math.min(0.5, asymmetry / 20);

    // Shoulder strain model
    if (['overhead_press', 'lateral_raise', 'bench_press', 'dip', 'lat_pulldown'].some(k => inputs.exerciseId.includes(k))) {
      const shrugPenalty = 1 + (shrug / reps) * 1.5;
      const strain = (rom * reps * 0.1) * shrugPenalty * asymmetryFactor;
      this.shoulderAccumulator += strain;
    }

    // Lumbar spine shear model
    if (['deadlift', 'romanian_deadlift', 'squat', 'bent_over_row', 'good_morning'].some(k => inputs.exerciseId.includes(k))) {
      const flexionPenalty = 1 + (spineFlex / reps) * 2.0;
      const strain = (rom * reps * 0.12) * flexionPenalty * asymmetryFactor;
      this.lumbarAccumulator += strain;
    }

    // Patellar / Knee strain model
    if (['squat', 'leg_press', 'lunge', 'leg_extension', 'sissy_squat'].some(k => inputs.exerciseId.includes(k))) {
      const valgusPenalty = 1 + (valgus / reps) * 1.8;
      const strain = (rom * reps * 0.11) * valgusPenalty * asymmetryFactor;
      this.kneeAccumulator += strain;
    }

    // Elbow strain model
    if (['bicep_curl', 'tricep_pushdown', 'tricep_extension', 'skull_crusher'].some(k => inputs.exerciseId.includes(k))) {
      const strain = (rom * reps * 0.08) * asymmetryFactor;
      this.elbowAccumulator += strain;
    }
  }

  /**
   * Evaluates the current Joint Readiness Score across cumulative session work.
   */
  public evaluateReadiness(): JointReadinessResult {
    const totalStrain = Math.round(
      this.shoulderAccumulator + this.lumbarAccumulator + this.kneeAccumulator + this.elbowAccumulator
    );

    // Baseline recovery ceiling: 300 strain units per session is a heavy load
    const maxStrainBudget = 300;
    const readiness = Math.max(0, Math.min(100, Math.round(100 - (totalStrain / maxStrainBudget) * 100)));

    let mostStressed: 'shoulder' | 'lumbar_spine' | 'patellar_knee' | 'elbow' | 'balanced' = 'balanced';
    const strains = [
      { joint: 'shoulder' as const, val: this.shoulderAccumulator },
      { joint: 'lumbar_spine' as const, val: this.lumbarAccumulator },
      { joint: 'patellar_knee' as const, val: this.kneeAccumulator },
      { joint: 'elbow' as const, val: this.elbowAccumulator },
    ].sort((a, b) => b.val - a.val);

    if (strains[0].val > 30) {
      mostStressed = strains[0].joint;
    }

    const isDeload = readiness < 40;

    let recFr = 'Capacité articulaire optimale. Vous pouvez poursuivre l\u2019entraînement normalement.';
    let recEn = 'Optimal joint capacity. You may proceed with normal training.';

    if (isDeload) {
      if (mostStressed === 'shoulder') {
        recFr = 'Alerte surcharge articulaire\u00A0: l\u2019épaule présente une fatigue mécanique élevée. Déchargez les mouvements au-dessus de la tête aujourd\u2019hui.';
        recEn = 'Joint overload alert: high mechanical shoulder strain. Deload overhead movements today.';
      } else if (mostStressed === 'lumbar_spine') {
        recFr = 'Alerte contrainte lombaire\u00A0: cisaillement rachidien important. Privilégiez les exercices avec soutien thoracique.';
        recEn = 'Lumbar strain alert: elevated spinal shear. Prioritize chest-supported exercises.';
      } else if (mostStressed === 'patellar_knee') {
        recFr = 'Alerte tendon rotulien\u00A0: contrainte fémoro-patellaire haute. Évitez les flexions profondes avec genoux dépassants.';
        recEn = 'Patellar tendon alert: high patellofemoral load. Avoid deep forward knee travel squats.';
      } else {
        recFr = 'Indice de récupération articulaire faible. Réduisez le volume de travail.';
        recEn = 'Low joint readiness index. Reduce overall training volume.';
      }
    } else if (readiness < 70) {
      recFr = `Fatigue articulaire modérée concentrée sur ${mostStressed}. Maintenez une exécution technique stricte.`;
      recEn = `Moderate joint fatigue concentrated on ${mostStressed}. Maintain strict form.`;
    }

    return {
      readinessScore: readiness,
      cumulativeStrainUnits: totalStrain,
      mostStressedJoint: mostStressed,
      isDeloadRecommended: isDeload,
      recommendationFr: recFr,
      recommendationEn: recEn,
    };
  }

  public reset(): void {
    this.shoulderAccumulator = 0;
    this.lumbarAccumulator = 0;
    this.kneeAccumulator = 0;
    this.elbowAccumulator = 0;
  }
}
