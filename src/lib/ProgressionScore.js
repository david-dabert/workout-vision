/**
 * ProgressionScore — Movement Quality Assessment
 *
 * Scores a set based on measurable biomechanical properties, not gamification.
 * Every component maps directly to something the camera can observe and that
 * exercise science literature considers meaningful.
 *
 * WHAT WE CAN MEASURE from a single phone camera:
 *   1. Joint angles (degrees) — directly from MediaPipe landmarks
 *   2. Angular velocity (deg/s) — 1st derivative of joint angles
 *   3. Phase timing (seconds) — eccentric vs concentric duration
 *   4. Bilateral symmetry — left/right angle comparison
 *   5. Range of motion consistency — coefficient of variation across reps
 *
 * WHAT WE CANNOT MEASURE (and therefore do not score):
 *   - Linear barbell velocity (m/s) — requires depth camera or encoder
 *   - Force/power output (watts) — requires force plate or encoder
 *   - Muscle activation (EMG) — requires surface electrodes
 *   - Intra-abdominal pressure — not externally observable
 *
 * The form score (0-100) is the PRIMARY metric. It measures how closely
 * each rep matches the biomechanical criteria defined per exercise.
 * This is the number users should care about.
 *
 * The composite score (0-100) adds tempo and consistency data ON TOP of
 * the form score, but only when the camera captures enough data to
 * compute those reliably (≥3 reps with velocity data).
 *
 * References:
 *   - Schoenfeld BJ, 2010, J Strength Cond Res: tempo 2-4s eccentric
 *   - Wilk M et al, 2020, Biology of Sport: eccentric:concentric 2:1 to 3:1
 *   - Baker D, 2001, J Strength Cond Res: >20% velocity loss = fatigue
 *   - Kiesel K et al, 2007, N Am J Sports Phys Ther: >15% bilateral asymmetry = injury risk
 */

// ---------------------------------------------------------------------------
// Grade thresholds — tied to form quality, not arbitrary points
//
// These map to coaching language, not gamification:
//   90-100: Textbook form — no corrections needed
//   75-89:  Good form — minor corrections on some reps
//   60-74:  Acceptable — significant corrections needed
//   40-59:  Poor — multiple form breaks per rep
//   0-39:   Unsafe — stop and fix before continuing
// ---------------------------------------------------------------------------

const GRADES = [
  { min: 90, label: 'A',  title: 'grade_excellent' },
  { min: 75, label: 'B',  title: 'grade_good' },
  { min: 60, label: 'C',  title: 'grade_acceptable' },
  { min: 40, label: 'D',  title: 'grade_poor' },
  { min: 0,  label: 'F',  title: 'grade_unsafe' },
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
   * Compute the set quality score.
   *
   * Returns a 0-100 composite score where:
   *   - Form quality is the dominant factor (60%)
   *   - Rep-to-rep consistency matters (20%)
   *   - Tempo control matters (20%)
   *
   * Volume and improvement are tracked but NOT mixed into the score.
   * They are separate dimensions reported alongside, not inflating the number.
   *
   * @param {Object} params
   * @param {number[]} params.formScores - per-rep form scores (0-100)
   * @param {Object[]} params.repVelocities - per-rep velocity data from VelocityEngine
   * @param {number} params.reps - total reps
   * @param {number} params.weightKg - external load
   * @param {Object} [params.previousBest] - previous best for improvement tracking
   * @returns {ProgressionResult}
   */
  static computeSet(params) {
    const { formScores = [], repVelocities = [], reps = 0, weightKg = 0, previousBest = null } = params;

    if (reps === 0) {
      return { score: 0, grade: getGrade(0), components: {}, breakdown: '' };
    }

    // ── Component 1: Form Quality (60% of score) ──
    // Direct average of per-rep form scores from the form check system.
    // Each rep's form score is already computed from exercise-specific
    // biomechanical checks (elbow angle, trunk lean, depth, etc.)
    const validFormScores = formScores.filter(s => s != null);
    const avgForm = validFormScores.length > 0
      ? validFormScores.reduce((a, b) => a + b, 0) / validFormScores.length
      : 75; // No form checks defined = no issues detected; benefit of the doubt (B)

    // ── Component 2: Rep-to-Rep Consistency (20% of score) ──
    // Coefficient of variation of form scores.
    // Low CV = every rep looks the same = good motor control.
    // Reference: Preatoni E et al, 2013, J Biomech — movement variability
    // as an indicator of motor skill acquisition.
    // Thresholds: CV < 5% = highly learned, 5-10% = expert, 10-20% = intermediate, >20% = novice.
    let consistencyScore = 60; // default when <3 reps — insufficient data, not zero
    if (validFormScores.length >= 3) {
      const mean = validFormScores.reduce((a, b) => a + b, 0) / validFormScores.length;
      const variance = validFormScores.reduce((a, v) => a + (v - mean) ** 2, 0) / validFormScores.length;
      const std = Math.sqrt(variance);
      // cv = std/mean. When std=0 (all identical), movement is perfectly consistent → cv=0.
      // When mean=0 but std=0 (all scores are 0), still cv=0 — not chaotic, just uniformly bad.
      // Only use the fallback cv=1 when std>0 but mean=0 (genuinely undefined/indeterminate).
      const cv = std === 0 ? 0 : (mean > 0 ? std / mean : 1);
      // Piecewise mapping calibrated to Preatoni 2013 thresholds:
      //   CV ≤ 0.05 (5%): highly automated movement → 100
      //   CV 0.05-0.10 (expert): 90-100
      //   CV 0.10-0.20 (intermediate): 60-90 — NOT mediocre, still competent
      //   CV 0.20-0.40 (novice/poor): 10-60
      //   CV > 0.40 (chaotic): 0-10
      let cs;
      if (cv <= 0.05) {
        cs = 100;
      } else if (cv <= 0.10) {
        cs = 100 - ((cv - 0.05) / 0.05) * 10;   // 100 → 90
      } else if (cv <= 0.20) {
        cs = 90 - ((cv - 0.10) / 0.10) * 30;    // 90 → 60
      } else if (cv <= 0.40) {
        cs = 60 - ((cv - 0.20) / 0.20) * 50;    // 60 → 10
      } else {
        cs = Math.max(0, 10 - ((cv - 0.40) / 0.10) * 5); // 10 → 0
      }
      consistencyScore = cs;
    }

    // ── Component 3: Tempo Control (20% of score) ──
    // Eccentric:concentric ratio. Controlled eccentric = safer, more effective.
    // Reference: Wilk M et al, 2020, Biology of Sport
    //   - 2:1 to 3:1 ecc:con ratio for hypertrophy
    //   - Schoenfeld 2010: 2-4 second eccentric for muscle growth
    //   - Faster than 1:1 = uncontrolled/bouncing = injury risk
    let tempoScore = 50; // default when no velocity data
    if (repVelocities && repVelocities.length >= 2) {
      const validVels = repVelocities.filter(v => v !== null && v.tempoRatio > 0);
      if (validVels.length >= 2) {
        const ratios = validVels.map(v => v.tempoRatio);
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

        // Scoring based on Wilk 2020:
        //   2.0-3.0: Ideal range → 100
        //   1.5-2.0: Slightly fast eccentric → 75-100
        //   3.0-4.0: Slow but acceptable → 75-100
        //   1.0-1.5: Too fast, losing control → 40-75
        //   <1.0: Bouncing/momentum → 0-40
        //   >4.0: Excessively slow → 50-75
        let ratioQuality;
        if (avgRatio >= 2.0 && avgRatio <= 3.0) {
          ratioQuality = 100;
        } else if (avgRatio >= 1.5 && avgRatio < 2.0) {
          ratioQuality = 75 + (avgRatio - 1.5) * 50; // 75→100
        } else if (avgRatio > 3.0 && avgRatio <= 4.0) {
          ratioQuality = 100 - (avgRatio - 3.0) * 25; // 100→75
        } else if (avgRatio >= 1.0 && avgRatio < 1.5) {
          ratioQuality = 40 + (avgRatio - 1.0) * 70; // 40→75
        } else if (avgRatio < 1.0) {
          ratioQuality = Math.max(0, avgRatio * 40); // 0→40
        } else {
          ratioQuality = Math.max(50, 75 - (avgRatio - 4.0) * 12.5); // 75→50
        }

        // Tempo consistency: low variance in ratios = controlled movement
        const tempoVariance = ratios.reduce((a, r) => a + (r - avgRatio) ** 2, 0) / ratios.length;
        const tempoCV = avgRatio > 0 ? Math.sqrt(tempoVariance) / avgRatio : 1;
        const tempoConsistency = Math.max(0, Math.min(100, 100 * (1 - tempoCV / 0.5)));

        // 70% ratio quality, 30% ratio consistency
        tempoScore = ratioQuality * 0.7 + tempoConsistency * 0.3;
      }
    }

    // ── Composite Score (0-100) ──
    // Weighted: 60% form, 20% consistency, 20% tempo
    const compositeScore = Math.round(
      avgForm * 0.60 +
      consistencyScore * 0.20 +
      tempoScore * 0.20
    );

    const grade = getGrade(compositeScore);

    // ── Volume (reported separately, not in the score) ──
    // Volume = reps × weight. This is a LOAD metric, not a quality metric.
    // Mixing load into a quality score conflates "how much" with "how well".
    const volume = reps * Math.max(0, weightKg);

    // ── Improvement (reported separately) ──
    let improvement = null;
    if (previousBest && previousBest.score > 0) {
      improvement = compositeScore - previousBest.score;
    }

    return {
      score: compositeScore,
      grade,
      components: {
        form: Math.round(avgForm),
        consistency: Math.round(consistencyScore),
        tempo: Math.round(tempoScore),
        volume: Math.round(volume),
        improvement,
      },
      breakdown: `${compositeScore}/100 (${grade.label})`,
    };
  }
}
