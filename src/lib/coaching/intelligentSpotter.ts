/**
 * intelligentSpotter.ts
 *
 * Real-time Neuromuscular Fatigue & Injury Prevention Spotter.
 * Monitors concentric velocity loss, bilateral asymmetry drift, and compensation
 * patterns (shrug signs, spinal flexion, valgus collapse) across a set.
 *
 * Provides immediate actionable voice intervention cues to protect joints and prevent tears.
 */

export interface RepTelemetry {
  repNumber: number;
  concentricDurationMs: number;
  eccentricDurationMs: number;
  meanConcentricVelocityDegPerSec: number;
  bilateralAsymmetryDegrees: number;
  formViolations?: string[];
}

export type FatigueState =
  | 'FRESH'
  | 'STABLE'
  | 'MODERATE_FATIGUE'
  | 'HIGH_FATIGUE'
  | 'NEUROMUSCULAR_FAILURE';

export type InjuryRiskLevel = 'MINIMAL' | 'ELEVATED' | 'CRITICAL';

export interface SpotterDecision {
  repNumber: number;
  velocityLossPct: number;
  fatigueState: FatigueState;
  injuryRisk: InjuryRiskLevel;
  shouldAbortSet: boolean;
  audioCueFr: string;
  audioCueEn: string;
  reason: string;
}

export interface SpotterConfig {
  /** Maximum acceptable velocity loss before alerting fatigue (typically 25-35%) */
  velocityLossWarningThreshold: number;
  /** Maximum acceptable velocity loss before triggering abort (typically 45-55%) */
  velocityLossAbortThreshold: number;
  /** Maximum bilateral asymmetry drift allowed in degrees (typically 8-12 deg) */
  asymmetryDriftAbortThreshold: number;
}

const DEFAULT_SPOTTER_CONFIG: SpotterConfig = {
  velocityLossWarningThreshold: 0.25,
  velocityLossAbortThreshold: 0.45,
  asymmetryDriftAbortThreshold: 10,
};

export class IntelligentSpotter {
  private config: SpotterConfig;
  private repHistory: RepTelemetry[] = [];
  private baselineVelocity: number | null = null;

  constructor(config?: Partial<SpotterConfig>) {
    this.config = { ...DEFAULT_SPOTTER_CONFIG, ...config };
  }

  /**
   * Evaluates a completed repetition in real-time.
   */
  public evaluateRep(rep: RepTelemetry): SpotterDecision {
    this.repHistory.push(rep);

    // Baseline is established on the fastest of the first two reps
    if (this.baselineVelocity === null) {
      this.baselineVelocity = rep.meanConcentricVelocityDegPerSec;
    } else if (this.repHistory.length === 2) {
      this.baselineVelocity = Math.max(this.baselineVelocity, rep.meanConcentricVelocityDegPerSec);
    }

    const baseVel = this.baselineVelocity || rep.meanConcentricVelocityDegPerSec;
    const currentVel = rep.meanConcentricVelocityDegPerSec;
    const velocityLoss = Math.max(0, (baseVel - currentVel) / (baseVel || 1));
    const velocityLossPct = Math.round(velocityLoss * 100);

    const violations = rep.formViolations || [];
    const hasDangerousViolation = violations.some(v =>
      ['shrug_sign', 'lumbar_rounding', 'knee_valgus', 'asymmetrical_hip_shift'].includes(v)
    );

    const asymmetry = Math.abs(rep.bilateralAsymmetryDegrees);

    // Decision Logic
    let fatigueState: FatigueState = 'FRESH';
    let injuryRisk: InjuryRiskLevel = 'MINIMAL';
    let shouldAbort = false;
    let cueFr = 'Répétition propre. Continuez.';
    let cueEn = 'Clean rep. Keep going.';
    let reason = 'Normal smooth repetition';

    if (velocityLoss > this.config.velocityLossAbortThreshold || (velocityLoss > 0.35 && hasDangerousViolation)) {
      fatigueState = 'NEUROMUSCULAR_FAILURE';
      injuryRisk = 'CRITICAL';
      shouldAbort = true;
      if (hasDangerousViolation) {
        reason = `Failure threshold reached with form compensation (${violations.join(', ')})`;
        cueFr = `Arrêt recommandé\u00A0: vitesse en chute de ${velocityLossPct}% et compensation motrice. Ne tentez pas la suivante.`;
        cueEn = `Stop recommended: velocity down ${velocityLossPct}% with compensation. Do not attempt the next rep.`;
      } else {
        reason = `Extreme velocity loss (${velocityLossPct}%) indicating complete concentric exhaustion`;
        cueFr = `Arrêt recommandé\u00A0: vitesse en baisse de ${velocityLossPct}%. Rangez la charge en sécurité.`;
        cueEn = `Stop recommended: velocity loss of ${velocityLossPct}%. Rack the weight safely.`;
      }
    } else if (asymmetry >= this.config.asymmetryDriftAbortThreshold) {
      fatigueState = 'HIGH_FATIGUE';
      injuryRisk = 'CRITICAL';
      shouldAbort = true;
      reason = `Excessive bilateral asymmetry drift (${asymmetry} degrees)`;
      cueFr = `Arrêt\u00A0: déséquilibre latéral marqué (${asymmetry}\u00B0). Risque articulaire asymétrique.`;
      cueEn = `Stop: significant lateral asymmetry (${asymmetry} deg). Asymmetrical joint risk.`;
    } else if (velocityLoss > this.config.velocityLossWarningThreshold) {
      fatigueState = 'HIGH_FATIGUE';
      injuryRisk = 'ELEVATED';
      shouldAbort = false;
      reason = `Approaching true RPE 9.5 (velocity loss ${velocityLossPct}%)`;
      cueFr = `Vitesse en baisse de ${velocityLossPct}%. Encore une dernière répétition contrôlée au maximum.`;
      cueEn = `Velocity down ${velocityLossPct}%. One more controlled repetition maximum.`;
    } else if (velocityLoss > 0.12) {
      fatigueState = 'MODERATE_FATIGUE';
      injuryRisk = 'MINIMAL';
      shouldAbort = false;
      cueFr = 'Bonne maîtrise. Rythme constant.';
      cueEn = 'Good control. Steady cadence.';
    }

    return {
      repNumber: rep.repNumber,
      velocityLossPct,
      fatigueState,
      injuryRisk,
      shouldAbortSet: shouldAbort,
      audioCueFr: cueFr,
      audioCueEn: cueEn,
      reason,
    };
  }

  public reset(): void {
    this.repHistory = [];
    this.baselineVelocity = null;
  }
}
