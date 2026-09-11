/**
 * Declarative exercise definitions — compiled by exerciseDSL.js
 *
 * This file contains ALL 274 exercise definitions in DSL format.
 * Import compileExercises from exerciseDSL.js and pass EXERCISE_DEFINITIONS to get
 * the runtime objects expected by RepCounter, ExerciseAutoDetector, and form checks.
 *
 * Generated from exercises.js — do not edit the original, edit this file instead.
 */

import { bestSide, bestSideMax, qualityBelow, qualityAbove, qualityRange, qualitySymmetry } from './exercises';

// ─── Shorthand constants for common value specs ───

const BS_KNEE = { type: 'bestSide', left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee' };
const BS_HIP = { type: 'bestSide', left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip' };
const BS_ELBOW = { type: 'bestSide', left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow' };
const BS_SHOULDER = { type: 'bestSide', left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder' };
const BSM_KNEE = { type: 'bestSideMax', left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee' };
const BSM_HIP = { type: 'bestSideMax', left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip' };
const BSM_ELBOW = { type: 'bestSideMax', left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow' };
const BSM_SHOULDER = { type: 'bestSideMax', left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder' };
const D_TRUNK = { type: 'direct', key: 'trunk' };

// ─── Reusable landmark-based check functions ───

/** Knee valgus check via landmarks (squat family) */
const kneeValgusCheck = {
  name: 'Knee valgus',
  type: 'custom',
  check: (angles, landmarks) => {
    if (!landmarks || !landmarks[25] || !landmarks[26] || !landmarks[27] || !landmarks[28]) return true;
    const lk = landmarks[25], la = landmarks[27], rk = landmarks[26], ra = landmarks[28];
    const leftVis = (lk.visibility || 0) > 0.3 && (la.visibility || 0) > 0.3;
    const rightVis = (rk.visibility || 0) > 0.3 && (ra.visibility || 0) > 0.3;
    if (!leftVis && !rightVis) return true;
    const leftOk = !leftVis || (lk.x - la.x) > -0.02;
    const rightOk = !rightVis || (ra.x - rk.x) > -0.02;
    return leftOk && rightOk;
  },
  quality: (angles, landmarks) => {
    if (!landmarks || !landmarks[25] || !landmarks[26] || !landmarks[27] || !landmarks[28]) return 1;
    const lk = landmarks[25], la = landmarks[27], rk = landmarks[26], ra = landmarks[28];
    const leftVis = (lk.visibility || 0) > 0.3 && (la.visibility || 0) > 0.3;
    const rightVis = (rk.visibility || 0) > 0.3 && (ra.visibility || 0) > 0.3;
    if (!leftVis && !rightVis) return 1;
    const drifts = [];
    if (leftVis) drifts.push(lk.x - la.x);
    if (rightVis) drifts.push(ra.x - rk.x);
    const worstDrift = Math.min(...drifts);
    if (worstDrift >= -0.02) return 1;
    return Math.max(0, 1 - ((-0.02 - worstDrift) / 0.04));
  },
  good: 'Knees tracking over toes',
  bad: 'Knee cave detected',
  severity: 'major',
  citation: 'Hewett TE et al, 2005, Am J Sports Med',
};

/** Lumbar flexion check via landmarks (deadlift family) */
const lumbarFlexionCheck = {
  name: 'Lumbar flexion',
  type: 'custom',
  check: (angles, landmarks) => {
    if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return true;
    const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
    const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
    return (midHipZ - midShoulderZ) < 0.03;
  },
  quality: (angles, landmarks) => {
    if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return 1;
    const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
    const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
    const diff = midHipZ - midShoulderZ;
    if (diff < 0.03) return 1;
    return Math.max(0, 1 - (diff - 0.03) / 0.06);
  },
  good: 'Neutral spine maintained',
  bad: 'Potential lumbar rounding detected',
  severity: 'major',
  citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
};


export const EXERCISE_DEFINITIONS = {

  // ===== LOWER COMPOUND =====
  squat: {
    name: 'Barbell Back Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Erectors', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 120,
    upThreshold: 155,
    amplitudeRatio: 0.15,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 90, good: 'Below parallel', bad: 'Above parallel — go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res', safetyNote: { en: 'If you have hip pain or impingement, do not force depth beyond comfort.', fr: 'En cas de douleur ou conflit de hanche, ne forcez pas la profondeur.' } },
      { name: 'Knee symmetry', type: 'symmetry', left: 'leftKnee', right: 'rightKnee', threshold: 18, good: 'Knees tracking evenly', bad: 'Asymmetric knee bend', severity: 'major', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
      { name: 'Trunk angle', type: 'below', key: 'trunk', threshold: 55, good: 'Upright torso maintained', bad: 'Excessive forward lean', severity: 'minor', citation: 'Fry AC et al, 2003, J Strength Cond Res' },
      kneeValgusCheck,
    ],
    scienceNotes: 'Full ROM squats produce greater quad and glute activation than partial squats (Schoenfeld 2010). Knee valgus >10 deg increases ACL strain (Hewett 2005). Forward lean >55 deg shifts load to erectors and increases spinal shear (Fry 2003).',
    limitations: ['foot pressure distribution', 'breathing technique', 'grip width', 'bar position on traps'],
  },

  front_squat: {
    name: 'Front Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 120,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 85, good: 'Below parallel', bad: 'Above parallel', severity: 'major', citation: 'Gullett JC et al, 2009, J Strength Cond Res' },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 40, margin: 12, good: 'Upright torso -- elbows high', bad: 'Torso collapsing forward', severity: 'major', citation: 'Gullett JC et al, 2009, J Strength Cond Res' },
      { name: 'Knee symmetry', type: 'symmetry', left: 'leftKnee', right: 'rightKnee', threshold: 12, good: 'Knees tracking evenly', bad: 'Asymmetric knee bend', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Front squats reduce posterior shear on the knee vs back squats while demanding greater quad activation and more upright torso (Gullett 2009).',
  },

  goblet_squat: {
    name: 'Goblet Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back', 'Biceps'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 115,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 90, good: 'Full depth achieved', bad: 'Go deeper', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 45, margin: 12, good: 'Torso upright', bad: 'Leaning forward', severity: 'minor', citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J' },
    ],
    scienceNotes: 'Goblet position acts as counterbalance enabling deeper squat with more upright torso, ideal for motor learning (Contreras & Schoenfeld 2011).',
  },

  deadlift: {
    name: 'Conventional Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes', 'Erectors'], secondary: ['Quadriceps', 'Trapezius', 'Forearms'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip hinge depth', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 100, good: 'Full hip hinge range', bad: 'Incomplete hinge', severity: 'minor', citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc' },
      { name: 'Trunk neutral', type: 'range', key: 'trunk', low: 20, high: 80, margin: 12, good: 'Back angle within safe range', bad: 'Excessive trunk rounding or hyperextension', severity: 'major', citation: 'Cholewicki J et al, 1991, Med Sci Sports Exerc' },
      lumbarFlexionCheck,
      { name: 'Lockout', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 165, good: 'Full hip extension at top', bad: 'Incomplete lockout', severity: 'minor', citation: 'Hales ME et al, 2009, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Conventional deadlift produces peak erector and hamstring activation at the bottom third of the pull (Cholewicki 1991). Lumbar flexion under load increases disc injury risk by 300-800% (McGill 2007).',
    limitations: ['grip type', 'breathing technique', 'bar path', 'intra-abdominal pressure'],
  },

  romanian_deadlift: {
    name: 'Romanian Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Erectors', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Knee soft lock', type: 'custom',
        check: (angles) => {
          const knee = Math.min(angles.leftKnee, angles.rightKnee);
          return knee >= 150 && knee <= 175;
        },
        quality: (angles) => qualityRange(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 150, 175, 10), good: 'Knees slightly bent -- soft lock maintained', bad: 'Knees too bent or too locked', severity: 'minor', citation: 'McAllister MJ et al, 2014, J Strength Cond Res' },
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 95, good: 'Deep hip hinge achieved', bad: 'Hinge deeper', severity: 'major', citation: 'McAllister MJ et al, 2014, J Strength Cond Res' },
      { name: 'Trunk angle', type: 'range', key: 'trunk', low: 40, high: 85, margin: 12, good: 'Back flat through hinge', bad: 'Back rounding or insufficient hinge', severity: 'major', citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance' },
      lumbarFlexionCheck,
    ],
    scienceNotes: 'RDL places peak stretch on hamstrings at end range with minimal quad involvement. Keeping knees at 15-20 deg flexion maximizes hamstring length-tension (McAllister 2014). Lumbar flexion under load increases disc injury risk (McGill 2007).',
  },

  hip_thrust: {
    name: 'Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 170, good: 'Full hip extension -- peak glute contraction', bad: 'Incomplete extension', severity: 'major', citation: 'Contreras B et al, 2015, J Appl Biomech', phase: 'top' },
      { name: 'Knee angle', type: 'averageRange', left: 'leftKnee', right: 'rightKnee', low: 80, high: 110, good: 'Knee angle ~90 deg at top', bad: 'Reposition feet', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
      { name: 'Anterior pelvic tilt', type: 'custom',
        check: (angles) => {
          const hipAngle = Math.min(angles.leftHip, angles.rightHip);
          if (hipAngle <= 160) return true;
          return angles.trunk < 20;
        },
        quality: (angles) => {
          const hipAngle = bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip');
          if (hipAngle == null || hipAngle <= 160) return 1;
          return qualityBelow(angles.trunk, 20, 10);
        }, good: 'Neutral spine at lockout', bad: 'Anterior pelvic tilt detected', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech', phase: 'top' },
    ],
    scienceNotes: 'Hip thrust produces greater glute activation than squat at comparable loads (Contreras 2015). Full extension at top is critical for peak contraction.',
  },


  // ===== LOWER ISOLATION =====
  lunge: {
    name: 'Walking Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 105,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Rear knee approaching floor', bad: 'Go deeper', severity: 'minor', citation: 'Riemann BL et al, 2012, J Athl Train', safetyNote: { en: 'If you have hip pain or impingement, do not force depth beyond comfort.', fr: 'En cas de douleur ou conflit de hanche, ne forcez pas la profondeur.' } },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 25, margin: 10, good: 'Torso upright', bad: 'Leaning forward', severity: 'minor', citation: 'Farrokhi S et al, 2008, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Lunges produce significant unilateral quad and glute activation; deeper lunges increase glute contribution (Riemann 2012).',
  },

  bulgarian_split_squat: {
    name: 'Bulgarian Split Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core', 'Hip Flexors'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 105,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Deep split squat position', bad: 'Sit deeper into the split', severity: 'minor', citation: 'DeForest BA et al, 2014, Int J Exerc Sci' },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 30, margin: 10, good: 'Torso vertical', bad: 'Excessive forward lean', severity: 'minor', citation: 'DeForest BA et al, 2014, Int J Exerc Sci' },
    ],
    scienceNotes: 'Bulgarian split squat produces comparable quad activation to back squat with lower spinal load; effective unilateral overload (DeForest 2014).',
  },

  standing_leg_extension: {
    name: 'Standing Leg Extension',
    category: 'isolation',
    muscles: { primary: ['Quadriceps'], secondary: [] },
    joint: 'knee',
    value: BSM_KNEE,
    downThreshold: 120,
    upThreshold: 160,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => Math.max(angles.leftKnee, angles.rightKnee) > 165,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 165, 15), good: 'Full knee extension -- peak quad contraction', bad: 'Extend fully', severity: 'minor', citation: 'Signorile JF et al, 1994, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Leg extension isolates vastus medialis at terminal extension (last 15 deg). Full lockout is critical for VMO activation (Signorile 1994).',
  },

  calf_raise: {
    name: 'Standing Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    value: { type: 'heelDisplacement' },
    downThreshold: 45,
    upThreshold: 55,
    formChecks: [
      { name: 'Knee straight', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Knees straight -- gastrocnemius targeted', bad: 'Knees bending', severity: 'minor', citation: 'Riemann BL et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Straight-knee calf raises preferentially target gastrocnemius; bent-knee targets soleus (Riemann 2011). Full ROM including dorsiflexion stretch at bottom improves hypertrophy.',
  },


  // ===== UPPER PUSH =====
  push_up: {
    name: 'Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Core', 'Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    amplitudeRatio: 0.25,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Full depth -- chest near floor', bad: 'Go deeper', severity: 'major', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
      { name: 'Body alignment', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Body in straight line', bad: 'Hips sagging or piking', severity: 'major', citation: 'Freeman S et al, 2006, J Strength Cond Res' },
      { name: 'Elbow symmetry', type: 'symmetry', left: 'leftElbow', right: 'rightElbow', threshold: 15, good: 'Arms working evenly', bad: 'One arm doing more work', severity: 'minor', citation: 'Kiesel K et al, 2007, N am J Sports Phys Ther' },
    ],
    scienceNotes: 'Narrow hand placement increases triceps activation; wide placement increases pectoral activation (Cogley 2005). Maintaining rigid trunk increases core demand (Freeman 2006).',
  },

  overhead_press: {
    name: 'Overhead Press',
    category: 'compound',
    muscles: { primary: ['Anterior Deltoids', 'Lateral Deltoids', 'Triceps'], secondary: ['Upper Pectorals', 'Core', 'Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 165, good: 'Arms fully extended overhead', bad: 'Press to full lockout', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', phase: 'top' },
      { name: 'Trunk stable', type: 'below', key: 'trunk', threshold: 20, margin: 10, good: 'Trunk vertical -- no excessive lean', bad: 'Excessive back lean', severity: 'major', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', safetyNote: { en: 'If you have lower back issues, reduce load before correcting trunk position.', fr: 'En cas de problème lombaire, réduisez la charge avant de corriger la position du tronc.' } },
      { name: 'Shoulder symmetry', type: 'symmetry', left: 'leftShoulder', right: 'rightShoulder', threshold: 15, good: 'Shoulders pressing evenly', bad: 'Asymmetric press', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Standing overhead press produces greater core and deltoid activation than seated (Saeterbakken 2013). Excessive lumbar extension under load increases spinal compression risk.',
  },

  bench_press: {
    name: 'Bench Press (side view)',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 75, good: 'Bar at chest level', bad: 'Lower the bar further', severity: 'major', citation: 'Larsen S et al, 2021, Int J Environ Res Public Health', safetyNote: { en: 'If you have shoulder issues, do not lower beyond a comfortable range.', fr: 'En cas de problème d\\\'épaule, ne descendez pas au-delà d\\\'une amplitude confortable.' } },
      { name: 'Lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full lockout at top', bad: 'Extend arms fully at top', severity: 'minor', citation: 'Larsen S et al, 2021, Int J Environ Res Public Health', phase: 'top' },
    ],
    scienceNotes: 'Full ROM bench press produces greater pec activation than partial reps (Larsen 2021). Best detected from side camera angle.',
    limitations: ['grip width', 'bar path', 'scapular retraction', 'breathing technique', 'arch height'],
  },

  dip: {
    name: 'Dip',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Anterior Deltoids', 'Pectorals'], secondary: ['Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 95,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Upper arm parallel or below', bad: 'Go deeper for full activation', severity: 'minor', citation: 'McKenzie A et al, 2022, J Sports Sci' },
      { name: 'Full lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full extension at top', bad: 'Lock out fully at top', severity: 'minor', citation: 'McKenzie A et al, 2022, J Sports Sci', phase: 'top' },
    ],
    scienceNotes: 'Dips with forward lean increase pec activation; upright position targets triceps (McKenzie 2022). Shoulder injury risk increases with depth beyond 90 deg elbow in predisposed individuals.',
  },


  // ===== UPPER PULL =====
  bent_over_row: {
    name: 'Bent-Over Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Posterior Deltoids'], secondary: ['Biceps', 'Erectors', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 130,
    upThreshold: 165,
    formChecks: [
      { name: 'Trunk angle', type: 'range', key: 'trunk', low: 35, high: 70, margin: 12, good: 'Trunk hinged at proper angle', bad: 'Adjust torso', severity: 'major', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
      { name: 'Elbow drive', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 75, good: 'Full contraction -- elbows pulled past torso', bad: 'Pull elbows higher', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
      { name: 'Arm symmetry', type: 'symmetry', left: 'leftElbow', right: 'rightElbow', threshold: 15, good: 'Both arms pulling evenly', bad: 'One arm pulling harder', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Bent-over row at 45 deg trunk angle balances lat activation with erector demand. More horizontal trunk increases lat activation but also spinal load (Fenwick 2009).',
  },

  pull_up: {
    name: 'Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Posterior Deltoids', 'Rhomboids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 90,
    upThreshold: 155,
    amplitudeRatio: 0.22,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 60, good: 'Chin above bar level', bad: 'Pull higher', severity: 'major', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
      { name: 'Full hang', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full dead hang at bottom', bad: 'Extend fully at bottom', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res', phase: 'bottom' },
    ],
    scienceNotes: 'Supinated grip increases biceps activation; pronated grip increases lat activation (Youdas 2010). Full ROM from dead hang produces greater strength gains than partial reps.',
  },


  // ===== ARMS =====
  bicep_curl: {
    name: 'Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    amplitudeRatio: 0.3,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 55, good: 'Full bicep squeeze at top', bad: 'Curl higher', severity: 'minor', citation: 'Oliveira LF et al, 2009, J Strength Cond Res' },
      { name: 'Full extension', type: 'custom',
        check: (angles) => Math.max(angles.leftElbow, angles.rightElbow) > 145,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 145, 15), good: 'Full extension at bottom', bad: 'Extend arms fully at bottom', severity: 'minor', citation: 'Oliveira LF et al, 2009, J Strength Cond Res', phase: 'bottom' },
      { name: 'No body swing', type: 'below', key: 'trunk', threshold: 20, margin: 10, good: 'Strict form -- no swinging', bad: 'Body swinging', severity: 'major', citation: 'Oliveira LF et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Strict curls produce greater bicep hypertrophy stimulus than cheat curls despite lower absolute load. Full ROM produces superior long-head activation (Oliveira 2009).',
  },

  tricep_extension: {
    name: 'Overhead Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 140,
    formChecks: [
      { name: 'Full stretch', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 55, good: 'Deep stretch -- long head fully lengthened', bad: 'Lower further behind head for full stretch', severity: 'minor', citation: 'Maeo S et al, 2023, Eur J Sport Sci' },
      { name: 'Full lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 155, good: 'Full extension -- peak contraction', bad: 'Extend fully overhead', severity: 'minor', citation: 'Maeo S et al, 2023, Eur J Sport Sci', phase: 'top' },
      { name: 'Elbow stable', type: 'symmetry', left: 'leftShoulder', right: 'rightShoulder', threshold: 15, good: 'Elbows stable and aligned', bad: 'Elbows flaring', severity: 'minor', citation: 'Maeo S et al, 2023, Eur J Sport Sci' },
    ],
    scienceNotes: 'Overhead tricep exercises produce greater long-head activation due to stretched position (Maeo 2023). Full ROM from deep stretch to lockout is critical for hypertrophy.',
  },

  upright_row: {
    name: 'Upright Row',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids', 'Trapezius'], secondary: ['Biceps', 'Anterior Deltoids'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'Elbows high', type: 'custom',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 75,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 75, 15), good: 'Elbows pulled high', bad: 'Pull elbows higher', severity: 'minor', citation: 'McAllister MJ et al, 2013, J Strength Cond Res' },
      { name: 'Trunk stable', type: 'below', key: 'trunk', threshold: 25, margin: 10, good: 'Torso stable', bad: 'Excessive leaning', severity: 'minor', citation: 'McAllister MJ et al, 2013, J Strength Cond Res' },
    ],
    scienceNotes: 'Upright rows effectively target the lateral deltoid and upper trapezius. A wider grip reduces shoulder internal rotation, lowering impingement risk (McAllister 2013).',
  },

  lateral_raise: {
    name: 'Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Anterior Deltoids', 'Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 40,
    upThreshold: 70,
    amplitudeRatio: 0.2,
    formChecks: [
      { name: 'Height', type: 'custom',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 80,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 80, 15), good: 'Arms at or above shoulder height', bad: 'Raise higher', severity: 'minor', citation: 'Reinold MM et al, 2009, Am J Sports Med' },
      { name: 'Symmetry', type: 'symmetry', left: 'leftShoulder', right: 'rightShoulder', threshold: 15, good: 'Both arms at same height', bad: 'Uneven raise', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
      { name: 'No shrugging', type: 'below', key: 'trunk', threshold: 10, margin: 10, good: 'Shoulders down -- clean isolation', bad: 'Shrugging', severity: 'minor', citation: 'Reinold MM et al, 2009, Am J Sports Med' },
    ],
    scienceNotes: 'Lateral raises above 90 deg increase upper trap involvement. Stopping at shoulder height maximizes medial deltoid isolation. Slight forward lean (10-15 deg) shifts emphasis to rear deltoid (Reinold 2009).',
    limitations: ['grip rotation', 'breathing technique', 'momentum/swing detection'],
  },


  // ===== MACHINE / SEATED =====
  chest_supported_row: {
    name: 'Chest-Supported Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Posterior Deltoids'], secondary: ['Biceps', 'Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 65,
    upThreshold: 110,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Full pull -- shoulder blades squeezed', bad: 'Pull further', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
      { name: 'Arm symmetry', type: 'symmetry', left: 'leftElbow', right: 'rightElbow', threshold: 20, good: 'Both arms pulling evenly', bad: 'One arm pulling harder', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Chest-supported rows eliminate erector demand, isolating upper back musculature. Produces comparable lat activation to bent-over row without spinal loading (Fenwick 2009).',
  },

  seated_row: {
    name: 'Seated Cable Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids'], secondary: ['Biceps', 'Posterior Deltoids', 'Erectors'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 65,
    upThreshold: 110,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Full pull -- elbows past torso', bad: 'Pull further', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
      { name: 'Trunk stable', type: 'below', key: 'trunk', threshold: 30, margin: 10, good: 'Trunk upright and stable', bad: 'Excessive lean', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Seated row with upright torso targets mid-back; excessive trunk lean shifts load to erectors and reduces lat isolation (Fenwick 2009).',
  },

  lat_pulldown: {
    name: 'Lat Pulldown',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Posterior Deltoids', 'Rhomboids', 'Trapezius'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 40,
    upThreshold: 140,
    amplitudeRatio: 0.2,
    formChecks: [
      { name: 'Full pull', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 60, good: 'Bar at chest -- full lat contraction', bad: 'Pull lower', severity: 'major', citation: 'Signorile JF et al, 2002, J Strength Cond Res' },
      { name: 'Full stretch', type: 'above', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 140, good: 'Full stretch at top', bad: 'Let the bar go fully up', severity: 'minor', citation: 'Signorile JF et al, 2002, J Strength Cond Res' },
    ],
    scienceNotes: 'Wide grip lat pulldown produces greater lat activation than narrow grip. Pulling to chest is safer and more effective than behind neck (Signorile 2002).',
    limitations: ['grip width', 'breathing technique', 'scapular depression', 'cable path'],
  },

  leg_press: {
    name: 'Leg Press',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 70,
    upThreshold: 120,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 90, good: 'Full depth -- 90 deg knee angle', bad: 'Go deeper', severity: 'minor', citation: 'Escamilla RF et al, 2001, Med Sci Sports Exerc' },
      { name: 'Knee symmetry', type: 'symmetry', left: 'leftKnee', right: 'rightKnee', threshold: 12, good: 'Knees pressing evenly', bad: 'Uneven press', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Leg press at 90 deg knee flexion produces comparable quad activation to squat with reduced spinal load (Escamilla 2001). Avoid full lockout to protect knees.',
  },

  leg_extension: {
    name: 'Leg Extension (Machine)',
    category: 'isolation',
    muscles: { primary: ['Quadriceps'], secondary: [] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 70,
    upThreshold: 120,
    formChecks: [
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 165, good: 'Full lockout -- peak quad contraction', bad: 'Extend fully', severity: 'minor', citation: 'Signorile JF et al, 1994, J Strength Cond Res', phase: 'top' },
      { name: 'Knee symmetry', type: 'symmetry', left: 'leftKnee', right: 'rightKnee', threshold: 12, good: 'Both legs extending evenly', bad: 'One leg weaker', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Machine leg extension isolates quadriceps, especially vastus medialis at terminal extension. Full lockout is critical for VMO activation (Signorile 1994).',
  },

  leg_curl: {
    name: 'Leg Curl (Machine)',
    category: 'isolation',
    muscles: { primary: ['Hamstrings'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    value: BSM_KNEE,
    downThreshold: 120,
    upThreshold: 160,
    formChecks: [
      { name: 'Full contraction', type: 'custom',
        check: (angles) => Math.max(angles.leftKnee, angles.rightKnee) < 50,
        quality: (angles) => qualityBelow(bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 50, 15), good: 'Full curl -- heels to glutes', bad: 'Curl further', severity: 'minor', citation: 'Schoenfeld BJ et al, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Lying leg curl produces peak hamstring activation at full flexion. Slow eccentrics increase hamstring hypertrophy stimulus (Schoenfeld 2015).',
  },

  machine_chest_press: {
    name: 'Machine Chest Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Full press', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full extension', bad: 'Press further', severity: 'minor', citation: 'Larsen S et al, 2021, Int J Environ Res Public Health' },
      { name: 'Arm symmetry', type: 'symmetry', left: 'leftElbow', right: 'rightElbow', threshold: 15, good: 'Both arms pressing evenly', bad: 'One arm lagging', severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther' },
    ],
    scienceNotes: 'Machine chest press provides stable pressing pattern with consistent resistance curve. Full ROM produces greater pec activation than partial reps (Larsen 2021).',
  },


  // ===== CORE =====
  plank: {
    name: 'Plank Hold',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Transverse Abdominis'], secondary: ['Obliques', 'Erectors', 'Glutes'] },
    joint: 'hip',
    value: D_TRUNK,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 10000,
    formChecks: [
      { name: 'Body alignment', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Flat back -- strong plank position', bad: 'Hips sagging or piking', severity: 'major', citation: 'Schoenfeld BJ et al, 2014, J Strength Cond Res' },
      { name: 'Hip position', type: 'averageAbove', left: 'leftHip', right: 'rightHip', threshold: 160, good: 'Hips level', bad: 'Hips dropping', severity: 'major', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Plank produces significant rectus abdominis and transverse abdominis activation without spinal flexion load (Schoenfeld 2014). Hip sag indicates core fatigue and increases lumbar stress (McGill 2010).',
  },

  crunch: {
    name: 'Crunch',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    value: D_TRUNK,
    downThreshold: 15,
    upThreshold: 30,
    formChecks: [
      { name: 'Range', type: 'above', key: 'trunk', threshold: 25, margin: 12, good: 'Sufficient curl -- shoulders off floor', bad: 'Curl higher', severity: 'minor', citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Crunches isolate upper rectus abdominis with minimal hip flexor activation when performed correctly (Escamilla 2006). Avoid neck pulling.',
  },

  mountain_climber: {
    name: 'Mountain Climber',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Hip Flexors'], secondary: ['Deltoids', 'Quadriceps', 'Glutes'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 140,
    minSpacing: 0.25,
    formChecks: [
      { name: 'Plank position', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Flat back maintained', bad: 'Hips rising', severity: 'major', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Mountain climbers combine core stabilization with hip flexion, producing high heart rate response relative to perceived effort (McCall 2015).',
  },

  burpee: {
    name: 'Burpee',
    category: 'bodyweight',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Pectorals', 'Deltoids', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Full standing extension at top', bad: 'Stand up fully between reps', severity: 'minor', citation: 'Ratamess NA et al, 2015, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Burpees produce significant metabolic demand with high caloric expenditure per unit time. Full extension at top is critical for complete hip and knee ROM (Ratamess 2015).',
  },

  jumping_jack: {
    name: 'Jumping Jack',
    category: 'bodyweight',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Calves', 'Hip Abductors'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 70,
    minSpacing: 0.25,
    formChecks: [
      { name: 'Arm height', type: 'custom',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 80,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 80, 15), good: 'Arms reaching full overhead', bad: 'Raise arms higher overhead', severity: 'minor', citation: 'ACSM Guidelines, 2021' },
    ],
    scienceNotes: 'Jumping jacks provide low-impact cardiovascular conditioning with shoulder abduction and hip abduction patterns (ACSM 2021).',
  },


  // ===== BODYWEIGHT UPPER =====
  pike_push_up: {
    name: 'Pike Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Anterior Deltoids', 'Triceps'], secondary: ['Upper Pectorals', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Head approaching floor', bad: 'Go deeper', severity: 'minor', citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J' },
      { name: 'Hip pike', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 110, good: 'Hips high -- good pike angle', bad: 'Push hips higher', severity: 'major', citation: 'Contreras B, Schoenfeld BJ, 2011, Strength Cond J' },
    ],
    scienceNotes: 'Pike push-ups shift load to anterior deltoid due to near-vertical pressing angle. Effective bodyweight progression toward handstand push-ups (Contreras 2011).',
  },

  diamond_push_up: {
    name: 'Diamond Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Pectorals'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Chest to hands', bad: 'Go deeper', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
      { name: 'Body alignment', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Body in straight line', bad: 'Hips sagging or piking', severity: 'major', citation: 'Freeman S et al, 2006, J Strength Cond Res' },
    ],
    scienceNotes: 'Narrow hand placement (diamond) produces significantly greater triceps and pec activation than standard or wide push-ups (Cogley 2005).',
  },

  inverted_row: {
    name: 'Inverted Row',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Posterior Deltoids'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full pull', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 60, good: 'Chest to bar', bad: 'Pull higher', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
      { name: 'Body alignment', type: 'averageAbove', left: 'leftHip', right: 'rightHip', threshold: 160, good: 'Body rigid and straight', bad: 'Hips sagging', severity: 'major', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Inverted rows produce comparable lat activation to bent-over rows without spinal loading. Body angle determines difficulty (Fenwick 2009).',
  },


  // ===== BODYWEIGHT LOWER =====
  jump_squat: {
    name: 'Jump Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Calves', 'Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      { name: 'Squat depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good squat depth before jump', bad: 'Squat deeper before jumping', severity: 'minor', citation: 'Mackala K et al, 2013, J Hum Kinet' },
      { name: 'Landing mechanics', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 140, margin: 12, good: 'Soft landing -- knees absorbing impact', bad: 'Soften your landing', severity: 'major', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Jump squats produce peak power output at 30-60% 1RM squat load. Landing mechanics are critical for ACL injury prevention (Hewett 2005, Mackala 2013).',
  },

  pistol_squat: {
    name: 'Pistol Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core', 'Gluteus Medius'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 80, good: 'Full depth -- hamstring to calf', bad: 'Go deeper if mobility allows', severity: 'minor', citation: 'Khuu A et al, 2016, J Strength Cond Res' },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 40, margin: 12, good: 'Torso controlled', bad: 'Excessive forward lean', severity: 'minor', citation: 'Khuu A et al, 2016, J Strength Cond Res' },
    ],
    scienceNotes: 'Pistol squats require exceptional single-leg strength, ankle dorsiflexion, and hip stability. One of the most demanding bodyweight lower exercises (Khuu 2016).',
  },

  glute_bridge: {
    name: 'Glute Bridge',
    category: 'bodyweight',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 165, good: 'Full hip extension -- glutes fully engaged', bad: 'Push hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech', phase: 'top' },
      { name: 'Knee angle', type: 'averageRange', left: 'leftKnee', right: 'rightKnee', low: 80, high: 110, good: 'Knees at ~90 degrees', bad: 'Reposition feet', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Glute bridges produce high glute activation with minimal spinal load. Effective regression from hip thrusts and for glute activation warm-ups (Contreras 2015).',
  },

  wall_sit: {
    name: 'Wall Sit',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps'], secondary: ['Glutes', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 15000,
    formChecks: [
      { name: 'Knee angle', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Thighs at or below parallel', bad: 'Slide lower', severity: 'minor', citation: 'Escamilla RF, 2001, Med Sci Sports Exerc' },
      { name: 'Back flat', type: 'below', key: 'trunk', threshold: 20, margin: 10, good: 'Back flat against wall', bad: 'Press back flat against wall', severity: 'minor', citation: 'Escamilla RF, 2001, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Wall sits produce high quadriceps isometric activation, particularly VMO. Effective for patellar tendinopathy rehabilitation (Escamilla 2001).',
  },

  dead_hang: {
    name: 'Dead Hang',
    category: 'bodyweight',
    muscles: { primary: ['Forearms', 'Latissimus Dorsi'], secondary: ['Deltoids', 'Core'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 10000,
    formChecks: [
      { name: 'Arms extended', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15), good: 'Full arm extension', bad: 'Straighten arms fully', severity: 'minor', citation: 'Escamilla RF et al, 2009' },
      { name: 'Shoulders engaged', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Shoulders active', bad: 'Pack shoulders', severity: 'major', citation: 'Escamilla RF et al, 2009' },
    ],
    scienceNotes: 'Dead hangs decompress the spine and develop grip endurance. Active scapular engagement prevents shoulder impingement (Escamilla 2009).',
  },

  l_sit: {
    name: 'L-Sit Hold',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Rectus Abdominis'], secondary: ['Triceps', 'Quadriceps', 'Latissimus Dorsi'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 5000,
    formChecks: [
      { name: 'Legs parallel', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 100, good: 'Legs at or above parallel', bad: 'Raise legs higher to parallel', severity: 'major', citation: 'Contreras B, 2011' },
      { name: 'Knees straight', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 150, 15), good: 'Legs straight', bad: 'Extend knees fully', severity: 'minor', citation: 'Contreras B, 2011' },
    ],
    scienceNotes: 'L-sit hold demands extreme hip flexor and core isometric strength with locked-arm support (Contreras 2011).',
  },

  hollow_body_hold: {
    name: 'Hollow Body Hold',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Transverse Abdominis'], secondary: ['Hip Flexors', 'Quadriceps'] },
    joint: 'hip',
    value: D_TRUNK,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 10000,
    formChecks: [
      { name: 'Lower back flat', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Back pressed to floor', bad: 'Press lower back into floor', severity: 'major', citation: 'McGill SM, 2010' },
      { name: 'Arms overhead', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 140,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 140, 15), good: 'Arms extended overhead', bad: 'Reach arms overhead', severity: 'minor', citation: 'McGill SM, 2010' },
    ],
    scienceNotes: 'Hollow body hold is a gymnastics fundamental producing full-body isometric tension with emphasis on anterior core (McGill 2010).',
  },

  overhead_hold: {
    name: 'Overhead Hold',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Trapezius'], secondary: ['Core', 'Triceps'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 10000,
    formChecks: [
      { name: 'Arms locked', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15), good: 'Full lockout', bad: 'Lock elbows fully', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
      { name: 'Overhead position', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Weight directly overhead', bad: 'Press weight directly overhead', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
    ],
    scienceNotes: 'Overhead holds develop shoulder stability and core anti-extension strength under load (Schoenfeld 2010).',
  },

  side_plank: {
    name: 'Side Plank',
    category: 'bodyweight',
    muscles: { primary: ['Obliques'], secondary: ['Glutes', 'Deltoids', 'Core'] },
    joint: 'hip',
    value: D_TRUNK,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    minIsometricDuration: 10000,
    formChecks: [
      { name: 'Body alignment', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Straight line from head to feet', bad: 'Lift hips', severity: 'major', citation: 'McGill SM, 2010' },
    ],
    scienceNotes: 'Side plank produces high oblique activation with low spinal compression. One of McGill Big Three for back health (McGill 2010).',
  },

  step_up: {
    name: 'Step-Up',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Full standing extension at top', bad: 'Stand up fully on the box', severity: 'minor', citation: 'Riemann BL et al, 2012, J Athl Train', phase: 'top' },
      { name: 'Trunk upright', type: 'below', key: 'trunk', threshold: 25, margin: 10, good: 'Torso upright throughout', bad: 'Stay tall', severity: 'minor', citation: 'Riemann BL et al, 2012, J Athl Train' },
    ],
    scienceNotes: 'Step-ups produce significant unilateral quad and glute activation with low spinal load. Higher box increases glute contribution (Riemann 2012).',
  },


  // ===== UNCONVENTIONAL / FUNCTIONAL =====
  kettlebell_swing: {
    name: 'Kettlebell Swing',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core', 'Deltoids', 'Erectors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 85, good: 'Deep hip hinge at bottom', bad: 'Hinge deeper', severity: 'major', citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res' },
      { name: 'Full extension', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 170, good: 'Full hip snap at top', bad: 'Drive hips through', severity: 'major', citation: 'McGill SM, Marshall LW, 2012, J Strength Cond Res', phase: 'top' },
      { name: 'Knee soft', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 140, good: 'Knees soft -- not squatting the swing', bad: 'Less knee bend', severity: 'minor', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell swing produces peak hip power comparable to jump squat with lower joint loading. Hip hinge pattern is critical -- squatting the swing reduces power and loads the spine (McGill 2012, Lake 2012).',
  },

  thruster: {
    name: 'Thruster',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Deltoids', 'Triceps'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      { name: 'Squat depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Below parallel in squat', bad: 'Squat deeper before pressing', severity: 'minor', citation: 'Kipp K et al, 2011, J Strength Cond Res' },
      { name: 'Lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Arms fully locked out overhead', bad: 'Press to full lockout', severity: 'minor', citation: 'Kipp K et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Thrusters combine front squat and overhead press into a high-power compound movement. Produces one of the highest metabolic demands of any barbell exercise (Kipp 2011).',
  },

  clean_and_press: {
    name: 'Clean and Press',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Trapezius', 'Glutes', 'Deltoids', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      { name: 'Hip extension', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 165, good: 'Full hip extension on catch', bad: 'Extend hips fully during clean', severity: 'minor', citation: 'Comfort P et al, 2012, J Strength Cond Res', phase: 'top' },
      { name: 'Press lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Arms fully locked overhead', bad: 'Press to full lockout', severity: 'minor', citation: 'Comfort P et al, 2012, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'The clean and press is a foundational full-body power movement. Proper hip extension timing is critical for efficient force transfer (Comfort 2012).',
  },

  renegade_row: {
    name: 'Renegade Row',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Core'], secondary: ['Biceps', 'Obliques', 'Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      { name: 'Anti-rotation', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Minimal trunk rotation -- strong core brace', bad: 'Too much rotation', severity: 'major', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Renegade rows combine plank anti-rotation with unilateral rowing. The anti-rotation demand makes this primarily a core exercise with back as secondary (McGill 2010).',
  },

  turkish_get_up: {
    name: 'Turkish Get-Up',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Core', 'Glutes', 'Gluteus Medius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 40,
    upThreshold: 80,
    formChecks: [
      { name: 'Arm vertical', type: 'custom',
        check: (angles) => Math.max(angles.leftShoulder, angles.rightShoulder) > 90,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 90, 15), good: 'Arm locked vertical throughout', bad: 'Keep arm vertical', severity: 'major', citation: 'Liebenson C, 2011, J Bodywork Movement Ther' },
    ],
    scienceNotes: 'Turkish get-ups develop integrated full-body stability and shoulder health. One of the most effective single exercises for functional movement quality (Liebenson 2011).',
  },

  bear_crawl: {
    name: 'Bear Crawl',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Deltoids'], secondary: ['Quadriceps', 'Hip Flexors', 'Triceps'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 120,
    formChecks: [
      { name: 'Low position', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 100, good: 'Hips low -- knees hovering near ground', bad: 'Get lower', severity: 'minor', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Bear crawls develop cross-body coordination, core anti-extension, and shoulder stability simultaneously (McGill 2010).',
  },


  // ===== HANGING / BAR =====
  muscle_up: {
    name: 'Muscle-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Pectorals', 'Triceps'], secondary: ['Biceps', 'Core', 'Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full lockout above bar', bad: 'Push to full lockout', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res', phase: 'top' },
      { name: 'Full hang', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full dead hang at bottom', bad: 'Start from a full hang', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res', phase: 'bottom' },
    ],
    scienceNotes: 'Muscle-ups require explosive pulling power transitioning through the bar to a dip position. One of the most demanding upper body bodyweight movements (Youdas 2010).',
  },

  chin_up: {
    name: 'Chin-Up',
    category: 'bodyweight',
    muscles: { primary: ['Biceps', 'Latissimus Dorsi'], secondary: ['Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 55, good: 'Chin above bar', bad: 'Pull higher', severity: 'major', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
      { name: 'Full hang', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full dead hang', bad: 'Extend fully at bottom', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res', phase: 'bottom' },
    ],
    scienceNotes: 'Supinated grip (chin-up) produces significantly greater biceps activation than pronated grip (pull-up) while maintaining comparable lat activation (Youdas 2010).',
  },


  // ===== SUPERSET-FRIENDLY / CONDITIONING =====
  box_jump: {
    name: 'Box Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Landing depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 120, good: 'Soft landing on box', bad: 'Land softer', severity: 'major', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Box jumps develop explosive hip and knee extension power. Quiet landings (low noise) indicate proper eccentric deceleration and reduced injury risk (Hewett 2005).',
  },

  skater_jump: {
    name: 'Skater Jump',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Quadriceps'], secondary: ['Hip Abductors', 'Core', 'Calves'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Landing control', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 130, good: 'Controlled single-leg landing', bad: 'Land with more control', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Skater jumps develop lateral power and single-leg stability. Effective for sport-specific lateral agility and hip abductor strength (Hewett 2005).',
  },

  squat_jump_to_lunge: {
    name: 'Squat Jump to Lunge',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good depth on both squat and lunge', bad: 'Go deeper on each phase', severity: 'minor', citation: 'Ratamess NA et al, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Combo exercises combining bilateral and unilateral patterns produce high metabolic demand and challenge coordination and stability (Ratamess 2015).',
  },

  man_maker: {
    name: 'Man Maker',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Upper Back', 'Pectorals', 'Core', 'Quadriceps'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Push-up depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Full push-up depth', bad: 'Go lower on the push-up', severity: 'minor', citation: 'Ratamess NA et al, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Man makers combine push-up, renegade row, clean, and press. Extreme metabolic demand with full-body integration (Ratamess 2015).',
  },

  commando_pull_up: {
    name: 'Commando Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Obliques'], secondary: ['Core', 'Forearms'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 60, good: 'Head above bar', bad: 'Pull higher', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Commando pull-ups add rotational core demand to standard pull-up pattern by alternating head side on each rep (Youdas 2010).',
  },


  // ===== CABLE / MACHINE ISOLATION =====
  face_pull: {
    name: 'Face Pull',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rotator Cuff'], secondary: ['Rhomboids', 'Trapezius', 'Biceps'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 60,
    upThreshold: 120,
    formChecks: [
      { name: 'Full pull', type: 'above', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 80, good: 'Elbows high and flared -- rear delts engaged', bad: 'Pull higher', severity: 'minor', citation: 'Reinold MM et al, 2009, Am J Sports Med' },
      { name: 'Trunk stable', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Upright torso -- no leaning back', bad: 'Leaning back', severity: 'major', citation: 'Reinold MM et al, 2009, Am J Sports Med' },
    ],
    scienceNotes: 'Face pulls are a primary exercise for posterior shoulder health, targeting rear delts and external rotators. High elbow position is critical for full rear delt activation (Reinold 2009).',
  },

  incline_bench_press: {
    name: 'Incline Bench Press',
    category: 'compound',
    muscles: { primary: ['Upper Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 75, good: 'Bar touching upper chest', bad: 'Lower the bar further', severity: 'major', citation: 'Trebs AA et al, 2010, J Strength Cond Res' },
      { name: 'Lockout', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 160, good: 'Full lockout at top', bad: 'Extend arms fully at top', severity: 'minor', citation: 'Trebs AA et al, 2010, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Incline bench press shifts emphasis to the upper (clavicular) head of the pectoralis major. A 30-45 deg incline maximizes upper pec activation (Trebs 2010).',
  },

  sumo_deadlift: {
    name: 'Sumo Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hip Adductors', 'Quadriceps'], secondary: ['Hamstrings', 'Erectors', 'Trapezius'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge depth', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 100, good: 'Full hip hinge at setup', bad: 'Push hips further back and down', severity: 'minor', citation: 'Escamilla RF et al, 2000, Med Sci Sports Exerc' },
      { name: 'Trunk neutral', type: 'range', key: 'trunk', low: 20, high: 80, margin: 12, good: 'Back angle within safe range', bad: 'Excessive trunk rounding', severity: 'major', citation: 'Escamilla RF et al, 2000, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Sumo deadlift reduces spinal extension moment compared to conventional, increasing adductor and quad demand due to wider stance and more vertical torso (Escamilla 2000).',
  },

  nordic_curl: {
    name: 'Nordic Curl',
    category: 'bodyweight',
    muscles: { primary: ['Hamstrings'], secondary: ['Glutes', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Controlled descent', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 60, good: 'Controlled eccentric descent', bad: 'Collapsing too fast', severity: 'major', citation: 'Bourne MN et al, 2017, Br J Sports Med' },
      { name: 'Trunk alignment', type: 'below', key: 'trunk', threshold: 25, margin: 12, good: 'Body in straight line from knee to shoulder', bad: 'Hips breaking', severity: 'minor', citation: 'Bourne MN et al, 2017, Br J Sports Med' },
    ],
    scienceNotes: 'Nordic curls produce very high eccentric hamstring loading and are one of the most effective injury-prevention exercises for hamstring strains (Bourne 2017, Petersen 2011).',
  },

  seated_calf_raise: {
    name: 'Seated Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Soleus'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    value: { type: 'heelDisplacement' },
    downThreshold: 45,
    upThreshold: 55,
    formChecks: [
      { name: 'Knee bent', type: 'averageRange', left: 'leftKnee', right: 'rightKnee', low: 80, high: 110, margin: 15, good: 'Knees at ~90 deg -- soleus targeted', bad: 'Maintain knee flexion to isolate soleus', severity: 'major', citation: 'Riemann BL et al, 2011, J Strength Cond Res' },
      { name: 'Full ROM', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Upright seated posture', bad: 'Sit upright', severity: 'minor', citation: 'Riemann BL et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Seated calf raises preferentially target the soleus due to gastrocnemius slack at the bent knee. Both heads require training for complete calf development (Riemann 2011).',
  },

  hanging_leg_raise: {
    name: 'Hanging Leg Raise',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques', 'Forearms'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Leg height', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 90, good: 'Legs at or above parallel', bad: 'Raise legs higher', severity: 'minor', citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc' },
      { name: 'No swinging', type: 'symmetry', left: 'leftHip', right: 'rightHip', threshold: 15, good: 'Controlled movement -- no momentum', bad: 'Swinging detected', severity: 'major', citation: 'Escamilla RF et al, 2006, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Hanging leg raises produce peak lower rectus abdominis and hip flexor activation. Full ROM above parallel increases oblique and transverse abdominis demand (Escamilla 2006).',
  },


  // ===== ADDITIONAL COMPOUND =====
  hack_squat: {
    name: 'Hack Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Full depth', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Hack squat machine provides guided squat pattern with back support, emphasizing quadriceps (Schoenfeld 2010).',
  },

  smith_squat: {
    name: 'Smith Machine Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 105, good: 'Below parallel', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
    ],
    scienceNotes: 'Smith machine provides fixed bar path; foot placement forward emphasizes quads, under hips emphasizes glutes (Schoenfeld 2010).',
  },

  zercher_squat: {
    name: 'Zercher Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Core'], secondary: ['Biceps', 'Upper Back'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good depth', bad: 'Squat deeper', severity: 'major', citation: 'Gullett JC et al, 2009' },
      { name: 'Upright torso', type: 'below', key: 'trunk', threshold: 45, margin: 12, good: 'Torso upright', bad: 'Stay more upright', severity: 'minor', citation: 'Gullett JC et al, 2009' },
    ],
    scienceNotes: 'Zercher squat holds barbell in elbow crooks, requiring extreme core and upper back engagement (Gullett 2009).',
  },

  overhead_squat: {
    name: 'Overhead Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Deltoids'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Full depth', bad: 'Go deeper', severity: 'major', citation: 'Schoenfeld BJ, 2010' },
      { name: 'Arms overhead', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Arms locked overhead', bad: 'Keep arms fully extended overhead', severity: 'major', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Overhead squat demands full-body mobility and stability, used in Olympic lifting assessment and CrossFit (NSCA 2016).',
  },

  power_clean: {
    name: 'Power Clean',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Trapezius'], secondary: ['Quadriceps', 'Core', 'Deltoids'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Hip extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Extend hips fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Power clean develops explosive hip extension and triple extension power, foundational Olympic lifting movement (Suchomel 2015).',
  },

  snatch: {
    name: 'Snatch',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Deltoids', 'Trapezius'], secondary: ['Quadriceps', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full triple extension', bad: 'Extend fully before pulling under', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Snatch is the highest velocity barbell movement, demanding full-body power and overhead stability (Suchomel 2015).',
  },

  t_bar_row: {
    name: 'T-Bar Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids'], secondary: ['Biceps', 'Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Torso angle', type: 'range', key: 'trunk', low: 30, high: 60, margin: 12, good: 'Good torso angle', bad: 'Maintain 45-degree forward lean', severity: 'minor', citation: 'Lehman GJ et al, 2004' },
    ],
    scienceNotes: 'T-bar row produces high lat and mid-back activation with neutral grip reducing bicep limitation (Lehman 2004).',
  },

  pendlay_row: {
    name: 'Pendlay Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Trapezius'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Parallel torso', type: 'above', key: 'trunk', threshold: 60, margin: 12, good: 'Torso parallel to floor', bad: 'Keep torso closer to horizontal', severity: 'major', citation: 'Fenwick CM et al, 2009' },
    ],
    scienceNotes: 'Pendlay row requires dead-stop from floor with parallel torso, maximizing concentric power and lat recruitment (Fenwick 2009).',
  },

  close_grip_bench: {
    name: 'Close-Grip Bench Press',
    category: 'compound',
    muscles: { primary: ['Triceps', 'Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15), good: 'Full lockout', bad: 'Lock out fully at top', severity: 'minor', citation: 'Lehman GJ, 2005', phase: 'top' },
    ],
    scienceNotes: 'Close-grip bench press shifts load to triceps while maintaining chest activation (Lehman 2005).',
  },

  decline_bench_press: {
    name: 'Decline Bench Press',
    category: 'compound',
    muscles: { primary: ['Lower Pectorals', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Extend fully', severity: 'minor', citation: 'Lauver JD et al, 2016', phase: 'top' },
    ],
    scienceNotes: 'Decline angle shifts emphasis to lower pectoralis and reduces shoulder stress (Lauver 2016).',
  },

  floor_press: {
    name: 'Floor Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 150,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Lock out fully', severity: 'minor', citation: 'Lehman GJ, 2005', phase: 'top' },
    ],
    scienceNotes: 'Floor press limits ROM to reduce shoulder stress and isolate lockout strength (Lehman 2005).',
  },

  landmine_press: {
    name: 'Landmine Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Deltoids'], secondary: ['Triceps', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full press', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Landmine press provides shoulder-friendly pressing with natural arc path and core demand (NSCA 2016).',
  },

  arnold_press: {
    name: 'Arnold Press',
    category: 'compound',
    muscles: { primary: ['Deltoids'], secondary: ['Triceps', 'Upper Pectorals'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full press', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full overhead extension', bad: 'Press fully overhead', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013', phase: 'top' },
    ],
    scienceNotes: 'Arnold press adds rotation through the press, increasing anterior deltoid time under tension (Saeterbakken 2013).',
  },


  // ===== ADDITIONAL ISOLATION =====
  hammer_curl: {
    name: 'Hammer Curl',
    category: 'isolation',
    muscles: { primary: ['Brachioradialis', 'Biceps'], secondary: ['Forearms'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Elbow position', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 30, good: 'Elbows at sides', bad: 'Keep elbows pinned to sides', severity: 'minor', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Neutral grip shifts emphasis from biceps to brachioradialis and brachialis (Marcolin 2018).',
  },

  preacher_curl: {
    name: 'Preacher Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 140, 15), good: 'Full stretch at bottom', bad: 'Extend fully at bottom', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'bottom' },
    ],
    scienceNotes: 'Preacher curl pad eliminates momentum and isolates the biceps through full ROM (Marcolin 2018).',
  },

  concentration_curl: {
    name: 'Concentration Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 140,
    formChecks: [
      { name: 'Controlled rep', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 30, good: 'Isolated movement', bad: 'No swinging', severity: 'minor', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Concentration curl produces highest biceps peak activation of all curl variants (Marcolin 2018).',
  },

  lying_bicep_curl: {
    name: 'Lying Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 90,
    upThreshold: 130,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 50, good: 'Full curl at top', bad: 'Incomplete contraction at top', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
      { name: 'No shoulder movement', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 40, good: 'Shoulders stable', bad: 'Shoulder movement detected', severity: 'major', citation: 'Marcolin G et al, 2018' },
    ],
    scienceNotes: 'Lying (incline or flat bench) bicep curls increase bicep long head stretch, producing greater hypertrophy stimulus compared to standing curls (Marcolin 2018).',
  },

  spider_curl: {
    name: 'Spider Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 140,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 45, good: 'Peak squeeze at top', bad: 'Curl higher', severity: 'minor', citation: 'Marcolin G et al, 2018', phase: 'top' },
    ],
    scienceNotes: 'Spider curls (prone on incline bench) eliminate momentum and isolate bicep short head through gravity-loaded contraction (Marcolin 2018).',
  },

  skull_crusher: {
    name: 'Skull Crusher',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 150, 15), good: 'Full lockout', bad: 'Extend fully at top', severity: 'minor', citation: 'Landin D, Thompson M, 2011', phase: 'top' },
    ],
    scienceNotes: 'Skull crushers (lying tricep extension) maximize long head tricep activation through overhead stretch (Landin 2011).',
  },

  cable_tricep_pushdown: {
    name: 'Cable Tricep Pushdown',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BSM_ELBOW,
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Elbow position', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 25, good: 'Elbows at sides', bad: 'Keep elbows pinned', severity: 'minor', citation: 'Landin D, Thompson M, 2011' },
    ],
    scienceNotes: 'Cable pushdowns isolate the triceps with constant tension through full ROM (Landin 2011).',
  },

  front_raise: {
    name: 'Front Raise',
    category: 'isolation',
    muscles: { primary: ['Anterior Deltoids'], secondary: ['Upper Pectorals'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'No swing', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Controlled raise', bad: 'No swinging', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013' },
    ],
    scienceNotes: 'Front raises isolate anterior deltoid; stopping at shoulder height prevents impingement (Saeterbakken 2013).',
  },

  rear_delt_fly: {
    name: 'Rear Delt Fly',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids'], secondary: ['Rhomboids', 'Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 20,
    upThreshold: 70,
    formChecks: [
      { name: 'Forward lean', type: 'above', key: 'trunk', threshold: 30, margin: 12, good: 'Good bend-over position', bad: 'Lean forward more to target rear delts', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013' },
    ],
    scienceNotes: 'Rear delt fly isolates posterior deltoid, critical for shoulder balance and posture (Saeterbakken 2013).',
  },

  shrug: {
    name: 'Shrug',
    category: 'isolation',
    muscles: { primary: ['Trapezius'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 15,
    upThreshold: 30,
    formChecks: [
      { name: 'No arm bend', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 150, 15), good: 'Arms straight', bad: 'Keep arms straight', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Shrugs isolate upper trapezius. Full elevation and controlled descent maximize time under tension (NSCA 2016).',
  },

  cable_fly: {
    name: 'Cable Fly',
    category: 'isolation',
    muscles: { primary: ['Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Slight elbow bend', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 130, good: 'Good arm position', bad: 'Keep slight bend in elbows', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Cable flys maintain constant tension through full chest ROM unlike dumbbell flys (Lauver 2016).',
  },

  dumbbell_fly: {
    name: 'Dumbbell Fly',
    category: 'isolation',
    muscles: { primary: ['Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 20,
    upThreshold: 60,
    formChecks: [
      { name: 'Slight elbow bend', type: 'above', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 130, good: 'Good arm arc', bad: 'Keep slight bend', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Dumbbell flys stretch pectorals through full horizontal adduction (Lauver 2016).',
  },

  cable_crossover: {
    name: 'Cable Crossover',
    category: 'isolation',
    muscles: { primary: ['Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Controlled squeeze', type: 'below', key: 'trunk', threshold: 25, margin: 12, good: 'Good torso position', bad: 'Stay upright', severity: 'minor', citation: 'Lauver JD et al, 2016' },
    ],
    scienceNotes: 'Cable crossovers allow variable angle chest training with constant tension (Lauver 2016).',
  },

  wrist_curl: {
    name: 'Wrist Curl',
    category: 'isolation',
    muscles: { primary: ['Forearms'], secondary: [] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Forearm stable', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 30, good: 'Forearms braced', bad: 'Keep forearms on thighs or bench', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wrist curls isolate forearm flexors, essential for grip strength development (NSCA 2016).',
  },


  // ===== ADDITIONAL BODYWEIGHT =====
  sit_up: {
    name: 'Sit-Up',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 140,
    amplitudeRatio: 0.15,
    formChecks: [
      { name: 'Full sit', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 100,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 100, 15), good: 'Full range', bad: 'Sit up fully', severity: 'minor', citation: 'Escamilla RF et al, 2006', phase: 'top' },
    ],
    scienceNotes: 'Full sit-ups engage hip flexors more than crunches; keep feet anchored for stability (Escamilla 2006).',
  },

  v_up: {
    name: 'V-Up',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Obliques'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Touch toes', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 70, good: 'Full V position', bad: 'Reach for your toes', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'V-ups combine upper and lower ab activation for high-intensity core work (Escamilla 2006).',
  },

  russian_twist: {
    name: 'Russian Twist',
    category: 'bodyweight',
    muscles: { primary: ['Obliques'], secondary: ['Rectus Abdominis', 'Hip Flexors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 70,
    upThreshold: 110,
    formChecks: [
      { name: 'Lean back', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 120, good: 'Good lean angle', bad: 'Lean back more for full engagement', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Russian twists target obliques with rotational load; holding weight increases difficulty (Escamilla 2006).',
  },

  bicycle_crunch: {
    name: 'Bicycle Crunch',
    category: 'bodyweight',
    muscles: { primary: ['Obliques', 'Rectus Abdominis'], secondary: ['Hip Flexors'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Shoulder off ground', type: 'above', key: 'trunk', threshold: 10, margin: 12, good: 'Shoulders lifted', bad: 'Lift shoulders off the ground', severity: 'minor', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Bicycle crunches produce highest oblique and rectus abdominis EMG of bodyweight core exercises (Escamilla 2006).',
  },

  flutter_kick: {
    name: 'Flutter Kick',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Quadriceps'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 140,
    upThreshold: 165,
    minSpacing: 0.2,
    formChecks: [
      { name: 'Lower back down', type: 'centerDeviation', key: 'trunk', center: 80, margin: 30, good: 'Back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Flutter kicks maintain constant lower ab tension; pressing back to floor prevents lumbar strain (Escamilla 2006).',
  },

  superman: {
    name: 'Superman',
    category: 'bodyweight',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Posterior Deltoids'] },
    joint: 'hip',
    value: BSM_HIP,
    downThreshold: 150,
    upThreshold: 170,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 165,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 165, 15), good: 'Full back extension', bad: 'Lift arms and legs higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Superman exercise targets posterior chain from prone position, strengthening spinal erectors (NSCA 2016).',
  },

  hand_release_push_up: {
    name: 'Hand-Release Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 150,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Lock out fully at top', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Hand-release ensures full ROM by requiring chest to floor each rep (Cogley 2005).',
  },

  wide_push_up: {
    name: 'Wide Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals'], secondary: ['Triceps', 'Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 95, good: 'Chest to floor', bad: 'Go deeper', severity: 'minor', citation: 'Cogley RM et al, 2005' },
    ],
    scienceNotes: 'Wide hand placement increases pectoral activation at cost of reduced triceps engagement (Cogley 2005).',
  },

  archer_push_up: {
    name: 'Archer Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Core', 'Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 150, 15), good: 'Full press', bad: 'Extend fully', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Archer push-ups shift load unilaterally, progressing toward one-arm push-up (Cogley 2005).',
  },

  incline_push_up: {
    name: 'Incline Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Lower Pectorals', 'Triceps'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Chest near surface', bad: 'Lower chest closer to surface', severity: 'major', citation: 'Cogley RM et al, 2005', phase: 'bottom' },
      { name: 'Body alignment', type: 'range', key: 'trunk', low: 15, high: 55, margin: 12, good: 'Straight body line', bad: 'Keep body in a straight line', severity: 'minor', citation: 'Contreras B, 2011' },
    ],
    scienceNotes: 'Incline push-ups (hands elevated) reduce load compared to standard push-ups, making them a regression. The incline shifts emphasis slightly to lower pectorals (Cogley 2005).',
  },

  deficit_push_up: {
    name: 'Deficit Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Deep stretch', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 60, good: 'Full depth below hands', bad: 'Go deeper to use the deficit', severity: 'major', citation: 'Contreras B, 2011', phase: 'bottom' },
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full extension', bad: 'Lock out fully at top', severity: 'minor', citation: 'Cogley RM et al, 2005', phase: 'top' },
    ],
    scienceNotes: 'Deficit push-ups (hands on elevated surfaces like blocks or dumbbells) increase ROM beyond standard push-ups, producing greater pectoral stretch and activation (Contreras 2011).',
  },

  deficit_push_down: {
    name: 'Deficit Push-Down',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Pectorals'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Controlled descent', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 60, good: 'Full depth achieved', bad: 'Lower further into the deficit', severity: 'major', citation: 'Contreras B, 2011', phase: 'bottom' },
      { name: 'Elbow position', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 100, margin: 12, good: 'Elbows tracking properly', bad: 'Keep elbows closer to body', severity: 'minor', citation: 'Cogley RM et al, 2005' },
    ],
    scienceNotes: 'Deficit push-downs emphasize the eccentric phase with extended ROM, targeting triceps and chest with increased time under tension at the bottom (Contreras 2011).',
  },

  toes_to_bar: {
    name: 'Toes to Bar',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Hip Flexors'], secondary: ['Latissimus Dorsi', 'Forearms'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full range', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 60, good: 'Toes reaching bar', bad: 'Bring toes higher to the bar', severity: 'major', citation: 'Escamilla RF et al, 2006' },
    ],
    scienceNotes: 'Toes-to-bar combines hanging leg raise with full hip flexion, demanding core and grip strength (Escamilla 2006).',
  },

  single_leg_deadlift: {
    name: 'Single-Leg Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core', 'Erectors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Hip hinge', type: 'above', key: 'trunk', threshold: 40, margin: 12, good: 'Good hip hinge depth', bad: 'Hinge deeper at the hips', severity: 'major', citation: 'Stastny P et al, 2015' },
    ],
    scienceNotes: 'Single-leg deadlift challenges balance and hamstring/glute activation unilaterally (Stastny 2015).',
  },

  good_morning: {
    name: 'Good Morning',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee soft', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 170, good: 'Slight knee bend', bad: 'Keep slight bend in knees', severity: 'minor', citation: 'Vigotsky AD et al, 2015' },
    ],
    scienceNotes: 'Good mornings target posterior chain through loaded hip hinge with barbell on back (Vigotsky 2015).',
  },

  reverse_lunge: {
    name: 'Reverse Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee over ankle', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 80, good: 'Knee properly aligned', bad: 'Front knee too far forward', severity: 'major', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Reverse lunges reduce knee shear compared to forward lunges while maintaining quad/glute activation (Riemann 2012).',
  },

  walking_lunge: {
    name: 'Walking Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good lunge depth', bad: 'Drop knee lower', severity: 'minor', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Walking lunges add dynamic balance and deceleration demands to the standard lunge (Riemann 2012).',
  },

  side_lunge: {
    name: 'Side Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Hip Adductors', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 110, good: 'Good lateral depth', bad: 'Sit deeper into the lunge', severity: 'minor', citation: 'Riemann BL et al, 2012' },
    ],
    scienceNotes: 'Side lunges train frontal plane movement and adductor strength, valuable for sport performance (Riemann 2012).',
  },

  split_jerk: {
    name: 'Split Jerk',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Deltoids', 'Triceps'], secondary: ['Core', 'Glutes'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 165,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 165, 15), good: 'Arms locked overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015', phase: 'top' },
    ],
    scienceNotes: 'Split jerk drives barbell overhead using leg drive and split stance for stability (Suchomel 2015).',
  },

  push_press: {
    name: 'Push Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Quadriceps', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15), good: 'Full overhead press', bad: 'Lock out fully', severity: 'major', citation: 'Lake JP, Lauder MA, 2012', phase: 'top' },
    ],
    scienceNotes: 'Push press uses leg drive dip to move more weight overhead than strict press (Lake 2012).',
  },

  wall_ball: {
    name: 'Wall Ball',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Deltoids'], secondary: ['Core', 'Triceps'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Squat depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good squat depth', bad: 'Squat deeper before throwing', severity: 'major', citation: 'Glassman G, CrossFit L1 Training Guide' },
    ],
    scienceNotes: 'Wall balls combine front squat with overhead throw, a CrossFit staple for metabolic conditioning.',
  },

  battle_rope: {
    name: 'Battle Rope',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Core'], secondary: ['Forearms', 'Latissimus Dorsi'] },
    joint: 'shoulder',
    value: { type: 'custom', fn: (angles, landmarks) => {
      // Wrist y-position normalized to body height (camera-distance independent).
      // Guard: body height must be at least 10% of the frame (nose far enough from
      // ankle) to avoid division-by-near-zero on bad camera angles.
      if (landmarks && landmarks[15] && landmarks[16] && landmarks[0] && landmarks[27]) {
        const bodyHeight = Math.abs(landmarks[27].y - landmarks[0].y);
        if (bodyHeight < 0.1) return angles.leftShoulder; // fallback to shoulder angle
        const wristY = (landmarks[15].y + landmarks[16].y) / 2;
        return (1 - wristY / bodyHeight) * 100;
      }
      return angles.leftShoulder;
    } },
    downThreshold: 30,
    upThreshold: 50,
    amplitudeRatio: 0.12,
    minSpacing: 0.15,
    formChecks: [
      { name: 'Stable base', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Athletic stance', bad: 'Bend knees into athletic position', severity: 'minor', citation: 'Fountaine CJ, Schmidt BJ, 2015' },
    ],
    scienceNotes: 'Battle ropes produce high cardiovascular and upper body metabolic demand (Fountaine 2015).',
  },


  // ===== LEGS — QUAD / MACHINE =====
  box_squat: {
    name: 'Box Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Sit fully on box', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Full sit on box', bad: 'Sit completely on the box before standing', severity: 'major', citation: 'Swinton PA et al, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Box squats develop concentric strength by eliminating the stretch-shortening cycle at the bottom (Swinton 2012).',
  },

  pause_squat: {
    name: 'Pause Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Below parallel', bad: 'Squat deeper before pausing', severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pause squats eliminate the stretch-shortening cycle, increasing time under tension at the bottom and improving rate of force development (Schoenfeld 2010).',
  },

  belt_squat: {
    name: 'Belt Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good depth', bad: 'Squat deeper', severity: 'minor', citation: 'Evans TW et al, 2019, J Strength Cond Res' },
    ],
    scienceNotes: 'Belt squat loads the lower body without axial spinal compression, making it spine-friendly while maintaining quad/glute activation (Evans 2019).',
  },

  heel_elevated_squat: {
    name: 'Heel Elevated Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Upright torso', type: 'below', key: 'trunk', threshold: 45, margin: 12, good: 'Torso upright', bad: 'Stay more upright', severity: 'minor', citation: 'Sayers MGL et al, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Heel elevation increases knee flexion ROM and shifts load anteriorly to the quadriceps by allowing a more upright torso (Sayers 2012).',
  },

  landmine_squat: {
    name: 'Landmine Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 95,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good squat depth', bad: 'Squat deeper', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Landmine squat provides an arc-path load that naturally encourages upright torso positioning (NSCA 2016).',
  },

  pendulum_squat: {
    name: 'Pendulum Squat',
    category: 'machine',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Full range of motion', bad: 'Go deeper', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pendulum squat machines provide a fixed arc path that reduces stabilization demands while maximizing quad loading (Schoenfeld 2010).',
  },

  sissy_squat: {
    name: 'Sissy Squat',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps'], secondary: ['Hip Flexors', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 60,
    upThreshold: 155,
    formChecks: [
      { name: 'Lean back', type: 'above', key: 'trunk', threshold: 40, margin: 12, good: 'Good backward lean', bad: 'Lean back further to load quads', severity: 'minor', citation: 'Signorile JF et al, 1994, J Strength Cond Res' },
    ],
    scienceNotes: 'Sissy squats isolate the quadriceps through extreme knee flexion with posterior trunk lean (Signorile 1994).',
  },

  adductor_machine: {
    name: 'Adductor Machine',
    category: 'machine',
    muscles: { primary: ['Hip Adductors'], secondary: ['Hip Adductors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled squeeze', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 110, good: 'Full adduction', bad: 'Squeeze legs fully together', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine hip adduction isolates the adductor magnus, longus, and brevis in a controlled path (NSCA 2016).',
  },

  abductor_machine: {
    name: 'Abductor Machine',
    category: 'machine',
    muscles: { primary: ['Hip Abductors'], secondary: ['Gluteus Medius'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full abduction', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 150, 15), good: 'Full range abduction', bad: 'Push legs further apart', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine hip abduction targets the gluteus medius and minimus, important for hip stability and knee tracking (NSCA 2016).',
  },

  cable_hip_adduction: {
    name: 'Cable Hip Adduction',
    category: 'isolation',
    muscles: { primary: ['Hip Adductors'], secondary: ['Hip Adductors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled motion', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 120, good: 'Controlled adduction', bad: 'Control the movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable adduction provides constant tension through the full ROM unlike machine variants (NSCA 2016).',
  },

  cable_hip_abduction: {
    name: 'Cable Hip Abduction',
    category: 'isolation',
    muscles: { primary: ['Hip Abductors', 'Glutes'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable torso', type: 'below', key: 'trunk', threshold: 30, margin: 12, good: 'Torso stable', bad: 'Avoid leaning away from working leg', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Standing cable abduction produces high gluteus medius activation when performed with stable torso (Distefano 2009).',
  },

  single_leg_press: {
    name: 'Single-Leg Press',
    category: 'machine',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Good depth', bad: 'Press deeper', severity: 'minor', citation: 'Escamilla RF et al, 2001, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Single-leg press addresses bilateral strength deficits while providing machine stability (Escamilla 2001).',
  },


  // ===== LEGS — POSTERIOR CHAIN =====
  stiff_leg_deadlift: {
    name: 'Stiff-Leg Deadlift',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Trapezius'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Straight legs', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 155, 15), good: 'Legs straight', bad: 'Keep legs straighter', severity: 'minor', citation: 'McAllister MJ et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Stiff-leg deadlift maximizes hamstring stretch and eccentric loading compared to conventional deadlift (McAllister 2014).',
  },

  single_leg_hip_thrust: {
    name: 'Single-Leg Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full hip extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Single-leg hip thrust addresses bilateral glute strength imbalances while producing high glute activation (Contreras 2015).',
  },

  cable_pull_through: {
    name: 'Cable Pull-Through',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Erectors', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 90, good: 'Good hip hinge depth', bad: 'Hinge further at hips', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Cable pull-through teaches hip hinge mechanics with constant tension, useful as a deadlift accessory (Contreras 2015).',
  },

  donkey_kick: {
    name: 'Donkey Kick',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable spine', type: 'below', key: 'trunk', threshold: 30, margin: 12, good: 'Spine neutral', bad: 'Avoid arching lower back', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Donkey kicks isolate glute max with minimal equipment, producing moderate-to-high glute activation (Distefano 2009).',
  },

  fire_hydrant: {
    name: 'Fire Hydrant',
    category: 'bodyweight',
    muscles: { primary: ['Glutes', 'Hip Abductors'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Stable torso', type: 'below', key: 'trunk', threshold: 25, margin: 12, good: 'Torso stable', bad: 'Keep torso still', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Fire hydrants target the gluteus medius through hip abduction and external rotation from a quadruped position (Distefano 2009).',
  },

  lying_leg_curl: {
    name: 'Lying Leg Curl',
    category: 'machine',
    muscles: { primary: ['Hamstrings'], secondary: ['Gastrocnemius'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 80, good: 'Full curl', bad: 'Curl further', severity: 'minor', citation: 'Schoenfeld BJ et al, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Lying leg curl targets the hamstrings at the knee joint in a shortened hip position, emphasizing the short head of the biceps femoris (Schoenfeld 2015).',
  },

  glute_ham_raise: {
    name: 'Glute-Ham Raise',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Erectors', 'Calves'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 50,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 60, good: 'Full body extension', bad: 'Lower further', severity: 'major', citation: 'Zebis MK et al, 2013, Br J Sports Med' },
    ],
    scienceNotes: 'Glute-ham raise produces very high hamstring activation and is superior to lying leg curl for eccentric hamstring strength (Zebis 2013).',
  },

  reverse_hyperextension: {
    name: 'Reverse Hyperextension',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled swing', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Extend hips fully', severity: 'minor', citation: 'Lawrence MA, Carlisle T, 2015, J Strength Cond Res' },
    ],
    scienceNotes: 'Reverse hypers decompress the spine while loading the posterior chain through hip extension (Lawrence 2015).',
  },

  cable_hip_extension: {
    name: 'Cable Hip Extension',
    category: 'isolation',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Stable torso', type: 'below', key: 'trunk', threshold: 25, margin: 12, good: 'Torso stable', bad: 'Avoid leaning forward', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable hip extension provides constant tension through the glute extension range, useful for glute isolation (NSCA 2016).',
  },


  // ===== LEGS — CALVES =====
  donkey_calf_raise: {
    name: 'Donkey Calf Raise',
    category: 'isolation',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Full stretch', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Full calf stretch at bottom', bad: 'Lower heels further', severity: 'minor', citation: 'Schoenfeld BJ et al, 2020, J Strength Cond Res' },
    ],
    scienceNotes: 'Donkey calf raise loads the gastrocnemius in a stretched hip position, increasing stretch-mediated hypertrophy (Schoenfeld 2020).',
  },

  leg_press_calf_raise: {
    name: 'Leg Press Calf Raise',
    category: 'machine',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: [] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 160, good: 'Full range of motion', bad: 'Use full range', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Leg press calf raise allows heavy loading with a locked knee position for gastrocnemius emphasis (NSCA 2016).',
  },

  tibialis_raise: {
    name: 'Tibialis Raise',
    category: 'isolation',
    muscles: { primary: ['Tibialis Anterior'], secondary: [] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 155,
    upThreshold: 175,
    formChecks: [
      { name: 'Controlled motion', type: 'custom', placeholder: true, good: 'Controlled dorsiflexion', bad: 'Slow down the movement', severity: 'minor', citation: 'Jeon HS et al, 2015, J Phys Ther Sci' },
    ],
    scienceNotes: 'Tibialis raises strengthen the tibialis anterior, important for ankle stability and shin splint prevention (Jeon 2015).',
  },


  // ===== LEGS — PLYOMETRIC =====
  depth_jump: {
    name: 'Depth Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Quick ground contact', type: 'above', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Short ground contact time', bad: 'React faster off the ground', severity: 'major', citation: 'Bobbert MF et al, 1987, Med Sci Sports Exerc' },
    ],
    scienceNotes: 'Depth jumps develop reactive strength by exploiting the stretch-shortening cycle from a drop height (Bobbert 1987).',
  },

  broad_jump: {
    name: 'Broad Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Landing control', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 120, good: 'Controlled landing', bad: 'Absorb landing with bent knees', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Broad jumps develop horizontal power production, a key predictor of sprint performance (Hewett 2005).',
  },

  split_squat_jump: {
    name: 'Split Squat Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good split depth', bad: 'Drop lower before jumping', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Split squat jumps develop unilateral explosive power and coordination (Hewett 2005).',
  },

  tuck_jump: {
    name: 'Tuck Jump',
    category: 'bodyweight',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Hip Flexors'], secondary: ['Calves', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 60,
    upThreshold: 155,
    formChecks: [
      { name: 'Knee tuck height', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 70, good: 'Knees high', bad: 'Bring knees higher to chest', severity: 'minor', citation: 'Hewett TE et al, 2005, Am J Sports Med' },
    ],
    scienceNotes: 'Tuck jumps develop explosive power and hip flexor strength while challenging coordination (Hewett 2005).',
  },

  curtsy_lunge: {
    name: 'Curtsy Lunge',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Quadriceps', 'Hip Adductors'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good lunge depth', bad: 'Step deeper behind', severity: 'minor', citation: 'Stastny P et al, 2015, J Hum Kinet' },
    ],
    scienceNotes: 'Curtsy lunges emphasize glute medius and adductors through the crossover stepping pattern (Stastny 2015).',
  },


  // ===== CHEST =====
  incline_dumbbell_press: {
    name: 'Incline Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Upper Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Lauver JD et al, 2016, Eur J Sport Sci', phase: 'top' },
    ],
    scienceNotes: 'Incline dumbbell press at 30-45 degrees maximizes clavicular head pectoralis activation compared to flat (Lauver 2016).',
  },

  decline_dumbbell_press: {
    name: 'Decline Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Lower Pectorals', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Extend fully', severity: 'minor', citation: 'Lauver JD et al, 2016, Eur J Sport Sci', phase: 'top' },
    ],
    scienceNotes: 'Decline pressing emphasizes the sternal head of the pectoralis major and reduces shoulder stress (Lauver 2016).',
  },

  flat_dumbbell_press: {
    name: 'Flat Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Anterior Deltoids', 'Triceps'], secondary: ['Serratus Anterior'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH et al, 2017, J Sports Sci', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell press allows greater ROM and independent arm movement compared to barbell, increasing stabilizer activation (Saeterbakken 2017).',
  },

  machine_fly: {
    name: 'Pec Deck Fly',
    category: 'machine',
    muscles: { primary: ['Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 70,
    formChecks: [
      { name: 'Squeeze at center', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 40, good: 'Full contraction', bad: 'Squeeze arms together more', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Pec deck provides isolated chest activation with reduced triceps involvement compared to pressing (Schoenfeld 2010).',
  },

  chest_dip: {
    name: 'Chest Dip',
    category: 'compound',
    muscles: { primary: ['Lower Pectorals', 'Triceps', 'Anterior Deltoids'], secondary: ['Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Forward lean', type: 'above', key: 'trunk', threshold: 15, margin: 12, good: 'Good forward lean for chest emphasis', bad: 'Lean forward more to target chest', severity: 'minor', citation: 'McKenzie A et al, 2022, J Strength Cond Res' },
    ],
    scienceNotes: 'Forward-leaning dip position shifts emphasis from triceps to pectoralis major (McKenzie 2022).',
  },

  decline_push_up: {
    name: 'Decline Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Upper Pectorals', 'Triceps'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Chest near floor', bad: 'Lower chest closer to floor', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Decline push-ups (feet elevated) increase load on the upper chest and shoulders compared to standard push-ups (Cogley 2005).',
  },

  svend_press: {
    name: 'Svend Press',
    category: 'isolation',
    muscles: { primary: ['Pectorals'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 20,
    upThreshold: 60,
    formChecks: [
      { name: 'Constant squeeze', type: 'custom', placeholder: true, good: 'Maintaining plate squeeze', bad: 'Squeeze plates harder together', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Svend press emphasizes inner chest activation through isometric adduction force while pressing (NSCA 2016).',
  },


  // ===== BACK — VERTICAL PULLS =====
  neutral_grip_pull_up: {
    name: 'Neutral Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Brachialis', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Neutral grip reduces wrist and shoulder stress while maintaining high lat and bicep activation (Youdas 2010).',
  },

  wide_grip_pull_up: {
    name: 'Wide Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Teres Major'], secondary: ['Biceps', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Andersen V et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Wide grip pull-ups increase lat width emphasis but reduce ROM compared to narrower grips (Andersen 2014).',
  },

  close_grip_pull_up: {
    name: 'Close Grip Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Brachialis', 'Lower Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Chin over bar', bad: 'Pull higher', severity: 'minor', citation: 'Andersen V et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Close grip allows greater ROM per rep and increased bicep contribution (Andersen 2014).',
  },

  straight_arm_pulldown: {
    name: 'Straight-Arm Pulldown',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi'], secondary: ['Teres Major', 'Posterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Straight arms', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Arms straight', bad: 'Keep arms straighter', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Straight-arm pulldowns isolate the lats without bicep involvement, useful as a mind-muscle connection exercise (NSCA 2016).',
  },

  assisted_pull_up: {
    name: 'Assisted Pull-Up',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 95, good: 'Chin above bar', bad: 'Pull higher', severity: 'minor', citation: 'Youdas JW et al, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Assisted pull-ups allow progressive overload toward bodyweight pull-ups while maintaining similar muscle activation patterns (Youdas 2010).',
  },

  kipping_pull_up: {
    name: 'Kipping Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Deltoids'], secondary: ['Biceps', 'Core', 'Hip Flexors'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Chin over bar', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Chin clears bar', bad: 'Pull higher', severity: 'minor', citation: 'Halet KA et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Kipping pull-ups use momentum from hip drive to increase rep volume; lower per-rep muscle tension than strict pull-ups (Halet 2009).',
  },

  scapular_pull_up: {
    name: 'Scapular Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Lower Trapezius', 'Serratus Anterior'], secondary: ['Rhomboids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 150,
    upThreshold: 170,
    formChecks: [
      { name: 'Scapular retraction', type: 'custom', placeholder: true, good: 'Good scapular movement', bad: 'Focus on pulling shoulder blades down and back', severity: 'minor', citation: 'Decker MJ et al, 1999, J Shoulder Elbow Surg' },
    ],
    scienceNotes: 'Scapular pull-ups train scapular depression and retraction, foundational for healthy overhead movement (Decker 1999).',
  },


  // ===== BACK — ROWS =====
  single_arm_dumbbell_row: {
    name: 'Single-Arm Dumbbell Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Posterior Deltoids'], secondary: ['Rhomboids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 105, good: 'Elbow past torso', bad: 'Pull elbow further back', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Single-arm rows allow unilateral lat loading and anti-rotation core demand (Fenwick 2009).',
  },

  meadows_row: {
    name: 'Meadows Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Posterior Deltoids'], secondary: ['Biceps', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Elbow drive', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 110, good: 'Good elbow drive', bad: 'Drive elbow higher', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Meadows row (landmine single-arm row) provides a unique arc path that emphasizes the upper lat and teres major (Fenwick 2009).',
  },

  seal_row: {
    name: 'Seal Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Rhomboids', 'Biceps'], secondary: ['Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full contraction', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 105, good: 'Full row', bad: 'Pull higher', severity: 'minor', citation: 'Lehman GJ et al, 2004, J Strength Cond Res' },
    ],
    scienceNotes: 'Seal row (prone bench row) eliminates momentum and lower back involvement, isolating the upper back (Lehman 2004).',
  },

  machine_row: {
    name: 'Machine Row',
    category: 'machine',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rhomboids', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 110, good: 'Full pull', bad: 'Pull handles further back', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine rows provide stable support for back isolation, removing core and balance limitations (NSCA 2016).',
  },

  cable_row_single: {
    name: 'Single-Arm Cable Row',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Anti-rotation', type: 'below', key: 'trunk', threshold: 25, margin: 12, good: 'Torso stable', bad: 'Avoid rotating torso', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Single-arm cable row combines lat isolation with anti-rotation core demand (Fenwick 2009).',
  },

  dumbbell_pullover: {
    name: 'Dumbbell Pullover',
    category: 'isolation',
    muscles: { primary: ['Latissimus Dorsi', 'Pectorals'], secondary: ['Triceps', 'Serratus Anterior'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Slight elbow bend', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 140, 15), good: 'Slight elbow bend maintained', bad: 'Keep slight bend in elbows', severity: 'minor', citation: 'Marchetti PH, Uchida MC, 2011, J Electromyogr Kinesiol' },
    ],
    scienceNotes: 'Dumbbell pullovers stretch the lats and pecs simultaneously, with activation ratio depending on cue (pull vs squeeze) (Marchetti 2011).',
  },

  yates_row: {
    name: 'Yates Row (Underhand Barbell Row)',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Rhomboids', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Torso angle', type: 'above', key: 'trunk', threshold: 40, margin: 12, good: 'Good torso angle', bad: 'Maintain moderate forward lean', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Supinated grip row increases bicep recruitment and allows higher pulling volume at a more upright torso angle (Fenwick 2009).',
  },

  incline_dumbbell_row: {
    name: 'Incline Dumbbell Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Posterior Deltoids'], secondary: ['Biceps', 'Rhomboids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Chest on bench', type: 'custom', placeholder: true, good: 'Chest supported on bench', bad: 'Keep chest on the bench', severity: 'minor', citation: 'Lehman GJ et al, 2004, J Strength Cond Res' },
    ],
    scienceNotes: 'Incline dumbbell rows with chest support eliminate momentum and isolate upper back musculature (Lehman 2004).',
  },


  // ===== BACK — LOWER BACK =====
  back_extension: {
    name: 'Back Extension (Roman Chair)',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Controlled motion', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Full extension', bad: 'Extend until body is straight', severity: 'minor', citation: 'Mayer JM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Roman chair back extensions produce high erector spinae activation and can be loaded progressively (Mayer 2005).',
  },

  back_extension_45: {
    name: '45-Degree Back Extension',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full extension', bad: 'Extend until body is straight', severity: 'minor', citation: 'Mayer JM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: '45-degree back extension produces high erector spinae activation while allowing progressive overload with weight (Mayer 2005).',
  },

  jefferson_curl: {
    name: 'Jefferson Curl',
    category: 'isolation',
    muscles: { primary: ['Erectors', 'Hamstrings'], secondary: ['Glutes'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 45,
    upThreshold: 165,
    formChecks: [
      { name: 'Slow controlled descent', type: 'custom', placeholder: true, good: 'Controlled spinal articulation', bad: 'Roll down one vertebra at a time', severity: 'major', citation: 'McGill SM, 2015, Low Back Disorders' },
    ],
    scienceNotes: 'Jefferson curls train spinal flexion under load for mobility; contraindicated for those with disc issues (McGill 2015).',
  },

  rack_pull: {
    name: 'Rack Pull',
    category: 'compound',
    muscles: { primary: ['Trapezius', 'Erectors', 'Glutes'], secondary: ['Hamstrings', 'Forearms'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 165,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Stand fully upright', severity: 'minor', citation: 'Swinton PA et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Rack pulls overload the lockout portion of the deadlift, developing upper back and grip strength (Swinton 2011).',
  },


  // ===== SHOULDERS =====
  machine_shoulder_press: {
    name: 'Machine Shoulder Press',
    category: 'machine',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full press', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Machine shoulder press provides stable overhead pressing, suitable for beginners and high-volume training (NSCA 2016).',
  },

  dumbbell_overhead_press: {
    name: 'Dumbbell Overhead Press (Standing)',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Core', 'Upper Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout overhead', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Standing dumbbell press produces higher deltoid and core activation than seated variants (Saeterbakken 2013).',
  },

  seated_dumbbell_press: {
    name: 'Seated Dumbbell Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Press to full extension', severity: 'minor', citation: 'Saeterbakken AH, Fimland MS, 2013, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Seated pressing allows higher loads due to back support, isolating the deltoids with less core demand (Saeterbakken 2013).',
  },

  z_press: {
    name: 'Z Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps', 'Core'], secondary: ['Upper Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Upright torso', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Torso upright', bad: 'Stay upright without leaning back', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Z press (seated on floor, no back support) demands extreme core stability and eliminates leg drive (NSCA 2016).',
  },

  cable_lateral_raise: {
    name: 'Cable Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Controlled raise', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 70, 15), good: 'Arms at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable lateral raises provide constant tension throughout ROM, superior to dumbbells for lateral deltoid hypertrophy (Reinold 2004).',
  },

  cable_front_raise: {
    name: 'Cable Front Raise',
    category: 'isolation',
    muscles: { primary: ['Anterior Deltoids'], secondary: ['Upper Pectorals'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Shoulder height', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 70, 15), good: 'Arm at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable front raises provide constant tension on the anterior deltoid through the full range (NSCA 2016).',
  },

  cable_rear_delt_fly: {
    name: 'Cable Rear Delt Fly',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full retraction', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 60, 15), good: 'Full rear delt squeeze', bad: 'Pull arms further back', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable rear delt fly isolates the posterior deltoid with constant cable tension (Reinold 2004).',
  },

  machine_rear_delt_fly: {
    name: 'Machine Rear Delt Fly (Reverse Pec Deck)',
    category: 'machine',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full squeeze', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 60, 15), good: 'Full retraction', bad: 'Squeeze shoulder blades together more', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Reverse pec deck provides stable rear delt isolation with guided movement path (NSCA 2016).',
  },

  band_pull_apart: {
    name: 'Band Pull-Apart',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 120,
    formChecks: [
      { name: 'Full stretch', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 100,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 100, 15), good: 'Band to chest', bad: 'Pull band further apart', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Band pull-aparts are a highly effective warm-up and shoulder health exercise targeting the rear delts and rhomboids (Reinold 2004).',
  },

  external_rotation: {
    name: 'External Rotation',
    category: 'isolation',
    muscles: { primary: ['Rotator Cuff'], secondary: ['Posterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'Elbow pinned', type: 'custom', placeholder: true, good: 'Elbow at side', bad: 'Keep elbow pinned to your side', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'External rotation strengthens the infraspinatus and teres minor, critical for shoulder stability and injury prevention (Reinold 2004).',
  },

  internal_rotation: {
    name: 'Internal Rotation',
    category: 'isolation',
    muscles: { primary: ['Rotator Cuff'], secondary: ['Pectorals', 'Anterior Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 80,
    formChecks: [
      { name: 'Elbow pinned', type: 'custom', placeholder: true, good: 'Elbow at side', bad: 'Keep elbow pinned to your side', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Internal rotation targets the subscapularis for balanced rotator cuff strength (Reinold 2004).',
  },

  prone_y_raise: {
    name: 'Prone Y Raise',
    category: 'isolation',
    muscles: { primary: ['Lower Trapezius', 'Posterior Deltoids'], secondary: ['Rhomboids'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 10,
    upThreshold: 90,
    formChecks: [
      { name: 'Thumbs up position', type: 'custom', placeholder: true, good: 'Thumbs pointing up', bad: 'Rotate thumbs upward', severity: 'minor', citation: 'Cools AM et al, 2007, Am J Sports Med' },
    ],
    scienceNotes: 'Prone Y raises produce high lower trapezius activation, important for scapular upward rotation and shoulder health (Cools 2007).',
  },

  seated_lateral_raise: {
    name: 'Seated Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'No momentum', type: 'below', key: 'trunk', threshold: 30, margin: 12, good: 'No body swing', bad: 'Avoid swinging torso', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Seated lateral raises eliminate lower body momentum, isolating the lateral deltoid (Reinold 2004). Trunk threshold relaxed for seated position camera angle variance.',
  },


  // ===== BICEPS =====
  barbell_curl: {
    name: 'Barbell Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'No body swing', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Strict form', bad: 'Avoid swinging body', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'Barbell curls allow heavier loading than dumbbell variants; strict form maximizes bicep activation (Marcolin 2018).',
  },

  ez_bar_curl: {
    name: 'EZ Bar Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Strict form', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Strict curl', bad: 'Avoid using momentum', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'EZ bar reduces wrist strain compared to straight bar while maintaining similar bicep activation (Marcolin 2018).',
  },

  cable_curl: {
    name: 'Cable Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Elbows stationary', type: 'below', key: 'trunk', threshold: 15, margin: 12, good: 'Elbows pinned', bad: 'Keep elbows at your sides', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cable curls provide constant tension throughout the entire ROM unlike free weight curls (NSCA 2016).',
  },

  incline_dumbbell_curl: {
    name: 'Incline Dumbbell Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full stretch', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 140, 15), good: 'Full arm extension at bottom', bad: 'Let arms fully extend', severity: 'minor', citation: 'Oliveira LF et al, 2009, J Strength Cond Res', phase: 'bottom' },
    ],
    scienceNotes: 'Incline position stretches the biceps long head maximally, producing greater muscle activation at long muscle lengths (Oliveira 2009).',
  },

  reverse_curl: {
    name: 'Reverse Curl (Pronated Grip)',
    category: 'isolation',
    muscles: { primary: ['Brachioradialis', 'Brachialis'], secondary: ['Biceps', 'Forearms'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Strict form', type: 'below', key: 'trunk', threshold: 15, margin: 12, good: 'Strict reverse curl', bad: 'Avoid swinging', severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ' },
    ],
    scienceNotes: 'Pronated grip shifts emphasis from biceps to brachioradialis and brachialis, building forearm mass (Marcolin 2018).',
  },

  zottman_curl: {
    name: 'Zottman Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachioradialis'], secondary: ['Brachialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Rotation at top', type: 'custom', placeholder: true, good: 'Supinate up, pronate down', bad: 'Rotate wrists at the top', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Zottman curls combine supinated concentric (biceps emphasis) with pronated eccentric (brachioradialis emphasis) (NSCA 2016).',
  },

  drag_curl: {
    name: 'Drag Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 140,
    formChecks: [
      { name: 'Elbows back', type: 'custom', placeholder: true, good: 'Bar dragging up body', bad: 'Keep the bar close to your torso', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Drag curls eliminate front deltoid involvement by driving elbows behind the body, isolating the biceps (NSCA 2016).',
  },

  cross_body_curl: {
    name: 'Cross-Body Curl',
    category: 'isolation',
    muscles: { primary: ['Brachialis', 'Biceps'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Cross midline', type: 'custom', placeholder: true, good: 'Curling across body', bad: 'Curl dumbbell across to opposite shoulder', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Cross-body (pinwheel) curls emphasize the brachialis through a neutral grip and cross-body path (NSCA 2016).',
  },

  machine_curl: {
    name: 'Machine Bicep Curl',
    category: 'machine',
    muscles: { primary: ['Biceps', 'Brachialis'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 85, good: 'Full curl', bad: 'Curl further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine curls provide guided movement and constant resistance, useful for isolation and drop sets (NSCA 2016).',
  },


  // ===== TRICEPS =====
  bench_dip: {
    name: 'Bench Dip',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Anterior Deltoids'], secondary: ['Pectorals'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Good depth', bad: 'Lower further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Bench dips are an accessible bodyweight tricep exercise; avoid going too deep to protect shoulders (NSCA 2016).',
  },

  kickback: {
    name: 'Tricep Kickback',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BSM_ELBOW,
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 150, 15), good: 'Full lockout', bad: 'Extend arm fully', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'top' },
    ],
    scienceNotes: 'Tricep kickbacks produce high tricep activation at full extension due to peak resistance at lockout (Boeckh-Behrens 2000).',
  },

  cable_kickback: {
    name: 'Cable Tricep Kickback',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BSM_ELBOW,
    downThreshold: 70,
    upThreshold: 155,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 150, 15), good: 'Full lockout', bad: 'Extend arm fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable kickbacks maintain constant tension throughout the ROM unlike dumbbell variants (NSCA 2016).',
  },

  rope_pushdown: {
    name: 'Rope Tricep Pushdown',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BSM_ELBOW,
    downThreshold: 60,
    upThreshold: 130,
    formChecks: [
      { name: 'Spread at bottom', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 125,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 125, 15), good: 'Full spread and lockout', bad: 'Spread the rope at the bottom', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'top' },
    ],
    scienceNotes: 'Rope pushdowns allow wrist pronation at the bottom, increasing lateral head tricep activation (Boeckh-Behrens 2000).',
  },

  overhead_cable_tricep: {
    name: 'Overhead Cable Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 145,
    formChecks: [
      { name: 'Full stretch', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 70, good: 'Full stretch at bottom', bad: 'Let weight stretch triceps fully', severity: 'minor', citation: 'Boeckh-Behrens WU, Buskies D, 2000', phase: 'bottom' },
    ],
    scienceNotes: 'Overhead extension stretches the triceps long head maximally, producing superior hypertrophy of that head (Boeckh-Behrens 2000).',
  },

  machine_tricep_extension: {
    name: 'Machine Tricep Extension',
    category: 'machine',
    muscles: { primary: ['Triceps'], secondary: [] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 145,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 145, 15), good: 'Full extension', bad: 'Extend fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Machine tricep extension provides guided movement for isolated tricep training (NSCA 2016).',
  },

  close_grip_push_up: {
    name: 'Close-Grip Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Triceps', 'Pectorals'], secondary: ['Anterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full ROM', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 80, good: 'Chest near floor', bad: 'Lower chest closer to floor', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'Close-grip push-ups produce significantly higher tricep activation than standard width (Cogley 2005).',
  },

  tate_press: {
    name: 'Tate Press',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Pectorals'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Elbows stable', type: 'custom', placeholder: true, good: 'Elbows pointing out', bad: 'Keep elbows flared', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Tate press targets the triceps through a unique inward pressing path with dumbbells (NSCA 2016).',
  },

  jm_press: {
    name: 'JM Press',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Anterior Deltoids', 'Pectorals'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'Bar path to chin', type: 'custom', placeholder: true, good: 'Bar lowering to chin/neck area', bad: 'Lower bar toward chin, not chest', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'JM press is a hybrid between close-grip bench and skull crusher, heavily loading the triceps (NSCA 2016).',
  },


  // ===== FOREARMS =====
  wrist_extension: {
    name: 'Wrist Extension (Reverse Wrist Curl)',
    category: 'isolation',
    muscles: { primary: ['Forearms'], secondary: ['Brachioradialis'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 100,
    formChecks: [
      { name: 'Controlled motion', type: 'custom', placeholder: true, good: 'Controlled wrist extension', bad: 'Slow down the movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wrist extensions strengthen the extensor carpi muscles, important for grip balance and injury prevention (NSCA 2016).',
  },

  farmers_walk: {
    name: 'Upright posture',
    category: 'compound',
    muscles: { primary: ['Forearms', 'Trapezius', 'Core'], secondary: ['Glutes', 'Calves'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 5,
    upThreshold: 20,
    formChecks: [
      { name: 'Upright posture', type: 'below', key: 'trunk', threshold: 15, margin: 12, good: 'Tall posture', bad: 'Stand tall with shoulders back', severity: 'minor', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
  },


  // ===== TRAPS =====
  dumbbell_shrug: {
    name: 'Dumbbell Shrug',
    category: 'isolation',
    muscles: { primary: ['Upper Trapezius'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 10,
    upThreshold: 25,
    formChecks: [
      { name: 'Full elevation', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 15, good: 'Full shrug', bad: 'Shrug higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell shrugs allow more natural scapular movement compared to barbell shrugs (NSCA 2016).',
  },

  cable_shrug: {
    name: 'Cable Shrug',
    category: 'isolation',
    muscles: { primary: ['Upper Trapezius'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 10,
    upThreshold: 25,
    formChecks: [
      { name: 'Full elevation', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 15, good: 'Full shrug', bad: 'Shrug higher', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Cable shrugs provide constant tension throughout the shrugging motion (NSCA 2016).',
  },


  // ===== CORE =====
  ab_wheel_rollout: {
    name: 'Ab Wheel Rollout',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Core'], secondary: ['Latissimus Dorsi', 'Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 100,
    formChecks: [
      { name: 'No lower back sag', type: 'below', key: 'trunk', threshold: 30, margin: 12, good: 'Spine neutral', bad: 'Avoid lower back sagging', severity: 'major', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Ab wheel rollouts produce very high rectus abdominis and external oblique activation (Escamilla 2010).',
  },

  dragon_flag: {
    name: 'Dragon Flag',
    category: 'bodyweight',
    muscles: { primary: ['Rectus Abdominis', 'Core'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 170,
    formChecks: [
      { name: 'Body straight', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Body in straight line', bad: 'Keep body rigid and straight', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Dragon flags are an advanced core exercise requiring extreme anti-extension strength (NSCA 2016).',
  },

  cable_crunch: {
    name: 'Cable Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Spine flexion', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 80, good: 'Good crunch depth', bad: 'Crunch further down', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Cable crunches allow progressive overload on the rectus abdominis, producing high activation (Escamilla 2010).',
  },

  decline_crunch: {
    name: 'Decline Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques', 'Hip Flexors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Controlled motion', type: 'custom', placeholder: true, good: 'Controlled descent', bad: 'Lower slowly', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Decline angle increases resistance against the rectus abdominis compared to flat crunches (Escamilla 2010).',
  },

  hanging_knee_raise: {
    name: 'Hanging Knee Raise',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 60,
    upThreshold: 140,
    formChecks: [
      { name: 'No swinging', type: 'custom', placeholder: true, good: 'Controlled raise', bad: 'Minimize body swing', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Hanging knee raises primarily target the hip flexors with upper ab contribution through posterior pelvic tilt (Escamilla 2010).',
  },

  lying_leg_raise: {
    name: 'Lying Leg Raise',
    category: 'bodyweight',
    muscles: { primary: ['Hip Flexors', 'Rectus Abdominis'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Lower back flat', type: 'above', key: 'trunk', threshold: 155, margin: 20, good: 'Lower back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Lying leg raises target the lower portion of the rectus abdominis through hip flexion (Escamilla 2010).',
  },

  wood_chop: {
    name: 'Cable Wood Chop',
    category: 'compound',
    muscles: { primary: ['Obliques', 'Core'], secondary: ['Deltoids', 'Hip Flexors'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Rotate from core', type: 'centerDeviation', key: 'trunk', center: 80, margin: 25, good: 'Rotating from core', bad: 'Drive rotation from hips and core, not arms', severity: 'minor', citation: 'Saeterbakken AH et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Cable wood chops train rotational power, critical for sports performance and functional movement (Saeterbakken 2011).',
  },

  pallof_press: {
    name: 'Pallof Press',
    category: 'isolation',
    muscles: { primary: ['Core', 'Obliques'], secondary: ['Deltoids'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 40,
    upThreshold: 140,
    formChecks: [
      { name: 'Anti-rotation', type: 'below', key: 'trunk', threshold: 15, margin: 12, good: 'Resisting rotation', bad: 'Keep torso square and resist rotation', severity: 'minor', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Pallof press trains anti-rotation core stability, recommended by McGill as a core exercise that spares the spine (McGill 2010).',
  },

  dead_bug: {
    name: 'Dead Bug',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Rectus Abdominis'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Lower back flat', type: 'above', key: 'trunk', threshold: 155, margin: 20, good: 'Lower back pressed to floor', bad: 'Press lower back into the floor', severity: 'major', citation: 'McGill SM, 2010, Ultimate Back Fitness and Performance' },
    ],
    scienceNotes: 'Dead bugs train anti-extension core stability in a supine position, spine-friendly and rehab-appropriate (McGill 2010).',
  },

  copenhagen_plank: {
    name: 'Copenhagen Plank',
    category: 'bodyweight',
    muscles: { primary: ['Hip Adductors', 'Obliques', 'Core'], secondary: ['Hip Abductors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: null,
    upThreshold: null,
    isIsometric: true,
    formChecks: [
      { name: 'Straight body line', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 165,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 165, 15), good: 'Body in straight line', bad: 'Keep hips from dropping', severity: 'minor', citation: 'Serner A et al, 2014, Br J Sports Med' },
    ],
    scienceNotes: 'Copenhagen plank produces very high adductor activation, effective for groin injury prevention in athletes (Serner 2014).',
  },

  windshield_wiper: {
    name: 'Windshield Wiper',
    category: 'bodyweight',
    muscles: { primary: ['Obliques', 'Core'], secondary: ['Hip Flexors'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Controlled rotation', type: 'custom', placeholder: true, good: 'Controlled side-to-side motion', bad: 'Slow down the rotation', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Windshield wipers train rotational control and oblique strength through a challenging hanging or lying position (NSCA 2016).',
  },

  ab_crunch_machine: {
    name: 'Ab Crunch Machine',
    category: 'machine',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 70,
    upThreshold: 130,
    formChecks: [
      { name: 'Full crunch', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 80, good: 'Full contraction', bad: 'Crunch further', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Machine crunches allow progressive overload on the rectus abdominis in a guided path (NSCA 2016).',
  },


  // ===== OLYMPIC LIFTS =====
  hang_clean: {
    name: 'Hang Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Trapezius', 'Quadriceps', 'Glutes', 'Hamstrings'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Triple extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Full hip extension', bad: 'Extend hips fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Hang cleans develop explosive hip extension power from the hang position, reducing technical complexity vs full clean (Suchomel 2015).',
  },

  hang_snatch: {
    name: 'Hang Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Trapezius', 'Deltoids', 'Glutes', 'Hamstrings'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 160,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Full extension before catch', bad: 'Extend fully before pulling under', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Hang snatch develops explosive triple extension and overhead stability from the hang position (Suchomel 2015).',
  },

  clean_and_jerk: {
    name: 'Clean and Jerk',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Glutes', 'Deltoids', 'Triceps'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout overhead', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout overhead', bad: 'Lock out arms fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med', phase: 'top' },
    ],
    scienceNotes: 'Clean and jerk is the ultimate test of whole-body power production and overhead stability (Suchomel 2015).',
  },

  clean_pull: {
    name: 'Clean Pull',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Trapezius'], secondary: ['Erectors', 'Quadriceps'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full triple extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full extension', bad: 'Extend hips, knees, and ankles fully', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Clean pulls develop the pulling mechanics and power of the clean without the catch phase (Suchomel 2015).',
  },

  snatch_pull: {
    name: 'Snatch Pull',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Trapezius'], secondary: ['Erectors', 'Quadriceps'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full triple extension', bad: 'Extend fully at the top', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Snatch pulls develop the wide-grip pulling pattern and explosive extension for the snatch (Suchomel 2015).',
  },


  // ===== KETTLEBELL =====
  kettlebell_clean: {
    name: 'Kettlebell Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Forearms', 'Core', 'Glutes'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip drive', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Strong hip drive', bad: 'Drive hips forward to power the clean', severity: 'minor', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell cleans develop hip power and grip strength with a unique racking mechanic (Lake 2012).',
  },

  kettlebell_snatch: {
    name: 'Kettlebell Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Core', 'Glutes'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout overhead', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Locked out overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Kettlebell snatch is a high-power exercise combining hip drive with overhead lockout in one fluid movement (Lake 2012).',
  },

  kettlebell_press: {
    name: 'Kettlebell Press',
    category: 'compound',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Core', 'Upper Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Locked out overhead', bad: 'Press to full extension', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Kettlebell press develops unilateral pressing strength with unique offset loading that challenges core stability (NSCA 2016).',
  },

  kettlebell_windmill: {
    name: 'Kettlebell Windmill',
    category: 'compound',
    muscles: { primary: ['Core', 'Obliques', 'Deltoids'], secondary: ['Hamstrings', 'Glutes'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Arm locked out', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Arm stable overhead', bad: 'Keep top arm locked out', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Kettlebell windmills develop lateral core strength, hip mobility, and shoulder stability simultaneously (NSCA 2016).',
  },

  kettlebell_goblet_squat: {
    name: 'Kettlebell Goblet Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Biceps'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Below parallel', bad: 'Squat deeper', severity: 'minor', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell goblet squat is an excellent teaching tool for squat mechanics with natural counterbalance (Schoenfeld 2010).',
  },

  kettlebell_row: {
    name: 'Kettlebell Row',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 110, good: 'Full row', bad: 'Pull elbow further back', severity: 'minor', citation: 'Fenwick CM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell rows provide offset loading that challenges grip and core anti-rotation (Fenwick 2009).',
  },

  kettlebell_deadlift: {
    name: 'Kettlebell Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core', 'Forearms'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 90, good: 'Good hip hinge', bad: 'Hinge more at hips', severity: 'minor', citation: 'Lake JP, Lauder MA, 2012, J Strength Cond Res' },
    ],
    scienceNotes: 'Kettlebell deadlift teaches hip hinge mechanics with a lower center of gravity than barbell (Lake 2012).',
  },


  // ===== CABLE =====
  cable_reverse_fly: {
    name: 'Cable Reverse Fly',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 70,
    formChecks: [
      { name: 'Full retraction', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 60,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 60, 15), good: 'Full squeeze', bad: 'Pull arms further back', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Cable reverse fly provides constant tension for rear deltoid and rhomboid isolation (Reinold 2004).',
  },


  // ===== TRX / SUSPENSION =====
  trx_row: {
    name: 'TRX Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Core', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Body angle', type: 'custom', placeholder: true, good: 'Appropriate lean angle', bad: 'Adjust angle for desired difficulty', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX rows allow progressive difficulty through body angle adjustment while adding instability challenge (Snarr 2014).',
  },

  trx_push_up: {
    name: 'TRX Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable base', type: 'custom', placeholder: true, good: 'Controlled movement', bad: 'Minimize swinging', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX push-ups increase core and stabilizer demands compared to floor push-ups (Snarr 2014).',
  },

  trx_squat: {
    name: 'TRX Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 95, good: 'Good squat depth', bad: 'Squat deeper', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX-assisted squats allow deeper squatting while reducing load, useful for mobility work (Snarr 2014).',
  },

  trx_lunge: {
    name: 'TRX Lunge',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good lunge depth', bad: 'Lower further', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX rear-foot-elevated lunges add instability to challenge single-leg balance and proprioception (Snarr 2014).',
  },

  trx_pike: {
    name: 'TRX Pike',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Deltoids'], secondary: ['Hip Flexors'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Hips high', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 50, good: 'Hips piked high', bad: 'Drive hips higher', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'TRX pike combines core anti-extension with shoulder flexion strength in an unstable environment (Snarr 2014).',
  },

  trx_hamstring_curl: {
    name: 'TRX Hamstring Curl',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Hips up', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 150, 15), good: 'Hips elevated', bad: 'Keep hips up throughout', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX hamstring curls train the hamstrings through both hip extension and knee flexion simultaneously (Snarr 2014).',
  },

  trx_bicep_curl: {
    name: 'TRX Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 145,
    formChecks: [
      { name: 'Body stable', type: 'custom', placeholder: true, good: 'Body rigid', bad: 'Keep body rigid throughout', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet' },
    ],
    scienceNotes: 'TRX curls challenge biceps with bodyweight loading and core co-contraction (Snarr 2014).',
  },

  trx_tricep_extension: {
    name: 'TRX Tricep Extension',
    category: 'isolation',
    muscles: { primary: ['Triceps'], secondary: ['Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 60,
    upThreshold: 145,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 140,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 140, 15), good: 'Full lockout', bad: 'Extend arms fully', severity: 'minor', citation: 'Snarr RL, Esco MR, 2014, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'TRX tricep extensions load the triceps through bodyweight with instability challenge (Snarr 2014).',
  },


  // ===== RESISTANCE BAND =====
  band_squat: {
    name: 'Band Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 155,
    formChecks: [
      { name: 'Depth', type: 'below', useBestSide: true, left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee', threshold: 100, good: 'Good depth', bad: 'Squat deeper', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band squats provide accommodating resistance that increases through the concentric phase (Shoepe 2011).',
  },

  band_deadlift: {
    name: 'Band Deadlift',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Erectors'], secondary: ['Core', 'Trapezius'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 90, good: 'Good hip hinge', bad: 'Hinge deeper at hips', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band deadlifts provide accommodating resistance, useful for developing lockout strength (Shoepe 2011).',
  },

  band_row: {
    name: 'Band Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Posterior Deltoids', 'Core'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Full pull', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 110, good: 'Full retraction', bad: 'Pull further back', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band rows provide portable back training with increasing resistance through the contraction (Shoepe 2011).',
  },

  band_chest_press: {
    name: 'Band Chest Press',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 145,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 145, 15), good: 'Full press', bad: 'Extend arms fully', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Band chest press provides accommodating resistance, greatest at lockout where the chest is strongest (Shoepe 2011).',
  },

  band_lateral_raise: {
    name: 'Band Lateral Raise',
    category: 'isolation',
    muscles: { primary: ['Lateral Deltoids'], secondary: ['Upper Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 15,
    upThreshold: 80,
    formChecks: [
      { name: 'Shoulder height', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 70,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 70, 15), good: 'Arms at shoulder height', bad: 'Raise to shoulder level', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Band lateral raises provide increasing resistance through the raise, matching the deltoid strength curve (Shoepe 2011).',
  },

  band_hip_thrust: {
    name: 'Band Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Band hip thrusts add accommodating resistance that peaks at lockout where glutes are maximally contracted (Contreras 2015).',
  },

  band_clamshell: {
    name: 'Band Clamshell',
    category: 'isolation',
    muscles: { primary: ['Glutes', 'Hip Abductors'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 100,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable pelvis', type: 'custom', placeholder: true, good: 'Pelvis not rotating', bad: 'Keep hips stacked and still', severity: 'minor', citation: 'Distefano LJ et al, 2009, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Band clamshells activate the gluteus medius and are a staple in hip stability and rehab protocols (Distefano 2009).',
  },

  band_face_pull: {
    name: 'Band Face Pull',
    category: 'isolation',
    muscles: { primary: ['Posterior Deltoids', 'Rhomboids', 'Rotator Cuff'], secondary: ['Trapezius'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 60,
    upThreshold: 120,
    formChecks: [
      { name: 'External rotation', type: 'custom', placeholder: true, good: 'Good external rotation at finish', bad: 'Rotate hands outward at the top', severity: 'minor', citation: 'Reinold MM et al, 2004, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Band face pulls are a portable shoulder health exercise targeting posterior deltoids and external rotators (Reinold 2004).',
  },

  band_good_morning: {
    name: 'Band Good Morning',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Erectors'], secondary: ['Glutes', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 90, good: 'Good hip hinge depth', bad: 'Hinge deeper at hips', severity: 'minor', citation: 'Shoepe TC et al, 2011, J Strength Cond Res' },
    ],
    scienceNotes: 'Band good mornings provide accommodating resistance for posterior chain loading (Shoepe 2011).',
  },


  // ===== STABILITY BALL =====
  stability_ball_crunch: {
    name: 'Stability Ball Crunch',
    category: 'isolation',
    muscles: { primary: ['Rectus Abdominis'], secondary: ['Obliques', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 130,
    formChecks: [
      { name: 'Controlled crunch', type: 'custom', placeholder: true, good: 'Controlled motion', bad: 'Slow down the movement', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Stability ball crunches increase rectus abdominis activation compared to floor crunches due to instability (Escamilla 2010).',
  },

  stability_ball_hamstring_curl: {
    name: 'Stability Ball Hamstring Curl',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Hips up', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 150, 15), good: 'Hips elevated', bad: 'Keep hips from dropping', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther' },
    ],
    scienceNotes: 'Stability ball hamstring curls combine hip extension with knee flexion on an unstable surface (Escamilla 2010).',
  },

  stability_ball_hip_thrust: {
    name: 'Stability Ball Hip Thrust',
    category: 'compound',
    muscles: { primary: ['Glutes', 'Hamstrings'], secondary: ['Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Full hip extension', bad: 'Drive hips higher', severity: 'minor', citation: 'Contreras B et al, 2015, J Appl Biomech' },
    ],
    scienceNotes: 'Stability ball hip thrusts add instability to standard hip thrusts, increasing stabilizer activation (Contreras 2015).',
  },

  stability_ball_pike: {
    name: 'Stability Ball Pike',
    category: 'bodyweight',
    muscles: { primary: ['Core', 'Deltoids'], secondary: ['Hip Flexors'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 130,
    formChecks: [
      { name: 'Hips high', type: 'below', useBestSide: true, left: 'leftShoulder', right: 'rightShoulder', visLeft: '_visLeftShoulder', visRight: '_visRightShoulder', threshold: 50, good: 'Hips piked high', bad: 'Drive hips higher', severity: 'minor', citation: 'Escamilla RF et al, 2010, J Orthop Sports Phys Ther', phase: 'top' },
    ],
    scienceNotes: 'Stability ball pikes produce high rectus abdominis activation with shoulder stabilization demands (Escamilla 2010).',
  },

  stability_ball_push_up: {
    name: 'Stability Ball Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Core', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Stable ball', type: 'custom', placeholder: true, good: 'Ball stable under hands', bad: 'Control the ball', severity: 'minor', citation: 'Marshall PW, Murphy BA, 2006, J Strength Cond Res' },
    ],
    scienceNotes: 'Stability ball push-ups significantly increase core and stabilizer muscle activation compared to floor push-ups (Marshall 2006).',
  },

  stability_ball_back_extension: {
    name: 'Stability Ball Back Extension',
    category: 'compound',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Full extension', bad: 'Extend body to straight line', severity: 'minor', citation: 'Marshall PW, Murphy BA, 2006, J Strength Cond Res' },
    ],
    scienceNotes: 'Stability ball back extensions train the erectors with an unstable surface, increasing proprioceptive demand (Marshall 2006).',
  },


  // ===== CALISTHENICS / ADVANCED BODYWEIGHT =====
  handstand_push_up: {
    name: 'Handstand Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Deltoids', 'Triceps'], secondary: ['Upper Pectorals', 'Core', 'Trapezius'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Full lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 155, 15), good: 'Full lockout', bad: 'Lock out arms fully', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Handstand push-ups are an advanced bodyweight overhead press requiring full bodyweight loading (NSCA 2016).',
  },

  front_lever: {
    name: 'Front Lever',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Core'], secondary: ['Biceps', 'Posterior Deltoids'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 80,
    upThreshold: 100,
    isIsometric: true,
    formChecks: [
      { name: 'Body horizontal', type: 'custom', placeholder: true, good: 'Body horizontal under bar', bad: 'Keep body straight and horizontal', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Front lever is an advanced isometric hold requiring extreme lat and core strength to maintain a horizontal body under the bar (NSCA 2016).',
  },

  back_lever: {
    name: 'Back Lever',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Biceps', 'Core'], secondary: ['Anterior Deltoids'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 80,
    upThreshold: 100,
    isIsometric: true,
    formChecks: [
      { name: 'Body horizontal', type: 'custom', placeholder: true, good: 'Body horizontal behind bar', bad: 'Maintain straight horizontal line', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Back lever demands high shoulder extension strength and core stability in a prone horizontal position (NSCA 2016).',
  },

  planche: {
    name: 'Planche',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Anterior Deltoids', 'Core'], secondary: ['Triceps', 'Serratus Anterior'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 80,
    upThreshold: 100,
    isIsometric: true,
    formChecks: [
      { name: 'Body horizontal', type: 'custom', placeholder: true, good: 'Body horizontal above hands', bad: 'Lean forward more and keep body straight', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Planche is one of the most difficult bodyweight holds, requiring extreme anterior deltoid and core strength (NSCA 2016).',
  },

  ring_dip: {
    name: 'Ring Dip',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 75,
    upThreshold: 155,
    formChecks: [
      { name: 'Ring stability', type: 'custom', placeholder: true, good: 'Rings stable', bad: 'Keep rings close to body', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet' },
    ],
    scienceNotes: 'Ring dips produce significantly higher muscle activation than bar dips due to instability demands (Snarr 2013).',
  },

  ring_push_up: {
    name: 'Ring Push-Up',
    category: 'compound',
    muscles: { primary: ['Pectorals', 'Core', 'Triceps'], secondary: ['Anterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Ring turnout', type: 'custom', placeholder: true, good: 'Rings turned out at top', bad: 'Turn rings out at the top', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet', phase: 'top' },
    ],
    scienceNotes: 'Ring push-ups increase chest and core activation by 50% or more compared to floor push-ups (Snarr 2013).',
  },

  ring_row: {
    name: 'Ring Row',
    category: 'compound',
    muscles: { primary: ['Upper Back', 'Biceps'], secondary: ['Core', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Body straight', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 160,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 160, 15), good: 'Body rigid', bad: 'Keep body in a straight line', severity: 'minor', citation: 'Snarr RL, Esco MR, 2013, J Hum Kinet' },
    ],
    scienceNotes: 'Ring rows allow progressive difficulty adjustment through body angle with added instability challenge (Snarr 2013).',
  },

  typewriter_pull_up: {
    name: 'Typewriter Pull-Up',
    category: 'bodyweight',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps'], secondary: ['Core', 'Posterior Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 85,
    upThreshold: 155,
    formChecks: [
      { name: 'Chin above bar', type: 'below', useBestSide: true, left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow', threshold: 90, good: 'Chin stays above bar', bad: 'Keep chin above bar throughout lateral movement', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Typewriter pull-ups develop unilateral lat strength by shifting bodyweight laterally while maintaining chin above bar (NSCA 2016).',
  },

  one_arm_push_up: {
    name: 'One-Arm Push-Up',
    category: 'bodyweight',
    muscles: { primary: ['Pectorals', 'Triceps', 'Core'], secondary: ['Anterior Deltoids', 'Obliques'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 70,
    upThreshold: 150,
    formChecks: [
      { name: 'Minimal rotation', type: 'below', key: 'trunk', threshold: 30, margin: 12, good: 'Minimal torso rotation', bad: 'Minimize body rotation', severity: 'minor', citation: 'Cogley RM et al, 2005, J Strength Cond Res' },
    ],
    scienceNotes: 'One-arm push-ups demand extreme pressing strength and anti-rotation core stability (Cogley 2005).',
  },

  skin_the_cat: {
    name: 'Skin the Cat',
    category: 'bodyweight',
    muscles: { primary: ['Deltoids', 'Latissimus Dorsi', 'Core'], secondary: ['Biceps', 'Pectorals'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled motion', type: 'custom', placeholder: true, good: 'Controlled rotation', bad: 'Move slowly through full range', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Skin the cat develops shoulder flexibility and strength through a full 360-degree shoulder rotation under load (NSCA 2016).',
  },


  // ===== CARDIO / CONDITIONING =====
  rowing_machine: {
    name: 'Rowing Machine (Erg)',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Latissimus Dorsi', 'Biceps', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Drive sequence', type: 'custom', placeholder: true, good: 'Legs-back-arms sequence', bad: 'Drive with legs first, then back, then arms', severity: 'minor', citation: 'Kleshnev V, 2010, Rowing Biomechanics Newsletter' },
    ],
    scienceNotes: 'Rowing ergometer engages 86% of the musculature with correct drive sequence: legs, back, arms (Kleshnev 2010).',
  },

  ski_erg: {
    name: 'Ski Erg',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Core', 'Triceps'], secondary: ['Deltoids', 'Hip Flexors'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 30,
    upThreshold: 150,
    formChecks: [
      { name: 'Hip hinge', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 100, good: 'Good hip hinge on pull', bad: 'Hinge more at hips during pull', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Ski erg develops upper body pulling power and cardiovascular endurance simultaneously (NSCA 2016).',
  },

  assault_bike: {
    name: 'Assault Bike',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Deltoids', 'Core'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Upright posture', type: 'below', key: 'trunk', threshold: 40, margin: 12, good: 'Good posture', bad: 'Stay more upright', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Assault bike provides full-body conditioning with fan-based resistance that scales with effort (NSCA 2016).',
  },

  sled_push: {
    name: 'Sled Push',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Core', 'Deltoids'] },
    joint: 'knee',
    value: BS_KNEE,
    downThreshold: 100,
    upThreshold: 155,
    formChecks: [
      { name: 'Forward lean', type: 'above', key: 'trunk', threshold: 30, margin: 12, good: 'Good forward lean', bad: 'Lean into the sled more', severity: 'minor', citation: 'Winwood PW et al, 2014, J Strength Cond Res' },
    ],
    scienceNotes: 'Sled pushing develops horizontal force production with minimal eccentric loading, reducing muscle soreness (Winwood 2014).',
  },

  sled_pull: {
    name: 'Sled Pull',
    category: 'compound',
    muscles: { primary: ['Hamstrings', 'Glutes', 'Upper Back'], secondary: ['Biceps', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip drive', type: 'above', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 160, margin: 15, good: 'Driving through hips', bad: 'Drive hips forward', severity: 'minor', citation: 'Winwood PW et al, 2014, J Strength Cond Res', phase: 'top' },
    ],
    scienceNotes: 'Sled pulling develops posterior chain strength with concentric-only loading (Winwood 2014).',
  },

  tire_flip: {
    name: 'Tire Flip',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Quadriceps', 'Glutes', 'Upper Back', 'Deltoids'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 70,
    upThreshold: 165,
    formChecks: [
      { name: 'Hip drive position', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 80, good: 'Low hip position to start', bad: 'Get hips lower before lifting', severity: 'major', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Tire flips combine deadlift and push mechanics, producing very high full-body power output (McGill 2009).',
  },

  rope_climb: {
    name: 'Rope Climb',
    category: 'compound',
    muscles: { primary: ['Latissimus Dorsi', 'Biceps', 'Core', 'Forearms'], secondary: ['Forearms', 'Deltoids'] },
    joint: 'elbow',
    value: BS_ELBOW,
    downThreshold: 80,
    upThreshold: 155,
    formChecks: [
      { name: 'Foot lock', type: 'custom', placeholder: true, good: 'Secure foot lock', bad: 'Establish foot lock before pulling', severity: 'major', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Rope climbing develops grip strength, lat strength, and upper body pulling power with bodyweight load (NSCA 2016).',
  },


  // ===== FUNCTIONAL / CROSSFIT =====
  devil_press: {
    name: 'Devil Press',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Pectorals', 'Glutes', 'Core'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Full overhead lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Full overhead lockout', bad: 'Lock out dumbbells fully overhead', severity: 'major', citation: 'NSCA, 2016', phase: 'top' },
    ],
    scienceNotes: 'Devil press combines burpee with dumbbell snatch, producing extreme metabolic demand (NSCA 2016).',
  },

  dumbbell_snatch: {
    name: 'Dumbbell Snatch',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Deltoids', 'Core', 'Glutes', 'Trapezius'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 30,
    upThreshold: 160,
    formChecks: [
      { name: 'Lockout', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder') > 150,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'), 150, 15), good: 'Full lockout overhead', bad: 'Lock out fully overhead', severity: 'major', citation: 'Suchomel TJ et al, 2015, Sports Med', phase: 'top' },
    ],
    scienceNotes: 'Dumbbell snatch develops unilateral power from floor to overhead in one movement (Suchomel 2015).',
  },

  dumbbell_clean: {
    name: 'Dumbbell Clean',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: ['Glutes', 'Trapezius', 'Biceps', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 90,
    upThreshold: 160,
    formChecks: [
      { name: 'Hip drive', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 155,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 155, 15), good: 'Strong hip extension', bad: 'Drive hips forward to power the clean', severity: 'minor', citation: 'Suchomel TJ et al, 2015, Sports Med' },
    ],
    scienceNotes: 'Dumbbell cleans develop explosive hip power with independent arm loading (Suchomel 2015).',
  },

  wall_walk: {
    name: 'Wall Walk',
    category: 'bodyweight',
    muscles: { primary: ['Deltoids', 'Core'], secondary: ['Triceps', 'Pectorals'] },
    joint: 'shoulder',
    value: BSM_SHOULDER,
    downThreshold: 80,
    upThreshold: 170,
    formChecks: [
      { name: 'Controlled movement', type: 'custom', placeholder: true, good: 'Controlled wall walk', bad: 'Move slowly and controlled', severity: 'minor', citation: 'NSCA, 2016' },
    ],
    scienceNotes: 'Wall walks progressively load the shoulders and develop overhead stability toward handstand positioning (NSCA 2016).',
  },

  sandbag_carry: {
    name: 'Sandbag Carry',
    category: 'compound',
    muscles: { primary: ['Core', 'Trapezius', 'Quadriceps'], secondary: ['Deltoids', 'Forearms'] },
    joint: 'shoulder',
    value: BS_SHOULDER,
    downThreshold: 5,
    upThreshold: 20,
    formChecks: [
      { name: 'Upright posture', type: 'below', key: 'trunk', threshold: 20, margin: 12, good: 'Upright posture', bad: 'Stand taller', severity: 'minor', citation: 'McGill SM et al, 2009, J Strength Cond Res' },
    ],
    scienceNotes: 'Sandbag carries develop functional core stability and grip endurance with an unstable load (McGill 2009).',
  },


  // ===== SUPERSET / COMBO =====
  seated_back_extension: {
    name: 'Seated Back Extension',
    category: 'machine',
    muscles: { primary: ['Erectors', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
    joint: 'hip',
    value: BS_HIP,
    downThreshold: 80,
    upThreshold: 150,
    formChecks: [
      { name: 'Full extension', type: 'custom',
        check: (angles) => bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip') > 145,
        quality: (angles) => qualityAbove(bestSideMax(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip'), 145, 15), good: 'Full back extension', bad: 'Extend further back', severity: 'minor', citation: 'NSCA, 2016', phase: 'top' },
      { name: 'Controlled return', type: 'below', useBestSide: true, left: 'leftHip', right: 'rightHip', visLeft: '_visLeftHip', visRight: '_visRightHip', threshold: 120, good: 'Good forward lean', bad: 'Lean further forward for full ROM', severity: 'minor', citation: 'NSCA, 2016', phase: 'bottom' },
    ],
    scienceNotes: 'Seated back extension machines target the erector spinae through controlled trunk extension from a seated position (NSCA 2016).',
  },

  superset: {
    name: 'Superset',
    category: 'compound',
    muscles: { primary: ['Full Body'], secondary: [] },
    joint: 'multi',
    value: { type: 'custom', fn: (angles) => {
      const vals = [
        Math.min(angles.leftKnee, angles.rightKnee),
        Math.min(angles.leftElbow, angles.rightElbow),
        (angles.leftShoulder + angles.rightShoulder) / 2,
        (angles.leftHip + angles.rightHip) / 2,
      ];
      let best = vals[0], bestDelta = Math.abs(180 - vals[0]);
      for (let i = 1; i < vals.length; i++) {
        const d = Math.abs(180 - vals[i]);
        if (d > bestDelta) { best = vals[i]; bestDelta = d; }
      }
      return best;
    } },
    downThreshold: 90,
    upThreshold: 150,
    formChecks: [
      { name: 'Movement detected', type: 'custom',
        check: (angles) => {
          const knee = Math.min(angles.leftKnee, angles.rightKnee);
          const elbow = Math.min(angles.leftElbow, angles.rightElbow);
          return knee < 160 || elbow < 160;
        },
        quality: (angles) => Math.max(
          qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 160, 15),
          qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15)
        ), good: 'Active movement', bad: 'No significant joint movement detected', severity: 'minor', citation: 'General observation' },
    ],
    scienceNotes: 'Supersets pair two exercises back-to-back with no rest, increasing metabolic demand and training density (Robbins DW et al, 2010, J Strength Cond Res). Use this mode when alternating between exercises in a single video.',
  },

};
