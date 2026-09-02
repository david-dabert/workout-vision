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

export function bestSide(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  // Both sides well-tracked: use min (strictest for down-first exercises)
  if (leftOk && rightOk) return Math.min(left, right);
  // Only one side valid: use that side
  if (leftOk) return left;
  if (rightOk) return right;
  // Neither well-tracked: use the side with HIGHER visibility (less hallucinated).
  // Previous code used Math.max(left, right) here which AMPLIFIED hallucinations
  // by picking the most extreme (and often most wrong) angle.
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
}

// For exercises where the tracked value goes UP during the concentric phase
export function bestSideMax(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  if (leftOk && rightOk) return Math.max(left, right);
  if (leftOk) return left;
  if (rightOk) return right;
  // Same fix: prefer higher-visibility side instead of Math.max
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
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
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Below parallel',
        bad: 'Above parallel',
        severity: 'major',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 18,
        good: 'Knees tracking evenly',
        bad: 'Asymmetric knee bend',
        severity: 'major',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk < 55,
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
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 90,
        good: 'Below parallel',
        bad: 'Above parallel',
        severity: 'major',
        citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 40,
        good: 'Upright torso -- elbows high',
        bad: 'Torso collapsing forward',
        severity: 'major',
        citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
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
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 100,
        good: 'Full depth achieved',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 45,
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
        good: 'Full hip hinge range',
        bad: 'Incomplete hinge',
        severity: 'minor',
        citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc',
      },
      {
        name: 'Trunk neutral',
        check: (angles) => angles.trunk > 20 && angles.trunk < 80,
        good: 'Back angle within safe range',
        bad: 'Excessive trunk rounding or hyperextension',
        severity: 'major',
        citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 165,
        good: 'Full hip extension at top',
        bad: 'Incomplete lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Hales ME et al, 2009, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Conventional deadlift produces peak erector and hamstring activation at the bottom third of the pull (Cholewicki 1991). Lumbar flexion under load increases disc injury risk (McGill 2007).',
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
        good: 'Knees slightly bent -- soft lock maintained',
        bad: 'Knees too bent or too locked',
        severity: 'minor',
        citation: 'McAllister MJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Hip hinge',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 95,
        good: 'Deep hip hinge achieved',
        bad: 'Hinge deeper',
        severity: 'major',
        citation: 'McAllister MJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk > 40 && angles.trunk < 85,
        good: 'Back flat through hinge',
        bad: 'Back rounding or insufficient hinge',
        severity: 'major',
        citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
      },
    ],
    scienceNotes: 'RDL places peak stretch on hamstrings at end range with minimal quad involvement. Keeping knees at 15-20 deg flexion maximizes hamstring length-tension (McAllister 2014).',
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
        good: 'Knee angle ~90 deg at top',
        bad: 'Reposition feet',
        severity: 'minor',
        citation: 'Contreras B et al, 2015, J Appl Biomech',
      },
      {
        name: 'Anterior pelvic tilt',
        // At lockout (hip angle > 160), trunk should remain nearly horizontal (< 15 deg)
        // to avoid hyperextending the lumbar spine via anterior pelvic tilt.
        check: (angles) => {
          const hipAngle = Math.min(angles.leftHip, angles.rightHip);
          if (hipAngle <= 160) return true; // only check near lockout
          return angles.trunk < 20;
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
        good: 'Rear knee approaching floor',
        bad: 'Go deeper',
        severity: 'minor',
        citation: 'Riemann BL et al, 2012, J Athl Train',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 25,
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
        good: 'Deep split squat position',
        bad: 'Sit deeper into the split',
        severity: 'minor',
        citation: 'DeForest BA et al, 2014, Int J Exerc Sci',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 30,
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
        good: 'Full depth -- chest near floor',
        bad: 'Go deeper',
        severity: 'major',
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
      {
        name: 'Elbow symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        good: 'Arms working evenly',
        bad: 'One arm doing more work',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
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
        good: 'Arms fully extended overhead',
        bad: 'Press to full lockout',
        severity: 'minor',
        phase: 'top',
        citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 20,
        good: 'Trunk vertical -- no excessive lean',
        bad: 'Excessive back lean',
        severity: 'major',
        citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res',
      },
      {
        name: 'Shoulder symmetry',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
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
        good: 'Bar at chest level',
        bad: 'Lower the bar further',
        severity: 'major',
        citation: 'Larsen S et al, 2021, Int J Environ Res Public Health',
      },
      {
        name: 'Lockout',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
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
        good: 'Trunk hinged at proper angle',
        bad: 'Adjust torso',
        severity: 'major',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Elbow drive',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        good: 'Full contraction -- elbows pulled past torso',
        bad: 'Pull elbows higher',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
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
        good: 'Chin above bar level',
        bad: 'Pull higher',
        severity: 'major',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Full hang',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
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
        good: 'Full bicep squeeze at top',
        bad: 'Curl higher',
        severity: 'minor',
        citation: 'Oliveira LF et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Full extension',
        check: (angles) => Math.max(angles.leftElbow, angles.rightElbow) > 145,
        good: 'Full extension at bottom',
        bad: 'Extend arms fully at bottom',
        severity: 'minor',
        phase: 'top',
        citation: 'Oliveira LF et al, 2009, J Strength Cond Res',
      },
      {
        name: 'No body swing',
        check: (angles) => angles.trunk < 20,
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
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      {
        name: 'Full pull',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        good: 'Bar at chest -- full lat contraction',
        bad: 'Pull lower',
        severity: 'major',
        citation: 'Signorile JF et al, 2002, J Strength Cond Res',
      },
      {
        name: 'Full stretch',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
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
    getValue: (angles) => angles.trunk,
    downThreshold: null,
    upThreshold: null,
    formChecks: [
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 20,
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
        good: 'Deep hip hinge at bottom',
        bad: 'Hinge deeper',
        severity: 'major',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 170,
        good: 'Full hip snap at top',
        bad: 'Drive hips through',
        severity: 'major',
        phase: 'top',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Knee soft',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 140,
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

  // ===== SUPERSET / COMBO =====
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
  const groups = { compound: [], isolation: [], bodyweight: [] };
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
