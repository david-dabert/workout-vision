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
// landmark visibility, falling back to Math.min when both are well-tracked.
const VIS_THRESHOLD = 0.5;

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
  // Neither well-tracked: return whichever is a valid number, or null
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) return Math.max(left, right);
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
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) return Math.max(left, right);
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
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) < 90,
        good: 'Below parallel',
        bad: 'Above parallel -- sit deeper',
        severity: 'major',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        good: 'Knees tracking evenly',
        bad: 'Asymmetric knee bend -- check for lateral shift',
        severity: 'major',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'Trunk angle',
        check: (angles) => angles.trunk < 55,
        good: 'Upright torso maintained',
        bad: 'Excessive forward lean -- chest up',
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
          const leftValgus = lk.x - la.x;
          const rightValgus = ra.x - rk.x;
          return leftValgus > -0.02 && rightValgus > -0.02;
        },
        good: 'Knees tracking over toes',
        bad: 'Knee cave detected -- push knees out',
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
        bad: 'Above parallel -- sit deeper',
        severity: 'major',
        citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 40,
        good: 'Upright torso -- elbows high',
        bad: 'Torso collapsing forward -- elbows up',
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
        bad: 'Go deeper -- the goblet position allows it',
        severity: 'minor',
        citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 45,
        good: 'Torso upright',
        bad: 'Leaning forward -- keep weight close to chest',
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
        bad: 'Incomplete hinge -- push hips further back',
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
        bad: 'Incomplete lockout -- squeeze glutes at top',
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
        bad: 'Knees too bent or too locked -- slight bend protects hamstrings',
        severity: 'minor',
        citation: 'McAllister MJ et al, 2014, J Strength Cond Res',
      },
      {
        name: 'Hip hinge',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 95,
        good: 'Deep hip hinge achieved',
        bad: 'Hinge deeper -- push hips back',
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
        bad: 'Incomplete extension -- squeeze at the top',
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
        bad: 'Reposition feet -- knees should be ~90 deg at lockout',
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
          return angles.trunk < 15;
        },
        good: 'Neutral spine at lockout',
        bad: 'Anterior pelvic tilt detected -- tuck pelvis and brace abs at the top',
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
        bad: 'Go deeper -- rear knee should approach the ground',
        severity: 'minor',
        citation: 'Riemann BL et al, 2012, J Athl Train',
      },
      {
        name: 'Trunk upright',
        check: (angles) => angles.trunk < 25,
        good: 'Torso upright',
        bad: 'Leaning forward -- stay tall',
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
        bad: 'Extend fully -- squeeze at the top',
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
        bad: 'Knees bending -- keep legs straight',
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
        bad: 'Go deeper -- elbows to 90 deg or below',
        severity: 'major',
        citation: 'Cogley RM et al, 2005, J Strength Cond Res',
      },
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 15,
        good: 'Body in straight line',
        bad: 'Hips sagging or piking -- brace core',
        severity: 'major',
        citation: 'Freeman S et al, 2006, J Strength Cond Res',
      },
      {
        name: 'Elbow symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        good: 'Arms working evenly',
        bad: 'One arm doing more work -- equalize',
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
        bad: 'Excessive back lean -- reduce weight or brace harder',
        severity: 'major',
        citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res',
      },
      {
        name: 'Shoulder symmetry',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
        good: 'Shoulders pressing evenly',
        bad: 'Asymmetric press -- one arm lagging',
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
        bad: 'Lower the bar further -- touch chest',
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
        bad: 'Adjust torso -- aim for 45-60 deg forward lean',
        severity: 'major',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Elbow drive',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) < 60,
        good: 'Full contraction -- elbows pulled past torso',
        bad: 'Pull elbows higher -- squeeze shoulder blades',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        good: 'Both arms pulling evenly',
        bad: 'One arm pulling harder -- equalize',
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
        bad: 'Pull higher -- chin over the bar',
        severity: 'major',
        citation: 'Youdas JW et al, 2010, J Strength Cond Res',
      },
      {
        name: 'Full hang',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full dead hang at bottom',
        bad: 'Extend fully at bottom -- no half reps',
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
        bad: 'Curl higher -- full contraction',
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
        check: (angles) => angles.trunk < 15,
        good: 'Strict form -- no swinging',
        bad: 'Body swinging -- reduce weight or brace',
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
        bad: 'Elbows flaring -- keep them close to head',
        severity: 'minor',
        citation: 'Maeo S et al, 2023, Eur J Sport Sci',
      },
    ],
    scienceNotes: 'Overhead tricep exercises produce greater long-head activation due to stretched position (Maeo 2023). Full ROM from deep stretch to lockout is critical for hypertrophy.',
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
        bad: 'Raise higher -- at least to shoulder level',
        severity: 'minor',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
      {
        name: 'Symmetry',
        check: (angles) => Math.abs(angles.leftShoulder - angles.rightShoulder) < 15,
        good: 'Both arms at same height',
        bad: 'Uneven raise -- one arm lagging',
        severity: 'minor',
        citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'No shrugging',
        check: (angles) => angles.trunk < 10,
        good: 'Shoulders down -- clean isolation',
        bad: 'Shrugging -- depress shoulders and reduce weight',
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
        bad: 'Pull further -- drive elbows back',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 20,
        good: 'Both arms pulling evenly',
        bad: 'One arm pulling harder -- equalize',
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
        bad: 'Pull further -- squeeze shoulder blades',
        severity: 'minor',
        citation: 'Fenwick CM et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 30,
        good: 'Trunk upright and stable',
        bad: 'Excessive lean -- stay upright',
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
        bad: 'Pull lower -- bar should reach upper chest',
        severity: 'major',
        citation: 'Signorile JF et al, 2002, J Strength Cond Res',
      },
      {
        name: 'Full stretch',
        check: (angles) => Math.min(angles.leftElbow, angles.rightElbow) > 160,
        good: 'Full stretch at top',
        bad: 'Let the bar go fully up -- stretch lats',
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
        bad: 'Go deeper -- aim for 90 deg knee bend',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2001, Med Sci Sports Exerc',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        good: 'Knees pressing evenly',
        bad: 'Uneven press -- one leg pushing harder',
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
        bad: 'Extend fully -- squeeze quads at top',
        severity: 'minor',
        phase: 'top',
        citation: 'Signorile JF et al, 1994, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry',
        check: (angles) => Math.abs(angles.leftKnee - angles.rightKnee) < 12,
        good: 'Both legs extending evenly',
        bad: 'One leg weaker -- balance out',
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
        bad: 'Curl further -- bring heels closer to glutes',
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
        bad: 'Press further -- extend arms fully',
        severity: 'minor',
        citation: 'Larsen S et al, 2021, Int J Environ Res Public Health',
      },
      {
        name: 'Arm symmetry',
        check: (angles) => Math.abs(angles.leftElbow - angles.rightElbow) < 15,
        good: 'Both arms pressing evenly',
        bad: 'One arm lagging -- equalize',
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
        check: (angles) => angles.trunk < 15,
        good: 'Flat back -- strong plank position',
        bad: 'Hips sagging or piking -- maintain straight line',
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
        bad: 'Hips dropping -- squeeze glutes and brace abs',
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
        bad: 'Curl higher -- lift shoulder blades',
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
        bad: 'Hips rising -- keep back flat',
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
        bad: 'Go deeper -- head toward the ground',
        severity: 'minor',
        citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J',
      },
      {
        name: 'Hip pike',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) < 110,
        good: 'Hips high -- good pike angle',
        bad: 'Push hips higher -- maintain pike',
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
        bad: 'Go deeper -- chest should approach hands',
        severity: 'minor',
        citation: 'Cogley RM et al, 2005, J Strength Cond Res',
      },
      {
        name: 'Body alignment',
        check: (angles) => angles.trunk < 15,
        good: 'Body in straight line',
        bad: 'Hips sagging or piking -- brace core',
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
        bad: 'Pull higher -- chest to bar',
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
        bad: 'Hips sagging -- maintain plank position',
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
        bad: 'Soften your landing -- bend knees on impact',
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
        bad: 'Excessive forward lean -- work on ankle mobility',
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
        bad: 'Push hips higher -- full extension',
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
        bad: 'Reposition feet -- knees should be ~90 deg at top',
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
        bad: 'Slide lower -- aim for 90 deg knee angle',
        severity: 'minor',
        citation: 'Escamilla RF, 2001, Med Sci Sports Exerc',
      },
      {
        name: 'Back flat',
        check: (angles) => angles.trunk < 15,
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
      { name: 'Shoulders engaged', check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150, good: 'Shoulders active', bad: 'Pack shoulders -- do not hang passively', severity: 'major', citation: 'Escamilla RF et al, 2009' },
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
      { name: 'Body alignment', check: (angles) => angles.trunk < 15, good: 'Straight line from head to feet', bad: 'Lift hips -- maintain straight line', severity: 'major', citation: 'McGill SM, 2010' },
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
        bad: 'Stay tall -- avoid leaning forward',
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
        bad: 'Hinge deeper -- push hips further back',
        severity: 'major',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Full extension',
        check: (angles) => Math.min(angles.leftHip, angles.rightHip) > 170,
        good: 'Full hip snap at top',
        bad: 'Drive hips through -- full extension',
        severity: 'major',
        phase: 'top',
        citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res',
      },
      {
        name: 'Knee soft',
        check: (angles) => Math.min(angles.leftKnee, angles.rightKnee) > 140,
        good: 'Knees soft -- not squatting the swing',
        bad: 'Less knee bend -- this is a hinge, not a squat',
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
        bad: 'Too much rotation -- brace core and widen feet',
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
        bad: 'Keep arm vertical -- eyes on the weight',
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
        bad: 'Get lower -- knees should hover 2-3 inches off ground',
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
        bad: 'Pull higher -- chin over bar',
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
        bad: 'Land softer -- absorb with legs',
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
        bad: 'Land with more control -- stabilize before next jump',
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
        bad: 'Pull higher -- elbows should be at or above shoulder level',
        severity: 'minor',
        citation: 'Reinold MM et al, 2009, Am J Sports Med',
      },
      {
        name: 'Trunk stable',
        check: (angles) => angles.trunk < 15,
        good: 'Upright torso -- no leaning back',
        bad: 'Leaning back -- reduce weight and stay upright',
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
        bad: 'Lower the bar further -- touch upper chest',
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
        bad: 'Excessive trunk rounding -- maintain neutral spine',
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
        bad: 'Collapsing too fast -- slow the descent',
        severity: 'major',
        citation: 'Bourne MN et al, 2017, Br J Sports Med',
      },
      {
        name: 'Trunk alignment',
        check: (angles) => angles.trunk < 25,
        good: 'Body in straight line from knee to shoulder',
        bad: 'Hips breaking -- maintain a rigid torso',
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
        check: (angles) => angles.trunk < 15,
        good: 'Upright seated posture',
        bad: 'Sit upright -- avoid leaning forward',
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
        bad: 'Raise legs higher -- aim for parallel or above',
        severity: 'minor',
        citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc',
      },
      {
        name: 'No swinging',
        check: (angles) => Math.abs(angles.leftHip - angles.rightHip) < 15,
        good: 'Controlled movement -- no momentum',
        bad: 'Swinging detected -- slow down and use control',
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
      { name: 'Controlled rep', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 30, good: 'Isolated movement', bad: 'No swinging -- isolate the bicep', severity: 'minor', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Concentration curl produces highest biceps peak activation of all curl variants (Marcolin 2018).',
  },

  lying_bicep_curl: {
    name: 'Lying Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Brachioradialis'] },
    joint: 'elbow',
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 50, good: 'Full curl at top', bad: 'Curl further -- full contraction', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
      { name: 'No shoulder movement', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 40, good: 'Shoulders stable', bad: 'Keep shoulders pinned to bench', severity: 'major', citation: 'Marcolin G et al, 2018' },
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
      { name: 'Full contraction', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') < 45, good: 'Peak squeeze at top', bad: 'Curl higher -- squeeze at peak', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
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
      { name: 'Elbow position', check: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') < 25, good: 'Elbows at sides', bad: 'Keep elbows pinned -- no flaring', severity: 'minor', citation: 'Landin D, Thompson M, 2011' },
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
      { name: 'No swing', check: (angles) => angles.trunk < 15, good: 'Controlled raise', bad: 'No swinging -- keep torso still', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013' },
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
      { name: 'No arm bend', check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150, good: 'Arms straight', bad: 'Keep arms straight -- shrug with traps only', severity: 'minor', citation: 'NSCA, 2016' },
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
      { name: 'Slight elbow bend', check: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 130, good: 'Good arm arc', bad: 'Keep slight bend -- do not straighten arms', severity: 'minor', citation: 'Lauver JD et al, 2016' },
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
      { name: 'Controlled squeeze', check: (angles) => angles.trunk < 25, good: 'Good torso position', bad: 'Stay upright -- do not lean forward excessively', severity: 'minor', citation: 'Lauver JD et al, 2016' },
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
      { name: 'Lower back down', check: (angles) => angles.trunk < 15, good: 'Back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'Escamilla RF et al, 2006' },
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

// ---------------------------------------------------------------------------
// RepCounter
// ---------------------------------------------------------------------------

/**
 * Counts repetitions for a given exercise using hysteresis-based phase detection
 * on smoothed joint angles. Prevents double-counting via explicit state machine
 * (up -> going_down -> down -> going_up -> up).
 *
 * @example
 * const counter = new RepCounter('squat');
 * // in your frame loop:
 * const result = counter.update(landmarks);
 * // result.reps, result.phase, result.formFeedback, etc.
 */
export class RepCounter {
  /**
   * @param {string} exerciseKey - key from EXERCISES
   * @param {object} [opts] - options
   * @param {number} [opts.fps=30] - capture frame rate; adjusts smoother and state machine
   */
  constructor(exerciseKey, opts = {}) {
    const ex = EXERCISES[exerciseKey];
    if (!ex) throw new Error(`Unknown exercise: ${exerciseKey}`);
    this._exercise = ex;
    this._exerciseKey = exerciseKey;
    this._fps = opts.fps || 30;
    const smoothWindow = this._fps <= 5 ? 1 : 3;
    this._smoother = new AngleBuffer(smoothWindow);
    this._lowFps = this._fps <= 5;
    this.reset();
  }

  get repHistory() { return this._repHistory; }
  get reps() { return this._reps; }

  reset() {
    this._reps = 0;
    this._repHistory = [];
    this._currentRepIssues = [];
    this._issueFrameCounts = {};
    this._peakAngle = null;
    this._smoother.reset();
    // Threshold-crossing state
    this._atBottom = false;
    this._frameIdx = 0;
    this._phase = 'up';
    this._lastValue = null;
    // Two-pass: collect all landmarks in pass 1, count reps in pass 2
    this._collectedLandmarks = [];
    this._observedMin = Infinity;
    this._observedMax = -Infinity;
    this._useAdaptive = false;
    this._finalized = false;
    // Frame tracking for biomechanics integration
    this._repStartFrame = 0;
    this._bottomFrame = 0;
  }

  /**
   * Pass 1: collect landmarks frame by frame. No rep counting happens here.
   * Call finalize() after all frames to trigger pass 2 (rep counting with
   * locked thresholds computed from the full observed range).
   *
   * @param {Array} landmarks - 33 MediaPipe landmarks
   * @returns {{ reps: number, phase: string, angle: number, angles: object,
   *            formFeedback: Array, repCompleted: boolean,
   *            repHistory: Array }}
   */
  update(landmarks) {
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) {
      return {
        reps: this._reps, phase: this._phase, angle: null, angles: null,
        formFeedback: [], repCompleted: false, repHistory: this._repHistory,
      };
    }

    const angles = this._smoother.smooth(rawAngles);
    const ex = this._exercise;

    if (ex.isIsometric) {
      return this._handleIsometric(angles, landmarks);
    }

    const value = ex.getValue(angles, landmarks);
    this._frameIdx++;

    // Track observed range for threshold computation in finalize()
    if (value < this._observedMin) this._observedMin = value;
    if (value > this._observedMax) this._observedMax = value;

    // Store for pass 2
    this._collectedLandmarks.push(landmarks);

    // Track direction for live phase display
    if (this._lastValue !== null) {
      if (value < this._lastValue - 1) this._phase = 'down';
      else if (value > this._lastValue + 1) this._phase = 'up';
    }
    this._lastValue = value;

    return {
      reps: this._reps, phase: this._phase,
      angle: Math.round(value * 10) / 10, angles,
      formFeedback: [], repCompleted: false,
      repHistory: this._repHistory,
    };
  }

  /**
   * Pass 2: peak-valley rep detection on the full collected signal.
   *
   * Algorithm:
   * 1. Extract the exercise getValue() for every frame → raw signal
   * 2. Smooth with a wider window (5-frame moving average)
   * 3. Find local minima (valleys) and maxima (peaks)
   * 4. A rep = one valley followed by one peak where (peak - valley) >= minROM
   *    minROM = 30% of the full observed range, minimum 15 degrees
   *
   * This replaces threshold-crossing entirely. No thresholds to tune.
   * Works on any absolute angle range.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    const ex = this._exercise;
    if (ex.isIsometric || this._collectedLandmarks.length < 6) return;

    // Step 1: extract raw signal and per-frame angles/landmarks
    const rawSignal = [];
    const frameData = []; // { angles, landmarks } per frame
    const smoother = new AngleBuffer(this._fps <= 5 ? 1 : 3);

    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const landmarks = this._collectedLandmarks[i];
      const rawAngles = extractJointAngles(landmarks);
      if (!rawAngles) {
        rawSignal.push(null);
        frameData.push(null);
        continue;
      }
      const angles = smoother.smooth(rawAngles);
      const value = ex.getValue(angles, landmarks);
      rawSignal.push(value);
      frameData.push({ angles, landmarks });
    }

    // Step 2: smooth the signal with moving average
    // Window scales with FPS: 7 frames at 8fps (0.9s), 3 frames at 4fps (0.75s)
    const smoothed = [];
    const halfW = this._fps <= 5 ? 1 : 3;
    for (let i = 0; i < rawSignal.length; i++) {
      if (rawSignal[i] === null) { smoothed.push(null); continue; }
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - halfW); j <= Math.min(rawSignal.length - 1, i + halfW); j++) {
        if (rawSignal[j] !== null) { sum += rawSignal[j]; count++; }
      }
      smoothed.push(count > 0 ? sum / count : null);
    }

    // Step 3: find peaks and valleys with prominence filtering
    // Minimum prominence = 5 degrees prevents noise extrema
    // Minimum gap = 3 frames (~0.4s at 8fps) between extrema filters jitter
    const MIN_PROMINENCE = 5;
    const MIN_GAP_FRAMES = 3;
    const extrema = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] === null || smoothed[i-1] === null || smoothed[i+1] === null) continue;
      if (smoothed[i] > smoothed[i-1] && smoothed[i] > smoothed[i+1]) {
        extrema.push({ type: 'peak', index: i, value: smoothed[i] });
      } else if (smoothed[i] < smoothed[i-1] && smoothed[i] < smoothed[i+1]) {
        extrema.push({ type: 'valley', index: i, value: smoothed[i] });
      }
    }

    // Merge consecutive same-type extrema (keep the most extreme)
    const merged = [];
    for (const e of extrema) {
      if (merged.length > 0 && merged[merged.length - 1].type === e.type) {
        const prev = merged[merged.length - 1];
        if (e.type === 'peak' && e.value > prev.value) merged[merged.length - 1] = e;
        if (e.type === 'valley' && e.value < prev.value) merged[merged.length - 1] = e;
      } else {
        merged.push(e);
      }
    }

    // Filter by prominence and minimum gap between alternating extrema
    const filtered = [];
    for (const e of merged) {
      if (filtered.length === 0) { filtered.push(e); continue; }
      const prev = filtered[filtered.length - 1];
      const gap = Math.abs(e.value - prev.value);
      const frameGap = e.index - prev.index;
      if (gap >= MIN_PROMINENCE && frameGap >= MIN_GAP_FRAMES) {
        filtered.push(e);
      } else if (gap < MIN_PROMINENCE) {
        // Noise extremum: keep whichever is more extreme
        if (e.type === 'peak' && e.value > prev.value) filtered[filtered.length - 1] = e;
        else if (e.type === 'valley' && e.value < prev.value) filtered[filtered.length - 1] = e;
      }
      // If frameGap too small but prominence sufficient, still keep it
      else { filtered.push(e); }
    }

    // Step 4: count reps as valley→peak pairs with sufficient ROM
    const range = this._observedMax - this._observedMin;
    const minROM = Math.max(15, range * 0.3);

    // Reset rep state
    this._reps = 0;
    this._repHistory = [];
    this._currentRepIssues = [];
    this._issueFrameCounts = {};

    // Helper: find where the descent toward a valley actually begins.
    // Scans backwards from the valley through the smoothed signal to find
    // the local peak just before the descent. This excludes rest time
    // between reps where the angle stays flat at the extended position.
    const findDescentStart = (valleyIdx) => {
      let best = valleyIdx;
      for (let i = valleyIdx - 1; i >= 0; i--) {
        if (smoothed[i] === null) break;
        if (smoothed[i] >= smoothed[best]) {
          best = i;
        } else if (smoothed[best] - smoothed[i] > 3) {
          // Signal started going back down — we passed the local peak
          break;
        }
      }
      return best;
    };

    let lastValley = null;

    for (const e of filtered) {
      if (e.type === 'valley') {
        lastValley = e;
      } else if (e.type === 'peak' && lastValley !== null) {
        const rom = e.value - lastValley.value;
        if (rom >= minROM) {
          // Find actual start of descent for this rep (excludes rest time)
          const descentStart = findDescentStart(lastValley.index);

          this._peakAngle = e.value;
          this._repStartFrame = descentStart;
          this._bottomFrame = lastValley.index;
          this._frameIdx = e.index;

          // Evaluate form at the appropriate phase for each check
          this._currentRepIssues = [];
          this._issueFrameCounts = {};
          const bottomData = frameData[lastValley.index];
          const topData = frameData[e.index]; // peak frame = top of rep
          if (bottomData || topData) {
            const formFeedback = this._evaluateFormPhased(bottomData, topData);
            for (const fb of formFeedback) {
              if (!fb.passed) {
                this._currentRepIssues.push(fb.name);
              }
            }
          }

          this._completeRep(
            frameData[e.index]?.angles || bottomData?.angles || {},
            frameData[e.index]?.landmarks || bottomData?.landmarks || []
          );
          lastValley = null; // consumed
        }
      }
    }

    this._useAdaptive = true; // for diagnostics display
  }

  _handleIsometric(angles, landmarks) {
    const formFeedback = this._evaluateForm(angles, landmarks);
    return {
      reps: 0,
      phase: 'hold',
      angle: Math.round(angles.trunk * 10) / 10,
      angles,
      formFeedback,
      repCompleted: false,
      repHistory: [],
    };
  }

  /** Diagnostic data for debugging on mobile */
  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    const minROM = Math.max(15, range * 0.3);
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      minROM: Math.round(minROM * 10) / 10,
      method: 'peak-valley',
      repsDetected: this._reps,
      totalFrames: this._collectedLandmarks.length,
    };
  }

  _completeRep(angles, landmarks) {
    this._reps++;
    const totalChecks = this._exercise.formChecks.length;
    const failedMajor = this._currentRepIssues.filter((name) => {
      const fc = this._exercise.formChecks.find((c) => c.name === name);
      return fc && fc.severity === 'major';
    }).length;
    const failedMinor = this._currentRepIssues.filter((name) => {
      const fc = this._exercise.formChecks.find((c) => c.name === name);
      return fc && fc.severity !== 'major';
    }).length;

    // Score: start at 100, -15 per major issue, -5 per minor issue
    const score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);

    // Map check names to their failure text so form notes show actionable feedback
    // ("Curl higher -- full contraction") instead of the check name ("Full contraction")
    const issueTexts = this._currentRepIssues.map(name => {
      const fc = this._exercise.formChecks.find(c => c.name === name);
      return fc ? fc.bad : name;
    });

    this._repHistory.push({
      score,
      issues: issueTexts,
      ts: Date.now(),
      peakAngle: this._peakAngle,
      // Frame indices for biomechanics: start of descent, bottom, end of ascent
      startFrame: this._repStartFrame,
      bottomFrame: this._bottomFrame,
      endFrame: this._frameIdx,
    });

    this._peakAngle = null;
    this._currentRepIssues = [];
    this._issueFrameCounts = {};
    // Next rep starts from this frame
    this._repStartFrame = this._frameIdx;
  }

  _evaluateForm(angles, landmarks) {
    return this._exercise.formChecks.map((fc) => {
      // Pass landmarks as optional second argument; existing checks that only
      // use angles will simply ignore it.
      const passed = fc.check(angles, landmarks);
      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }

  /**
   * Phase-aware form evaluation: checks tagged phase:'top' are evaluated
   * at the peak frame (top of rep), all others at the valley frame (bottom).
   * This fixes lockout/extension/hang checks that were previously evaluated
   * at the wrong frame and could never pass.
   */
  _evaluateFormPhased(bottomData, topData) {
    return this._exercise.formChecks.map((fc) => {
      const isTopCheck = fc.phase === 'top';
      const data = isTopCheck ? topData : bottomData;
      if (!data) {
        // If the needed frame data is missing, assume passed to avoid false negatives
        return { name: fc.name, passed: true, text: fc.good, severity: fc.severity };
      }
      const passed = fc.check(data.angles, data.landmarks);
      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }
}

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

    // Bicep curl family: elbow ROM dominates + standing upright
    if (elbowRange > 15 && elbowRange > kneeRange * 1.5 && elbowRange > hipRange * 1.5
        && kneeBufAvg > 140 && hipBufAvg > 140 && trunkBufAvg < 35) {
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
    if (elbowRange > 20 && shoulderAvg > 80 && trunkBufAvg < 25 && kneeBufAvg > 140) {
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
