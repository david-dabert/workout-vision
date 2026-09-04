/**
 * Personalized Form Baselines — Cross-Session Learning
 *
 * Learns each user's form patterns across sessions. Instead of comparing
 * against generic thresholds, the system builds a personal baseline per
 * exercise and per form check, then scores relative to the user's own
 * historical performance.
 *
 * Storage: IndexedDB via localforage, keyed by exercise slug.
 */

import localforage from 'localforage';

const baselineStore = localforage.createInstance({
  name: 'workoutVision',
  storeName: 'formBaselines',
});

/**
 * Per-exercise baseline shape:
 * {
 *   exercise: 'squat',
 *   sessions: number,
 *   lastUpdated: number (timestamp),
 *   checks: {
 *     'Depth': { mean: 0.82, stddev: 0.08, samples: 45, best: 0.95, trend: 0.02 },
 *     'Knee symmetry': { mean: 0.91, stddev: 0.05, samples: 45, best: 0.98, trend: -0.01 },
 *     ...
 *   },
 *   overallForm: { mean: 78, stddev: 8, best: 95, sessions: 12 },
 * }
 */

/**
 * Update baselines after a workout is analyzed.
 * Called from the analysis pipeline after results are computed.
 *
 * @param {string} exercise - exercise slug (e.g., 'squat')
 * @param {Array} repHistory - array of per-rep results with feedback[].quality
 * @param {number} formScore - overall form score for the set (0-100)
 */
export async function updateBaseline(exercise, repHistory, formScore) {
  if (!exercise || !repHistory || repHistory.length === 0) return;

  let baseline = await baselineStore.getItem(exercise);
  if (!baseline) {
    baseline = {
      exercise,
      sessions: 0,
      lastUpdated: Date.now(),
      checks: {},
      overallForm: { mean: 0, sumSq: 0, best: 0, sessions: 0 },
    };
  }

  baseline.sessions++;
  baseline.lastUpdated = Date.now();

  // Update overall form score running stats
  const of = baseline.overallForm;
  of.sessions++;
  const oldMean = of.mean;
  of.mean += (formScore - of.mean) / of.sessions;
  of.sumSq += (formScore - oldMean) * (formScore - of.mean);
  of.best = Math.max(of.best, formScore);
  of.stddev = of.sessions > 1 ? Math.sqrt(of.sumSq / (of.sessions - 1)) : 0;

  // Update per-check quality baselines
  for (const rep of repHistory) {
    if (!rep.feedback) continue;
    for (const fc of rep.feedback) {
      if (fc.skipped) continue;
      const q = fc.quality != null ? fc.quality : (fc.passed ? 1 : 0);
      if (!baseline.checks[fc.name]) {
        baseline.checks[fc.name] = { mean: 0, sumSq: 0, samples: 0, best: 0, trend: 0, recentValues: [] };
      }
      const ck = baseline.checks[fc.name];
      ck.samples++;
      const ckOldMean = ck.mean;
      ck.mean += (q - ck.mean) / ck.samples;
      ck.sumSq += (q - ckOldMean) * (q - ck.mean);
      ck.best = Math.max(ck.best, q);
      ck.stddev = ck.samples > 1 ? Math.sqrt(ck.sumSq / (ck.samples - 1)) : 0;

      // Track recent values for trend (keep last 20)
      ck.recentValues.push(q);
      if (ck.recentValues.length > 20) ck.recentValues.shift();

      // Compute trend: slope of linear regression on recent values
      if (ck.recentValues.length >= 5) {
        ck.trend = computeTrend(ck.recentValues);
      }
    }
  }

  await baselineStore.setItem(exercise, baseline);
  return baseline;
}

/**
 * Get the stored baseline for an exercise.
 * @param {string} exercise - exercise slug
 * @returns {Object|null} baseline or null if none exists
 */
export async function getBaseline(exercise) {
  return await baselineStore.getItem(exercise);
}

/**
 * Get all baselines.
 * @returns {Object} map of exercise → baseline
 */
export async function getAllBaselines() {
  const baselines = {};
  await baselineStore.iterate((value, key) => {
    baselines[key] = value;
  });
  return baselines;
}

/**
 * Score a current workout relative to the user's personal baseline.
 * Returns a comparison object showing where this session falls.
 *
 * @param {string} exercise - exercise slug
 * @param {number} currentFormScore - this session's form score
 * @param {Array} repHistory - this session's per-rep results
 * @returns {Object|null} comparison or null if no baseline exists
 */
export async function compareToBaseline(exercise, currentFormScore, repHistory) {
  const baseline = await getBaseline(exercise);
  if (!baseline || baseline.sessions < 3) return null;

  const comparison = {
    sessionsTracked: baseline.sessions,
    overallForm: {
      current: currentFormScore,
      personalMean: Math.round(baseline.overallForm.mean),
      personalBest: Math.round(baseline.overallForm.best),
      deviation: Math.round(currentFormScore - baseline.overallForm.mean),
      isPersonalBest: currentFormScore > baseline.overallForm.best,
    },
    checkComparisons: [],
    improvingChecks: [],
    decliningChecks: [],
  };

  for (const rep of (repHistory || [])) {
    if (!rep.feedback) continue;
    for (const fc of rep.feedback) {
      if (fc.skipped || !baseline.checks[fc.name]) continue;
      const ck = baseline.checks[fc.name];
      const q = fc.quality != null ? fc.quality : (fc.passed ? 1 : 0);
      const existing = comparison.checkComparisons.find(c => c.name === fc.name);
      if (!existing) {
        comparison.checkComparisons.push({
          name: fc.name,
          currentQuality: q,
          personalMean: Math.round(ck.mean * 100) / 100,
          personalBest: Math.round(ck.best * 100) / 100,
          trend: Math.round(ck.trend * 1000) / 1000,
        });
      }
    }
  }

  for (const cc of comparison.checkComparisons) {
    if (cc.trend > 0.01) comparison.improvingChecks.push(cc.name);
    if (cc.trend < -0.01) comparison.decliningChecks.push(cc.name);
  }

  return comparison;
}

/**
 * Compute linear regression slope on an array of values.
 */
function computeTrend(values) {
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
