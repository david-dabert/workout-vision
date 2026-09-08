/**
 * Declarative Exercise DSL — Interpreter and Compiler
 *
 * Converts JSON exercise definitions into the runtime objects expected by
 * RepCounter, ExerciseAutoDetector, and the form check system.
 *
 * DSL Schema:
 * {
 *   name: string,
 *   category: 'compound' | 'isolation' | 'bodyweight',
 *   muscles: { primary: string[], secondary?: string[] },
 *   joint: 'knee' | 'hip' | 'elbow' | 'shoulder',
 *   value: { type: 'bestSide'|'bestSideMax'|'direct'|'custom', left?: string, right?: string, visLeft?: string, visRight?: string, key?: string, fn?: Function },
 *   downThreshold: number,
 *   upThreshold: number,
 *   amplitudeRatio?: number,
 *   formChecks: FormCheckDSL[],
 *   scienceNotes?: string,
 *   limitations?: string[],
 *   isIsometric?: boolean,
 * }
 *
 * FormCheckDSL:
 * {
 *   name: string,
 *   type: 'below' | 'above' | 'range' | 'symmetry' | 'custom',
 *   key?: string,     // angle key for below/above/range
 *   left?: string,    // for symmetry
 *   right?: string,   // for symmetry
 *   threshold?: number,
 *   low?: number,     // for range
 *   high?: number,    // for range
 *   margin?: number,
 *   good: string,
 *   bad: string,
 *   severity: 'major' | 'minor' | 'info',
 *   citation?: string,
 *   safetyNote?: { en: string, fr: string },
 *   check?: Function,   // for 'custom' type
 *   quality?: Function, // for 'custom' type
 * }
 */

import { bestSide, bestSideMax, qualityBelow, qualityAbove, qualityRange, qualitySymmetry } from './exercises';

// ─── Value function compiler ───

const VALUE_COMPILERS = {
  bestSide: (spec) => (angles) =>
    bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight),

  bestSideMax: (spec) => (angles) =>
    bestSideMax(angles, spec.left, spec.right, spec.visLeft, spec.visRight),

  direct: (spec) => (angles) => angles[spec.key],

  custom: (spec) => spec.fn,
};

// ─── Form check compiler ───

const CHECK_COMPILERS = {
  below: (spec) => ({
    name: spec.name,
    check: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left || spec.key.replace('right', 'left'), spec.right || spec.key, spec.visLeft, spec.visRight)
        : angles[spec.key];
      return val < spec.threshold;
    },
    quality: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight)
        : angles[spec.key];
      return qualityBelow(val, spec.threshold, spec.margin || 15);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  above: (spec) => ({
    name: spec.name,
    check: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight)
        : angles[spec.key];
      return val > spec.threshold;
    },
    quality: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight)
        : angles[spec.key];
      return qualityAbove(val, spec.threshold, spec.margin || 15);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  range: (spec) => ({
    name: spec.name,
    check: (angles) => {
      const val = angles[spec.key];
      return val >= spec.low && val <= spec.high;
    },
    quality: (angles) => qualityRange(angles[spec.key], spec.low, spec.high, spec.margin || 10),
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  symmetry: (spec) => ({
    name: spec.name,
    check: (angles) => Math.abs(angles[spec.left] - angles[spec.right]) < spec.threshold,
    quality: (angles) => qualitySymmetry(angles[spec.left], angles[spec.right], spec.threshold),
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'major',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  custom: (spec) => ({
    name: spec.name,
    check: spec.check,
    quality: spec.quality || (() => 1),
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),
};

/**
 * Compile a DSL exercise definition into the runtime format expected by the system.
 * @param {Object} dsl - Declarative exercise definition
 * @returns {Object} Runtime exercise object with getValue function and compiled formChecks
 */
export function compileExercise(dsl) {
  const valueCompiler = VALUE_COMPILERS[dsl.value?.type || 'bestSide'];
  if (!valueCompiler) throw new Error(`Unknown value type: ${dsl.value?.type}`);

  const compiledChecks = (dsl.formChecks || []).map(fc => {
    const compiler = CHECK_COMPILERS[fc.type || 'custom'];
    if (!compiler) throw new Error(`Unknown check type: ${fc.type} in ${dsl.name}`);
    return compiler(fc);
  });

  return {
    name: dsl.name,
    category: dsl.category,
    muscles: dsl.muscles,
    joint: dsl.joint,
    getValue: valueCompiler(dsl.value || {}),
    downThreshold: dsl.downThreshold,
    upThreshold: dsl.upThreshold,
    amplitudeRatio: dsl.amplitudeRatio,
    formChecks: compiledChecks,
    scienceNotes: dsl.scienceNotes,
    limitations: dsl.limitations,
    isIsometric: dsl.isIsometric,
  };
}

/**
 * Compile a map of DSL definitions into runtime exercise objects.
 * @param {Object} dslMap - { key: DSL definition }
 * @returns {Object} { key: runtime exercise }
 */
export function compileExercises(dslMap) {
  const result = {};
  for (const [key, dsl] of Object.entries(dslMap)) {
    try {
      result[key] = compileExercise(dsl);
    } catch (err) {
      console.warn(`[exerciseDSL] Failed to compile ${key}:`, err.message);
    }
  }
  return result;
}

// ─── Example DSL definitions (demonstrating the pattern) ───

export const EXAMPLE_DSL = {
  squat: {
    name: 'Barbell Back Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Erectors', 'Core'] },
    joint: 'knee',
    value: { type: 'bestSide', left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee' },
    amplitudeRatio: 0.15,
    downThreshold: 120,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth', type: 'below',
        key: 'leftKnee', useBestSide: true,
        left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee',
        threshold: 90, margin: 15,
        good: 'Below parallel', bad: 'Above parallel — go deeper',
        severity: 'major', citation: 'Schoenfeld BJ, 2010, J Strength Cond Res',
        safetyNote: { en: 'If you have hip pain or impingement, do not force depth beyond comfort.', fr: 'En cas de douleur ou conflit de hanche, ne forcez pas la profondeur.' },
      },
      {
        name: 'Knee symmetry', type: 'symmetry',
        left: 'leftKnee', right: 'rightKnee', threshold: 18,
        good: 'Knees tracking evenly', bad: 'Asymmetric knee bend',
        severity: 'major', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
      {
        name: 'Trunk angle', type: 'below',
        key: 'trunk', threshold: 55, margin: 15,
        good: 'Upright torso maintained', bad: 'Excessive forward lean',
        severity: 'minor', citation: 'Fry AC et al, 2003, J Strength Cond Res',
      },
    ],
    scienceNotes: 'Full ROM squats produce greater quad and glute activation than partial squats (Schoenfeld 2010). Knee valgus >10 deg increases ACL strain (Hewett 2005). Forward lean >55 deg shifts load to erectors and increases spinal shear (Fry 2003).',
    limitations: ['foot pressure distribution', 'breathing technique', 'grip width', 'bar position on traps'],
  },

  front_squat: {
    name: 'Front Squat',
    category: 'compound',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core', 'Upper Back'] },
    joint: 'knee',
    value: { type: 'bestSide', left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee' },
    downThreshold: 120,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Depth', type: 'below',
        key: 'leftKnee', useBestSide: true,
        left: 'leftKnee', right: 'rightKnee', visLeft: '_visLeftKnee', visRight: '_visRightKnee',
        threshold: 85, margin: 15,
        good: 'Below parallel', bad: 'Above parallel',
        severity: 'major', citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Trunk upright', type: 'below',
        key: 'trunk', threshold: 40, margin: 12,
        good: 'Upright torso -- elbows high', bad: 'Torso collapsing forward',
        severity: 'major', citation: 'Gullett JC et al, 2009, J Strength Cond Res',
      },
      {
        name: 'Knee symmetry', type: 'symmetry',
        left: 'leftKnee', right: 'rightKnee', threshold: 12,
        good: 'Knees tracking evenly', bad: 'Asymmetric knee bend',
        severity: 'minor', citation: 'Kiesel K et al, 2007, N Am J Sports Phys Ther',
      },
    ],
    scienceNotes: 'Front squats reduce posterior shear on the knee vs back squats while demanding greater quad activation and more upright torso (Gullett 2009).',
  },

  bicep_curl: {
    name: 'Bicep Curl',
    category: 'isolation',
    muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
    joint: 'elbow',
    value: { type: 'bestSide', left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow' },
    downThreshold: 110,
    upThreshold: 155,
    formChecks: [
      {
        name: 'Peak contraction', type: 'below',
        key: 'leftElbow', useBestSide: true,
        left: 'leftElbow', right: 'rightElbow', visLeft: '_visLeftElbow', visRight: '_visRightElbow',
        threshold: 50, margin: 15,
        good: 'Full contraction at top', bad: 'Curl higher for full contraction',
        severity: 'minor', citation: 'Marcolin G et al, 2018, PeerJ',
      },
      {
        name: 'Trunk stable', type: 'below',
        key: 'trunk', threshold: 20, margin: 10,
        good: 'Torso upright — no swinging', bad: 'Excessive body swing (cheat curl)',
        severity: 'major', citation: 'Marcolin G et al, 2018, PeerJ',
      },
    ],
    scienceNotes: 'Full ROM bicep curls produce more hypertrophy than partial ROM (Marcolin 2018). Excessive trunk sway shifts load to anterior deltoid and momentum.',
  },
};

// Validate DSL at build time in dev mode
if (import.meta.env?.DEV) {
  try {
    const compiled = compileExercises(EXAMPLE_DSL);
    const keys = Object.keys(compiled);
    console.log(`[exerciseDSL] Compiled ${keys.length} example exercises successfully`);
  } catch (err) {
    console.error('[exerciseDSL] Compilation error:', err);
  }
}
