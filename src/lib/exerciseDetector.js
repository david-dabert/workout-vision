/**
 * Exercise auto-detection engine.
 *
 * Attempts to automatically detect which exercise the user is performing
 * based on joint angle patterns over a rolling window.
 *
 * Separated from exercises.js for modularity.
 */

import { extractJointAngles } from './poseAnalysis';
import { bestSide } from './exercises';
import { AngleBuffer } from './repCounter';

// ---------------------------------------------------------------------------
// ExerciseAutoDetector
// ---------------------------------------------------------------------------

/**
 * Attempts to automatically detect which exercise the user is performing
 * based on joint angle patterns over a rolling window. Requires ~1 second
 * (30 frames at 30fps) of stable pattern to declare a detection.
 *
 * Detection heuristics by joint angle signature:
 * - Squat-like: knees flexing deeply + hips flexing + trunk <60 deg
 * - Deadlift-like: hips flexing deeply + knees moderate + trunk >40 deg
 * - Push-up: elbows flexing + trunk near 0 (horizontal) + low shoulder angle
 * - Curl: elbows flexing + trunk near 0 (vertical) + shoulders static
 * - Overhead press: elbows flexing + shoulders >90 deg
 * - Row: elbows flexing + trunk 40-70 deg
 * - Lateral raise: shoulders abducting + elbows nearly straight
 * - Plank: all angles stable + trunk near 0
 */
export class ExerciseAutoDetector {
  /**
   * @param {object} [opts]
   * @param {number} [opts.fps=30] - capture frame rate; adjusts detection windows
   */
  constructor(opts = {}) {
    const fps = opts.fps || 30;
    this._frameBuffer = [];
    this._bufferSize = Math.max(8, Math.round(fps));
    this._smoother = new AngleBuffer(fps <= 5 ? 2 : 3);
    this._lastDetection = null;
    this._detectionConfidence = 0;
    // Weighted voting: 8 agreeing frames at any FPS (~0.5s at 15fps, ~1s at 8fps)
    // Old value of 15 was nearly impossible with real-world camera jitter
    this._requiredConfidence = fps <= 5 ? 4 : 8;
    this._minFrames = fps <= 5 ? 5 : 8;
    // Vote history for majority-wins detection
    this._voteHistory = [];
    this._voteWindowSize = Math.max(12, Math.round(fps * 1.5));
  }

  /**
   * Process a frame and return detected exercise or null.
   * @param {Array} landmarks - 33 MediaPipe landmarks
   * @returns {string|null} exercise key from EXERCISES, or null
   */
  update(landmarks) {
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) return this._lastDetection;

    const angles = this._smoother.smooth(rawAngles);
    this._frameBuffer.push(angles);
    if (this._frameBuffer.length > this._bufferSize) {
      this._frameBuffer.shift();
    }
    if (this._frameBuffer.length < this._minFrames) return null;

    const detection = this._classify(angles);

    // Majority voting: track recent classifications and pick the winner
    if (detection) {
      this._voteHistory.push(detection);
      if (this._voteHistory.length > this._voteWindowSize) {
        this._voteHistory.shift();
      }
    }

    // Count votes for each exercise in the window
    if (this._voteHistory.length >= this._requiredConfidence) {
      const counts = {};
      for (const v of this._voteHistory) {
        counts[v] = (counts[v] || 0) + 1;
      }
      let best = null, bestCount = 0;
      for (const [key, count] of Object.entries(counts)) {
        if (count > bestCount) { best = key; bestCount = count; }
      }
      // Winner needs at least requiredConfidence votes AND >50% of the window
      if (bestCount >= this._requiredConfidence && bestCount > this._voteHistory.length * 0.5) {
        this._lastDetection = best;
        return best;
      }
    }

    return null;
  }

  _classify(angles) {
    const kneeAvg = bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee');
    const hipAvg = bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip');
    const elbowAvg = bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow');
    const shoulderAvg = bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder');
    const trunk = angles.trunk;

    const buf = this._frameBuffer;
    const vs = (a, l, r, vl, vr) => bestSide(a, l, r, vl, vr);
    const kneeRange = this._getRange(buf, (a) => vs(a, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'));
    const hipRange = this._getRange(buf, (a) => vs(a, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'));
    const elbowRange = this._getRange(buf, (a) => vs(a, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'));
    const shoulderRange = this._getRange(buf, (a) => vs(a, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'));
    const trunkRange = this._getRange(buf, (a) => a.trunk);

    const kneeBufAvg = this._getAvg(buf, (a) => vs(a, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'));
    const hipBufAvg = this._getAvg(buf, (a) => vs(a, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'));
    const elbowBufAvg = this._getAvg(buf, (a) => vs(a, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'));
    const trunkBufAvg = this._getAvg(buf, (a) => a.trunk);
    const shoulderBufAvg = this._getAvg(buf, (a) => vs(a, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'));
    const kneeMax = this._getMax(buf, (a) => vs(a, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'));
    const hipMax = this._getMax(buf, (a) => vs(a, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'));
    const kneeMin = this._getMin(buf, (a) => vs(a, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'));
    const hipMin = this._getMin(buf, (a) => vs(a, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'));
    const kneeAsym = Math.abs(angles.leftKnee - angles.rightKnee);

    // Body orientation detection
    const isSeated = (hipBufAvg < 130 && hipRange < 20) ||
                     (kneeBufAvg < 130 && kneeRange < 25 && hipBufAvg < 140);
    const isLying = trunkBufAvg < 15 && hipBufAvg > 140 && kneeRange < 15;
    const isProne = trunkBufAvg < 15 && hipBufAvg > 150;
    const isStanding = kneeBufAvg > 140 && hipBufAvg > 140;
    const isHanging = shoulderBufAvg > 140 && kneeBufAvg > 100;

    // ========== SEATED EXERCISES ==========
    if (isSeated) {
      // Seated back extension: seated + trunk ROM + hip ROM + arms/knees static
      if (trunkRange > 10 && hipRange > 15 && elbowRange < 15 && kneeRange < 15) {
        return 'seated_back_extension';
      }
      // Leg press: seated + large knee ROM + large hip ROM + no arm movement
      if (kneeRange > 20 && hipRange > 15 && elbowRange < 10) {
        return 'leg_press';
      }
      if (kneeRange > 12 && elbowRange < 10) {
        if (kneeBufAvg < 100) return 'leg_curl';
        return 'leg_extension';
      }
      if (elbowRange > 8) {
        if (trunkBufAvg > 15) return 'chest_supported_row';
        if (shoulderBufAvg > 80) return 'lat_pulldown';
        if (shoulderAvg < 40) return 'machine_chest_press';
        if (shoulderRange > 15 && elbowBufAvg < 100) return 'preacher_curl';
        return 'seated_row';
      }
      if (shoulderRange > 10) {
        if (shoulderBufAvg > 80) return 'lat_pulldown';
        return 'machine_chest_press';
      }
      if (hipRange > 15 && kneeRange < 10) return 'russian_twist';
      return 'seated_row';
    }

    // ========== HANGING EXERCISES ==========
    // Dead hang: hanging with virtually no movement
    if (isHanging && elbowRange < 10 && shoulderRange < 10 && hipRange < 10) return 'dead_hang';
    if (isHanging && elbowRange > 15) {
      if (hipRange > 25) return 'toes_to_bar';
      if (elbowBufAvg < 120) return 'chin_up';
      return 'pull_up';
    }
    if (isHanging && hipRange > 25 && kneeRange > 15) return 'hanging_leg_raise';
    // L-sit from hang: hanging with hip flexion held steady
    if (isHanging && hipBufAvg < 100 && hipRange < 10 && kneeBufAvg > 140) return 'l_sit';

    // ========== FLOOR/PRONE EXERCISES ==========
    if (isProne && trunkRange < 8 && kneeRange < 10 && elbowRange < 15) return 'plank';

    // Hollow body hold: lying supine with arms overhead, very low movement
    if (trunkBufAvg < 20 && trunkRange < 8 && shoulderBufAvg > 140 && hipBufAvg > 140 && elbowRange < 10 && kneeRange < 10) return 'hollow_body_hold';

    if (isProne && hipRange > 10 && kneeRange < 10 && elbowRange < 10) return 'superman';

    // Push-up family: prone/near-prone + elbow ROM + legs mostly still
    if (trunkBufAvg < 30 && elbowRange > 20 && kneeRange < 12 && hipBufAvg > 140) {
      if (elbowBufAvg < 90) return 'diamond_push_up';
      if (shoulderBufAvg > 90) return 'pike_push_up';
      return 'push_up';
    }

    // Lying exercises (bench press family, flys, skull crushers, lying curls)
    if (isLying && elbowRange > 15) {
      // Lying bicep curl: lying + elbow flexing + shoulder stays low (no pressing)
      if (shoulderBufAvg < 30 && elbowBufAvg < 100 && shoulderRange < 15) return 'lying_bicep_curl';
      if (shoulderRange > 20 && elbowBufAvg > 130) return 'dumbbell_fly';
      if (shoulderBufAvg > 70) return 'skull_crusher';
      if (shoulderBufAvg < 40) return 'close_grip_bench';
      return 'bench_press';
    }

    // Floor-based hip exercises
    if (trunkBufAvg < 25 && hipRange > 20 && kneeBufAvg > 70 && kneeBufAvg < 130 && elbowRange < 10) {
      if (hipBufAvg < 130) return 'hip_thrust';
      return 'glute_bridge';
    }

    // Crunch family (lying + trunk oscillation)
    if (trunkRange > 8 && trunkRange < 30 && kneeRange < 15 && elbowRange < 15 && trunkBufAvg < 30) {
      if (hipRange > 15) return 'v_up';
      if (kneeRange > 8) return 'bicycle_crunch';
      if (trunkRange > 15) return 'sit_up';
      return 'crunch';
    }

    // Flutter kicks: lying + small hip oscillation + legs straight
    if (trunkBufAvg < 15 && hipRange > 5 && hipRange < 20 && kneeBufAvg > 150) return 'flutter_kick';

    // ========== STANDING UPPER BODY ISOLATION ==========

    // Shrug: very small shoulder ROM + arms straight + standing
    if (isStanding && shoulderRange > 5 && shoulderRange < 15 && elbowBufAvg > 150 && elbowRange < 10) {
      return 'shrug';
    }

    // Bicep curl family: elbow ROM dominates + standing upright + shoulders mostly still
    if (elbowRange > 15 && elbowRange > kneeRange * 1.5 && elbowRange > hipRange * 1.5
        && shoulderRange < 20 && kneeBufAvg > 140 && hipBufAvg > 140 && trunkBufAvg < 35) {
      if (shoulderBufAvg < 15) return 'hammer_curl';
      return 'bicep_curl';
    }

    // Cable pushdown: standing + elbow ROM + elbows pinned + shoulders low
    if (isStanding && elbowRange > 20 && shoulderBufAvg < 25 && shoulderRange < 10) {
      return 'cable_tricep_pushdown';
    }

    // Rear delt fly: shoulder ROM + bent over + elbows mostly straight (check BEFORE lateral/front)
    if (shoulderRange > 15 && elbowBufAvg > 120 && trunkBufAvg > 30 && kneeBufAvg > 140) {
      return 'rear_delt_fly';
    }

    // Upright row: standing + shoulder ROM + elbow ROM + arms start low
    if (isStanding && shoulderRange > 15 && elbowRange > 15 && shoulderBufAvg < 60 && trunkBufAvg < 40) {
      return 'upright_row';
    }

    // Face pull: shoulder + elbow ROM + standing + high pull
    if (shoulderRange > 15 && elbowRange > 15 && shoulderBufAvg > 60 && trunkBufAvg < 15 && kneeBufAvg > 140) {
      return 'face_pull';
    }

    // Front raise: shoulder ROM + elbows very straight + standing very upright (stricter than lateral)
    if (shoulderRange > 20 && elbowBufAvg > 150 && trunkBufAvg < 10 && kneeBufAvg > 140) {
      return 'front_raise';
    }

    // Lateral raise: shoulder ROM + elbows mostly straight + standing
    if (shoulderRange > 20 && elbowBufAvg > 130 && trunkBufAvg < 20 && kneeBufAvg > 140) {
      return 'lateral_raise';
    }

    // Overhead press family: elbow ROM + high shoulder + standing
    if (elbowRange > 20 && shoulderAvg > 80 && trunkBufAvg < 45 && kneeBufAvg > 140) {
      if (kneeRange > 10) return 'push_press';
      return 'overhead_press';
    }

    // Tricep extension: elbow ROM + shoulders elevated (overhead)
    if (elbowRange > 20 && shoulderAvg > 100 && trunkBufAvg < 15) {
      return 'tricep_extension';
    }

    // ========== STANDING UPPER BODY COMPOUND ==========

    // Bent-over row family: elbow ROM + forward lean trunk + standing
    if (elbowRange > 15 && trunkBufAvg > 35 && trunkBufAvg < 75 && kneeBufAvg > 130) {
      if (trunkBufAvg > 60) return 'pendlay_row';
      return 'bent_over_row';
    }

    // Cable fly/crossover: standing + shoulder ROM + elbows mostly straight
    if (isStanding && shoulderRange > 20 && elbowBufAvg > 130 && trunkBufAvg < 20) {
      return 'cable_crossover';
    }

    // Dip: elbow ROM + shoulders going low + trunk forward
    if (elbowRange > 25 && shoulderRange > 15 && kneeBufAvg > 100 && trunkBufAvg > 10 && trunkBufAvg < 40) {
      return 'dip';
    }

    // Kettlebell swing: hip ROM + arms swinging + explosive
    if (hipRange > 30 && shoulderRange > 30 && kneeRange > 10 && kneeRange < 30 && trunkRange > 20) {
      return 'kettlebell_swing';
    }

    // ========== LOWER BODY ==========

    // Lunge family: knee ROM + asymmetric knees
    if (kneeRange > 20 && kneeAsym > 30) {
      if (kneeAsym > 50) return 'bulgarian_split_squat';
      return 'lunge';
    }

    // Overhead hold: standing + arms fully overhead + no movement
    if (isStanding && shoulderBufAvg > 150 && shoulderRange < 10 && elbowBufAvg > 150 && elbowRange < 10 && hipRange < 10) {
      return 'overhead_hold';
    }

    // Calf raise: very small knee ROM + standing on toes (ankle-driven)
    if (isStanding && kneeRange < 10 && hipRange < 10 && elbowRange < 10 && shoulderRange < 10) {
      return 'calf_raise';
    }

    // Step up: one knee bending while standing
    if (kneeRange > 15 && kneeAsym > 20 && trunkBufAvg < 20) {
      return 'step_up';
    }

    // Squat family: large knee ROM + hip flexion + mostly upright
    if (kneeRange > 25 && hipRange > 15 && trunkBufAvg < 60 && kneeMax > 145) {
      if (shoulderBufAvg > 130) return 'overhead_squat';
      if (kneeMin < 80) return 'pistol_squat';
      if (trunkBufAvg < 30) return 'front_squat';
      if (hipRange > kneeRange) return 'sumo_deadlift';
      return 'squat';
    }

    // Deadlift/RDL/Good morning: large hip ROM + forward trunk
    if (hipRange > 25 && trunkBufAvg > 35 && hipMax > 145) {
      if (kneeRange < 10) return 'good_morning';
      if (kneeRange < 15) return 'romanian_deadlift';
      return 'deadlift';
    }

    // Hip thrust/glute bridge: hip ROM + knees bent + supine-ish
    if (hipRange > 20 && kneeBufAvg > 70 && kneeBufAvg < 120 && elbowRange < 10) {
      return 'hip_thrust';
    }

    // Jump squat / box jump: squat-like ROM + fast cycles
    if (kneeRange > 30 && hipRange > 20 && trunkBufAvg < 40) {
      return 'jump_squat';
    }

    // Wall sit: isometric squat (knees bent, very low range)
    if (kneeBufAvg < 120 && kneeRange < 10 && hipRange < 10 && trunkBufAvg < 20) {
      return 'wall_sit';
    }

    // Mountain climber: prone + alternating knee drive
    if (trunkBufAvg < 25 && kneeRange > 20 && elbowRange < 10 && hipRange > 15) {
      return 'mountain_climber';
    }

    // Jumping jack: standing + shoulder ROM + legs moving together
    if (isStanding && shoulderRange > 30 && kneeRange > 10 && elbowBufAvg > 130) {
      return 'jumping_jack';
    }

    // Burpee: massive trunk range + knee range + elbow range (full body)
    if (trunkRange > 40 && kneeRange > 30 && elbowRange > 20) {
      return 'burpee';
    }

    // Battle rope: standing + rapid shoulder oscillation + knees slightly bent
    if (isStanding && shoulderRange > 15 && shoulderRange < 40 && elbowRange < 15 && kneeRange < 10) {
      return 'battle_rope';
    }

    // Thruster: squat + press combo
    if (kneeRange > 20 && elbowRange > 20 && shoulderBufAvg > 60 && hipRange > 15) {
      return 'thruster';
    }

    // Clean and press / power clean: hip + shoulder + elbow all moving
    if (hipRange > 20 && shoulderRange > 25 && elbowRange > 20) {
      if (shoulderBufAvg > 100) return 'clean_and_press';
      return 'power_clean';
    }

    return null;
  }

  _getRange(buffer, accessor) {
    let min = Infinity;
    let max = -Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val == null || isNaN(val)) continue;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    return max === -Infinity ? 0 : max - min;
  }

  _getAvg(buffer, accessor) {
    if (buffer.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val == null || isNaN(val)) continue;
      sum += val;
      count++;
    }
    return count === 0 ? 0 : sum / count;
  }

  _getMax(buffer, accessor) {
    let max = -Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val != null && val > max) max = val;
    }
    return max;
  }

  _getMin(buffer, accessor) {
    let min = Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val != null && val < min) min = val;
    }
    return min;
  }

  reset() {
    this._frameBuffer = [];
    this._lastDetection = null;
    this._detectionConfidence = 0;
    this._smoother.reset();
  }
}
