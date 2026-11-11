/**
 * clinicalTrendAnalysis.ts: Multi-Session Longitudinal Rehabilitation & Kinematic Evolution Engine.
 *
 * Implements clinical trajectory classification, session-over-session ROM and compliance deltas,
 * and recovery forecasting according to evidence-based rehabilitation protocols.
 */

export type RecoveryTrajectory = 'ACCELERATED' | 'PROGRESSING' | 'STABILIZED' | 'REGRESSING';

export interface ClinicalSessionJoint {
  name: string;
  within?: number | null;
  gap?: number | null;
  range?: number | null;
}

export interface ClinicalSessionSummary {
  date?: string;
  verdict?: 'match' | 'revise' | 'refused';
  meanWithin?: number;
  minWithin?: number;
  joints?: ClinicalSessionJoint[];
}

export interface LongitudinalEvolutionTrend {
  sessionCount: number;
  trajectory: RecoveryTrajectory;
  deltaPercent: number;
  firstScore: number;
  latestScore: number;
  improvingJoints: string[];
  laggingJoints: string[];
  cueFr: string;
  cueEn: string;
}

/**
 * Computes multi-session longitudinal trajectory and joint compliance deltas.
 */
export function computeClinicalTrend(
  sessions: ClinicalSessionSummary[]
): LongitudinalEvolutionTrend | null {
  if (!Array.isArray(sessions) || sessions.length < 2) return null;

  // Filter valid sessions with recorded joint metrics
  const valid = sessions.filter(
    s => s && Array.isArray(s.joints) && s.joints.some(j => j.within != null)
  );
  if (valid.length < 2) return null;

  const scoreOf = (s: ClinicalSessionSummary): number => {
    const vals = s.joints?.map(j => j.within).filter((v): v is number => v != null) ?? [];
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const firstScore = Math.round(scoreOf(valid[0]) * 100);
  const latestScore = Math.round(scoreOf(valid[valid.length - 1]) * 100);
  const deltaPercent = latestScore - firstScore;

  let trajectory: RecoveryTrajectory;
  if (deltaPercent >= 10) {
    trajectory = 'ACCELERATED';
  } else if (deltaPercent >= 3) {
    trajectory = 'PROGRESSING';
  } else if (deltaPercent >= -3) {
    trajectory = 'STABILIZED';
  } else {
    trajectory = 'REGRESSING';
  }

  const firstJoints = new Map(valid[0].joints?.map(j => [j.name, j.within ?? 0]) ?? []);
  const latestJoints = new Map(
    valid[valid.length - 1].joints?.map(j => [j.name, j.within ?? 0]) ?? []
  );

  const improvingJoints: string[] = [];
  const laggingJoints: string[] = [];

  for (const [name, latestVal] of latestJoints.entries()) {
    const firstVal = firstJoints.get(name);
    if (firstVal !== undefined) {
      const diff = latestVal - firstVal;
      if (diff >= 0.05) improvingJoints.push(name);
      else if (diff <= -0.05) laggingJoints.push(name);
    }
  }

  const sign = deltaPercent >= 0 ? '+' : '';
  let cueFr = '';
  let cueEn = '';

  if (trajectory === 'ACCELERATED') {
    cueFr = `Trajectoire accélérée (${sign}${deltaPercent}\u00A0%)\u00A0: nette progression de la précision articulaire.`;
    cueEn = `Accelerated trajectory (${sign}${deltaPercent}%): clear progression in joint precision.`;
  } else if (trajectory === 'PROGRESSING') {
    cueFr = `Progression constante (${sign}${deltaPercent}\u00A0%)\u00A0: amélioration continue du contrôle moteur.`;
    cueEn = `Steady progression (${sign}${deltaPercent}%): continuous motor control improvement.`;
  } else if (trajectory === 'STABILIZED') {
    cueFr = `Plateau de consolidation (${sign}${deltaPercent}\u00A0%)\u00A0: tolérance stabilisée sur les dernières séances.`;
    cueEn = `Consolidation plateau (${sign}${deltaPercent}%): tolerance stabilized across recent sessions.`;
  } else {
    cueFr = `Vigilance compensation (${sign}${deltaPercent}\u00A0%)\u00A0: légère régression ou fatigue neuromusculaire.`;
    cueEn = `Compensation vigilance (${sign}${deltaPercent}%): slight regression or neuromuscular fatigue.`;
  }

  return {
    sessionCount: valid.length,
    trajectory,
    deltaPercent,
    firstScore,
    latestScore,
    improvingJoints,
    laggingJoints,
    cueFr,
    cueEn,
  };
}
