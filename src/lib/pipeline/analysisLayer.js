/**
 * Layer 4: Analysis & Feedback
 *
 * Input: rep events from Layer 3 + angle time series from Layer 2
 * Output: JSON payload with counts, per-rep data, and flagged metrics
 *
 * All metrics are marked as "unvalidated" in the output payload.
 * This layer CANNOT crash the app. If it throws, the count still shows.
 */

/**
 * Generate the analysis payload.
 *
 * @param {Object} kinematics - Output from Layer 2 (kinematicEngine)
 * @param {Object} repResult - Output from Layer 3 (repCounter)
 * @param {string} exerciseName - Exercise key
 * @param {Object} options
 * @param {number} options.duration - Video duration in seconds
 * @returns {Object} Analysis payload for Layer 5 (UI)
 */
export function generateAnalysis(kinematics, repResult, exerciseName, options = {}) {
  const { duration = 0 } = options;

  // Core payload: always present, never throws
  const payload = {
    exerciseName,
    repCount: repResult.count,
    confidence: repResult.confidence,
    duration: Math.round(duration),
    reps: repResult.reps || [],
    validated: false,
  };

  // Experimental metrics: wrapped in try/catch so failures don't crash
  try {
    payload.metrics = computeMetrics(kinematics, repResult, exerciseName);
  } catch (err) {
    payload.metrics = {
      error: err.message,
      validated: false,
    };
  }

  // Coaching notes: best-effort
  try {
    payload.coaching = generateCoachingNotes(kinematics, repResult, exerciseName);
  } catch {
    payload.coaching = [];
  }

  return payload;
}

// ============================================================================
// Experimental metrics (all marked unvalidated)
// ============================================================================

function computeMetrics(kinematics, repResult, exerciseName) {
  const reps = repResult.reps || [];

  if (reps.length === 0) {
    return { validated: false };
  }

  // ROM consistency
  const roms = reps.map(r => r.rom).filter(r => r > 0);
  const avgRom = roms.length > 0 ? roms.reduce((s, r) => s + r, 0) / roms.length : 0;
  const romStdDev = roms.length > 1
    ? Math.sqrt(roms.reduce((s, r) => s + (r - avgRom) ** 2, 0) / roms.length)
    : 0;

  // Tempo consistency
  const durations = reps.map(r => r.duration).filter(d => d > 0);
  const avgTempo = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
  const tempoStdDev = durations.length > 1
    ? Math.sqrt(durations.reduce((s, d) => s + (d - avgTempo) ** 2, 0) / durations.length)
    : 0;

  // Fatigue indicator: compare first half vs second half ROM
  let fatigueIndicator = null;
  if (reps.length >= 4) {
    const half = Math.floor(reps.length / 2);
    const firstHalfRom = reps.slice(0, half).reduce((s, r) => s + r.rom, 0) / half;
    const secondHalfRom = reps.slice(half).reduce((s, r) => s + r.rom, 0) / (reps.length - half);
    if (firstHalfRom > 0) {
      fatigueIndicator = Math.round(((firstHalfRom - secondHalfRom) / firstHalfRom) * 100);
    }
  }

  return {
    avgRom: Math.round(avgRom * 10) / 10,
    romStdDev: Math.round(romStdDev * 10) / 10,
    avgTempo: Math.round(avgTempo * 100) / 100,
    tempoStdDev: Math.round(tempoStdDev * 100) / 100,
    fatigueIndicator,
    validated: false,
    label: 'experimental',
  };
}

// ============================================================================
// Coaching notes (best effort, all marked experimental)
// ============================================================================

function generateCoachingNotes(kinematics, repResult, exerciseName) {
  const notes = [];
  const reps = repResult.reps || [];

  if (reps.length === 0) return notes;

  // ROM consistency check
  const roms = reps.map(r => r.rom).filter(r => r > 0);
  if (roms.length >= 3) {
    const avgRom = roms.reduce((s, r) => s + r, 0) / roms.length;
    const maxRom = Math.max(...roms);
    const minRom = Math.min(...roms);
    const romRange = maxRom - minRom;

    if (romRange > avgRom * 0.3) {
      notes.push({
        type: 'rom_inconsistency',
        message: 'Range of motion varies significantly between reps. Try to maintain consistent depth.',
        severity: 'info',
        validated: false,
      });
    }
  }

  // Tempo check
  const durations = reps.map(r => r.duration).filter(d => d > 0);
  if (durations.length >= 3) {
    const avgD = durations.reduce((s, d) => s + d, 0) / durations.length;
    const cv = Math.sqrt(durations.reduce((s, d) => s + (d - avgD) ** 2, 0) / durations.length) / avgD;

    if (cv > 0.3) {
      notes.push({
        type: 'tempo_inconsistency',
        message: 'Rep tempo varies. A consistent tempo helps muscle activation.',
        severity: 'info',
        validated: false,
      });
    }
  }

  // Fatigue warning
  if (reps.length >= 6) {
    const lastThreeRom = reps.slice(-3).reduce((s, r) => s + r.rom, 0) / 3;
    const firstThreeRom = reps.slice(0, 3).reduce((s, r) => s + r.rom, 0) / 3;

    if (firstThreeRom > 0 && (firstThreeRom - lastThreeRom) / firstThreeRom > 0.15) {
      notes.push({
        type: 'fatigue',
        message: 'ROM decreased in the last few reps, which may indicate fatigue.',
        severity: 'info',
        validated: false,
      });
    }
  }

  return notes;
}
