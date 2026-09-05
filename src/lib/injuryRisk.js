/**
 * Injury Risk Prediction — Longitudinal Data Analysis
 *
 * Analyzes workout history to detect patterns that correlate with injury risk:
 * - Form degradation trends across sessions
 * - Asymmetry progression (left/right imbalance growing)
 * - Volume spikes (acute:chronic workload ratio)
 * - ROM regression (decreasing range of motion over time)
 * - Fatigue accumulation (velocity decay patterns)
 *
 * Based on:
 *   - Gabbett TJ, 2016, Br J Sports Med (acute:chronic workload ratio)
 *   - Kiesel K, 2007 (asymmetry threshold >15%)
 *   - Schoenfeld BJ, 2017 (volume dose-response)
 */

import { getAllWorkouts } from './storage';
import { getAllBaselines } from './formBaselines';

/**
 * Risk levels returned by the predictor.
 */
const RISK = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
};

/**
 * Run a full injury risk assessment from stored workout history.
 *
 * @returns {Object} risk report with flags and recommendations
 */
export async function assessInjuryRisk() {
  const workouts = await getAllWorkouts();
  const baselines = await getAllBaselines();

  if (!workouts || workouts.length < 5) {
    return {
      overall: RISK.LOW,
      flags: [],
      recommendations: [],
      dataPoints: workouts?.length || 0,
      message: 'not_enough_data',
    };
  }

  const flags = [];

  // 1. Acute:Chronic Workload Ratio (ACWR)
  const acwr = computeACWR(workouts);
  if (acwr) {
    if (acwr.ratio > 1.5) {
      flags.push({
        type: 'workload_spike',
        risk: RISK.HIGH,
        value: acwr.ratio,
        detail: { acuteLoad: acwr.acute, chronicLoad: acwr.chronic },
        en: `Training load spiked to ${acwr.ratio.toFixed(1)}x your average. High injury risk zone (>1.5). Consider reducing volume this week.`,
        fr: `Charge d'entraînement en pic : ${acwr.ratio.toFixed(1)}x votre moyenne. Zone de risque élevé (>1.5). Réduisez le volume cette semaine.`,
      });
    } else if (acwr.ratio > 1.3) {
      flags.push({
        type: 'workload_elevated',
        risk: RISK.MODERATE,
        value: acwr.ratio,
        detail: { acuteLoad: acwr.acute, chronicLoad: acwr.chronic },
        en: `Training load at ${acwr.ratio.toFixed(1)}x average. Monitor fatigue closely.`,
        fr: `Charge d'entraînement à ${acwr.ratio.toFixed(1)}x la moyenne. Surveillez la fatigue.`,
      });
    } else if (acwr.ratio < 0.8 && acwr.chronic > 0) {
      flags.push({
        type: 'detraining',
        risk: RISK.LOW,
        value: acwr.ratio,
        en: `Training volume dropped to ${acwr.ratio.toFixed(1)}x average. Risk of detraining if sustained.`,
        fr: `Volume en baisse : ${acwr.ratio.toFixed(1)}x la moyenne. Risque de désentraînement si prolongé.`,
      });
    }
  }

  // 2. Form degradation trend
  const formTrend = analyzeFormTrend(workouts);
  for (const ft of formTrend) {
    if (ft.slope < -2) {
      flags.push({
        type: 'form_declining',
        risk: ft.slope < -4 ? RISK.HIGH : RISK.MODERATE,
        exercise: ft.exercise,
        value: ft.slope,
        en: `${ft.exerciseName}: form score declining (${ft.slope.toFixed(1)} points/session over last ${ft.sessions} sessions). Possible fatigue or technique drift.`,
        fr: `${ft.exerciseName}: score de forme en baisse (${ft.slope.toFixed(1)} pts/séance sur ${ft.sessions} séances). Fatigue ou dérive technique possible.`,
      });
    }
  }

  // 3. Asymmetry progression from baselines
  const asymmetryFlags = analyzeAsymmetry(baselines);
  flags.push(...asymmetryFlags);

  // 4. ROM regression
  const romFlags = analyzeROMRegression(workouts);
  flags.push(...romFlags);

  // 5. Overtraining single muscle group
  const muscleFlags = analyzeMuscleOverload(workouts);
  flags.push(...muscleFlags);

  // Determine overall risk
  const hasHigh = flags.some(f => f.risk === RISK.HIGH);
  const hasModerate = flags.some(f => f.risk === RISK.MODERATE);
  const overall = hasHigh ? RISK.HIGH : hasModerate ? RISK.MODERATE : RISK.LOW;

  // Generate recommendations
  const recommendations = generateRecommendations(flags);

  return {
    overall,
    flags,
    recommendations,
    dataPoints: workouts.length,
    acwr: acwr?.ratio || null,
  };
}

/**
 * Compute Acute:Chronic Workload Ratio.
 * Acute = last 7 days load. Chronic = rolling 28-day average weekly load.
 */
function computeACWR(workouts) {
  const now = Date.now();
  const DAY = 86400000;

  const getLoad = (w) => (w.reps || 1) * (w.weight || 1) * (w.duration ? Math.min(w.duration / 60, 10) : 1);

  let acuteLoad = 0;
  const weeklyLoads = [0, 0, 0, 0]; // 4 weeks

  for (const w of workouts) {
    const ts = w.createdAt || new Date(w.date).getTime();
    const daysAgo = (now - ts) / DAY;
    const load = getLoad(w);

    if (daysAgo <= 7) acuteLoad += load;
    if (daysAgo <= 7) weeklyLoads[0] += load;
    else if (daysAgo <= 14) weeklyLoads[1] += load;
    else if (daysAgo <= 21) weeklyLoads[2] += load;
    else if (daysAgo <= 28) weeklyLoads[3] += load;
  }

  const chronicLoad = weeklyLoads.reduce((a, b) => a + b, 0) / 4;
  if (chronicLoad === 0) return null;

  return {
    ratio: Math.round((acuteLoad / chronicLoad) * 100) / 100,
    acute: Math.round(acuteLoad),
    chronic: Math.round(chronicLoad),
  };
}

/**
 * Analyze form score trends per exercise.
 */
function analyzeFormTrend(workouts) {
  const byExercise = {};
  for (const w of workouts) {
    if (w.formScore == null) continue;
    if (!byExercise[w.exercise]) byExercise[w.exercise] = [];
    byExercise[w.exercise].push({
      score: w.formScore,
      ts: w.createdAt || new Date(w.date).getTime(),
      name: w.exerciseName || w.exercise,
    });
  }

  const trends = [];
  for (const [exercise, sessions] of Object.entries(byExercise)) {
    if (sessions.length < 4) continue;
    // Sort chronologically
    sessions.sort((a, b) => a.ts - b.ts);
    // Take last 8 sessions max
    const recent = sessions.slice(-8);
    const slope = linearRegressionSlope(recent.map(s => s.score));
    trends.push({
      exercise,
      exerciseName: recent[0].name,
      slope,
      sessions: recent.length,
    });
  }

  return trends;
}

/**
 * Check for growing asymmetry in baselines.
 */
function analyzeAsymmetry(baselines) {
  const flags = [];
  for (const [exercise, bl] of Object.entries(baselines)) {
    if (!bl.checks) continue;
    for (const [checkName, ck] of Object.entries(bl.checks)) {
      if (!/symmetry|asymmetry|balance|lateral/i.test(checkName)) continue;
      if (ck.trend < -0.02 && ck.samples >= 10) {
        flags.push({
          type: 'asymmetry_growing',
          risk: ck.mean < 0.7 ? RISK.HIGH : RISK.MODERATE,
          exercise,
          check: checkName,
          value: ck.mean,
          en: `${exercise}: ${checkName} asymmetry worsening (trend ${(ck.trend * 100).toFixed(1)}%/session). Consider unilateral work.`,
          fr: `${exercise}: asymétrie ${checkName} en hausse. Envisagez du travail unilatéral.`,
        });
      }
    }
  }
  return flags;
}

/**
 * Detect ROM regression across sessions.
 */
function analyzeROMRegression(workouts) {
  const flags = [];
  const byExercise = {};

  for (const w of workouts) {
    if (!w.bioAnalysis?.rangeOfMotion?.average) continue;
    if (!byExercise[w.exercise]) byExercise[w.exercise] = [];
    byExercise[w.exercise].push({
      rom: w.bioAnalysis.rangeOfMotion.average,
      ts: w.createdAt || new Date(w.date).getTime(),
      name: w.exerciseName || w.exercise,
    });
  }

  for (const [exercise, sessions] of Object.entries(byExercise)) {
    if (sessions.length < 5) continue;
    sessions.sort((a, b) => a.ts - b.ts);
    const recent = sessions.slice(-8);
    const slope = linearRegressionSlope(recent.map(s => s.rom));

    if (slope < -2) {
      flags.push({
        type: 'rom_declining',
        risk: slope < -4 ? RISK.HIGH : RISK.MODERATE,
        exercise,
        value: slope,
        en: `${recent[0].name}: range of motion declining (${slope.toFixed(1)}°/session). Possible mobility loss or compensatory pattern.`,
        fr: `${recent[0].name}: amplitude en baisse (${slope.toFixed(1)}°/séance). Perte de mobilité possible.`,
      });
    }
  }
  return flags;
}

/**
 * Detect overtraining of a single muscle group.
 * Flags when weekly sets for a muscle exceed evidence-based MRV (Maximum Recoverable Volume).
 */
function analyzeMuscleOverload(workouts) {
  const flags = [];
  const now = Date.now();
  const WEEK = 7 * 86400000;

  // Count sets per muscle in the last 7 days
  const muscleSets = {};

  // Lazy import exercise data
  for (const w of workouts) {
    const ts = w.createdAt || new Date(w.date).getTime();
    if (now - ts > WEEK) continue;

    // Muscles come from the workout record if available
    if (w.muscles?.primary) {
      for (const m of w.muscles.primary) {
        muscleSets[m] = (muscleSets[m] || 0) + 1;
      }
    }
  }

  // MRV thresholds (Israetel et al., Renaissance Periodization)
  const MRV = {
    chest: 22, back: 25, shoulders: 22, quads: 20, hamstrings: 18,
    biceps: 20, triceps: 18, glutes: 20, calves: 16, abs: 25,
  };

  for (const [muscle, sets] of Object.entries(muscleSets)) {
    const limit = MRV[muscle] || 20;
    if (sets > limit) {
      flags.push({
        type: 'muscle_overload',
        risk: sets > limit * 1.3 ? RISK.HIGH : RISK.MODERATE,
        muscle,
        value: sets,
        limit,
        en: `${muscle}: ${sets} sets this week exceeds maximum recoverable volume (${limit}). Recovery may be compromised.`,
        fr: `${muscle}: ${sets} séries cette semaine dépasse le volume récupérable max (${limit}). Récupération compromise.`,
      });
    }
  }
  return flags;
}

/**
 * Generate recommendations from flags.
 */
function generateRecommendations(flags) {
  const recs = [];
  const types = new Set(flags.map(f => f.type));

  if (types.has('workload_spike')) {
    recs.push({
      en: 'Reduce training volume by 20-30% this week. Focus on technique at lower intensities.',
      fr: 'Réduisez le volume de 20-30% cette semaine. Concentrez-vous sur la technique à basse intensité.',
    });
  }
  if (types.has('form_declining')) {
    recs.push({
      en: 'Form is declining on some exercises. Consider a deload week or reducing weight to reinforce technique.',
      fr: 'La forme baisse sur certains exercices. Envisagez une semaine de décharge ou réduisez les charges.',
    });
  }
  if (types.has('asymmetry_growing')) {
    recs.push({
      en: 'Growing left-right imbalance detected. Add unilateral exercises (single-leg, single-arm) to your routine.',
      fr: 'Déséquilibre gauche-droite croissant. Ajoutez des exercices unilatéraux à votre routine.',
    });
  }
  if (types.has('rom_declining')) {
    recs.push({
      en: 'Range of motion shrinking. Add 5-10 min of targeted mobility work before training.',
      fr: "Amplitude en baisse. Ajoutez 5-10 min de mobilité ciblée avant l'entraînement.",
    });
  }
  if (types.has('muscle_overload')) {
    recs.push({
      en: 'Some muscle groups are exceeding maximum recoverable volume. Redistribute sets across the week.',
      fr: 'Certains groupes musculaires dépassent le volume récupérable. Redistribuez les séries sur la semaine.',
    });
  }

  return recs;
}

/**
 * Linear regression slope for an array of values.
 */
function linearRegressionSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
}
