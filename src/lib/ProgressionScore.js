/**
 * ProgressionScore — The Number Users Tell Friends
 *
 * 0-100 score integrating form quality, consistency,
 * tempo control (eccentric/concentric ratio from frame timing),
 * volume, and improvement over previous sessions.
 *
 * All exported values (score + every component) are ∈ [0, 100].
 *
 * Internal weights: form 33%, consistency 27%, tempo 20%,
 * volume 13%, improvement 7% — but the surface is always 0-100.
 *
 * No pixel-velocity or fabricated physics. Only joint angles,
 * frame timing, and user-entered weight.
 *
 * Grades: F(0-19) D(20-34) C(35-49) B(50-64) B+(65-74) A(75-84) A+(85-92) S(93-100)
 */

// ---------------------------------------------------------------------------
// Internal component maxima (used to normalize to 0-100)
// ---------------------------------------------------------------------------

const COMPONENT_MAX = {
  form: 250,
  consistency: 200,
  tempo: 150,
  volume: 100,
  improvement: 50,
};
const TOTAL_MAX = Object.values(COMPONENT_MAX).reduce((a, b) => a + b, 0); // 750

// ---------------------------------------------------------------------------
// Grade thresholds (on normalized 0-100 scale)
// ---------------------------------------------------------------------------

const GRADES = [
  { min: 93, label: 'S',  title: 'grade_legendary' },
  { min: 85, label: 'A+', title: 'grade_elite_title' },
  { min: 75, label: 'A',  title: 'grade_advanced' },
  { min: 65, label: 'B+', title: 'grade_strong_title' },
  { min: 50, label: 'B',  title: 'grade_solid' },
  { min: 35, label: 'C',  title: 'grade_developing' },
  { min: 20, label: 'D',  title: 'grade_beginner' },
  { min: 0,  label: 'F',  title: 'grade_starting' },
];

function getGrade(score) {
  for (const g of GRADES) {
    if (score >= g.min) return g;
  }
  return GRADES[GRADES.length - 1];
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
    const validFormScores = formScores.filter(s => s != null && Number.isFinite(s));
    const avgForm = validFormScores.length > 0
      ? validFormScores.reduce((a, b) => a + b, 0) / validFormScores.length
      : null; // No form data = no form component

    let formComponent;
    if (avgForm == null) {
      formComponent = 0; // No form data = no form points
    } else if (avgForm >= 90) {
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

    // ── Component 4: Volume (max 100) ──
    // Reps x weight, log-scaled
    const volumeLoad = reps * Math.max(1, weightKg);
    const volumeComponent = Math.min(100, 100 * Math.log10(1 + volumeLoad) / Math.log10(1000));

    // ── Component 5: Improvement Bonus (max 50) ──
    // Beat your previous best (previousBest.score is 0-100, convert to internal scale)
    let improvementComponent = 0;
    const rawScore = formComponent + consistencyComponent + tempoComponent +
                     volumeComponent;

    if (previousBest && previousBest.score > 0) {
      // Guard: scores > 100 are from the pre-normalization 0-1000 era.
      // Convert them to 0-100 first so the comparison is meaningful.
      const prevNorm = previousBest.score > 100
        ? Math.min(100, previousBest.score / 10)
        : previousBest.score;
      const prevInternal = (prevNorm / 100) * TOTAL_MAX;
      const improvement = rawScore - prevInternal;
      if (improvement > 0) {
        improvementComponent = Math.min(50, improvement * 0.5);
      }
    }

    // ── Normalize to 0-100 ──
    const norm = (val, max) => Math.round(Math.min(100, Math.max(0, (val / max) * 100)));

    const rawTotal = formComponent + consistencyComponent + tempoComponent +
                     volumeComponent + improvementComponent;
    const totalScore = Math.round(Math.min(100, Math.max(0, (rawTotal / TOTAL_MAX) * 100)));

    const grade = getGrade(totalScore);

    return {
      score: totalScore,
      grade,
      percentile: 0, // retained for API compat, not displayed
      components: {
        form: norm(formComponent, COMPONENT_MAX.form),
        consistency: norm(consistencyComponent, COMPONENT_MAX.consistency),
        tempo: norm(tempoComponent, COMPONENT_MAX.tempo),
        volume: norm(volumeComponent, COMPONENT_MAX.volume),
        improvement: norm(improvementComponent, COMPONENT_MAX.improvement),
      },
      breakdown: `${totalScore} (${grade.label}, ${grade.title})`,
    };
  }

}
