/**
 * Stillness and Rest Boundary Detector (Card 057)
 *
 * Measures motion energy across anatomical landmarks to detect when a lifter
 * is at rest before starting a set and returns to rest after completing it.
 *
 * Guarantees:
 * 1. A set filmed with rest-bounded capture opens at rest (3s countdown + 2s stillness).
 * 2. A set finishes at rest (auto-stops after 2s of stillness at rest/rack).
 * 3. Prevents edge-truncation undercounts (131 of 382 errors in project register).
 */

const TORSO_LANDMARKS = [11, 12, 23, 24, 25, 26]; // shoulders, hips, knees

/**
 * Computes root-mean-square displacement velocity between consecutive landmark frames.
 * Handles both normalized image landmarks ({x, y}) and 3D world landmarks ({x, y, z}).
 *
 * @param {Array<Object>|null} curr Current frame landmarks
 * @param {Array<Object>|null} prev Previous frame landmarks
 * @param {number} dt Time delta in seconds
 * @returns {number} Motion energy metric in units/sec
 */
export function computeMotionEnergy(curr, prev, dt) {
  if (!curr || !prev || !dt || dt <= 0) return 0;

  let sumSq = 0;
  let count = 0;

  for (const idx of TORSO_LANDMARKS) {
    const c = curr[idx];
    const p = prev[idx];
    if (!c || !p) continue;

    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const dz = (c.z !== undefined && p.z !== undefined) ? (c.z - p.z) : 0;
    sumSq += (dx * dx + dy * dy + dz * dz);
    count += 1;
  }

  if (count === 0) return 0;
  const rms = Math.sqrt(sumSq / count);
  return rms / dt;
}

/**
 * Streaming detector that monitors stillness over a sliding window.
 */
export class StillnessDetector {
  /**
   * @param {Object} options
   * @param {number} [options.stillThreshold=0.06] Max velocity (units/sec) for stillness
   * @param {number} [options.targetStillSec=2.0] Duration (seconds) of stillness required
   */
  constructor(options = {}) {
    this.stillThreshold = options.stillThreshold ?? 0.06;
    this.targetStillSec = options.targetStillSec ?? 2.0;
    this.reset();
  }

  reset() {
    this.prevLandmarks = null;
    this.prevTimestamp = 0;
    this.currentStillDuration = 0;
    this.isSettled = false;
    this.lastMotionEnergy = 0;
  }

  /**
   * Ingest one frame and update stillness state.
   * @param {Array<Object>|null} landmarks
   * @param {number} timestampSec
   * @returns {{ isStill: boolean, stillDuration: number, isSettled: boolean, motionEnergy: number }}
   */
  update(landmarks, timestampSec) {
    if (!landmarks || typeof timestampSec !== 'number') {
      return {
        isStill: false,
        stillDuration: this.currentStillDuration,
        isSettled: this.isSettled,
        motionEnergy: this.lastMotionEnergy,
      };
    }

    if (this.prevLandmarks === null) {
      this.prevLandmarks = landmarks;
      this.prevTimestamp = timestampSec;
      return {
        isStill: true,
        stillDuration: 0,
        isSettled: false,
        motionEnergy: 0,
      };
    }

    const dt = timestampSec - this.prevTimestamp;
    if (dt <= 0) {
      return {
        isStill: this.currentStillDuration > 0,
        stillDuration: this.currentStillDuration,
        isSettled: this.isSettled,
        motionEnergy: this.lastMotionEnergy,
      };
    }

    const energy = computeMotionEnergy(landmarks, this.prevLandmarks, dt);
    this.lastMotionEnergy = energy;
    this.prevLandmarks = landmarks;
    this.prevTimestamp = timestampSec;

    const isStill = energy <= this.stillThreshold;

    if (isStill) {
      this.currentStillDuration += dt;
      if (this.currentStillDuration >= this.targetStillSec) {
        this.isSettled = true;
      }
    } else {
      this.currentStillDuration = 0;
      this.isSettled = false;
    }

    return {
      isStill,
      stillDuration: this.currentStillDuration,
      isSettled: this.isSettled,
      motionEnergy: energy,
    };
  }
}

/**
 * Detects resting start and end boundaries in a recorded series of frames.
 *
 * @param {Array<Array<Object>|null>} landmarksSeries Array of frame landmarks
 * @param {number[]} timestamps Array of frame timestamps (seconds)
 * @param {Object} [options]
 * @param {number} [options.stillThreshold=0.06] Max velocity threshold
 * @param {number} [options.minRestSec=2.0] Minimum rest duration to qualify as opened/closed at rest
 * @returns {{
 *   openedAtRest: boolean,
 *   closedAtRest: boolean,
 *   firstMoveIndex: number,
 *   lastMoveIndex: number,
 *   restStartDuration: number,
 *   restEndDuration: number
 * }}
 */
export function detectRestBoundaries(landmarksSeries, timestamps, options = {}) {
  const threshold = options.stillThreshold ?? 0.06;
  const minRestSec = options.minRestSec ?? 2.0;

  if (!Array.isArray(landmarksSeries) || !Array.isArray(timestamps) || landmarksSeries.length < 2) {
    return {
      openedAtRest: false,
      closedAtRest: false,
      firstMoveIndex: 0,
      lastMoveIndex: 0,
      restStartDuration: 0,
      restEndDuration: 0,
    };
  }

  const n = Math.min(landmarksSeries.length, timestamps.length);

  // Compute instantaneous energies
  const energies = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const dt = timestamps[i] - timestamps[i - 1];
    energies[i] = computeMotionEnergy(landmarksSeries[i], landmarksSeries[i - 1], dt);
  }

  // 1. Check if opened at rest:
  // Initial period from t=0 should be still until first significant motion
  let firstMoveIndex = n - 1;
  for (let i = 1; i < n; i++) {
    if (energies[i] > threshold) {
      firstMoveIndex = i;
      break;
    }
  }
  const restStartDuration = timestamps[firstMoveIndex] - timestamps[0];
  const openedAtRest = restStartDuration >= minRestSec;

  // 2. Check if closed at rest:
  // Trailing period before t_end should be still after last significant motion
  let lastMoveIndex = 0;
  for (let i = n - 1; i >= 1; i--) {
    if (energies[i] > threshold) {
      lastMoveIndex = i;
      break;
    }
  }
  const restEndDuration = timestamps[n - 1] - timestamps[lastMoveIndex];
  const closedAtRest = restEndDuration >= minRestSec;

  return {
    openedAtRest,
    closedAtRest,
    firstMoveIndex,
    lastMoveIndex,
    restStartDuration,
    restEndDuration,
  };
}
