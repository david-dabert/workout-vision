/**
 * Sovereign Health Sync — Zero-Server Client-Side Health Data Parser.
 *
 * Replaces expensive SaaS wearable cloud integrations (Apple HealthKit / Google Fit API)
 * by parsing local Apple Health XML exports and Google Takeout data directly in the browser.
 *
 * Zero server uploads. 100% private and sovereign.
 */

export interface HealthWorkout {
  type: string;
  durationMinutes: number;
  caloriesBurnedKcal: number | null;
  startDate: string;
  endDate: string;
}

export interface SleepSummary {
  totalAsleepMinutes: number;
  recordsCount: number;
  deepAsleepMinutes?: number;
  remAsleepMinutes?: number;
}

export interface HeartRateSummary {
  avgBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  samplesCount: number;
  restingBpm?: number | null;
}

export interface HealthSyncSummary {
  source: 'apple_health' | 'google_fit' | 'unknown';
  parsedAt: string;
  totalSteps: number;
  totalActiveCaloriesKcal: number;
  heartRate: HeartRateSummary;
  sleep: SleepSummary;
  workouts: HealthWorkout[];
  earliestRecordDate?: string | null;
  latestRecordDate?: string | null;
}

/**
 * Fast streaming-safe regex scanner for Apple Health export.xml.
 * Avoids DOMParser heap allocation limits on massive (100MB+) mobile exports.
 */
export function parseAppleHealthXml(
  xmlContent: string,
  options?: { maxRecords?: number; startDate?: string; endDate?: string }
): HealthSyncSummary {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return createEmptySummary('apple_health');
  }

  const maxRecords = options?.maxRecords ?? 200_000;
  const startFilter = options?.startDate ? new Date(options.startDate).getTime() : null;
  const endFilter = options?.endDate ? new Date(options.endDate).getTime() : null;

  let totalSteps = 0;
  let totalActiveCalories = 0;
  let restingBpmSum = 0;
  let restingBpmCount = 0;

  const hrValues: number[] = [];
  let totalAsleepMinutes = 0;
  let sleepRecordCount = 0;
  let deepAsleepMinutes = 0;
  let remAsleepMinutes = 0;

  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  const workouts: HealthWorkout[] = [];

  // Match <Record ... /> elements
  const recordRegex = /<Record\s+([^>]+?)\/?>/g;
  let match: RegExpExecArray | null;
  let recordCount = 0;

  while ((match = recordRegex.exec(xmlContent)) !== null && recordCount < maxRecords) {
    recordCount++;
    const attrsStr = match[1];

    const typeMatch = attrsStr.match(/type="([^"]+)"/);
    if (!typeMatch) continue;
    const type = typeMatch[1];

    const valMatch = attrsStr.match(/value="([^"]+)"/);
    const startDateMatch = attrsStr.match(/startDate="([^"]+)"/);
    const endDateMatch = attrsStr.match(/endDate="([^"]+)"/);

    const startDateStr = startDateMatch ? startDateMatch[1] : null;
    const endDateStr = endDateMatch ? endDateMatch[1] : null;

    if (startDateStr) {
      if (!earliestDate || startDateStr < earliestDate) earliestDate = startDateStr;
      if (!latestDate || startDateStr > latestDate) latestDate = startDateStr;

      if (startFilter || endFilter) {
        const recordTime = new Date(startDateStr).getTime();
        if (startFilter && recordTime < startFilter) continue;
        if (endFilter && recordTime > endFilter) continue;
      }
    }

    const valNum = valMatch ? parseFloat(valMatch[1]) : 0;

    if (type === 'HKQuantityTypeIdentifierStepCount') {
      if (!isNaN(valNum)) totalSteps += valNum;
    } else if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      if (!isNaN(valNum)) totalActiveCalories += valNum;
    } else if (type === 'HKQuantityTypeIdentifierHeartRate') {
      if (!isNaN(valNum) && valNum > 30 && valNum < 240) {
        hrValues.push(valNum);
      }
    } else if (type === 'HKQuantityTypeIdentifierRestingHeartRate') {
      if (!isNaN(valNum) && valNum > 30 && valNum < 150) {
        restingBpmSum += valNum;
        restingBpmCount++;
      }
    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const sleepVal = valMatch ? valMatch[1] : '';
      if (startDateStr && endDateStr) {
        const t1 = new Date(startDateStr).getTime();
        const t2 = new Date(endDateStr).getTime();
        const diffMinutes = Math.max(0, (t2 - t1) / (1000 * 60));

        // Sleep states: InBed vs Asleep (Core/Deep/REM)
        const isAsleep =
          sleepVal.includes('Asleep') ||
          sleepVal === '1' ||
          sleepVal === 'HKCategoryValueSleepAnalysisAsleepCore' ||
          sleepVal === 'HKCategoryValueSleepAnalysisAsleepDeep' ||
          sleepVal === 'HKCategoryValueSleepAnalysisAsleepREM';

        if (isAsleep) {
          totalAsleepMinutes += diffMinutes;
          sleepRecordCount++;
          if (sleepVal.includes('Deep')) deepAsleepMinutes += diffMinutes;
          if (sleepVal.includes('REM')) remAsleepMinutes += diffMinutes;
        }
      }
    }
  }

  // Match <Workout ...> elements
  const workoutRegex = /<Workout\s+([^>]+?)(?:\/>|>([\s\S]*?)<\/Workout>)/g;
  let wMatch: RegExpExecArray | null;

  while ((wMatch = workoutRegex.exec(xmlContent)) !== null) {
    const wAttrs = wMatch[1];
    const actTypeMatch = wAttrs.match(/workoutActivityType="([^"]+)"/);
    const durMatch = wAttrs.match(/duration="([^"]+)"/);
    const durUnitMatch = wAttrs.match(/durationUnit="([^"]+)"/);
    const energyMatch = wAttrs.match(/totalEnergyBurned="([^"]+)"/);
    const wStartMatch = wAttrs.match(/startDate="([^"]+)"/);
    const wEndMatch = wAttrs.match(/endDate="([^"]+)"/);

    const actType = actTypeMatch ? actTypeMatch[1].replace('HKWorkoutActivityType', '') : 'Workout';
    let duration = durMatch ? parseFloat(durMatch[1]) : 0;
    const durUnit = durUnitMatch ? durUnitMatch[1] : 'min';
    if (durUnit === 's' || durUnit === 'sec') duration = duration / 60;
    else if (durUnit === 'hr' || durUnit === 'hour') duration = duration * 60;

    const energy = energyMatch ? parseFloat(energyMatch[1]) : null;

    workouts.push({
      type: actType,
      durationMinutes: Math.round(duration * 10) / 10,
      caloriesBurnedKcal: energy !== null && !isNaN(energy) ? Math.round(energy) : null,
      startDate: wStartMatch ? wStartMatch[1] : '',
      endDate: wEndMatch ? wEndMatch[1] : '',
    });
  }

  // Compute HR statistics
  let avgBpm: number | null = null;
  let minBpm: number | null = null;
  let maxBpm: number | null = null;

  if (hrValues.length > 0) {
    const sum = hrValues.reduce((a, b) => a + b, 0);
    avgBpm = Math.round((sum / hrValues.length) * 10) / 10;
    minBpm = Math.round(Math.min(...hrValues));
    maxBpm = Math.round(Math.max(...hrValues));
  }

  return {
    source: 'apple_health',
    parsedAt: new Date().toISOString(),
    totalSteps: Math.round(totalSteps),
    totalActiveCaloriesKcal: Math.round(totalActiveCalories),
    heartRate: {
      avgBpm,
      minBpm,
      maxBpm,
      samplesCount: hrValues.length,
      restingBpm: restingBpmCount > 0 ? Math.round(restingBpmSum / restingBpmCount) : null,
    },
    sleep: {
      totalAsleepMinutes: Math.round(totalAsleepMinutes),
      recordsCount: sleepRecordCount,
      deepAsleepMinutes: Math.round(deepAsleepMinutes),
      remAsleepMinutes: Math.round(remAsleepMinutes),
    },
    workouts,
    earliestRecordDate: earliestDate,
    latestRecordDate: latestDate,
  };
}

/**
 * Parses Google Takeout / Google Fit Daily Summary CSV.
 * Columns typically: Date, Move Minutes count, Calories (kcal), Distance (m), Heart Points, Heart Minutes, Step count, Average heart rate (bpm)
 */
export function parseGoogleFitDailyCsv(csvContent: string): HealthSyncSummary {
  if (!csvContent || typeof csvContent !== 'string') {
    return createEmptySummary('google_fit');
  }

  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return createEmptySummary('google_fit');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const stepIdx = headers.findIndex(h => h.includes('step'));
  const calIdx = headers.findIndex(h => h.includes('calorie'));
  const hrIdx = headers.findIndex(h => h.includes('heart rate') || h.includes('bpm'));

  let totalSteps = 0;
  let totalCalories = 0;
  const hrValues: number[] = [];
  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim());
    if (row.length <= 1) continue;

    if (dateIdx !== -1 && row[dateIdx]) {
      const d = row[dateIdx];
      if (!earliestDate || d < earliestDate) earliestDate = d;
      if (!latestDate || d > latestDate) latestDate = d;
    }

    if (stepIdx !== -1 && row[stepIdx]) {
      const s = parseFloat(row[stepIdx]);
      if (!isNaN(s)) totalSteps += s;
    }

    if (calIdx !== -1 && row[calIdx]) {
      const c = parseFloat(row[calIdx]);
      if (!isNaN(c)) totalCalories += c;
    }

    if (hrIdx !== -1 && row[hrIdx]) {
      const hr = parseFloat(row[hrIdx]);
      if (!isNaN(hr) && hr > 30 && hr < 240) hrValues.push(hr);
    }
  }

  let avgBpm: number | null = null;
  let minBpm: number | null = null;
  let maxBpm: number | null = null;

  if (hrValues.length > 0) {
    const sum = hrValues.reduce((a, b) => a + b, 0);
    avgBpm = Math.round((sum / hrValues.length) * 10) / 10;
    minBpm = Math.round(Math.min(...hrValues));
    maxBpm = Math.round(Math.max(...hrValues));
  }

  return {
    source: 'google_fit',
    parsedAt: new Date().toISOString(),
    totalSteps: Math.round(totalSteps),
    totalActiveCaloriesKcal: Math.round(totalCalories),
    heartRate: {
      avgBpm,
      minBpm,
      maxBpm,
      samplesCount: hrValues.length,
    },
    sleep: {
      totalAsleepMinutes: 0,
      recordsCount: 0,
    },
    workouts: [],
    earliestRecordDate: earliestDate,
    latestRecordDate: latestDate,
  };
}

/**
 * Computes physiological recovery readiness score (0-100) combining sleep and resting heart rate.
 */
export function computeRecoveryReadiness(health: HealthSyncSummary): {
  score: number;
  readinessLevel: 'optimal' | 'moderate' | 'fatigued';
  insight: string;
} {
  let score = 75; // baseline neutral

  // Factor 1: Sleep (Target 7-9 hours = 420-540 min)
  const sleepHours = health.sleep.totalAsleepMinutes / 60;
  if (sleepHours >= 7.5 && sleepHours <= 9.5) {
    score += 15;
  } else if (sleepHours >= 6.5) {
    score += 5;
  } else if (sleepHours > 0 && sleepHours < 6) {
    score -= 20;
  }

  // Factor 2: Resting HR
  if (health.heartRate.restingBpm) {
    const rhr = health.heartRate.restingBpm;
    if (rhr <= 55) score += 10;
    else if (rhr <= 65) score += 5;
    else if (rhr > 75) score -= 15;
  }

  score = Math.max(10, Math.min(100, Math.round(score)));

  let readinessLevel: 'optimal' | 'moderate' | 'fatigued' = 'moderate';
  let insight = 'Capacités physiologiques stables pour la séance.';

  if (score >= 85) {
    readinessLevel = 'optimal';
    insight = 'Récupération maximale : conditions optimales pour une intensité élevée ou des records personnels.';
  } else if (score < 60) {
    readinessLevel = 'fatigued';
    insight = 'Indicateurs de fatigue détectés : envisager un volume modéré ou une gestion stricte du RIR.';
  }

  return { score, readinessLevel, insight };
}

function createEmptySummary(source: HealthSyncSummary['source']): HealthSyncSummary {
  return {
    source,
    parsedAt: new Date().toISOString(),
    totalSteps: 0,
    totalActiveCaloriesKcal: 0,
    heartRate: { avgBpm: null, minBpm: null, maxBpm: null, samplesCount: 0 },
    sleep: { totalAsleepMinutes: 0, recordsCount: 0 },
    workouts: [],
  };
}
