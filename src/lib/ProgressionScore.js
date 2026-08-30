/**
 * ProgressionScore — The Number Users Tell Friends
 *
 * Proprietary 0-1000 score integrating form quality, consistency,
 * tempo control, power/velocity, volume, fatigue resistance,
 * and improvement over previous sessions.
 *
 * Convergence item #5: Proprietary progression metric.
 *
 * Grades: F(0-199) D(200-349) C(350-499) B(500-649) B+(650-749) A(750-849) A+(850-929) S(930-1000)
 */

// ---------------------------------------------------------------------------
// Grade thresholds
// ---------------------------------------------------------------------------

const GRADES = [
  { min: 930, label: 'S',  title: 'Legendary' },
  { min: 850, label: 'A+', title: 'Elite' },
  { min: 750, label: 'A',  title: 'Advanced' },
  { min: 650, label: 'B+', title: 'Strong' },
  { min: 500, label: 'B',  title: 'Solid' },
  { min: 350, label: 'C',  title: 'Developing' },
  { min: 200, label: 'D',  title: 'Beginner' },
  { min: 0,   label: 'F',  title: 'Starting' },
];

function getGrade(score) {
  for (const g of GRADES) {
    if (score >= g.min) return g;
  }
  return GRADES[GRADES.length - 1];
}

// ---------------------------------------------------------------------------
// Percentile estimation (simple logistic curve approximation)
// Assumes population median around 450, stddev ~150
// ---------------------------------------------------------------------------

function estimatePercentile(score) {
  // Logistic function centered at 450
  const k = 0.008; // steepness
  const percentile = 100 / (1 + Math.exp(-k * (score - 450)));
  return Math.round(Math.min(99, Math.max(1, percentile)));
}

// ---------------------------------------------------------------------------
// ProgressionScore
// ---------------------------------------------------------------------------

export class ProgressionScore {
  /**
   * Compute the progression score for a single set.
   *
   * @param {Object} params
   * @param {number[]} params.formScores - per-rep form scores (0-100)
   * @param {Object[]} params.repVelocities - per-rep velocity data from VelocityEngine
   * @param {number} params.reps - total reps
   * @param {number} params.weightKg - external load
   * @param {Object} [params.previousBest] - previous best score for this exercise
   * @returns {ProgressionResult}
   */
  static computeSet(params) {
    const { formScores = [], repVelocities = [], reps = 0, weightKg = 0, previousBest = null } = params;

    if (reps === 0) {
      return { score: 0, grade: getGrade(0), percentile: 1, components: {}, breakdown: '' };
    }

    // ── Component 1: Form Quality (max 250) ──
    // Average form score with diminishing returns above 90
    const avgForm = formScores.length > 0
      ? formScores.reduce((a, b) => a + b, 0) / formScores.length
      : 70; // Default if no form checks

    let formComponent;
    if (avgForm >= 90) {
      formComponent = 225 + (avgForm - 90) * 2.5; // 225-250 for 90-100
    } else if (avgForm >= 70) {
      formComponent = 150 + (avgForm - 70) * 3.75; // 150-225 for 70-90
    } else {
      formComponent = avgForm * (150 / 70); // 0-150 for 0-70
    }
    formComponent = Math.min(250, Math.max(0, formComponent));

    // ── Component 2: Consistency (max 200) ──
    // Low variance in form scores = high consistency
    let consistencyComponent = 200;
    if (formScores.length >= 3) {
      const mean = formScores.reduce((a, b) => a + b, 0) / formScores.length;
      const variance = formScores.reduce((a, v) => a + (v - mean) * (v - mean), 0) / formScores.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // Coefficient of variation
      // CV of 0 = perfect consistency (200), CV of 0.3+ = poor (0)
      consistencyComponent = Math.max(0, 200 * (1 - cv / 0.3));
    }

    // ── Component 3: Tempo Control (max 150) ──
    // Ideal tempo ratios: eccentric:concentric around 2:1 to 3:1
    let tempoComponent = 75; // Default if no velocity data
    if (repVelocities && repVelocities.length >= 2) {
      const validVels = repVelocities.filter(v => v !== null);
      if (validVels.length >= 2) {
        const ratios = validVels.map(v => v.tempoRatio);
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

        // Ideal range: 1.5 to 3.0
        let ratioScore;
        if (avgRatio >= 1.5 && avgRatio <= 3.0) {
          ratioScore = 1.0; // Perfect
        } else if (avgRatio >= 1.0 && avgRatio < 1.5) {
          ratioScore = 0.6 + (avgRatio - 1.0) * 0.8; // 0.6-1.0
        } else if (avgRatio > 3.0 && avgRatio <= 4.0) {
          ratioScore = 1.0 - (avgRatio - 3.0) * 0.3; // 1.0-0.7
        } else {
          ratioScore = 0.3;
        }

        // Consistency of tempo
        const tempoVariance = ratios.reduce((a, r) => a + (r - avgRatio) * (r - avgRatio), 0) / ratios.length;
        const tempoConsistency = 1 / (1 + tempoVariance);

        tempoComponent = 150 * ratioScore * 0.6 + 150 * tempoConsistency * 0.4;
      }
    }

    // ── Component 4: Power/Velocity (max 150) ──
    // Faster concentric with control
    let powerComponent = 75; // Default
    if (repVelocities && repVelocities.length >= 2) {
      const validVels = repVelocities.filter(v => v !== null);
      if (validVels.length >= 2) {
        const meanVels = validVels.map(v => v.meanVelocity);
        const avgVel = meanVels.reduce((a, b) => a + b, 0) / meanVels.length;

        // Normalize velocity (0.1 = slow, 0.5+ = fast/explosive)
        // Score based on controlled speed, not just raw speed
        const velScore = Math.min(1, avgVel / 0.4);
        powerComponent = 150 * velScore;
      }
    }

    // ── Component 5: Volume (max 100) ──
    // Reps x weight, log-scaled
    const volumeLoad = reps * Math.max(1, weightKg);
    const volumeComponent = Math.min(100, 100 * Math.log10(1 + volumeLoad) / Math.log10(1000));

    // ── Component 6: Fatigue Resistance (max 100) ──
    // Low velocity decay across set
    let fatigueComponent = 50; // Default
    if (repVelocities && repVelocities.length >= 4) {
      const validVels = repVelocities.filter(v => v !== null);
      if (validVels.length >= 4) {
        const vels = validVels.map(v => v.meanVelocity);
        const firstTwo = (vels[0] + vels[1]) / 2;
        const lastTwo = (vels[vels.length - 2] + vels[vels.length - 1]) / 2;
        const decay = firstTwo > 0 ? 1 - (lastTwo / firstTwo) : 0;

        // Decay 0% = perfect (100), decay 20%+ = poor (0)
        fatigueComponent = Math.max(0, 100 * (1 - decay / 0.25));
      }
    }

    // ── Component 7: Improvement Bonus (max 50) ──
    // Beat your previous best
    let improvementComponent = 0;
    const rawScore = formComponent + consistencyComponent + tempoComponent +
                     powerComponent + volumeComponent + fatigueComponent;

    if (previousBest && previousBest.score > 0) {
      const improvement = rawScore - previousBest.score;
      if (improvement > 0) {
        improvementComponent = Math.min(50, improvement * 0.5);
      }
    }

    // ── Final Score ──
    const totalScore = Math.round(Math.min(1000,
      formComponent + consistencyComponent + tempoComponent +
      powerComponent + volumeComponent + fatigueComponent + improvementComponent
    ));

    const grade = getGrade(totalScore);
    const percentile = estimatePercentile(totalScore);

    return {
      score: totalScore,
      grade,
      percentile,
      components: {
        form: Math.round(formComponent),
        consistency: Math.round(consistencyComponent),
        tempo: Math.round(tempoComponent),
        power: Math.round(powerComponent),
        volume: Math.round(volumeComponent),
        fatigue: Math.round(fatigueComponent),
        improvement: Math.round(improvementComponent),
      },
      breakdown: `${totalScore} (${grade.label}, ${grade.title}) — Top ${100 - percentile}%`,
    };
  }

  /**
   * Compute aggregate session score from multiple sets.
   */
  static computeSession(setScores) {
    if (setScores.length === 0) return { score: 0, grade: getGrade(0), percentile: 1 };

    // Weighted average: later sets count slightly less (fatigue adjustment)
    let weightedSum = 0, weightSum = 0;
    setScores.forEach((s, i) => {
      const w = 1 - (i * 0.05); // Each subsequent set worth 5% less
      weightedSum += s.score * w;
      weightSum += w;
    });

    const score = Math.round(weightedSum / weightSum);
    return {
      score,
      grade: getGrade(score),
      percentile: estimatePercentile(score),
      setCount: setScores.length,
      bestSet: Math.max(...setScores.map(s => s.score)),
      breakdown: `Session: ${score} (${getGrade(score).label}) from ${setScores.length} sets`,
    };
  }
}
