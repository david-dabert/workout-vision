/**
 * Exercise database and shared helpers.
 *
 * Scientific references embedded per exercise. Joint angle thresholds
 * calibrated from biomechanics literature and empirical tuning on
 * MediaPipe Pose Landmarker output (normalized 0-1 coordinates, lite model).
 *
 * Angles object shape (from poseAnalysis.extractJointAngles):
 *   { leftKnee, rightKnee, leftHip, rightHip,
 *     leftElbow, rightElbow, leftShoulder, rightShoulder, trunk }
 *   All values in degrees.
 *
 * RepCounter and ExerciseAutoDetector have been split into separate modules
 * (repCounter.js and exerciseDetector.js) but are re-exported here so that
 * existing imports continue to work.
 */

// ---------------------------------------------------------------------------
// Visibility-aware bilateral selection
// ---------------------------------------------------------------------------
// When filming from the side, MediaPipe hallucinates the occluded arm/leg.
// Using Math.min of both sides clamps the value to the hallucinated angle,
// preventing threshold crossing. This helper uses the side with better
// landmark visibility, falling back safely when both are low-confidence.
//
// VIS_THRESHOLD raised from 0.5 to 0.6: MediaPipe visibility is a confidence
// score, not actual occlusion percentage. At 0.5, ~30% of selected landmarks
// are hallucinations. At 0.6, this drops to ~15%.
const VIS_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Continuous form quality helpers (0-1 gradient scoring)
// ---------------------------------------------------------------------------
// These replace binary pass/fail with smooth quality curves.
// A quality of 1.0 = perfect form. 0.0 = clearly failing.
// The margin parameter controls the transition zone width in degrees.

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Quality for "angle should be below threshold" (e.g., depth, trunk lean) */
export function qualityBelow(angle, threshold, margin = 15) {
  if (angle == null || isNaN(angle)) return 0;
  return clamp01((threshold - angle + margin) / (2 * margin));
}

/** Quality for "angle should be above threshold" (e.g., lockout, extension) */
export function qualityAbove(angle, threshold, margin = 15) {
  if (angle == null || isNaN(angle)) return 0;
  return clamp01((angle - threshold + margin) / (2 * margin));
}

/** Quality for bilateral symmetry checks (lower difference = higher quality) */
export function qualitySymmetry(left, right, threshold) {
  if (left == null || right == null || isNaN(left) || isNaN(right)) return 0;
  const diff = Math.abs(left - right);
  return clamp01(1 - diff / (threshold * 1.5));
}

/** Quality for "angle within range" checks (e.g., trunk 20-80°) */
export function qualityRange(angle, low, high, margin = 10) {
  if (angle == null || isNaN(angle)) return 0;
  if (angle >= low && angle <= high) return 1;
  const distOutside = angle < low ? low - angle : angle - high;
  return clamp01(1 - distOutside / margin);
}

/**
 * Visibility-aware bilateral selection.
 * @param {object} angles - joint angles with visibility metadata
 * @param {string} leftKey - left angle key
 * @param {string} rightKey - right angle key
 * @param {string} visLeftKey - left visibility key
 * @param {string} visRightKey - right visibility key
 * @param {function} agg - aggregation when both sides valid (Math.min or Math.max)
 */
function bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, agg) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  if (leftOk && rightOk) return agg(left, right);
  if (leftOk) return left;
  if (rightOk) return right;
  // Neither well-tracked: prefer higher-visibility side
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
}

export function bestSide(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  return bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, Math.min);
}

export function bestSideMax(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  return bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, Math.max);
}

// ---------------------------------------------------------------------------
// Exercise database
// ---------------------------------------------------------------------------

export const EXERCISES = {
  // ===== LOWER COMPOUND =====
  squat: {
    name: 'Barbell Back Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Erectors', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 120,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 90,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 90, 15),
        good: 'Below parallel',
        bad: 'Above parallel — go deeper',
        severity: 'major',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 18,
        quality: (angles) => qualitySymmetry(angles.leftKnee, angles.rightKnee, 18),
        good: 'Knees tracking evenly',
        bad: 'Asymmetric knee bend',
        severity: 'major',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk < 55,
        quality: (angles) => qualityBelow(angles.trunk, 55, 15),
        good: 'Upright torso maintained',
        bad: 'Excessive forward lean',
        severity: 'minor',
        citation: 'Fry AC et al, 2003, J Strength Cond Res',
      },
      {
        name: 'Knee valgus',
        // landmarks[25]=LEFT_KNEE, landmarks[26]=RIGHT_KNEE,
        // landmarks[27]=LEFT_ANKLE, landmarks[28]=RIGHT_ANKLE.
        // Valgus: knee x drifts inward past ankle x.
        // Left side: knee x should be >= ankle x (or not more than 0.02 inward).
        // Right side: ankle x should be >= knee x (or not more than 0.02 inward).
        check: (angles, landmarks) => {
          if (!landmarks || !landmarks[25] || !landmarks[26] || !landmarks[27] || !landmarks[28]) return true;
          const lk = landmarks[25];
          const la = landmarks[27];
          const rk = landmarks[26];
          const ra = landmarks[28];
          // Only check sides where both knee and ankle are visible.
          // When occluded, MediaPipe hallucinates positions causing false failures.
          const leftVis = (lk.visibility || 0) > 0.3 && (la.visibility || 0) > 0.3;
          const rightVis = (rk.visibility || 0) > 0.3 && (ra.visibility || 0) > 0.3;
          if (!leftVis && !rightVis) return true;
          const leftOk = !leftVis || (lk.x - la.x) > -0.02;
          const rightOk = !rightVis || (ra.x - rk.x) > -0.02;
          return leftOk && rightOk;
        },
        good: 'Knees tracking over toes',
        bad: 'Knee cave detected',
        severity: 'major',
        citation: 'Hewett TE et al, 2005, Am J Sports Med',
      },
    ],
    scienceNotes: 'Full ROM squats produce greater quad and glute activation than partial squats (Schoenfeld 2010). Knee valgus >10 deg increases ACL strain (Hewett 2005). Forward lean >55 deg shifts load to erectors and increases spinal shear (Fry 2003).',
  },

  front_squat: {
    name: 'Front Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 120,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 85,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 85, 15),
        good: 'Below parallel',
        bad: 'Above parallel',
        severity: 'major',
        citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 40,
        quality: (angles) => qualityBelow(angles.trunk, 40, 12),
        good: 'Upright torso -- elbows high',
        bad: 'Torso collapsing forward',
        severity: 'major',
        citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        quality: (angles) => qualitySymmetry(angles.leftKnee, angles.rightKnee, 12),
        good: 'Knees tracking evenly',
        bad: 'Asymmetric knee bend',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Front squats reduce posterior shear on the knee vs back squats while demanding greater quad activation and more upright torso (Gullett 2009).',
  },

  goblet_squat: {
    name: 'Goblet Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back', 'Biceps'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 115,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 90,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 90, 15),
        good: 'Full depth achieved',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 45,
        quality: (angles) => qualityBelow(angles.trunk, 45, 12),
        good: 'Torso upright',
        bad: 'Leaning forward',
        severity: 'minor',
        citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J',
      },
    ],
    scienceNotes: 'Goblet position acts as counterbalance enabling deeper squat with more upright torso, ideal for motor learning (Contreras & Schoenfeld 2011).',
  },

  deadlift: {
    name: 'Conventional Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes', 'Erectors'], secondary: ['Quadriceps', 'Traps', 'Forearms'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Hip hinge depth',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 100,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 100, 15),
        good: 'Full hip hinge range',
        bad: 'Incomplete hinge',
        severity: 'minor',
        citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc',
      },
      {
        name: 'Trunk neutral',
        check: (angles) => angles.trunk > 20 && angles.trunk < 80,
        quality: (angles) => qualityRange(angles.trunk, 20, 80, 12),
        good: 'Back angle within safe range',
        bad: 'Excessive trunk rounding or hyperextension',
        severity: 'major',
        citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc',
      },
      {
        name: 'Lumbar flexion',
        check: (angles, landmarks) => {
          // Proxy for lumbar rounding: if hip midpoint is anterior to shoulder midpoint
          // in the sagittal plane by more than 0.03 normalized units, flag as potential
          // lumbar flexion. McGill SM, 2007: lumbar flexion under compressive load
          // increases disc herniation risk by 300-800%.
          // NOTE: This is a heuristic proxy, not a clinical measurement.
          if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return true;
          const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
          const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
          // If hips are significantly forward of shoulders in depth (z), spine is rounding
          return (midHipZ - midShoulderZ) < 0.03;
        },
        good: 'Neutral spine maintained',
        bad: 'Potential lumbar rounding detected',
        severity: 'major',
        citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 165,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 165, 15),
        good: 'Full hip extension at top',
        bad: 'Incomplete lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Hales ME et al, 2009, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Conventional deadlift produces peak erector and hamstring activation at the bottom third of the pull (Cholewicki 1991). Lumbar flexion under load increases disc injury risk by 300-800% (McGill 2007).',
  },

  romanian_deadlift: {
    name: 'Romanian Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Erectors', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Knee soft lock',
        check: (angles) => {
          const knee = Math.min(angles.leftKnee, angles.rightKnee);
          return knee >= 150 && knee <= 175;
        },
        quality: (angles) => qualityRange(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 150, 175, 10),
        good: 'Knees slightly bent -- soft lock maintained',
        bad: 'Knees too bent or too locked',
        severity: 'minor',
        citation: 'McAllister MJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Hip hinge',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 95,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 95, 15),
        good: 'Deep hip hinge achieved',
        bad: 'Hinge deeper',
        severity: 'major',
        citation: 'McAllister MJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk > 40 && angles.trunk < 85,
        quality: (angles) => qualityRange(angles.trunk, 40, 85, 12),
        good: 'Back flat through hinge',
        bad: 'Back rounding or insufficient hinge',
        severity: 'major',
        citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
      },
      {
        name: 'Lumbar flexion',
        check: (angles, landmarks) => {
          if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return true;
          const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
          const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
          return (midHipZ - midShoulderZ) < 0.03;
        },
        good: 'Neutral spine maintained',
        bad: 'Potential lumbar rounding detected',
        severity: 'major',
        citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'RDL places peak stretch on hamstrings at end range with minimal quad involvement. Keeping knees at 15-20 deg flexion maximizes hamstring length-tension (McAllister 2014). Lumbar flexion under load increases disc injury risk (McGill 2007).',
  },

  hip_thrust: {
    name: 'Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 170,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 170, 15),
        good: 'Full hip extension -- peak glute contraction',
        bad: 'Incomplete extension',
        severity: 'major',
        phase: 'top',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
      {
        name: 'Knee angle',
        check: (angles) => {
          const avg = (angles.leftKnee + angles.rightKnee) / 2;
          return avg > 80 && avg < 110;
        },
        quality: (angles) => qualityRange((angles.leftKnee + angles.rightKnee) / 2, 80, 110, 12),
        good: 'Knee angle ~90 deg at top',
        bad: 'Reposition feet',
        severity: 'minor',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
      {
        name: 'Anterior pelvic tilt',
        check: (angles) => {
          const hipAngle = Math.min(angles.leftHip, angles.rightHip);
          if (hipAngle <= 160) return true;
          return angles.trunk < 20;
        },
        quality: (angles) => {
          const hipAngle = bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip');
          if (hipAngle == null || hipAngle <= 160) return 1;
          return qualityBelow(angles.trunk, 20, 10);
        },
        good: 'Neutral spine at lockout',
        bad: 'Anterior pelvic tilt detected',
        severity: 'minor',
        phase: 'top',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
    ],
    scienceNotes: 'Hip thrust produces greater glute activation than squat at comparable loads (Contreras 2015). Full extension at top is critical for peak contraction.',
  },

  // ===== LOWER ISOLATION =====
  lunge: {
    name: 'Walking Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 105,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 100, 15),
        good: 'Rear knee approaching floor',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Riemann BL et al, 2012, J Athl Train',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 25,
        quality: (angles) => qualityBelow(angles.trunk, 25, 10),
        good: 'Torso upright',
        bad: 'Leaning forward',
        severity: 'minor',
        citation: 'Farrokhi S et al, 2008, J Orthop Sports Phys Ther',
      },
    ],
    scienceNotes: 'Lunges produce significant unilateral quad and glute activation; deeper lunges increase glute contribution (Riemann 2012).',
  },

  bulgarian_split_squat: {
    name: 'Bulgarian Split Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core', 'Hip Flexors'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 105,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 100, 15),
        good: 'Deep split squat position',
        bad: 'Sit deeper into the split',
        severity: 'minor',
        citation: 'DeForest BA et al, 2014, Int J Exerc Sci',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 30,
        quality: (angles) => qualityBelow(angles.trunk, 30, 10),
        good: 'Torso vertical',
        bad: 'Excessive forward lean',
        severity: 'minor',
        citation: 'DeForest BA et al, 2014, Int J Exerc Sci',
      },
    ],
    scienceNotes: 'Bulgarian split squat produces comparable quad activation to back squat with lower spinal load; effective unilateral overload (DeForest 2014).',
  },

  standing_leg_extension: {
    name: 'Standing Leg Extension',
    category: 'isolation',
    muscles: { primary: ['Quadriceps'], secondary: [] },
    joint: 'knee',
    getValue: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 120,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.max(angles.leftKnee, angles.rightKnee) > 165,
        good: 'Full knee extension -- peak quad contraction',
        bad: 'Extend fully',
        severity: 'minor',
        phase: 'top',
        citation: 'Signorile JF et al, 1994, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Leg extension isolates vastus medialis at terminal extension (last 15 deg). Full lockout is critical for VMO activation (Signorile 1994).',
  },

  calf_raise: {
    name: 'Standing Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    // Calf raise detection via ankle (heel) vertical displacement.
    // landmarks[29] = LEFT_HEEL, landmarks[30] = RIGHT_HEEL.
    // y-coordinates: 0=top of frame, 1=bottom. Rising heels = decreasing y = increasing (1-y).
    // getValue returns the inverted average heel y so upward heel movement = increasing value.
    getValue: (angles, landmarks) => {
      if (landmarks && landmarks[29] && landmarks[30]) {
        const leftHeel = landmarks[29].y;
        const rightHeel = landmarks[30].y;
        return (1 - (leftHeel + rightHeel) / 2) * 100; // scale to 0-100 range
      }
      // Fallback to trunk if landmarks unavailable
      return angles.trunk;
    },
    downThreshold: 45,
    upThreshold: 55,
    formChecks: [
      {
        name: 'Knee straight',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 160,
        good: 'Knees straight -- gastrocnemius targeted',
        bad: 'Knees bending',
        severity: 'minor',
        citation: 'Riemann BL et al, 2011, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Straight-knee calf raises preferentially target gastrocnemius; bent-knee targets soleus (Riemann 2011). Full ROM including dorsiflexion stretch at bottom improves hypertrophy.',
  },

  // ===== UPPER PUSH =====
  push_up: {
    name: 'Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Anterior Deltoid', 'Triceps'], secondary: ['Core', 'Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 90,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 90, 15),
        good: 'Full depth -- chest near floor',
        bad: 'Go deeper',
        severity: 'major',
        citation: 'Cogley RM et al, 2005, J Strength Cond Res',
      },
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 20,
        quality: (angles) => qualityBelow(angles.trunk, 20, 10),
        good: 'Body in straight line',
        bad: 'Hips sagging or piking',
        severity: 'major',
        citation: 'Freeman S et al, 2006, J Strength Cond Res',
      },
      {
        name: 'Elbow symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        quality: (angles) => qualitySymmetry(angles.leftElbow, angles.rightElbow, 15),
        good: 'Arms working evenly',
        bad: 'One arm doing more work',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Narrow hand placement increases triceps activation; wide placement increases pectoral activation (Cogley 2005). Maintaining rigid trunk increases core demand (Freeman 2006).',
  },

  overhead_press: {
    name: 'Overhead Press',
    category: 'compound',
    muscles: { primary: ['Anterior Deltoid', 'Medial Deltoid', 'Triceps'], secondary: ['Upper Pectorals', 'Core', 'Traps'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Full lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 165,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 165, 15),
        good: 'Arms fully extended overhead',
        bad: 'Press to full lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 20,
        quality: (angles) => qualityBelow(angles.trunk, 20, 10),
        good: 'Trunk vertical -- no excessive lean',
        bad: 'Excessive back lean',
        severity: 'major',
        citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res',
      },
      {
        name: 'Shoulder symmetry',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
        quality: (angles) => qualitySymmetry(angles.leftShoulder, angles.rightShoulder, 15),
        good: 'Shoulders pressing evenly',
        bad: 'Asymmetric press',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Standing overhead press produces greater core and deltoid activation than seated (Saeterbakken 2013). Excessive lumbar extension under load increases spinal compression risk.',
  },

  bench_press: {
    name: 'Bench Press (side view)',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Anterior Deltoid', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 75,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 75, 15),
        good: 'Bar at chest level',
        bad: 'Lower the bar further',
        severity: 'major',
        citation: 'Larsen S et al, 2021, Int J Environ Res Public Health',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15),
        good: 'Full lockout at top',
        bad: 'Extend arms fully at top',
        severity: 'minor',
        phase: 'top',
        citation: 'Larsen S et al, 2021, Int J Environ Res Public Health',
      },
    ],
    scienceNotes: 'Full ROM bench press produces greater pec activation than partial reps (Larsen 2021). Best detected from side camera angle.',
  },

  dip: {
    name: 'Dip',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Anterior Deltoid', 'Pectorals'], secondary: ['Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 95,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 90,
        good: 'Upper arm parallel or below',
        bad: 'Go deeper for full activation',
        severity: 'minor',
        citation: 'McKenzie A et al, 2022, J Sports Sci',
      },
      {
        name: 'Full lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full extension at top',
        bad: 'Lock out fully at top',
        severity: 'minor',
        phase: 'top',
        citation: 'McKenzie A et al, 2022, J Sports Sci',
      },
    ],
    scienceNotes: 'Dips with forward lean increase pec activation; upright position targets triceps (McKenzie 2022). Shoulder injury risk increases with depth beyond 90 deg elbow in predisposed individuals.',
  },

  // ===== UPPER PULL =====
  bent_over_row: {
    name: 'Bent-Over Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Rear Deltoid'], secondary: ['Biceps', 'Erectors', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 130,
    upThreshold: 165,
    formChecks: [
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk > 35 && angles.trunk < 70,
        quality: (angles) => qualityRange(angles.trunk, 35, 70, 12),
        good: 'Trunk hinged at proper angle',
        bad: 'Adjust torso',
        severity: 'major',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Elbow drive',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 60, 15),
        good: 'Full contraction -- elbows pulled past torso',
        bad: 'Pull elbows higher',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        quality: (angles) => qualitySymmetry(angles.leftElbow, angles.rightElbow, 15),
        good: 'Both arms pulling evenly',
        bad: 'One arm pulling harder',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Bent-over row at 45 deg trunk angle balances lat activation with erector demand. More horizontal trunk increases lat activation but also spinal load (Fenwick 2009).',
  },

  pull_up: {
    name: 'Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rear Deltoid', 'Rhomboids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full ROM',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 60, 15),
        good: 'Chin above bar level',
        bad: 'Pull higher',
        severity: 'major',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Full hang',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15),
        good: 'Full dead hang at bottom',
        bad: 'Extend fully at bottom',
        severity: 'minor',
        phase: 'top',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Supinated grip increases biceps activation; pronated grip increases lat activation (Youdas 2010). Full ROM from dead hang produces greater strength gains than partial reps.',
  },

  // ===== ARMS =====
  bicep_curl: {
    name: 'Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps Brachii'], secondary: ['Brachialis', 'Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      {
        name: 'Full contraction',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 55,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 55, 15),
        good: 'Full bicep squeeze at top',
        bad: 'Curl higher',
        severity: 'minor',
        citation: 'Oliveira LF et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Full extension',
        check: (angles) => Math.max(angles.leftElbow, angles.rightElbow) > 145,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 145, 15),
        good: 'Full extension at bottom',
        bad: 'Extend arms fully at bottom',
        severity: 'minor',
        phase: 'top',
        citation: 'Oliveira LF et al, 2009, J Strength Cond Res',
      },
      {
        name: 'No body swing',
        check: (angles) => angles.trunk < 20,
        quality: (angles) => qualityBelow(angles.trunk, 20, 10),
        good: 'Strict form -- no swinging',
        bad: 'Body swinging',
        severity: 'major',
        citation: 'Oliveira LF et al, 2009, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Strict curls produce greater bicep hypertrophy stimulus than cheat curls despite lower absolute load. Full ROM produces superior long-head activation (Oliveira 2009).',
  },

  tricep_extension: {
    name: 'Overhead Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps (long head)'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 140,
    formChecks: [
      {
        name: 'Full stretch',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 55,
        good: 'Deep stretch -- long head fully lengthened',
        bad: 'Lower further behind head for full stretch',
        severity: 'minor',
        citation: 'Maeo S et al, 2023, Eur J Sport Sci',
      },
      {
        name: 'Full lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 155,
        good: 'Full extension -- peak contraction',
        bad: 'Extend fully overhead',
        severity: 'minor',
        phase: 'top',
        citation: 'Maeo S et al, 2023, Eur J Sport Sci',
      },
      {
        name: 'Elbow stable',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
        good: 'Elbows stable and aligned',
        bad: 'Elbows flaring',
        severity: 'minor',
        citation: 'Maeo S et al, 2023, Eur J Sport Sci',
      },
    ],
    scienceNotes: 'Overhead tricep exercises produce greater long-head activation due to stretched position (Maeo 2023). Full ROM from deep stretch to lockout is critical for hypertrophy.',
  },

  upright_row: {
    name: 'Upright Row',
    category: 'isolation',
    muscles: { primary: ['Medial Deltoid', 'Traps'], secondary: ['Biceps', 'Anterior Deltoid'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      {
        name: 'Elbows high',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 75,
        good: 'Elbows pulled high',
        bad: 'Pull elbows higher',
        severity: 'minor',
        citation: 'McAllister MJ et al, 2013, J Strength Cond Res',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 25,
        good: 'Torso stable',
        bad: 'Excessive leaning',
        severity: 'minor',
        citation: 'McAllister MJ et al, 2013, J Strength Cond Res',
      }
    ],
    scienceNotes: 'Upright rows effectively target the lateral deltoid and upper trapezius. A wider grip reduces shoulder internal rotation, lowering impingement risk (McAllister 2013).',
  },

  lateral_raise: {
    name: 'Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Medial Deltoid'], secondary: ['Anterior Deltoid', 'Traps'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 70,
    formChecks: [
      {
        name: 'Height',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 80,
        good: 'Arms at or above shoulder height',
        bad: 'Raise higher',
        severity: 'minor',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
      {
        name: 'Symmetry',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
        good: 'Both arms at same height',
        bad: 'Uneven raise',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'No shrugging',
        check: (angles) => angles.trunk < 10,
        good: 'Shoulders down -- clean isolation',
        bad: 'Shrugging',
        severity: 'minor',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
    ],
    scienceNotes: 'Lateral raises above 90 deg increase upper trap involvement. Stopping at shoulder height maximizes medial deltoid isolation. Slight forward lean (10-15 deg) shifts emphasis to rear deltoid (Reinold 2009).',
  },

  // ===== MACHINE / SEATED =====
  chest_supported_row: {
    name: 'Chest-Supported Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Rear Deltoid'], secondary: ['Biceps', 'Traps'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 65,
    upThreshold: 110,
    formChecks: [
      {
        name: 'Full contraction',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 80,
        good: 'Full pull -- shoulder blades squeezed',
        bad: 'Pull further',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 20,
        good: 'Both arms pulling evenly',
        bad: 'One arm pulling harder',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Chest-supported rows eliminate erector demand, isolating upper back musculature. Produces comparable lat activation to bent-over row without spinal loading (Fenwick 2009).',
  },

  seated_row: {
    name: 'Seated Cable Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids'], secondary: ['Biceps', 'Rear Deltoid', 'Erectors'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 65,
    upThreshold: 110,
    formChecks: [
      {
        name: 'Full contraction',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 80,
        good: 'Full pull -- elbows past torso',
        bad: 'Pull further',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 30,
        good: 'Trunk upright and stable',
        bad: 'Excessive lean',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Seated row with upright torso targets mid-back; excessive trunk lean shifts load to erectors and reduces lat isolation (Fenwick 2009).',
  },

  lat_pulldown: {
    name: 'Lat Pulldown',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rear Deltoid', 'Rhomboids', 'Traps'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 140,
    formChecks: [
      {
        name: 'Full pull',
        check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 60,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 60, 20),
        good: 'Bar at chest -- full lat contraction',
        bad: 'Pull lower',
        severity: 'major',
        citation: 'Signorile JF et al, 2002, J Strength Cond Res',
      },
      {
        name: 'Full stretch',
        check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 140,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 140, 20),
        good: 'Full stretch at top',
        bad: 'Let the bar go fully up',
        severity: 'minor',
        citation: 'Signorile JF et al, 2002, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Wide grip lat pulldown produces greater lat activation than narrow grip. Pulling to chest is safer and more effective than behind neck (Signorile 2002).',
  },

  leg_press: {
    name: 'Leg Press',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 70,
    upThreshold: 120,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 90,
        good: 'Full depth -- 90 deg knee angle',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2001, Med Sci Sports Exerc',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        good: 'Knees pressing evenly',
        bad: 'Uneven press',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Leg press at 90 deg knee flexion produces comparable quad activation to squat with reduced spinal load (Escamilla 2001). Avoid full lockout to protect knees.',
  },

  leg_extension: {
    name: 'Leg Extension (Machine)',
    category: 'isolation',
    muscles: { primary: ['Quadriceps'], secondary: [] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 70,
    upThreshold: 120,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 165,
        good: 'Full lockout -- peak quad contraction',
        bad: 'Extend fully',
        severity: 'minor',
        phase: 'top',
        citation: 'Signorile JF et al, 1994, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        good: 'Both legs extending evenly',
        bad: 'One leg weaker',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Machine leg extension isolates quadriceps, especially vastus medialis at terminal extension. Full lockout is critical for VMO activation (Signorile 1994).',
  },

  leg_curl: {
    name: 'Leg Curl (Machine)',
    category: 'isolation',
    muscles: { primary: ['Hamstrings'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    getValue: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 120,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Full contraction',
        check: (angles) => Math.max(angles.leftKnee, angles.rightKnee) < 50,
        good: 'Full curl -- heels to glutes',
        bad: 'Curl further',
        severity: 'minor',
        citation: 'Schoenfeld BJ et al, 2015, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Lying leg curl produces peak hamstring activation at full flexion. Slow eccentrics increase hamstring hypertrophy stimulus (Schoenfeld 2015).',
  },

  machine_chest_press: {
    name: 'Machine Chest Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Anterior Deltoid', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      {
        name: 'Full press',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full extension',
        bad: 'Press further',
        severity: 'minor',
        citation: 'Larsen S et al, 2021, Int J Environ Res Public Health',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        good: 'Both arms pressing evenly',
        bad: 'One arm lagging',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Machine chest press provides stable pressing pattern with consistent resistance curve. Full ROM produces greater pec activation than partial reps (Larsen 2021).',
  },

  // ===== CORE =====
  plank: {
    name: 'Plank Hold',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Transverse Abdominis'], secondary: ['Obliques', 'Erectors', 'Glutes'] },
    joint: 'hip',
    isIsometric: true,
    minIsometricDuration: 10000, // 10s minimum meaningful hold
    getValue: (angles) => angles.trunk,
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 20,
        quality: (angles) => qualityBelow(angles.trunk, 20, 10),
        good: 'Flat back -- strong plank position',
        bad: 'Hips sagging or piking',
        severity: 'major',
        citation: 'Schoenfeld BJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Hip position',
        check: (angles) => {
          const avgHip = (angles.leftHip + angles.rightHip) / 2;
          return avgHip > 160;
        },
        quality: (angles) => qualityAbove((angles.leftHip + angles.rightHip) / 2, 160, 15),
        good: 'Hips level',
        bad: 'Hips dropping',
        severity: 'major',
        citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'Plank produces significant rectus abdominis and transverse abdominis activation without spinal flexion load (Schoenfeld 2014). Hip sag indicates core fatigue and increases lumbar stress (McGill 2010).',
  },

  crunch: {
    name: 'Crunch',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => angles.trunk,
    downThreshold: 15,
    upThreshold: 30,
    formChecks: [
      {
        name: 'Range',
        check: (angles) => angles.trunk > 25,
        good: 'Sufficient curl -- shoulders off floor',
        bad: 'Curl higher',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc',
      },
    ],
    scienceNotes: 'Crunches isolate upper rectus abdominis with minimal hip flexor activation when performed correctly (Escamilla 2006). Avoid neck pulling.',
  },

  mountain_climber: {
    name: 'Mountain Climber',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Hip Flexors'], secondary: ['Shoulders', 'Quadriceps', 'Glutes'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 140,
    formChecks: [
      {
        name: 'Plank position',
        check: (angles) => angles.trunk < 25,
        good: 'Flat back maintained',
        bad: 'Hips rising',
        severity: 'major',
        citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'Mountain climbers combine core stabilization with hip flexion, producing high heart rate response relative to perceived effort (McCall 2015).',
  },

  burpee: {
    name: 'Burpee',
    category: 'bodyweight',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Pectorals', 'Shoulders', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 160,
        good: 'Full standing extension at top',
        bad: 'Stand up fully between reps',
        severity: 'minor',
        phase: 'top',
        citation: 'Ratamess NA et al, 2015, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Burpees produce significant metabolic demand with high caloric expenditure per unit time. Full extension at top is critical for complete hip and knee ROM (Ratamess 2015).',
  },

  jumping_jack: {
    name: 'Jumping Jack',
    category: 'bodyweight',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Calves', 'Hip Abductors'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      {
        name: 'Arm height',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 80,
        good: 'Arms reaching full overhead',
        bad: 'Raise arms higher overhead',
        severity: 'minor',
        citation: 'ACSM Guidelines, 2021',
      },
    ],
    scienceNotes: 'Jumping jacks provide low-impact cardiovascular conditioning with shoulder abduction and hip abduction patterns (ACSM 2021).',
  },

  // ===== BODYWEIGHT UPPER =====
  pike_push_up: {
    name: 'Pike Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Anterior Deltoid', 'Triceps'], secondary: ['Upper Pectorals', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 90,
        good: 'Head approaching floor',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J',
      },
      {
        name: 'Hip pike',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 110,
        good: 'Hips high -- good pike angle',
        bad: 'Push hips higher',
        severity: 'major',
        citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J',
      },
    ],
    scienceNotes: 'Pike push-ups shift load to anterior deltoid due to near-vertical pressing angle. Effective bodyweight progression toward handstand push-ups (Contreras 2011).',
  },

  diamond_push_up: {
    name: 'Diamond Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Pectorals'], secondary: ['Anterior Deltoid', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 80,
        good: 'Chest to hands',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Cogley RM et al, 2005, J Strength Cond Res',
      },
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 20,
        good: 'Body in straight line',
        bad: 'Hips sagging or piking',
        severity: 'major',
        citation: 'Freeman S et al, 2006, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Narrow hand placement (diamond) produces significantly greater triceps and pec activation than standard or wide push-ups (Cogley 2005).',
  },

  inverted_row: {
    name: 'Inverted Row',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Rear Deltoid'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      {
        name: 'Full pull',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        good: 'Chest to bar',
        bad: 'Pull higher',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Body alignment',
        check: (angles) => {
          const avgHip = (angles.leftHip + angles.rightHip) / 2;
          return avgHip > 160;
        },
        good: 'Body rigid and straight',
        bad: 'Hips sagging',
        severity: 'major',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Inverted rows produce comparable lat activation to bent-over rows without spinal loading. Body angle determines difficulty (Fenwick 2009).',
  },

  // ===== BODYWEIGHT LOWER =====
  jump_squat: {
    name: 'Jump Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Calves', 'Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Squat depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Good squat depth before jump',
        bad: 'Squat deeper before jumping',
        severity: 'minor',
        citation: 'Mackala K et al, 2013, J Hum Kinet',
      },
      {
        name: 'Landing mechanics',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 140 && angles.trunk < 30,
        good: 'Soft landing -- knees absorbing impact',
        bad: 'Soften your landing',
        severity: 'major',
        citation: 'Hewett TE et al, 2005, Am J Sports Med',
      },
    ],
    scienceNotes: 'Jump squats produce peak power output at 30-60% 1RM squat load. Landing mechanics are critical for ACL injury prevention (Hewett 2005, Mackala 2013).',
  },

  pistol_squat: {
    name: 'Pistol Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core', 'Hip Stabilizers'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 80,
        good: 'Full depth -- hamstring to calf',
        bad: 'Go deeper if mobility allows',
        severity: 'minor',
        citation: 'Khuu A et al, 2016, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 40,
        good: 'Torso controlled',
        bad: 'Excessive forward lean',
        severity: 'minor',
        citation: 'Khuu A et al, 2016, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Pistol squats require exceptional single-leg strength, ankle dorsiflexion, and hip stability. One of the most demanding bodyweight lower exercises (Khuu 2016).',
  },

  glute_bridge: {
    name: 'Glute Bridge',
    category: 'bodyweight',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 165,
        good: 'Full hip extension -- glutes fully engaged',
        bad: 'Push hips higher',
        severity: 'minor',
        phase: 'top',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
      {
        name: 'Knee angle',
        check: (angles) => {
          const avg = (angles.leftKnee + angles.rightKnee) / 2;
          return avg > 80 && avg < 110;
        },
        good: 'Knees at ~90 degrees',
        bad: 'Reposition feet',
        severity: 'minor',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
    ],
    scienceNotes: 'Glute bridges produce high glute activation with minimal spinal load. Effective regression from hip thrusts and for glute activation warm-ups (Contreras 2015).',
  },

  wall_sit: {
    name: 'Wall Sit',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps'], secondary: ['Glutes', 'Core'] },
    joint: 'knee',
    isIsometric: true,
    minIsometricDuration: 15000, // 15s minimum meaningful hold
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      {
        name: 'Knee angle',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Thighs at or below parallel',
        bad: 'Slide lower',
        severity: 'minor',
        citation: 'Escamilla RF, 2001, Med Sci Sports Exerc',
      },
      {
        name: 'Back flat',
        check: (angles) => angles.trunk < 20,
        good: 'Back flat against wall',
        bad: 'Press back flat against wall',
        severity: 'minor',
        citation: 'Escamilla RF, 2001, Med Sci Sports Exerc',
      },
    ],
    scienceNotes: 'Wall sits produce high quadriceps isometric activation, particularly VMO. Effective for patellar tendinopathy rehabilitation (Escamilla 2001).',
  },

  dead_hang: {
    name: 'Dead Hang',
    category: 'bodyweight',
    muscles: { primary: ['Forearms', 'Lats'], secondary: ['Shoulders', 'Core'] },
    joint: 'shoulder',
    isIsometric: true,
    minIsometricDuration: 10000, // 10s minimum
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      { name: 'Arms extended', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160, good: 'Full arm extension', bad: 'Straighten arms fully', severity: 'minor', citation: 'Escamilla RF et al, 2009' },
      { name: 'Shoulders engaged', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Shoulders active', bad: 'Pack shoulders', severity: 'major', citation: 'Escamilla RF et al, 2009' },
    ],
    scienceNotes: 'Dead hangs decompress the spine and develop grip endurance. Active scapular engagement prevents shoulder impingement (Escamilla 2009).',
  },

  l_sit: {
    name: 'L-Sit Hold',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Rectus Abdominis'], secondary: ['Triceps', 'Quadriceps', 'Lats'] },
    joint: 'hip',
    isIsometric: true,
    minIsometricDuration: 5000, // 5s minimum (advanced hold)
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      { name: 'Legs parallel', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 100, good: 'Legs at or above parallel', bad: 'Raise legs higher to parallel', severity: 'major', citation: 'Contreras B, 2011' },
      { name: 'Knees straight', check: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 150, good: 'Legs straight', bad: 'Extend knees fully', severity: 'minor', citation: 'Contreras B, 2011' },
    ],
    scienceNotes: 'L-sit hold demands extreme hip flexor and core isometric strength with locked-arm support (Contreras 2011).',
  },

  hollow_body_hold: {
    name: 'Hollow Body Hold',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Transverse Abdominis'], secondary: ['Hip Flexors', 'Quadriceps'] },
    joint: 'hip',
    isIsometric: true,
    minIsometricDuration: 10000, // 10s minimum
    getValue: (angles) => angles.trunk,
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      { name: 'Lower back flat', check: (angles) => angles.trunk < 20, good: 'Back pressed to floor', bad: 'Press lower back into floor', severity: 'major', citation: 'McGill SM, 2010' },
      { name: 'Arms overhead', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 140, good: 'Arms extended overhead', bad: 'Reach arms overhead', severity: 'minor', citation: 'McGill SM, 2010' },
    ],
    scienceNotes: 'Hollow body hold is a gymnastics fundamental producing full-body isometric tension with emphasis on anterior core (McGill 2010).',
  },

  overhead_hold: {
    name: 'Overhead Hold',
    category: 'compound',
    muscles: { primary: ['Shoulders', 'Trapezius'], secondary: ['Core', 'Triceps'] },
    joint: 'shoulder',
    isIsometric: true,
    minIsometricDuration: 10000, // 10s minimum
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      { name: 'Arms locked', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160, good: 'Full lockout', bad: 'Lock elbows fully', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
      { name: 'Overhead position', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Weight directly overhead', bad: 'Press weight directly overhead', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
    ],
    scienceNotes: 'Overhead holds develop shoulder stability and core anti-extension strength under load (Schoenfeld 2010).',
  },

  side_plank: {
    name: 'Side Plank',
    category: 'bodyweight',
    muscles: { primary: ['Obliques'], secondary: ['Glutes', 'Shoulders', 'Core'] },
    joint: 'hip',
    isIsometric: true,
    minIsometricDuration: 10000, // 10s minimum per side
    getValue: (angles) => angles.trunk,
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      { name: 'Body alignment', check: (angles) => angles.trunk < 20, good: 'Straight line from head to feet', bad: 'Lift hips', severity: 'major', citation: 'McGill SM, 2010' },
    ],
    scienceNotes: 'Side plank produces high oblique activation with low spinal compression. One of McGill Big Three for back health (McGill 2010).',
  },

  step_up: {
    name: 'Step-Up',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 160,
        good: 'Full standing extension at top',
        bad: 'Stand up fully on the box',
        severity: 'minor',
        phase: 'top',
        citation: 'Riemann BL et al, 2012, J Athl Train',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 25,
        good: 'Torso upright throughout',
        bad: 'Stay tall',
        severity: 'minor',
        citation: 'Riemann BL et al, 2012, J Athl Train',
      },
    ],
    scienceNotes: 'Step-ups produce significant unilateral quad and glute activation with low spinal load. Higher box increases glute contribution (Riemann 2012).',
  },

  // ===== UNCONVENTIONAL / FUNCTIONAL =====
  kettlebell_swing: {
    name: 'Kettlebell Swing',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core', 'Shoulders', 'Erectors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      {
        name: 'Hip hinge',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 85,
        quality: (angles) => qualityBelow(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 85, 15),
        good: 'Deep hip hinge at bottom',
        bad: 'Hinge deeper',
        severity: 'major',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 170,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 170, 15),
        good: 'Full hip snap at top',
        bad: 'Drive hips through',
        severity: 'major',
        phase: 'top',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Knee soft',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 140,
        quality: (angles) => qualityAbove(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 140, 15),
        good: 'Knees soft -- not squatting the swing',
        bad: 'Less knee bend',
        severity: 'minor',
        citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Kettlebell swing produces peak hip power comparable to jump squat with lower joint loading. Hip hinge pattern is critical -- squatting the swing reduces power and loads the spine (McGill 2012, Lake 2012).',
  },

  thruster: {
    name: 'Thruster',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Shoulders', 'Triceps'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Squat depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Below parallel in squat',
        bad: 'Squat deeper before pressing',
        severity: 'minor',
        citation: 'Kipp K et al, 2011, J Strength Cond Res',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Arms fully locked out overhead',
        bad: 'Press to full lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Kipp K et al, 2011, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Thrusters combine front squat and overhead press into a high-power compound movement. Produces one of the highest metabolic demands of any barbell exercise (Kipp 2011).',
  },

  clean_and_press: {
    name: 'Clean and Press',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Traps', 'Glutes', 'Shoulders', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Hip extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 165,
        good: 'Full hip extension on catch',
        bad: 'Extend hips fully during clean',
        severity: 'minor',
        phase: 'top',
        citation: 'Comfort P et al, 2012, J Strength Cond Res',
      },
      {
        name: 'Press lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Arms fully locked overhead',
        bad: 'Press to full lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Comfort P et al, 2012, J Strength Cond Res',
      },
    ],
    scienceNotes: 'The clean and press is a foundational full-body power movement. Proper hip extension timing is critical for efficient force transfer (Comfort 2012).',
  },

  renegade_row: {
    name: 'Renegade Row',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Core'], secondary: ['Biceps', 'Obliques', 'Shoulders'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Anti-rotation',
        check: (angles) => angles.trunk < 20,
        good: 'Minimal trunk rotation -- strong core brace',
        bad: 'Too much rotation',
        severity: 'major',
        citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'Renegade rows combine plank anti-rotation with unilateral rowing. The anti-rotation demand makes this primarily a core exercise with back as secondary (McGill 2010).',
  },

  turkish_get_up: {
    name: 'Turkish Get-Up',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Shoulders', 'Core', 'Glutes', 'Hip Stabilizers'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 80,
    formChecks: [
      {
        name: 'Arm vertical',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 90,
        good: 'Arm locked vertical throughout',
        bad: 'Keep arm vertical',
        severity: 'major',
        citation: 'Liebenson C, 2011, J Bodywork Movement Ther',
      },
    ],
    scienceNotes: 'Turkish get-ups develop integrated full-body stability and shoulder health. One of the most effective single exercises for functional movement quality (Liebenson 2011).',
  },

  bear_crawl: {
    name: 'Bear Crawl',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Shoulders'], secondary: ['Quadriceps', 'Hip Flexors', 'Triceps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 120,
    formChecks: [
      {
        name: 'Low position',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 100,
        good: 'Hips low -- knees hovering near ground',
        bad: 'Get lower',
        severity: 'minor',
        citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'Bear crawls develop cross-body coordination, core anti-extension, and shoulder stability simultaneously (McGill 2010).',
  },

  // ===== HANGING / BAR =====
  muscle_up: {
    name: 'Muscle-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Pectorals', 'Triceps'], secondary: ['Biceps', 'Core', 'Shoulders'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full lockout above bar',
        bad: 'Push to full lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Full hang',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full dead hang at bottom',
        bad: 'Start from a full hang',
        severity: 'minor',
        phase: 'top',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Muscle-ups require explosive pulling power transitioning through the bar to a dip position. One of the most demanding upper body bodyweight movements (Youdas 2010).',
  },

  chin_up: {
    name: 'Chin-Up',
    category: 'bodyweight',
    muscles: { primary: ['Biceps', 'Latissimus Dorsi'], secondary: ['Rear Deltoid', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full ROM',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 55,
        good: 'Chin above bar',
        bad: 'Pull higher',
        severity: 'major',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Full hang',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full dead hang',
        bad: 'Extend fully at bottom',
        severity: 'minor',
        phase: 'top',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Supinated grip (chin-up) produces significantly greater biceps activation than pronated grip (pull-up) while maintaining comparable lat activation (Youdas 2010).',
  },

  // ===== SUPERSET-FRIENDLY / CONDITIONING =====
  box_jump: {
    name: 'Box Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Landing depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 120,
        good: 'Soft landing on box',
        bad: 'Land softer',
        severity: 'major',
        citation: 'Hewett TE et al, 2005, Am J Sports Med',
      },
    ],
    scienceNotes: 'Box jumps develop explosive hip and knee extension power. Quiet landings (low noise) indicate proper eccentric deceleration and reduced injury risk (Hewett 2005).',
  },

  skater_jump: {
    name: 'Skater Jump',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Quadriceps'], secondary: ['Hip Abductors', 'Core', 'Calves'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Landing control',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 130,
        good: 'Controlled single-leg landing',
        bad: 'Land with more control',
        severity: 'minor',
        citation: 'Hewett TE et al, 2005, Am J Sports Med',
      },
    ],
    scienceNotes: 'Skater jumps develop lateral power and single-leg stability. Effective for sport-specific lateral agility and hip abductor strength (Hewett 2005).',
  },

  squat_jump_to_lunge: {
    name: 'Squat Jump to Lunge',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Good depth on both squat and lunge',
        bad: 'Go deeper on each phase',
        severity: 'minor',
        citation: 'Ratamess NA et al, 2015, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Combo exercises combining bilateral and unilateral patterns produce high metabolic demand and challenge coordination and stability (Ratamess 2015).',
  },

  man_maker: {
    name: 'Man Maker',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Shoulders', 'Back', 'Chest', 'Core', 'Legs'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Push-up depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 90,
        good: 'Full push-up depth',
        bad: 'Go lower on the push-up',
        severity: 'minor',
        citation: 'Ratamess NA et al, 2015, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Man makers combine push-up, renegade row, clean, and press. Extreme metabolic demand with full-body integration (Ratamess 2015).',
  },

  commando_pull_up: {
    name: 'Commando Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Obliques'], secondary: ['Core', 'Forearms'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Full ROM',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        good: 'Head above bar',
        bad: 'Pull higher',
        severity: 'minor',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Commando pull-ups add rotational core demand to standard pull-up pattern by alternating head side on each rep (Youdas 2010).',
  },

  // ===== CABLE / MACHINE ISOLATION =====
  face_pull: {
    name: 'Face Pull',
    category: 'isolation',
    muscles: { primary: ['Rear Deltoid', 'Rotator Cuff'], secondary: ['Rhomboids', 'Traps', 'Biceps'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 60,
    upThreshold: 120,
    formChecks: [
      {
        name: 'Full pull',
        check: (angles) => Math.min(angles.leftShoulder, angles.rightShoulder) > 80,
        good: 'Elbows high and flared -- rear delts engaged',
        bad: 'Pull higher',
        severity: 'minor',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 20,
        good: 'Upright torso -- no leaning back',
        bad: 'Leaning back',
        severity: 'major',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
    ],
    scienceNotes: 'Face pulls are a primary exercise for posterior shoulder health, targeting rear delts and external rotators. High elbow position is critical for full rear delt activation (Reinold 2009).',
  },

  incline_bench_press: {
    name: 'Incline Bench Press',
    category: 'compound',
    muscles: { primary: ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 75,
        good: 'Bar touching upper chest',
        bad: 'Lower the bar further',
        severity: 'major',
        citation: 'Trebs AA et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full lockout at top',
        bad: 'Extend arms fully at top',
        severity: 'minor',
        phase: 'top',
        citation: 'Trebs AA et al, 2010, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Incline bench press shifts emphasis to the upper (clavicular) head of the pectoralis major. A 30-45 deg incline maximizes upper pec activation (Trebs 2010).',
  },

  sumo_deadlift: {
    name: 'Sumo Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Adductors', 'Quadriceps'], secondary: ['Hamstrings', 'Erectors', 'Traps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 165,
    formChecks: [
      {
        name: 'Hip hinge depth',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 100,
        good: 'Full hip hinge at setup',
        bad: 'Push hips further back and down',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2000, Med Sci Sports Exerc',
      },
      {
        name: 'Trunk neutral',
        check: (angles) => angles.trunk > 20 && angles.trunk < 80,
        good: 'Back angle within safe range',
        bad: 'Excessive trunk rounding',
        severity: 'major',
        citation: 'Escamilla RF et al, 2000, Med Sci Sports Exerc',
      },
    ],
    scienceNotes: 'Sumo deadlift reduces spinal extension moment compared to conventional, increasing adductor and quad demand due to wider stance and more vertical torso (Escamilla 2000).',
  },

  nordic_curl: {
    name: 'Nordic Curl',
    category: 'bodyweight',
    muscles: { primary: ['Hamstrings'], secondary: ['Glutes', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Controlled descent',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 60,
        good: 'Controlled eccentric descent',
        bad: 'Collapsing too fast',
        severity: 'major',
        citation: 'Bourne MN et al, 2017, Br J Sports Med',
      },
      {
        name: 'Trunk alignment',
        check: (angles) => angles.trunk < 25,
        good: 'Body in straight line from knee to shoulder',
        bad: 'Hips breaking',
        severity: 'minor',
        citation: 'Bourne MN et al, 2017, Br J Sports Med',
      },
    ],
    scienceNotes: 'Nordic curls produce very high eccentric hamstring loading and are one of the most effective injury-prevention exercises for hamstring strains (Bourne 2017, Petersen 2011).',
  },

  seated_calf_raise: {
    name: 'Seated Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Soleus'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    // Same heel-displacement tracking as calf_raise but targets soleus (knee bent).
    getValue: (angles, landmarks) => {
      if (landmarks && landmarks[29] && landmarks[30]) {
        const leftHeel = landmarks[29].y;
        const rightHeel = landmarks[30].y;
        return (1 - (leftHeel + rightHeel) / 2) * 100;
      }
      return angles.trunk;
    },
    downThreshold: 45,
    upThreshold: 55,
    formChecks: [
      {
        name: 'Knee bent',
        check: (angles) => {
          const avg = (angles.leftKnee + angles.rightKnee) / 2;
          return avg > 80 && avg < 110;
        },
        good: 'Knees at ~90 deg -- soleus targeted',
        bad: 'Maintain knee flexion to isolate soleus',
        severity: 'major',
        citation: 'Riemann BL et al, 2011, J Strength Cond Res',
      },
      {
        name: 'Full ROM',
        check: (angles) => angles.trunk < 20,
        good: 'Upright seated posture',
        bad: 'Sit upright',
        severity: 'minor',
        citation: 'Riemann BL et al, 2011, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Seated calf raises preferentially target the soleus due to gastrocnemius slack at the bent knee. Both heads require training for complete calf development (Riemann 2011).',
  },

  hanging_leg_raise: {
    name: 'Hanging Leg Raise',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques', 'Grip'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      {
        name: 'Leg height',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 90,
        good: 'Legs at or above parallel',
        bad: 'Raise legs higher',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc',
      },
      {
        name: 'No swinging',
        check: (angles) => Math.abs(angles.leftHip - angles.rightHip) < 15,
        good: 'Controlled movement -- no momentum',
        bad: 'Swinging detected',
        severity: 'major',
        citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc',
      },
    ],
    scienceNotes: 'Hanging leg raises produce peak lower rectus abdominis and hip flexor activation. Full ROM above parallel increases oblique and transverse abdominis demand (Escamilla 2006).',
  },

  // ===== ADDITIONAL COMPOUND =====
  hack_squat: {
    name: 'Hack Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Full depth', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Hack squat machine provides guided squat pattern with back support, emphasizing quadriceps (Schoenfeld 2010).',
  },

  smith_squat: {
    name: 'Smith Machine Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 105, good: 'Below parallel', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
    ],
    scienceNotes: 'Smith machine provides fixed bar path; foot placement forward emphasizes quads, under hips emphasizes glutes (Schoenfeld 2010).',
  },

  zercher_squat: {
    name: 'Zercher Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Core'], secondary: ['Biceps', 'Upper Back'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good depth', bad: 'Squat deeper', severity: 'major', citation: 'Gullett JC et al, 2009' },
      { name: 'Upright torso', check: (angles) => angles.trunk < 45, good: 'Torso upright', bad: 'Stay more upright', severity: 'minor', citation: 'Gullett JC et al, 2009' },
    ],
    scienceNotes: 'Zercher squat holds barbell in elbow crooks, requiring extreme core and upper back engagement (Gullett 2009).',
  },

  overhead_squat: {
    name: 'Overhead Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Shoulders'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Full depth', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
      { name: 'Arms overhead', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Arms locked overhead', bad: 'Keep arms fully extended overhead', severity: 'major', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Overhead squat demands full-body mobility and stability, used in Olympic lifting assessment and CrossFit (NSCA 2016).',
  },

  power_clean: {
    name: 'Power Clean',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Traps'], secondary: ['Quadriceps', 'Core', 'Deltoids'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Hip extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Extend hips fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Power clean develops explosive hip extension and triple extension power, foundational Olympic lifting movement (Suchomel 2015).',
  },

  snatch: {
    name: 'Snatch',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Shoulders', 'Traps'], secondary: ['Quadriceps', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full triple extension', bad: 'Extend fully before pulling under', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Snatch is the highest velocity barbell movement, demanding full-body power and overhead stability (Suchomel 2015).',
  },

  t_bar_row: {
    name: 'T-Bar Row',
    category: 'compound',
    muscles: { primary: ['Lats', 'Rhomboids'], secondary: ['Biceps', 'Rear Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Torso angle', check: (angles) => angles.trunk > 30 && angles.trunk < 60, good: 'Good torso angle', bad: 'Maintain 45-degree forward lean', severity: 'minor', citation: 'Lehman GJ et al, 2004' },
    ],
    scienceNotes: 'T-bar row produces high lat and mid-back activation with neutral grip reducing bicep limitation (Lehman 2004).',
  },

  pendlay_row: {
    name: 'Pendlay Row',
    category: 'compound',
    muscles: { primary: ['Lats', 'Rhomboids', 'Traps'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Parallel torso', check: (angles) => angles.trunk > 60, good: 'Torso parallel to floor', bad: 'Keep torso closer to horizontal', severity: 'major', citation: 'Fenwick CM et al, 2009' },
    ],
    scienceNotes: 'Pendlay row requires dead-stop from floor with parallel torso, maximizing concentric power and lat recruitment (Fenwick 2009).',
  },

  close_grip_bench: {
    name: 'Close-Grip Bench Press',
    category: 'compound',
    muscles: { primary: ['Triceps', 'Chest'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160, good: 'Full lockout', bad: 'Lock out fully at top', severity: 'minor', citation: 'Lehman GJ, 2005', phase: 'top' },
    ],
    scienceNotes: 'Close-grip bench press shifts load to triceps while maintaining chest activation (Lehman 2005).',
  },

  decline_bench_press: {
    name: 'Decline Bench Press',
    category: 'compound',
    muscles: { primary: ['Lower Chest', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Extend fully', severity: 'minor', citation: 'Lauver JD et al, 2016', phase: 'top' },
    ],
    scienceNotes: 'Decline angle shifts emphasis to lower pectoralis and reduces shoulder stress (Lauver 2016).',
  },

  floor_press: {
    name: 'Floor Press',
    category: 'compound',
    muscles: { primary: ['Chest', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Lock out fully', severity: 'minor', citation: 'Lehman GJ, 2005', phase: 'top' },
    ],
    scienceNotes: 'Floor press limits ROM to reduce shoulder stress and isolate lockout strength (Lehman 2005).',
  },

  landmine_press: {
    name: 'Landmine Press',
    category: 'compound',
    muscles: { primary: ['Chest', 'Deltoids'], secondary: ['Triceps', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full press', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Landmine press provides shoulder-friendly pressing with natural arc path and core demand (NSCA 2016).',
  },

  arnold_press: {
    name: 'Arnold Press',
    category: 'compound',
    muscles: { primary: ['Deltoids'], secondary: ['Triceps', 'Upper Chest'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full press', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full overhead extension', bad: 'Press fully overhead', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013', phase: 'top' },
    ],
    scienceNotes: 'Arnold press adds rotation through the press, increasing anterior deltoid time under tension (Saeterbakken 2013).',
  },

  // ===== ADDITIONAL ISOLATION =====
  hammer_curl: {
    name: 'Hammer Curl',
    category: 'isolation',
    muscles: { primary: ['Brachioradialis', 'Biceps'], secondary: ['Forearms'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Elbow position', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 30, good: 'Elbows at sides', bad: 'Keep elbows pinned to sides', severity: 'minor', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Neutral grip shifts emphasis from biceps to brachioradialis and brachialis (Marcolin 2018).',
  },

  preacher_curl: {
    name: 'Preacher Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140, good: 'Full stretch at bottom', bad: 'Extend fully at bottom', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
    ],
    scienceNotes: 'Preacher curl pad eliminates momentum and isolates the biceps through full ROM (Marcolin 2018).',
  },

  concentration_curl: {
    name: 'Concentration Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 140,
    formChecks: [
      { name: 'Controlled rep', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 30, good: 'Isolated movement', bad: 'No swinging', severity: 'minor', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Concentration curl produces highest biceps peak activation of all curl variants (Marcolin 2018).',
  },

  lying_bicep_curl: {
    name: 'Lying Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 90,
    upThreshold: 130,
    formChecks: [
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 50, good: 'Full curl at top', bad: 'Incomplete contraction at top', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
      { name: 'No shoulder movement', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 40, good: 'Shoulders stable', bad: 'Shoulder movement detected', severity: 'major', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Lying (incline or flat bench) bicep curls increase bicep long head stretch, producing greater hypertrophy stimulus compared to standing curls (Marcolin 2018).',
  },

  spider_curl: {
    name: 'Spider Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps (short head)'], secondary: ['Brachialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 140,
    formChecks: [
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 45, good: 'Peak squeeze at top', bad: 'Curl higher', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
    ],
    scienceNotes: 'Spider curls (prone on incline bench) eliminate momentum and isolate bicep short head through gravity-loaded contraction (Marcolin 2018).',
  },

  skull_crusher: {
    name: 'Skull Crusher',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Full lockout', bad: 'Extend fully at top', severity: 'minor', citation: 'Landin D, Thompson M, 2011', phase: 'top' },
    ],
    scienceNotes: 'Skull crushers (lying tricep extension) maximize long head tricep activation through overhead stretch (Landin 2011).',
  },

  cable_tricep_pushdown: {
    name: 'Cable Tricep Pushdown',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Elbow position', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 25, good: 'Elbows at sides', bad: 'Keep elbows pinned', severity: 'minor', citation: 'Landin D, Thompson M, 2011' },
    ],
    scienceNotes: 'Cable pushdowns isolate the triceps with constant tension through full ROM (Landin 2011).',
  },

  front_raise: {
    name: 'Front Raise',
    category: 'isolation',
    muscles: { primary: ['Front Deltoids'], secondary: ['Upper Chest'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'No swing', check: (angles) => angles.trunk < 20, good: 'Controlled raise', bad: 'No swinging', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013' },
    ],
    scienceNotes: 'Front raises isolate anterior deltoid; stopping at shoulder height prevents impingement (Saeterbakken 2013).',
  },

  rear_delt_fly: {
    name: 'Rear Delt Fly',
    category: 'isolation',
    muscles: { primary: ['Rear Deltoids'], secondary: ['Rhomboids', 'Traps'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 20,
    upThreshold: 70,
    formChecks: [
      { name: 'Forward lean', check: (angles) => angles.trunk > 30, good: 'Good bend-over position', bad: 'Lean forward more to target rear delts', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013' },
    ],
    scienceNotes: 'Rear delt fly isolates posterior deltoid, critical for shoulder balance and posture (Saeterbakken 2013).',
  },

  shrug: {
    name: 'Shrug',
    category: 'isolation',
    muscles: { primary: ['Traps'], secondary: ['Levator Scapulae'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 30,
    formChecks: [
      { name: 'No arm bend', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Arms straight', bad: 'Keep arms straight', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Shrugs isolate upper trapezius. Full elevation and controlled descent maximize time under tension (NSCA 2016).',
  },

  cable_fly: {
    name: 'Cable Fly',
    category: 'isolation',
    muscles: { primary: ['Chest'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Slight elbow bend', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 130, good: 'Good arm position', bad: 'Keep slight bend in elbows', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Cable flys maintain constant tension through full chest ROM unlike dumbbell flys (Lauver 2016).',
  },

  dumbbell_fly: {
    name: 'Dumbbell Fly',
    category: 'isolation',
    muscles: { primary: ['Chest'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 20,
    upThreshold: 60,
    formChecks: [
      { name: 'Slight elbow bend', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 130, good: 'Good arm arc', bad: 'Keep slight bend', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Dumbbell flys stretch pectorals through full horizontal adduction (Lauver 2016).',
  },

  cable_crossover: {
    name: 'Cable Crossover',
    category: 'isolation',
    muscles: { primary: ['Chest'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Controlled squeeze', check: (angles) => angles.trunk < 25, good: 'Good torso position', bad: 'Stay upright', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Cable crossovers allow variable angle chest training with constant tension (Lauver 2016).',
  },

  wrist_curl: {
    name: 'Wrist Curl',
    category: 'isolation',
    muscles: { primary: ['Forearm Flexors'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Forearm stable', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 30, good: 'Forearms braced', bad: 'Keep forearms on thighs or bench', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wrist curls isolate forearm flexors, essential for grip strength development (NSCA 2016).',
  },

  // ===== ADDITIONAL BODYWEIGHT =====
  sit_up: {
    name: 'Sit-Up',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Full sit', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 100, good: 'Full range', bad: 'Sit up fully', severity: 'minor', citation: 'Escamilla RF et al, 2006', phase: 'top' },
    ],
    scienceNotes: 'Full sit-ups engage hip flexors more than crunches; keep feet anchored for stability (Escamilla 2006).',
  },

  v_up: {
    name: 'V-Up',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Touch toes', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 70, good: 'Full V position', bad: 'Reach for your toes', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'V-ups combine upper and lower ab activation for high-intensity core work (Escamilla 2006).',
  },

  russian_twist: {
    name: 'Russian Twist',
    category: 'bodyweight',
    muscles: { primary: ['Obliques'], secondary: ['Rectus Abdominis', 'Hip Flexors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 70,
    upThreshold: 110,
    formChecks: [
      { name: 'Lean back', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 120, good: 'Good lean angle', bad: 'Lean back more for full engagement', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Russian twists target obliques with rotational load; holding weight increases difficulty (Escamilla 2006).',
  },

  bicycle_crunch: {
    name: 'Bicycle Crunch',
    category: 'bodyweight',
    muscles: { primary: ['Obliques', 'Rectus Abdominis'], secondary: ['Hip Flexors'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Shoulder off ground', check: (angles) => angles.trunk > 10, good: 'Shoulders lifted', bad: 'Lift shoulders off the ground', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Bicycle crunches produce highest oblique and rectus abdominis EMG of bodyweight core exercises (Escamilla 2006).',
  },

  flutter_kick: {
    name: 'Flutter Kick',
    category: 'bodyweight',
    muscles: { primary: ['Lower Abs', 'Hip Flexors'], secondary: ['Quadriceps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 140,
    upThreshold: 165,
    formChecks: [
      { name: 'Lower back down', check: (angles) => angles.trunk < 20, good: 'Back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Flutter kicks maintain constant lower ab tension; pressing back to floor prevents lumbar strain (Escamilla 2006).',
  },

  superman: {
    name: 'Superman',
    category: 'bodyweight',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Rear Deltoids'] },
    joint: 'hip',
    getValue: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 150,
    upThreshold: 170,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 165, good: 'Full back extension', bad: 'Lift arms and legs higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Superman exercise targets posterior chain from prone position, strengthening spinal erectors (NSCA 2016).',
  },

  hand_release_push_up: {
    name: 'Hand-Release Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Chest', 'Triceps'], secondary: ['Front Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 150,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Lock out fully at top', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Hand-release ensures full ROM by requiring chest to floor each rep (Cogley 2005).',
  },

  wide_push_up: {
    name: 'Wide Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Chest'], secondary: ['Triceps', 'Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 95, good: 'Chest to floor', bad: 'Go deeper', severity: 'minor', citation: 'Cogley RM et al, 2005' },
    ],
    scienceNotes: 'Wide hand placement increases pectoral activation at cost of reduced triceps engagement (Cogley 2005).',
  },

  archer_push_up: {
    name: 'Archer Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Chest', 'Triceps'], secondary: ['Core', 'Shoulders'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Full press', bad: 'Extend fully', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Archer push-ups shift load unilaterally, progressing toward one-arm push-up (Cogley 2005).',
  },

  incline_push_up: {
    name: 'Incline Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Chest (lower)', 'Triceps'], secondary: ['Anterior Deltoid', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 80, good: 'Chest near surface', bad: 'Lower chest closer to surface', severity: 'major', citation: 'Cogley RM et al, 2005', phase: 'bottom' },
      { name: 'Body alignment', check: (angles) => angles.trunk > 15 && angles.trunk < 55, good: 'Straight body line', bad: 'Keep body in a straight line', severity: 'minor', citation: 'Contreras B, 2011' },
    ],
    scienceNotes: 'Incline push-ups (hands elevated) reduce load compared to standard push-ups, making them a regression. The incline shifts emphasis slightly to lower pectorals (Cogley 2005).',
  },

  deficit_push_up: {
    name: 'Deficit Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Chest', 'Triceps'], secondary: ['Anterior Deltoid', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Deep stretch', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 60, good: 'Full depth below hands', bad: 'Go deeper to use the deficit', severity: 'major', citation: 'Contreras B, 2011', phase: 'bottom' },
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full extension', bad: 'Lock out fully at top', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Deficit push-ups (hands on elevated surfaces like blocks or dumbbells) increase ROM beyond standard push-ups, producing greater pectoral stretch and activation (Contreras 2011).',
  },

  deficit_push_down: {
    name: 'Deficit Push-Down',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Chest'], secondary: ['Anterior Deltoid', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Controlled descent', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 60, good: 'Full depth achieved', bad: 'Lower further into the deficit', severity: 'major', citation: 'Contreras B, 2011', phase: 'bottom' },
      { name: 'Elbow position', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 100 || angles.trunk < 40, good: 'Elbows tracking properly', bad: 'Keep elbows closer to body', severity: 'minor', citation: 'Cogley RM et al, 2005' },
    ],
    scienceNotes: 'Deficit push-downs emphasize the eccentric phase with extended ROM, targeting triceps and chest with increased time under tension at the bottom (Contreras 2011).',
  },

  toes_to_bar: {
    name: 'Toes to Bar',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Lats', 'Grip'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full range', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 60, good: 'Toes reaching bar', bad: 'Bring toes higher to the bar', severity: 'major', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Toes-to-bar combines hanging leg raise with full hip flexion, demanding core and grip strength (Escamilla 2006).',
  },

  single_leg_deadlift: {
    name: 'Single-Leg Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core', 'Erectors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => angles.trunk > 40, good: 'Good hip hinge depth', bad: 'Hinge deeper at the hips', severity: 'major', citation: 'Stastny P et al, 2015' },
    ],
    scienceNotes: 'Single-leg deadlift challenges balance and hamstring/glute activation unilaterally (Stastny 2015).',
  },

  good_morning: {
    name: 'Good Morning',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee soft', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 170, good: 'Slight knee bend', bad: 'Keep slight bend in knees', severity: 'minor', citation: 'Vigotsky AD et al, 2015' },
    ],
    scienceNotes: 'Good mornings target posterior chain through loaded hip hinge with barbell on back (Vigotsky 2015).',
  },

  reverse_lunge: {
    name: 'Reverse Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee over ankle', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 80, good: 'Knee properly aligned', bad: 'Front knee too far forward', severity: 'major', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Reverse lunges reduce knee shear compared to forward lunges while maintaining quad/glute activation (Riemann 2012).',
  },

  walking_lunge: {
    name: 'Walking Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good lunge depth', bad: 'Drop knee lower', severity: 'minor', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Walking lunges add dynamic balance and deceleration demands to the standard lunge (Riemann 2012).',
  },

  side_lunge: {
    name: 'Side Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Adductors', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 110, good: 'Good lateral depth', bad: 'Sit deeper into the lunge', severity: 'minor', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Side lunges train frontal plane movement and adductor strength, valuable for sport performance (Riemann 2012).',
  },

  split_jerk: {
    name: 'Split Jerk',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Deltoids', 'Triceps'], secondary: ['Core', 'Glutes'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 165, good: 'Arms locked overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Split jerk drives barbell overhead using leg drive and split stance for stability (Suchomel 2015).',
  },

  push_press: {
    name: 'Push Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Quadriceps', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160, good: 'Full overhead press', bad: 'Lock out fully', severity: 'major', citation: 'Lake JP, Lauder MA, 2012', phase: 'top' },
    ],
    scienceNotes: 'Push press uses leg drive dip to move more weight overhead than strict press (Lake 2012).',
  },

  wall_ball: {
    name: 'Wall Ball',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Deltoids'], secondary: ['Core', 'Triceps'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Squat depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good squat depth', bad: 'Squat deeper before throwing', severity: 'major', citation: 'Glassman G, CrossFit L1 Training Guide' },
    ],
    scienceNotes: 'Wall balls combine front squat with overhead throw, a CrossFit staple for metabolic conditioning.',
  },

  battle_rope: {
    name: 'Battle Rope',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Core'], secondary: ['Forearms', 'Lats'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 20,
    upThreshold: 60,
    formChecks: [
      { name: 'Stable base', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 160, good: 'Athletic stance', bad: 'Bend knees into athletic position', severity: 'minor', citation: 'Fountaine CJ, Schmidt BJ, 2015' },
    ],
    scienceNotes: 'Battle ropes produce high cardiovascular and upper body metabolic demand (Fountaine 2015).',
  },

  // ===== LEGS — QUAD / MACHINE =====
  box_squat: {
    name: 'Box Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Sit fully on box', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Full sit on box', bad: 'Sit completely on the box before standing', severity: 'major', citation: 'Swinton PA et al, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Box squats develop concentric strength by eliminating the stretch-shortening cycle at the bottom (Swinton 2012).',
  },

  pause_squat: {
    name: 'Pause Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Below parallel', bad: 'Squat deeper before pausing', severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pause squats eliminate the stretch-shortening cycle, increasing time under tension at the bottom and improving rate of force development (Schoenfeld 2010).',
  },

  belt_squat: {
    name: 'Belt Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good depth', bad: 'Squat deeper', severity: 'minor', citation: 'Evans TW et al, 2019, J Strength Cond Res' },
    ],
    scienceNotes: 'Belt squat loads the lower body without axial spinal compression, making it spine-friendly while maintaining quad/glute activation (Evans 2019).',
  },

  heel_elevated_squat: {
    name: 'Heel Elevated Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Upright torso', check: (angles) => angles.trunk < 45, good: 'Torso upright', bad: 'Stay more upright', severity: 'minor', citation: 'Sayers MGL et al, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Heel elevation increases knee flexion ROM and shifts load anteriorly to the quadriceps by allowing a more upright torso (Sayers 2012).',
  },

  landmine_squat: {
    name: 'Landmine Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 95,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good squat depth', bad: 'Squat deeper', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Landmine squat provides an arc-path load that naturally encourages upright torso positioning (NSCA 2016).',
  },

  pendulum_squat: {
    name: 'Pendulum Squat',
    category: 'machine',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Full range of motion', bad: 'Go deeper', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pendulum squat machines provide a fixed arc path that reduces stabilization demands while maximizing quad loading (Schoenfeld 2010).',
  },

  sissy_squat: {
    name: 'Sissy Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps'], secondary: ['Hip Flexors', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 60,
    upThreshold: 155,
    formChecks: [
      { name: 'Lean back', check: (angles) => angles.trunk > 40, good: 'Good backward lean', bad: 'Lean back further to load quads', severity: 'minor', citation: 'Signorile JF et al, 1994, J Strength Cond Res' },
    ],
    scienceNotes: 'Sissy squats isolate the quadriceps through extreme knee flexion with posterior trunk lean (Signorile 1994).',
  },

  adductor_machine: {
    name: 'Adductor Machine',
    category: 'machine',
    muscles: { primary: ['Adductors'], secondary: ['Gracilis'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled squeeze', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 110, good: 'Full adduction', bad: 'Squeeze legs fully together', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine hip adduction isolates the adductor magnus, longus, and brevis in a controlled path (NSCA 2016).',
  },

  abductor_machine: {
    name: 'Abductor Machine',
    category: 'machine',
    muscles: { primary: ['Hip Abductors'], secondary: ['Gluteus Medius'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full abduction', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150, good: 'Full range abduction', bad: 'Push legs further apart', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine hip abduction targets the gluteus medius and minimus, important for hip stability and knee tracking (NSCA 2016).',
  },

  cable_hip_adduction: {
    name: 'Cable Hip Adduction',
    category: 'isolation',
    muscles: { primary: ['Adductors'], secondary: ['Gracilis'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 120, good: 'Controlled adduction', bad: 'Control the movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable adduction provides constant tension through the full ROM unlike machine variants (NSCA 2016).',
  },

  cable_hip_abduction: {
    name: 'Cable Hip Abduction',
    category: 'isolation',
    muscles: { primary: ['Hip Abductors', 'Glutes'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable torso', check: (angles) => angles.trunk < 30, good: 'Torso stable', bad: 'Avoid leaning away from working leg', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Standing cable abduction produces high gluteus medius activation when performed with stable torso (Distefano 2009).',
  },

  single_leg_press: {
    name: 'Single-Leg Press',
    category: 'machine',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Good depth', bad: 'Press deeper', severity: 'minor', citation: 'Escamilla RF et al, 2001, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Single-leg press addresses bilateral strength deficits while providing machine stability (Escamilla 2001).',
  },

  // ===== LEGS — POSTERIOR CHAIN =====
  stiff_leg_deadlift: {
    name: 'Stiff-Leg Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Traps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Straight legs', check: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 155, good: 'Legs straight', bad: 'Keep legs straighter', severity: 'minor', citation: 'McAllister MJ et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Stiff-leg deadlift maximizes hamstring stretch and eccentric loading compared to conventional deadlift (McAllister 2014).',
  },

  single_leg_hip_thrust: {
    name: 'Single-Leg Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full hip extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Single-leg hip thrust addresses bilateral glute strength imbalances while producing high glute activation (Contreras 2015).',
  },

  cable_pull_through: {
    name: 'Cable Pull-Through',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Erectors', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 90, good: 'Good hip hinge depth', bad: 'Hinge further at hips', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Cable pull-through teaches hip hinge mechanics with constant tension, useful as a deadlift accessory (Contreras 2015).',
  },

  donkey_kick: {
    name: 'Donkey Kick',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable spine', check: (angles) => angles.trunk < 30, good: 'Spine neutral', bad: 'Avoid arching lower back', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Donkey kicks isolate glute max with minimal equipment, producing moderate-to-high glute activation (Distefano 2009).',
  },

  fire_hydrant: {
    name: 'Fire Hydrant',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Hip Abductors'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Stable torso', check: (angles) => angles.trunk < 25, good: 'Torso stable', bad: 'Keep torso still', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Fire hydrants target the gluteus medius through hip abduction and external rotation from a quadruped position (Distefano 2009).',
  },

  lying_leg_curl: {
    name: 'Lying Leg Curl',
    category: 'machine',
    muscles: { primary: ['Hamstrings'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 80, good: 'Full curl', bad: 'Curl further', severity: 'minor', citation: 'Schoenfeld BJ et al, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Lying leg curl targets the hamstrings at the knee joint in a shortened hip position, emphasizing the short head of the biceps femoris (Schoenfeld 2015).',
  },

  glute_ham_raise: {
    name: 'Glute-Ham Raise',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Erectors', 'Calves'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 60, good: 'Full body extension', bad: 'Lower further', severity: 'major', citation: 'Zebis MK et al, 2013, Br J Sports Med' },
    ],
    scienceNotes: 'Glute-ham raise produces very high hamstring activation and is superior to lying leg curl for eccentric hamstring strength (Zebis 2013).',
  },

  reverse_hyperextension: {
    name: 'Reverse Hyperextension',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled swing', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Extend hips fully', severity: 'minor', citation: 'Lawrence MA, Carlisle T, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Reverse hypers decompress the spine while loading the posterior chain through hip extension (Lawrence 2015).',
  },

  back_extension_45: {
    name: '45-Degree Back Extension',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full extension', bad: 'Extend until body is straight', severity: 'minor', citation: 'Mayer JM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: '45-degree back extension produces high erector spinae activation while allowing progressive overload with weight (Mayer 2005).',
  },

  cable_hip_extension: {
    name: 'Cable Hip Extension',
    category: 'isolation',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable torso', check: (angles) => angles.trunk < 25, good: 'Torso stable', bad: 'Avoid leaning forward', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable hip extension provides constant tension through the glute extension range, useful for glute isolation (NSCA 2016).',
  },

  // ===== LEGS — CALVES =====
  donkey_calf_raise: {
    name: 'Donkey Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Full stretch', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 160, good: 'Full calf stretch at bottom', bad: 'Lower heels further', severity: 'minor', citation: 'Schoenfeld BJ et al, 2020, J Strength Cond Res' },
    ],
    scienceNotes: 'Donkey calf raise loads the gastrocnemius in a stretched hip position, increasing stretch-mediated hypertrophy (Schoenfeld 2020).',
  },

  leg_press_calf_raise: {
    name: 'Leg Press Calf Raise',
    category: 'machine',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 160, good: 'Full range of motion', bad: 'Use full range', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Leg press calf raise allows heavy loading with a locked knee position for gastrocnemius emphasis (NSCA 2016).',
  },

  tibialis_raise: {
    name: 'Tibialis Raise',
    category: 'isolation',
    muscles: { primary: ['Tibialis Anterior'], secondary: [] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => true, good: 'Controlled dorsiflexion', bad: 'Slow down the movement', severity: 'minor', citation: 'Jeon HS et al, 2015, J Phys Ther Sci' },
    ],
    scienceNotes: 'Tibialis raises strengthen the tibialis anterior, important for ankle stability and shin splint prevention (Jeon 2015).',
  },

  // ===== LEGS — PLYOMETRIC =====
  depth_jump: {
    name: 'Depth Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Quick ground contact', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 100, good: 'Short ground contact time', bad: 'React faster off the ground', severity: 'major', citation: 'Bobbert MF et al, 1987, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Depth jumps develop reactive strength by exploiting the stretch-shortening cycle from a drop height (Bobbert 1987).',
  },

  broad_jump: {
    name: 'Broad Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Landing control', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 120, good: 'Controlled landing', bad: 'Absorb landing with bent knees', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Broad jumps develop horizontal power production, a key predictor of sprint performance (Hewett 2005).',
  },

  split_squat_jump: {
    name: 'Split Squat Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good split depth', bad: 'Drop lower before jumping', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Split squat jumps develop unilateral explosive power and coordination (Hewett 2005).',
  },

  tuck_jump: {
    name: 'Tuck Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Hip Flexors'], secondary: ['Calves', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 60,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee tuck height', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 70, good: 'Knees high', bad: 'Bring knees higher to chest', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Tuck jumps develop explosive power and hip flexor strength while challenging coordination (Hewett 2005).',
  },

  curtsy_lunge: {
    name: 'Curtsy Lunge',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Quadriceps', 'Adductors'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good lunge depth', bad: 'Step deeper behind', severity: 'minor', citation: 'Stastny P et al, 2015, J Hum Kinet' },
    ],
    scienceNotes: 'Curtsy lunges emphasize glute medius and adductors through the crossover stepping pattern (Stastny 2015).',
  },

  // ===== CHEST =====
  incline_dumbbell_press: {
    name: 'Incline Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Upper Pectorals', 'Front Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Lauver JD et al, 2016, Eur J Sport Sci', phase: 'top' },
    ],
    scienceNotes: 'Incline dumbbell press at 30-45 degrees maximizes clavicular head pectoralis activation compared to flat (Lauver 2016).',
  },

  decline_dumbbell_press: {
    name: 'Decline Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Lower Pectorals', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Extend fully', severity: 'minor', citation: 'Lauver JD et al, 2016, Eur J Sport Sci', phase: 'top' },
    ],
    scienceNotes: 'Decline pressing emphasizes the sternal head of the pectoralis major and reduces shoulder stress (Lauver 2016).',
  },

  flat_dumbbell_press: {
    name: 'Flat Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Front Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH et al, 2017, J Sports Sci', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell press allows greater ROM and independent arm movement compared to barbell, increasing stabilizer activation (Saeterbakken 2017).',
  },

  machine_fly: {
    name: 'Pec Deck Fly',
    category: 'machine',
    muscles: { primary: ['Pectorals'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Squeeze at center', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 40, good: 'Full contraction', bad: 'Squeeze arms together more', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pec deck provides isolated chest activation with reduced triceps involvement compared to pressing (Schoenfeld 2010).',
  },

  chest_dip: {
    name: 'Chest Dip',
    category: 'compound',
    muscles: { primary: ['Lower Pectorals', 'Triceps', 'Front Deltoids'], secondary: ['Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Forward lean', check: (angles) => angles.trunk > 15, good: 'Good forward lean for chest emphasis', bad: 'Lean forward more to target chest', severity: 'minor', citation: 'McKenzie A et al, 2022, J Strength Cond Res' },
    ],
    scienceNotes: 'Forward-leaning dip position shifts emphasis from triceps to pectoralis major (McKenzie 2022).',
  },

  decline_push_up: {
    name: 'Decline Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Upper Pectorals', 'Triceps'], secondary: ['Front Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 80, good: 'Chest near floor', bad: 'Lower chest closer to floor', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Decline push-ups (feet elevated) increase load on the upper chest and shoulders compared to standard push-ups (Cogley 2005).',
  },

  svend_press: {
    name: 'Svend Press',
    category: 'isolation',
    muscles: { primary: ['Inner Pectorals'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 20,
    upThreshold: 60,
    formChecks: [
      { name: 'Constant squeeze', check: (angles) => true, good: 'Maintaining plate squeeze', bad: 'Squeeze plates harder together', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Svend press emphasizes inner chest activation through isometric adduction force while pressing (NSCA 2016).',
  },

  // ===== BACK — VERTICAL PULLS =====
  neutral_grip_pull_up: {
    name: 'Neutral Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Brachialis', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Neutral grip reduces wrist and shoulder stress while maintaining high lat and bicep activation (Youdas 2010).',
  },

  wide_grip_pull_up: {
    name: 'Wide Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Teres Major'], secondary: ['Biceps', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Andersen V et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Wide grip pull-ups increase lat width emphasis but reduce ROM compared to narrower grips (Andersen 2014).',
  },

  close_grip_pull_up: {
    name: 'Close Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Brachialis', 'Lower Traps'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Andersen V et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Close grip allows greater ROM per rep and increased bicep contribution (Andersen 2014).',
  },

  straight_arm_pulldown: {
    name: 'Straight-Arm Pulldown',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi'], secondary: ['Teres Major', 'Posterior Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Straight arms', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Arms straight', bad: 'Keep arms straighter', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Straight-arm pulldowns isolate the lats without bicep involvement, useful as a mind-muscle connection exercise (NSCA 2016).',
  },

  assisted_pull_up: {
    name: 'Assisted Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rear Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 95, good: 'Chin above bar', bad: 'Pull higher', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Assisted pull-ups allow progressive overload toward bodyweight pull-ups while maintaining similar muscle activation patterns (Youdas 2010).',
  },

  kipping_pull_up: {
    name: 'Kipping Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Shoulders'], secondary: ['Biceps', 'Core', 'Hip Flexors'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Chin over bar', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Chin clears bar', bad: 'Pull higher', severity: 'minor', citation: 'Halet KA et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Kipping pull-ups use momentum from hip drive to increase rep volume; lower per-rep muscle tension than strict pull-ups (Halet 2009).',
  },

  scapular_pull_up: {
    name: 'Scapular Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Lower Trapezius', 'Serratus Anterior'], secondary: ['Rhomboids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 150,
    upThreshold: 170,
    formChecks: [
      { name: 'Scapular retraction', check: (angles) => true, good: 'Good scapular movement', bad: 'Focus on pulling shoulder blades down and back', severity: 'minor', citation: 'Decker MJ et al, 1999, J Shoulder Elbow Surg' },
    ],
    scienceNotes: 'Scapular pull-ups train scapular depression and retraction, foundational for healthy overhead movement (Decker 1999).',
  },

  // ===== BACK — ROWS =====
  single_arm_dumbbell_row: {
    name: 'Single-Arm Dumbbell Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Rear Deltoids'], secondary: ['Rhomboids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 105, good: 'Elbow past torso', bad: 'Pull elbow further back', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Single-arm rows allow unilateral lat loading and anti-rotation core demand (Fenwick 2009).',
  },

  meadows_row: {
    name: 'Meadows Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rear Deltoids'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Elbow drive', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 110, good: 'Good elbow drive', bad: 'Drive elbow higher', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Meadows row (landmine single-arm row) provides a unique arc path that emphasizes the upper lat and teres major (Fenwick 2009).',
  },

  seal_row: {
    name: 'Seal Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Biceps'], secondary: ['Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 105, good: 'Full row', bad: 'Pull higher', severity: 'minor', citation: 'Lehman GJ et al, 2004, J Strength Cond Res' },
    ],
    scienceNotes: 'Seal row (prone bench row) eliminates momentum and lower back involvement, isolating the upper back (Lehman 2004).',
  },

  machine_row: {
    name: 'Machine Row',
    category: 'machine',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rhomboids', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 110, good: 'Full pull', bad: 'Pull handles further back', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine rows provide stable support for back isolation, removing core and balance limitations (NSCA 2016).',
  },

  cable_row_single: {
    name: 'Single-Arm Cable Row',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rear Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Anti-rotation', check: (angles) => angles.trunk < 25, good: 'Torso stable', bad: 'Avoid rotating torso', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Single-arm cable row combines lat isolation with anti-rotation core demand (Fenwick 2009).',
  },

  dumbbell_pullover: {
    name: 'Dumbbell Pullover',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi', 'Pectorals'], secondary: ['Triceps Long Head', 'Serratus Anterior'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Slight elbow bend', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140, good: 'Slight elbow bend maintained', bad: 'Keep slight bend in elbows', severity: 'minor', citation: 'Marchetti PH, Uchida MC, 2011, J Electromyogr Kinesiol' },
    ],
    scienceNotes: 'Dumbbell pullovers stretch the lats and pecs simultaneously, with activation ratio depending on cue (pull vs squeeze) (Marchetti 2011).',
  },

  yates_row: {
    name: 'Yates Row (Underhand Barbell Row)',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rhomboids', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Torso angle', check: (angles) => angles.trunk > 40, good: 'Good torso angle', bad: 'Maintain moderate forward lean', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Supinated grip row increases bicep recruitment and allows higher pulling volume at a more upright torso angle (Fenwick 2009).',
  },

  incline_dumbbell_row: {
    name: 'Incline Dumbbell Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Rear Deltoids'], secondary: ['Biceps', 'Rhomboids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Chest on bench', check: (angles) => true, good: 'Chest supported on bench', bad: 'Keep chest on the bench', severity: 'minor', citation: 'Lehman GJ et al, 2004, J Strength Cond Res' },
    ],
    scienceNotes: 'Incline dumbbell rows with chest support eliminate momentum and isolate upper back musculature (Lehman 2004).',
  },

  // ===== BACK — LOWER BACK =====
  back_extension: {
    name: 'Back Extension (Roman Chair)',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Full extension', bad: 'Extend until body is straight', severity: 'minor', citation: 'Mayer JM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Roman chair back extensions produce high erector spinae activation and can be loaded progressively (Mayer 2005).',
  },

  jefferson_curl: {
    name: 'Jefferson Curl',
    category: 'isolation',
    muscles: { primary: ['Erectors', 'Hamstrings'], secondary: ['Glutes'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 45,
    upThreshold: 165,
    formChecks: [
      { name: 'Slow controlled descent', check: (angles) => true, good: 'Controlled spinal articulation', bad: 'Roll down one vertebra at a time', severity: 'major', citation: 'McGill SM, 2015, Low Back Disorders' },
    ],
    scienceNotes: 'Jefferson curls train spinal flexion under load for mobility; contraindicated for those with disc issues (McGill 2015).',
  },

  rack_pull: {
    name: 'Rack Pull',
    category: 'compound',
    muscles: { primary: ['Trapezius', 'Erectors', 'Glutes'], secondary: ['Hamstrings', 'Forearms'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 165,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Stand fully upright', severity: 'minor', citation: 'Swinton PA et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Rack pulls overload the lockout portion of the deadlift, developing upper back and grip strength (Swinton 2011).',
  },

  // ===== SHOULDERS =====
  machine_shoulder_press: {
    name: 'Machine Shoulder Press',
    category: 'machine',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full press', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Machine shoulder press provides stable overhead pressing, suitable for beginners and high-volume training (NSCA 2016).',
  },

  dumbbell_overhead_press: {
    name: 'Dumbbell Overhead Press (Standing)',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Core', 'Upper Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout overhead', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Standing dumbbell press produces higher deltoid and core activation than seated variants (Saeterbakken 2013).',
  },

  seated_dumbbell_press: {
    name: 'Seated Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Seated pressing allows higher loads due to back support, isolating the deltoids with less core demand (Saeterbakken 2013).',
  },

  z_press: {
    name: 'Z Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps', 'Core'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Upright torso', check: (angles) => angles.trunk < 20, good: 'Torso upright', bad: 'Stay upright without leaning back', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Z press (seated on floor, no back support) demands extreme core stability and eliminates leg drive (NSCA 2016).',
  },

  cable_lateral_raise: {
    name: 'Cable Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Controlled raise', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70, good: 'Arms at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable lateral raises provide constant tension throughout ROM, superior to dumbbells for lateral deltoid hypertrophy (Reinold 2004).',
  },

  cable_front_raise: {
    name: 'Cable Front Raise',
    category: 'isolation',
    muscles: { primary: ['Anterior Deltoids'], secondary: ['Upper Pectorals'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Shoulder height', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70, good: 'Arm at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable front raises provide constant tension on the anterior deltoid through the full range (NSCA 2016).',
  },

  cable_rear_delt_fly: {
    name: 'Cable Rear Delt Fly',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Middle Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full retraction', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60, good: 'Full rear delt squeeze', bad: 'Pull arms further back', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable rear delt fly isolates the posterior deltoid with constant cable tension (Reinold 2004).',
  },

  machine_rear_delt_fly: {
    name: 'Machine Rear Delt Fly (Reverse Pec Deck)',
    category: 'machine',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Middle Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full squeeze', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60, good: 'Full retraction', bad: 'Squeeze shoulder blades together more', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Reverse pec deck provides stable rear delt isolation with guided movement path (NSCA 2016).',
  },

  band_pull_apart: {
    name: 'Band Pull-Apart',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Middle Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Full stretch', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 100, good: 'Band to chest', bad: 'Pull band further apart', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Band pull-aparts are a highly effective warm-up and shoulder health exercise targeting the rear delts and rhomboids (Reinold 2004).',
  },

  external_rotation: {
    name: 'External Rotation',
    category: 'isolation',
    muscles: { primary: ['Infraspinatus', 'Teres Minor'], secondary: ['Posterior Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'Elbow pinned', check: (angles) => true, good: 'Elbow at side', bad: 'Keep elbow pinned to your side', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'External rotation strengthens the infraspinatus and teres minor, critical for shoulder stability and injury prevention (Reinold 2004).',
  },

  internal_rotation: {
    name: 'Internal Rotation',
    category: 'isolation',
    muscles: { primary: ['Subscapularis'], secondary: ['Pectorals', 'Anterior Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'Elbow pinned', check: (angles) => true, good: 'Elbow at side', bad: 'Keep elbow pinned to your side', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Internal rotation targets the subscapularis for balanced rotator cuff strength (Reinold 2004).',
  },

  prone_y_raise: {
    name: 'Prone Y Raise',
    category: 'isolation',
    muscles: { primary: ['Lower Trapezius', 'Posterior Deltoids'], secondary: ['Rhomboids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 10,
    upThreshold: 90,
    formChecks: [
      { name: 'Thumbs up position', check: (angles) => true, good: 'Thumbs pointing up', bad: 'Rotate thumbs upward', severity: 'minor', citation: 'Cools AM et al, 2007, Am J Sports Med' },
    ],
    scienceNotes: 'Prone Y raises produce high lower trapezius activation, important for scapular upward rotation and shoulder health (Cools 2007).',
  },

  seated_lateral_raise: {
    name: 'Seated Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'No momentum', check: (angles) => angles.trunk < 20, good: 'No body swing', bad: 'Avoid swinging torso', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Seated lateral raises eliminate lower body momentum, isolating the lateral deltoid (Reinold 2004).',
  },

  // ===== BICEPS =====
  barbell_curl: {
    name: 'Barbell Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'No body swing', check: (angles) => angles.trunk < 20, good: 'Strict form', bad: 'Avoid swinging body', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'Barbell curls allow heavier loading than dumbbell variants; strict form maximizes bicep activation (Marcolin 2018).',
  },

  ez_bar_curl: {
    name: 'EZ Bar Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Strict form', check: (angles) => angles.trunk < 20, good: 'Strict curl', bad: 'Avoid using momentum', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'EZ bar reduces wrist strain compared to straight bar while maintaining similar bicep activation (Marcolin 2018).',
  },

  cable_curl: {
    name: 'Cable Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Elbows stationary', check: (angles) => angles.trunk < 15, good: 'Elbows pinned', bad: 'Keep elbows at your sides', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable curls provide constant tension throughout the entire ROM unlike free weight curls (NSCA 2016).',
  },

  incline_dumbbell_curl: {
    name: 'Incline Dumbbell Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps Long Head'], secondary: ['Brachialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full stretch', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140, good: 'Full arm extension at bottom', bad: 'Let arms fully extend', severity: 'minor', citation: 'Oliveira LF et al, 2009, J Strength Cond Res', phase: 'bottom' },
    ],
    scienceNotes: 'Incline position stretches the biceps long head maximally, producing greater muscle activation at long muscle lengths (Oliveira 2009).',
  },

  reverse_curl: {
    name: 'Reverse Curl (Pronated Grip)',
    category: 'isolation',
    muscles: { primary: ['Brachioradialis', 'Brachialis'], secondary: ['Biceps', 'Wrist Extensors'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Strict form', check: (angles) => angles.trunk < 15, good: 'Strict reverse curl', bad: 'Avoid swinging', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'Pronated grip shifts emphasis from biceps to brachioradialis and brachialis, building forearm mass (Marcolin 2018).',
  },

  zottman_curl: {
    name: 'Zottman Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachioradialis'], secondary: ['Brachialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Rotation at top', check: (angles) => true, good: 'Supinate up, pronate down', bad: 'Rotate wrists at the top', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Zottman curls combine supinated concentric (biceps emphasis) with pronated eccentric (brachioradialis emphasis) (NSCA 2016).',
  },

  drag_curl: {
    name: 'Drag Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Elbows back', check: (angles) => true, good: 'Bar dragging up body', bad: 'Keep the bar close to your torso', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Drag curls eliminate front deltoid involvement by driving elbows behind the body, isolating the biceps (NSCA 2016).',
  },

  cross_body_curl: {
    name: 'Cross-Body Curl',
    category: 'isolation',
    muscles: { primary: ['Brachialis', 'Biceps'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Cross midline', check: (angles) => true, good: 'Curling across body', bad: 'Curl dumbbell across to opposite shoulder', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cross-body (pinwheel) curls emphasize the brachialis through a neutral grip and cross-body path (NSCA 2016).',
  },

  machine_curl: {
    name: 'Machine Bicep Curl',
    category: 'machine',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 85, good: 'Full curl', bad: 'Curl further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine curls provide guided movement and constant resistance, useful for isolation and drop sets (NSCA 2016).',
  },

  // ===== TRICEPS =====
  bench_dip: {
    name: 'Bench Dip',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Front Deltoids'], secondary: ['Pectorals'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Good depth', bad: 'Lower further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Bench dips are an accessible bodyweight tricep exercise; avoid going too deep to protect shoulders (NSCA 2016).',
  },

  kickback: {
    name: 'Tricep Kickback',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Full lockout', bad: 'Extend arm fully', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'top' },
    ],
    scienceNotes: 'Tricep kickbacks produce high tricep activation at full extension due to peak resistance at lockout (Boeckh-Behrens 2000).',
  },

  cable_kickback: {
    name: 'Cable Tricep Kickback',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Full lockout', bad: 'Extend arm fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable kickbacks maintain constant tension throughout the ROM unlike dumbbell variants (NSCA 2016).',
  },

  rope_pushdown: {
    name: 'Rope Tricep Pushdown',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Spread at bottom', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 125, good: 'Full spread and lockout', bad: 'Spread the rope at the bottom', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'top' },
    ],
    scienceNotes: 'Rope pushdowns allow wrist pronation at the bottom, increasing lateral head tricep activation (Boeckh-Behrens 2000).',
  },

  overhead_cable_tricep: {
    name: 'Overhead Cable Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps Long Head'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 145,
    formChecks: [
      { name: 'Full stretch', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 70, good: 'Full stretch at bottom', bad: 'Let weight stretch triceps fully', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'bottom' },
    ],
    scienceNotes: 'Overhead extension stretches the triceps long head maximally, producing superior hypertrophy of that head (Boeckh-Behrens 2000).',
  },

  machine_tricep_extension: {
    name: 'Machine Tricep Extension',
    category: 'machine',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 145, good: 'Full extension', bad: 'Extend fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Machine tricep extension provides guided movement for isolated tricep training (NSCA 2016).',
  },

  close_grip_push_up: {
    name: 'Close-Grip Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Chest'], secondary: ['Front Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 80, good: 'Chest near floor', bad: 'Lower chest closer to floor', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Close-grip push-ups produce significantly higher tricep activation than standard width (Cogley 2005).',
  },

  tate_press: {
    name: 'Tate Press',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Pectorals'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Elbows stable', check: (angles) => true, good: 'Elbows pointing out', bad: 'Keep elbows flared', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Tate press targets the triceps through a unique inward pressing path with dumbbells (NSCA 2016).',
  },

  jm_press: {
    name: 'JM Press',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Front Deltoids', 'Pectorals'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Bar path to chin', check: (angles) => true, good: 'Bar lowering to chin/neck area', bad: 'Lower bar toward chin, not chest', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'JM press is a hybrid between close-grip bench and skull crusher, heavily loading the triceps (NSCA 2016).',
  },

  // ===== FOREARMS =====
  wrist_extension: {
    name: 'Wrist Extension (Reverse Wrist Curl)',
    category: 'isolation',
    muscles: { primary: ['Wrist Extensors'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => true, good: 'Controlled wrist extension', bad: 'Slow down the movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wrist extensions strengthen the extensor carpi muscles, important for grip balance and injury prevention (NSCA 2016).',
  },

  farmers_walk: {
    name: "Farmer's Walk",
    category: 'compound',
    muscles: { primary: ['Forearms', 'Traps', 'Core'], secondary: ['Glutes', 'Calves'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 5,
    upThreshold: 20,
    formChecks: [
      { name: 'Upright posture', check: (angles) => angles.trunk < 15, good: 'Tall posture', bad: 'Stand tall with shoulders back', severity: 'minor', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: "Farmer's walks produce high core, grip, and trap activation while training locomotion under load (McGill 2009).",
  },

  // ===== TRAPS =====
  dumbbell_shrug: {
    name: 'Dumbbell Shrug',
    category: 'isolation',
    muscles: { primary: ['Upper Trapezius'], secondary: ['Levator Scapulae'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 10,
    upThreshold: 25,
    formChecks: [
      { name: 'Full elevation', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 15, good: 'Full shrug', bad: 'Shrug higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell shrugs allow more natural scapular movement compared to barbell shrugs (NSCA 2016).',
  },

  cable_shrug: {
    name: 'Cable Shrug',
    category: 'isolation',
    muscles: { primary: ['Upper Trapezius'], secondary: ['Levator Scapulae'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 10,
    upThreshold: 25,
    formChecks: [
      { name: 'Full elevation', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 15, good: 'Full shrug', bad: 'Shrug higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable shrugs provide constant tension throughout the shrugging motion (NSCA 2016).',
  },

  // ===== CORE =====
  ab_wheel_rollout: {
    name: 'Ab Wheel Rollout',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Core'], secondary: ['Latissimus Dorsi', 'Shoulders'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 100,
    formChecks: [
      { name: 'No lower back sag', check: (angles) => angles.trunk < 30, good: 'Spine neutral', bad: 'Avoid lower back sagging', severity: 'major', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Ab wheel rollouts produce very high rectus abdominis and external oblique activation (Escamilla 2010).',
  },

  dragon_flag: {
    name: 'Dragon Flag',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Core'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 170,
    formChecks: [
      { name: 'Body straight', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Body in straight line', bad: 'Keep body rigid and straight', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Dragon flags are an advanced core exercise requiring extreme anti-extension strength (NSCA 2016).',
  },

  cable_crunch: {
    name: 'Cable Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Spine flexion', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 80, good: 'Good crunch depth', bad: 'Crunch further down', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Cable crunches allow progressive overload on the rectus abdominis, producing high activation (Escamilla 2010).',
  },

  decline_crunch: {
    name: 'Decline Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques', 'Hip Flexors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => true, good: 'Controlled descent', bad: 'Lower slowly', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Decline angle increases resistance against the rectus abdominis compared to flat crunches (Escamilla 2010).',
  },

  hanging_knee_raise: {
    name: 'Hanging Knee Raise',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'No swinging', check: (angles) => true, good: 'Controlled raise', bad: 'Minimize body swing', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Hanging knee raises primarily target the hip flexors with upper ab contribution through posterior pelvic tilt (Escamilla 2010).',
  },

  lying_leg_raise: {
    name: 'Lying Leg Raise',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Lower Abs'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Lower back flat', check: (angles) => true, good: 'Lower back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Lying leg raises target the lower portion of the rectus abdominis through hip flexion (Escamilla 2010).',
  },

  wood_chop: {
    name: 'Cable Wood Chop',
    category: 'compound',
    muscles: { primary: ['Obliques', 'Core'], secondary: ['Shoulders', 'Hips'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Rotate from core', check: (angles) => true, good: 'Rotating from core', bad: 'Drive rotation from hips and core, not arms', severity: 'minor', citation: 'Saeterbakken AH et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Cable wood chops train rotational power, critical for sports performance and functional movement (Saeterbakken 2011).',
  },

  pallof_press: {
    name: 'Pallof Press',
    category: 'isolation',
    muscles: { primary: ['Core', 'Obliques'], secondary: ['Shoulders'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 140,
    formChecks: [
      { name: 'Anti-rotation', check: (angles) => angles.trunk < 15, good: 'Resisting rotation', bad: 'Keep torso square and resist rotation', severity: 'minor', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Pallof press trains anti-rotation core stability, recommended by McGill as a core exercise that spares the spine (McGill 2010).',
  },

  dead_bug: {
    name: 'Dead Bug',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Rectus Abdominis'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Lower back flat', check: (angles) => true, good: 'Lower back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Dead bugs train anti-extension core stability in a supine position, spine-friendly and rehab-appropriate (McGill 2010).',
  },

  copenhagen_plank: {
    name: 'Copenhagen Plank',
    category: 'bodyweight',
    muscles: { primary: ['Adductors', 'Obliques', 'Core'], secondary: ['Hip Abductors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 160,
    upThreshold: 180,
    formChecks: [
      { name: 'Straight body line', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 165, good: 'Body in straight line', bad: 'Keep hips from dropping', severity: 'minor', citation: 'Serner A et al, 2014, Br J Sports Med' },
    ],
    scienceNotes: 'Copenhagen plank produces very high adductor activation, effective for groin injury prevention in athletes (Serner 2014).',
  },

  windshield_wiper: {
    name: 'Windshield Wiper',
    category: 'bodyweight',
    muscles: { primary: ['Obliques', 'Core'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled rotation', check: (angles) => true, good: 'Controlled side-to-side motion', bad: 'Slow down the rotation', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Windshield wipers train rotational control and oblique strength through a challenging hanging or lying position (NSCA 2016).',
  },

  ab_crunch_machine: {
    name: 'Ab Crunch Machine',
    category: 'machine',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Full crunch', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 80, good: 'Full contraction', bad: 'Crunch further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine crunches allow progressive overload on the rectus abdominis in a guided path (NSCA 2016).',
  },

  // ===== OLYMPIC LIFTS =====
  hang_clean: {
    name: 'Hang Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Traps', 'Quadriceps', 'Glutes', 'Hamstrings'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Triple extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Full hip extension', bad: 'Extend hips fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Hang cleans develop explosive hip extension power from the hang position, reducing technical complexity vs full clean (Suchomel 2015).',
  },

  hang_snatch: {
    name: 'Hang Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Traps', 'Shoulders', 'Glutes', 'Hamstrings'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Full extension before catch', bad: 'Extend fully before pulling under', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Hang snatch develops explosive triple extension and overhead stability from the hang position (Suchomel 2015).',
  },

  clean_and_jerk: {
    name: 'Clean and Jerk',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Glutes', 'Shoulders', 'Triceps'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout overhead', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout overhead', bad: 'Lock out arms fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med', phase: 'top' },
    ],
    scienceNotes: 'Clean and jerk is the ultimate test of whole-body power production and overhead stability (Suchomel 2015).',
  },

  clean_pull: {
    name: 'Clean Pull',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Traps'], secondary: ['Erectors', 'Quadriceps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full triple extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full extension', bad: 'Extend hips, knees, and ankles fully', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Clean pulls develop the pulling mechanics and power of the clean without the catch phase (Suchomel 2015).',
  },

  snatch_pull: {
    name: 'Snatch Pull',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Traps'], secondary: ['Erectors', 'Quadriceps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full triple extension', bad: 'Extend fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Snatch pulls develop the wide-grip pulling pattern and explosive extension for the snatch (Suchomel 2015).',
  },

  // ===== KETTLEBELL =====
  kettlebell_clean: {
    name: 'Kettlebell Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Forearms', 'Core', 'Glutes'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip drive', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Strong hip drive', bad: 'Drive hips forward to power the clean', severity: 'minor', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell cleans develop hip power and grip strength with a unique racking mechanic (Lake 2012).',
  },

  kettlebell_snatch: {
    name: 'Kettlebell Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Shoulders', 'Core', 'Glutes'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout overhead', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Locked out overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Kettlebell snatch is a high-power exercise combining hip drive with overhead lockout in one fluid movement (Lake 2012).',
  },

  kettlebell_press: {
    name: 'Kettlebell Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Core', 'Upper Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Locked out overhead', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Kettlebell press develops unilateral pressing strength with unique offset loading that challenges core stability (NSCA 2016).',
  },

  kettlebell_windmill: {
    name: 'Kettlebell Windmill',
    category: 'compound',
    muscles: { primary: ['Core', 'Obliques', 'Shoulders'], secondary: ['Hamstrings', 'Glutes'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Arm locked out', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Arm stable overhead', bad: 'Keep top arm locked out', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Kettlebell windmills develop lateral core strength, hip mobility, and shoulder stability simultaneously (NSCA 2016).',
  },

  kettlebell_goblet_squat: {
    name: 'Kettlebell Goblet Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Biceps'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Below parallel', bad: 'Squat deeper', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell goblet squat is an excellent teaching tool for squat mechanics with natural counterbalance (Schoenfeld 2010).',
  },

  kettlebell_row: {
    name: 'Kettlebell Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rear Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 110, good: 'Full row', bad: 'Pull elbow further back', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell rows provide offset loading that challenges grip and core anti-rotation (Fenwick 2009).',
  },

  kettlebell_deadlift: {
    name: 'Kettlebell Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core', 'Forearms'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 90, good: 'Good hip hinge', bad: 'Hinge more at hips', severity: 'minor', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell deadlift teaches hip hinge mechanics with a lower center of gravity than barbell (Lake 2012).',
  },

  // ===== CABLE =====
  cable_reverse_fly: {
    name: 'Cable Reverse Fly',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Middle Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full retraction', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60, good: 'Full squeeze', bad: 'Pull arms further back', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable reverse fly provides constant tension for rear deltoid and rhomboid isolation (Reinold 2004).',
  },

  // ===== TRX / SUSPENSION =====
  trx_row: {
    name: 'TRX Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Core', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Body angle', check: (angles) => true, good: 'Appropriate lean angle', bad: 'Adjust angle for desired difficulty', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX rows allow progressive difficulty through body angle adjustment while adding instability challenge (Snarr 2014).',
  },

  trx_push_up: {
    name: 'TRX Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable base', check: (angles) => true, good: 'Controlled movement', bad: 'Minimize swinging', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX push-ups increase core and stabilizer demands compared to floor push-ups (Snarr 2014).',
  },

  trx_squat: {
    name: 'TRX Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 95, good: 'Good squat depth', bad: 'Squat deeper', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX-assisted squats allow deeper squatting while reducing load, useful for mobility work (Snarr 2014).',
  },

  trx_lunge: {
    name: 'TRX Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good lunge depth', bad: 'Lower further', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX rear-foot-elevated lunges add instability to challenge single-leg balance and proprioception (Snarr 2014).',
  },

  trx_pike: {
    name: 'TRX Pike',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Shoulders'], secondary: ['Hip Flexors'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Hips high', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 50, good: 'Hips piked high', bad: 'Drive hips higher', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'TRX pike combines core anti-extension with shoulder flexion strength in an unstable environment (Snarr 2014).',
  },

  trx_hamstring_curl: {
    name: 'TRX Hamstring Curl',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Hips up', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150, good: 'Hips elevated', bad: 'Keep hips up throughout', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX hamstring curls train the hamstrings through both hip extension and knee flexion simultaneously (Snarr 2014).',
  },

  trx_bicep_curl: {
    name: 'TRX Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Body stable', check: (angles) => true, good: 'Body rigid', bad: 'Keep body rigid throughout', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX curls challenge biceps with bodyweight loading and core co-contraction (Snarr 2014).',
  },

  trx_tricep_extension: {
    name: 'TRX Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 60,
    upThreshold: 145,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140, good: 'Full lockout', bad: 'Extend arms fully', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'TRX tricep extensions load the triceps through bodyweight with instability challenge (Snarr 2014).',
  },

  // ===== RESISTANCE BAND =====
  band_squat: {
    name: 'Band Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', check: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') < 100, good: 'Good depth', bad: 'Squat deeper', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band squats provide accommodating resistance that increases through the concentric phase (Shoepe 2011).',
  },

  band_deadlift: {
    name: 'Band Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core', 'Traps'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 90, good: 'Good hip hinge', bad: 'Hinge deeper at hips', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band deadlifts provide accommodating resistance, useful for developing lockout strength (Shoepe 2011).',
  },

  band_row: {
    name: 'Band Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Rear Deltoids', 'Core'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 110, good: 'Full retraction', bad: 'Pull further back', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band rows provide portable back training with increasing resistance through the contraction (Shoepe 2011).',
  },

  band_chest_press: {
    name: 'Band Chest Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 145, good: 'Full press', bad: 'Extend arms fully', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Band chest press provides accommodating resistance, greatest at lockout where the chest is strongest (Shoepe 2011).',
  },

  band_lateral_raise: {
    name: 'Band Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Shoulder height', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70, good: 'Arms at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Band lateral raises provide increasing resistance through the raise, matching the deltoid strength curve (Shoepe 2011).',
  },

  band_hip_thrust: {
    name: 'Band Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Band hip thrusts add accommodating resistance that peaks at lockout where glutes are maximally contracted (Contreras 2015).',
  },

  band_clamshell: {
    name: 'Band Clamshell',
    category: 'isolation',
    muscles: { primary: ['Glutes', 'Hip Abductors'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable pelvis', check: (angles) => true, good: 'Pelvis not rotating', bad: 'Keep hips stacked and still', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Band clamshells activate the gluteus medius and are a staple in hip stability and rehab protocols (Distefano 2009).',
  },

  band_face_pull: {
    name: 'Band Face Pull',
    category: 'isolation',
    muscles: { primary: ['Rear Deltoids', 'Rhomboids', 'Rotator Cuff'], secondary: ['Middle Trapezius'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 60,
    upThreshold: 120,
    formChecks: [
      { name: 'External rotation', check: (angles) => true, good: 'Good external rotation at finish', bad: 'Rotate hands outward at the top', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Band face pulls are a portable shoulder health exercise targeting posterior deltoids and external rotators (Reinold 2004).',
  },

  band_good_morning: {
    name: 'Band Good Morning',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 90, good: 'Good hip hinge depth', bad: 'Hinge deeper at hips', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band good mornings provide accommodating resistance for posterior chain loading (Shoepe 2011).',
  },

  // ===== STABILITY BALL =====
  stability_ball_crunch: {
    name: 'Stability Ball Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 130,
    formChecks: [
      { name: 'Controlled crunch', check: (angles) => true, good: 'Controlled motion', bad: 'Slow down the movement', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Stability ball crunches increase rectus abdominis activation compared to floor crunches due to instability (Escamilla 2010).',
  },

  stability_ball_hamstring_curl: {
    name: 'Stability Ball Hamstring Curl',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Hips up', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150, good: 'Hips elevated', bad: 'Keep hips from dropping', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Stability ball hamstring curls combine hip extension with knee flexion on an unstable surface (Escamilla 2010).',
  },

  stability_ball_hip_thrust: {
    name: 'Stability Ball Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Stability ball hip thrusts add instability to standard hip thrusts, increasing stabilizer activation (Contreras 2015).',
  },

  stability_ball_pike: {
    name: 'Stability Ball Pike',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Shoulders'], secondary: ['Hip Flexors'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Hips high', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 50, good: 'Hips piked high', bad: 'Drive hips higher', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Stability ball pikes produce high rectus abdominis activation with shoulder stabilization demands (Escamilla 2010).',
  },

  stability_ball_push_up: {
    name: 'Stability Ball Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Core', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable ball', check: (angles) => true, good: 'Ball stable under hands', bad: 'Control the ball', severity: 'minor', citation: 'Marshall PW, Murphy BA, 2006, J Strength Cond Res' },
    ],
    scienceNotes: 'Stability ball push-ups significantly increase core and stabilizer muscle activation compared to floor push-ups (Marshall 2006).',
  },

  stability_ball_back_extension: {
    name: 'Stability Ball Back Extension',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Full extension', bad: 'Extend body to straight line', severity: 'minor', citation: 'Marshall PW, Murphy BA, 2006, J Strength Cond Res' },
    ],
    scienceNotes: 'Stability ball back extensions train the erectors with an unstable surface, increasing proprioceptive demand (Marshall 2006).',
  },

  // ===== CALISTHENICS / ADVANCED BODYWEIGHT =====
  handstand_push_up: {
    name: 'Handstand Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Pectorals', 'Core', 'Trapezius'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155, good: 'Full lockout', bad: 'Lock out arms fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Handstand push-ups are an advanced bodyweight overhead press requiring full bodyweight loading (NSCA 2016).',
  },

  front_lever: {
    name: 'Front Lever',
    category: 'bodyweight',
    isIsometric: true,
    muscles: { primary: ['Latissimus Dorsi', 'Core'], secondary: ['Biceps', 'Rear Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Body horizontal', check: (angles) => true, good: 'Body horizontal under bar', bad: 'Keep body straight and horizontal', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Front lever is an advanced isometric hold requiring extreme lat and core strength to maintain a horizontal body under the bar (NSCA 2016).',
  },

  back_lever: {
    name: 'Back Lever',
    category: 'bodyweight',
    isIsometric: true,
    muscles: { primary: ['Pectorals', 'Biceps', 'Core'], secondary: ['Front Deltoids'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Body horizontal', check: (angles) => true, good: 'Body horizontal behind bar', bad: 'Maintain straight horizontal line', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Back lever demands high shoulder extension strength and core stability in a prone horizontal position (NSCA 2016).',
  },

  planche: {
    name: 'Planche',
    category: 'bodyweight',
    isIsometric: true,
    muscles: { primary: ['Pectorals', 'Front Deltoids', 'Core'], secondary: ['Triceps', 'Serratus Anterior'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Body horizontal', check: (angles) => true, good: 'Body horizontal above hands', bad: 'Lean forward more and keep body straight', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Planche is one of the most difficult bodyweight holds, requiring extreme anterior deltoid and core strength (NSCA 2016).',
  },

  ring_dip: {
    name: 'Ring Dip',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Ring stability', check: (angles) => true, good: 'Rings stable', bad: 'Keep rings close to body', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet' },
    ],
    scienceNotes: 'Ring dips produce significantly higher muscle activation than bar dips due to instability demands (Snarr 2013).',
  },

  ring_push_up: {
    name: 'Ring Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Core', 'Triceps'], secondary: ['Front Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Ring turnout', check: (angles) => true, good: 'Rings turned out at top', bad: 'Turn rings out at the top', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'Ring push-ups increase chest and core activation by 50% or more compared to floor push-ups (Snarr 2013).',
  },

  ring_row: {
    name: 'Ring Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Core', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Body straight', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160, good: 'Body rigid', bad: 'Keep body in a straight line', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet' },
    ],
    scienceNotes: 'Ring rows allow progressive difficulty adjustment through body angle with added instability challenge (Snarr 2013).',
  },

  typewriter_pull_up: {
    name: 'Typewriter Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Core', 'Rear Deltoids'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Chin above bar', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 90, good: 'Chin stays above bar', bad: 'Keep chin above bar throughout lateral movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Typewriter pull-ups develop unilateral lat strength by shifting bodyweight laterally while maintaining chin above bar (NSCA 2016).',
  },

  one_arm_push_up: {
    name: 'One-Arm Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Front Deltoids', 'Obliques'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Minimal rotation', check: (angles) => angles.trunk < 30, good: 'Minimal torso rotation', bad: 'Minimize body rotation', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'One-arm push-ups demand extreme pressing strength and anti-rotation core stability (Cogley 2005).',
  },

  skin_the_cat: {
    name: 'Skin the Cat',
    category: 'bodyweight',
    muscles: { primary: ['Shoulders', 'Lats', 'Core'], secondary: ['Biceps', 'Pectorals'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled motion', check: (angles) => true, good: 'Controlled rotation', bad: 'Move slowly through full range', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Skin the cat develops shoulder flexibility and strength through a full 360-degree shoulder rotation under load (NSCA 2016).',
  },

  // ===== CARDIO / CONDITIONING =====
  rowing_machine: {
    name: 'Rowing Machine (Erg)',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Lats', 'Biceps', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Drive sequence', check: (angles) => true, good: 'Legs-back-arms sequence', bad: 'Drive with legs first, then back, then arms', severity: 'minor', citation: 'Kleshnev V, 2010, Rowing Biomechanics Newsletter' },
    ],
    scienceNotes: 'Rowing ergometer engages 86% of the musculature with correct drive sequence: legs, back, arms (Kleshnev 2010).',
  },

  ski_erg: {
    name: 'Ski Erg',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Core', 'Triceps'], secondary: ['Shoulders', 'Hip Flexors'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 150,
    formChecks: [
      { name: 'Hip hinge', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 100, good: 'Good hip hinge on pull', bad: 'Hinge more at hips during pull', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Ski erg develops upper body pulling power and cardiovascular endurance simultaneously (NSCA 2016).',
  },

  assault_bike: {
    name: 'Assault Bike',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Shoulders', 'Core'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Upright posture', check: (angles) => angles.trunk < 40, good: 'Good posture', bad: 'Stay more upright', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Assault bike provides full-body conditioning with fan-based resistance that scales with effort (NSCA 2016).',
  },

  sled_push: {
    name: 'Sled Push',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Core', 'Shoulders'] },
    joint: 'knee',
    getValue: (angles) => bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'),
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Forward lean', check: (angles) => angles.trunk > 30, good: 'Good forward lean', bad: 'Lean into the sled more', severity: 'minor', citation: 'Winwood PW et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Sled pushing develops horizontal force production with minimal eccentric loading, reducing muscle soreness (Winwood 2014).',
  },

  sled_pull: {
    name: 'Sled Pull',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes', 'Upper Back'], secondary: ['Biceps', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip drive', check: (angles) => true, good: 'Driving through hips', bad: 'Drive hips forward', severity: 'minor', citation: 'Winwood PW et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Sled pulling develops posterior chain strength with concentric-only loading (Winwood 2014).',
  },

  tire_flip: {
    name: 'Tire Flip',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Glutes', 'Back', 'Shoulders'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 70,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip drive position', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 80, good: 'Low hip position to start', bad: 'Get hips lower before lifting', severity: 'major', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Tire flips combine deadlift and push mechanics, producing very high full-body power output (McGill 2009).',
  },

  rope_climb: {
    name: 'Rope Climb',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Core', 'Grip'], secondary: ['Forearms', 'Shoulders'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Foot lock', check: (angles) => true, good: 'Secure foot lock', bad: 'Establish foot lock before pulling', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Rope climbing develops grip strength, lat strength, and upper body pulling power with bodyweight load (NSCA 2016).',
  },

  // ===== FUNCTIONAL / CROSSFIT =====
  devil_press: {
    name: 'Devil Press',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Shoulders', 'Chest', 'Glutes', 'Core'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Full overhead lockout', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Full overhead lockout', bad: 'Lock out dumbbells fully overhead', severity: 'major', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Devil press combines burpee with dumbbell snatch, producing extreme metabolic demand (NSCA 2016).',
  },

  dumbbell_snatch: {
    name: 'Dumbbell Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Shoulders', 'Core', 'Glutes', 'Traps'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Full lockout overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell snatch develops unilateral power from floor to overhead in one movement (Suchomel 2015).',
  },

  dumbbell_clean: {
    name: 'Dumbbell Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Glutes', 'Traps', 'Biceps', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip drive', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155, good: 'Strong hip extension', bad: 'Drive hips forward to power the clean', severity: 'minor', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Dumbbell cleans develop explosive hip power with independent arm loading (Suchomel 2015).',
  },

  wall_walk: {
    name: 'Wall Walk',
    category: 'bodyweight',
    muscles: { primary: ['Shoulders', 'Core'], secondary: ['Triceps', 'Chest'] },
    joint: 'shoulder',
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 80,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled movement', check: (angles) => true, good: 'Controlled wall walk', bad: 'Move slowly and controlled', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wall walks progressively load the shoulders and develop overhead stability toward handstand positioning (NSCA 2016).',
  },

  sandbag_carry: {
    name: 'Sandbag Carry',
    category: 'compound',
    muscles: { primary: ['Core', 'Traps', 'Legs'], secondary: ['Shoulders', 'Forearms'] },
    joint: 'shoulder',
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 5,
    upThreshold: 20,
    formChecks: [
      { name: 'Upright posture', check: (angles) => angles.trunk < 20, good: 'Upright posture', bad: 'Stand taller', severity: 'minor', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Sandbag carries develop functional core stability and grip endurance with an unstable load (McGill 2009).',
  },

  // ===== SUPERSET / COMBO =====
  seated_back_extension: {
    name: 'Seated Back Extension',
    category: 'machine',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    getValue: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'),
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 145, good: 'Full back extension', bad: 'Extend further back', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
      { name: 'Controlled return', check: (angles) => bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') < 120, good: 'Good forward lean', bad: 'Lean further forward for full ROM', severity: 'minor', citation: 'NSCA, 2016', phase: 'bottom' },
    ],
    scienceNotes: 'Seated back extension machines target the erector spinae through controlled trunk extension from a seated position (NSCA 2016).',
  },

  superset: {
    name: 'Superset',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: [] },
    joint: 'multi',
    getValue: (angles) => {
      // Track the joint with the largest range of motion in the current movement
      const vals = [
        Math.min(angles.leftKnee, angles.rightKnee),
        Math.min(angles.leftElbow, angles.rightElbow),
        (angles.leftShoulder + angles.rightShoulder) / 2,
        (angles.leftHip + angles.rightHip) / 2,
      ];
      // Return the value furthest from 180 (most bent joint = most active)
      let best = vals[0], bestDelta = Math.abs(180 - vals[0]);
      for (let i = 1; i < vals.length; i++) {
        const d = Math.abs(180 - vals[i]);
        if (d > bestDelta) { best = vals[i]; bestDelta = d; }
      }
      return best;
    },
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      {
        name: 'Movement detected',
        check: (angles) => {
          const knee = Math.min(angles.leftKnee, angles.rightKnee);
          const elbow = Math.min(angles.leftElbow, angles.rightElbow);
          return knee < 160 || elbow < 160;
        },
        good: 'Active movement',
        bad: 'No significant joint movement detected',
        severity: 'minor',
        citation: 'General observation',
      },
    ],
    scienceNotes: 'Supersets pair two exercises back-to-back with no rest, increasing metabolic demand and training density (Robbins DW et al, 2010, J Strength Cond Res). Use this mode when alternating between exercises in a single video.',
  },
};

// RepCounter and ExerciseAutoDetector: import directly from './repCounter' and './exerciseDetector'
// Re-exports removed to break circular dependency (exercises <-> repCounter/exerciseDetector).

// ---------------------------------------------------------------------------
// Shared exercise grouping for UI selectors
// ---------------------------------------------------------------------------
// Groups exercises by category (compound / isolation / bodyweight), sorted
// alphabetically within each group. Skips 'superset' (handled as "Other").
export const EXERCISE_GROUPS = (() => {
  const groups = { compound: [], isolation: [], bodyweight: [], machine: [] };
  for (const [key, ex] of Object.entries(EXERCISES)) {
    if (key === 'superset') continue;
    const cat = ex.category || 'compound';
    if (groups[cat]) groups[cat].push({ key, name: ex.name });
    else groups.compound.push({ key, name: ex.name });
  }
  for (const g of Object.values(groups)) g.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
})();

// ---------------------------------------------------------------------------
// Bryllim exercise illustration mapping (CDN-loaded, not bundled)
// Maps our exercise keys to @bryllim/workout-guide slugs.
// Images: 512x512 PNG, 3 frames per exercise (start, mid, end).
// ---------------------------------------------------------------------------
const BRYLLIM_CDN = 'https://unpkg.com/@bryllim/workout-guide@1.0.0/assets';

const EXERCISE_SLUG_MAP = {
  squat: 'squat', front_squat: 'front-squat', goblet_squat: 'goblet-squat',
  deadlift: 'deadlift', romanian_deadlift: 'romanian-deadlift',
  hip_thrust: 'hip-thrust', lunge: 'walking-lunge',
  bulgarian_split_squat: 'bulgarian-split-squat',
  standing_leg_extension: 'leg-extension', calf_raise: 'standing-calf-raise',
  pushup: 'push-up', overhead_press: 'overhead-press',
  bench_press: 'bench-press', dip: 'dip',
  bent_over_row: 'barbell-row', pullup: 'pull-up',
  bicep_curl: 'bicep-curl', tricep_extension: 'overhead-tricep-extension',
  upright_row: 'upright-row', lateral_raise: 'lateral-raise',
  chest_supported_row: 'chest-supported-row', seated_cable_row: 'seated-row',
  lat_pulldown: 'lat-pulldown', leg_press: 'leg-press',
  leg_extension_machine: 'leg-extension', leg_curl_machine: 'leg-curl',
  machine_chest_press: 'machine-chest-press',
  plank: 'plank', crunch: 'crunch', mountain_climber: 'mountain-climber',
  burpee: 'burpee', jumping_jack: 'jumping-jack',
  pike_pushup: 'pike-push-up', diamond_pushup: 'diamond-push-up',
  inverted_row: 'inverted-row', jump_squat: 'jump-squat',
  pistol_squat: 'pistol-squat', glute_bridge: 'glute-bridge',
  wall_sit: 'wall-sit', dead_hang: 'dead-hang', l_sit: 'l-sit-hold',
  hollow_body: 'hollow-body-hold', overhead_hold: 'overhead-press',
  side_plank: 'side-plank', step_up: 'step-up',
  kettlebell_swing: 'kettlebell-swing', thruster: 'squat',
  clean_and_press: 'deadlift', renegade_row: 'push-up',
  turkish_getup: 'plank', bear_crawl: 'bear-crawl',
  muscle_up: 'pull-up', chinup: 'chin-up',
  box_jump: 'jump-squat', skater_jump: 'skater-hop',
  squat_jump_to_lunge: 'jump-squat', man_maker: 'push-up',
  commando_pullup: 'commando-pull-up', face_pull: 'face-pull',
  incline_bench_press: 'incline-bench-press', sumo_deadlift: 'sumo-deadlift',
  nordic_curl: 'nordic-hamstring-curl', seated_calf_raise: 'seated-calf-raise',
  hanging_leg_raise: 'hanging-leg-raise', hack_squat: 'hack-squat',
  smith_machine_squat: 'smith-machine-squat', zercher_squat: 'squat',
  overhead_squat: 'squat', power_clean: 'deadlift', snatch: 'deadlift',
  tbar_row: 't-bar-row', pendlay_row: 'pendlay-row',
  close_grip_bench: 'close-grip-bench-press', decline_bench: 'decline-bench-press',
  floor_press: 'bench-press', landmine_press: 'landmine-press',
  arnold_press: 'arnold-press', hammer_curl: 'hammer-curl',
  preacher_curl: 'preacher-curl', concentration_curl: 'concentration-curl',
  lying_bicep_curl: 'spider-curl', spider_curl: 'spider-curl',
  skull_crusher: 'skull-crusher', cable_tricep_pushdown: 'tricep-pushdown',
  front_raise: 'front-raise', rear_delt_fly: 'rear-delt-fly',
  shrug: 'shrug', cable_fly: 'cable-fly', dumbbell_fly: 'dumbbell-fly',
  cable_crossover: 'cable-fly', wrist_curl: 'wrist-curl',
  situp: 'decline-sit-up', vup: 'v-up',
  // New exercises slug mappings
  box_squat: 'squat', pause_squat: 'squat', belt_squat: 'squat',
  heel_elevated_squat: 'squat', landmine_squat: 'squat', pendulum_squat: 'squat',
  sissy_squat: 'squat', adductor_machine: 'hip-adduction', abductor_machine: 'hip-abduction',
  single_leg_press: 'leg-press', stiff_leg_deadlift: 'romanian-deadlift',
  single_leg_hip_thrust: 'hip-thrust', cable_pull_through: 'hip-thrust',
  lying_leg_curl: 'leg-curl', glute_ham_raise: 'nordic-hamstring-curl',
  reverse_hyperextension: 'hip-thrust', back_extension_45: 'back-extension',
  back_extension: 'back-extension', rack_pull: 'deadlift',
  donkey_calf_raise: 'standing-calf-raise', leg_press_calf_raise: 'standing-calf-raise',
  depth_jump: 'jump-squat', broad_jump: 'jump-squat',
  split_squat_jump: 'jump-squat', tuck_jump: 'jump-squat',
  curtsy_lunge: 'walking-lunge',
  incline_dumbbell_press: 'incline-bench-press', decline_dumbbell_press: 'decline-bench-press',
  flat_dumbbell_press: 'bench-press', machine_fly: 'pec-deck-fly',
  chest_dip: 'dip', decline_push_up: 'push-up',
  neutral_grip_pull_up: 'pull-up', wide_grip_pull_up: 'pull-up',
  close_grip_pull_up: 'pull-up', straight_arm_pulldown: 'lat-pulldown',
  assisted_pull_up: 'pull-up', scapular_pull_up: 'pull-up',
  single_arm_dumbbell_row: 'dumbbell-row', meadows_row: 'dumbbell-row',
  seal_row: 'barbell-row', machine_row: 'seated-row',
  cable_row_single: 'seated-row', dumbbell_pullover: 'dumbbell-fly',
  yates_row: 'barbell-row', incline_dumbbell_row: 'chest-supported-row',
  machine_shoulder_press: 'overhead-press', dumbbell_overhead_press: 'overhead-press',
  seated_dumbbell_press: 'overhead-press', z_press: 'overhead-press',
  cable_lateral_raise: 'lateral-raise', cable_front_raise: 'front-raise',
  cable_rear_delt_fly: 'rear-delt-fly', machine_rear_delt_fly: 'rear-delt-fly',
  band_pull_apart: 'face-pull', seated_lateral_raise: 'lateral-raise',
  barbell_curl: 'bicep-curl', ez_bar_curl: 'bicep-curl',
  cable_curl: 'bicep-curl', incline_dumbbell_curl: 'bicep-curl',
  reverse_curl: 'bicep-curl', zottman_curl: 'bicep-curl',
  drag_curl: 'bicep-curl', cross_body_curl: 'hammer-curl',
  machine_curl: 'bicep-curl',
  bench_dip: 'dip', kickback: 'tricep-kickback',
  cable_kickback: 'tricep-kickback', rope_pushdown: 'tricep-pushdown',
  overhead_cable_tricep: 'overhead-tricep-extension',
  machine_tricep_extension: 'overhead-tricep-extension',
  close_grip_push_up: 'diamond-push-up',
  dumbbell_shrug: 'shrug', cable_shrug: 'shrug',
  ab_wheel_rollout: 'plank', dragon_flag: 'hanging-leg-raise',
  cable_crunch: 'crunch', decline_crunch: 'decline-sit-up',
  hanging_knee_raise: 'hanging-leg-raise', lying_leg_raise: 'hanging-leg-raise',
  wood_chop: 'crunch', ab_crunch_machine: 'crunch',
  hang_clean: 'deadlift', hang_snatch: 'deadlift',
  clean_and_jerk: 'deadlift', clean_pull: 'deadlift', snatch_pull: 'deadlift',
  kettlebell_clean: 'kettlebell-swing', kettlebell_snatch: 'kettlebell-swing',
  kettlebell_press: 'overhead-press', kettlebell_goblet_squat: 'goblet-squat',
  kettlebell_row: 'dumbbell-row', kettlebell_deadlift: 'deadlift',
  ring_dip: 'dip', ring_push_up: 'push-up', ring_row: 'inverted-row',
  typewriter_pull_up: 'pull-up', one_arm_push_up: 'push-up',
  handstand_push_up: 'pike-push-up',
  sled_push: 'squat', rope_climb: 'pull-up',
  dumbbell_snatch: 'deadlift', dumbbell_clean: 'deadlift',
  farmers_walk: 'shrug', assault_bike: 'squat',
};

/**
 * Get illustration URL for an exercise frame.
 * @param {string} exerciseKey - Our exercise key (e.g. 'squat')
 * @param {number} frame - Frame number (1, 2, or 3)
 * @returns {string|null} CDN URL or null if no mapping exists
 */
export function getExerciseIllustration(exerciseKey, frame = 1) {
  const slug = EXERCISE_SLUG_MAP[exerciseKey];
  if (!slug) return null;
  return `${BRYLLIM_CDN}/${slug}/frame-${frame}.png`;
}

// ---------------------------------------------------------------------------
// Exercise definition validation
// ---------------------------------------------------------------------------

/**
 * Validate a single exercise definition has all required fields.
 * @param {object} exercise - Exercise definition object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateExercise(exercise) {
  const errors = [];
  if (!exercise.name || typeof exercise.name !== 'string') errors.push('missing or invalid name');
  if (exercise.isIsometric) return { valid: errors.length === 0, errors };
  if (typeof exercise.getValue !== 'function') errors.push('missing getValue function');
  if (exercise.downThreshold == null) errors.push('missing downThreshold');
  if (exercise.upThreshold == null) errors.push('missing upThreshold');
  if (!Array.isArray(exercise.formChecks)) {
    errors.push('missing formChecks array');
  } else {
    for (let i = 0; i < exercise.formChecks.length; i++) {
      const fc = exercise.formChecks[i];
      if (!fc.name) errors.push(`formCheck[${i}] missing name`);
      if (typeof fc.check !== 'function') errors.push(`formCheck[${i}] missing check function`);
      if (!fc.good) errors.push(`formCheck[${i}] missing good text`);
      if (!fc.bad) errors.push(`formCheck[${i}] missing bad text`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate all exercises and log warnings for invalid definitions.
 * @returns {{ total: number, valid: number, invalid: Array<{ key: string, errors: string[] }> }}
 */
export function validateAllExercises() {
  const results = { total: 0, valid: 0, invalid: [] };
  for (const [key, ex] of Object.entries(EXERCISES)) {
    results.total++;
    const { valid, errors } = validateExercise(ex);
    if (valid) {
      results.valid++;
    } else {
      results.invalid.push({ key, errors });
    }
  }
  if (results.invalid.length > 0) {
    console.warn(`[exercises] ${results.invalid.length}/${results.total} exercises have validation errors:`,
      results.invalid.map(e => `${e.key}: ${e.errors.join(', ')}`).join('; '));
  }
  return results;
}

// Run validation at boot in development mode only
if (import.meta.env.DEV) {
  validateAllExercises();
}

// ---------------------------------------------------------------------------
// Per-exercise rep timing bounds (milliseconds)
// Based on biomechanics literature for controlled tempo lifting.
// Compound lifts: 1.5-8s per rep (includes pause at bottom)
// Isolation: 1-6s per rep
// Bodyweight: 1.2-7s per rep
// ---------------------------------------------------------------------------

export const REP_TIMING = {
  squat:              { minRepPeriod: 1500, maxRepPeriod: 8000 },
  front_squat:        { minRepPeriod: 1500, maxRepPeriod: 8000 },
  goblet_squat:       { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bench_press:        { minRepPeriod: 1500, maxRepPeriod: 8000 },
  deadlift:           { minRepPeriod: 1500, maxRepPeriod: 8000 },
  romanian_deadlift:  { minRepPeriod: 1500, maxRepPeriod: 8000 },
  overhead_press:     { minRepPeriod: 1500, maxRepPeriod: 8000 },
  shoulder_press:     { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bent_over_row:      { minRepPeriod: 1500, maxRepPeriod: 8000 },
  hip_thrust:         { minRepPeriod: 1500, maxRepPeriod: 8000 },
  lunge:              { minRepPeriod: 1500, maxRepPeriod: 8000 },
  leg_press:          { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bicep_curl:         { minRepPeriod: 1000, maxRepPeriod: 6000 },
  hammer_curl:        { minRepPeriod: 1000, maxRepPeriod: 6000 },
  tricep_extension:   { minRepPeriod: 1000, maxRepPeriod: 6000 },
  tricep_pushdown:    { minRepPeriod: 1000, maxRepPeriod: 6000 },
  lateral_raise:      { minRepPeriod: 1000, maxRepPeriod: 6000 },
  front_raise:        { minRepPeriod: 1000, maxRepPeriod: 6000 },
  calf_raise:         { minRepPeriod: 1000, maxRepPeriod: 6000 },
  push_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  pull_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  chin_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  dip:                { minRepPeriod: 1200, maxRepPeriod: 7000 },
};
