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

  // Heel displacement for calf raises: tracks heel y-position normalized to body height.
  // Dividing by nose-to-ankle distance makes the signal camera-distance independent.
  heelDisplacement: () => (angles, landmarks) => {
    if (landmarks && landmarks[29] && landmarks[30] && landmarks[0] && landmarks[27]) {
      const heelY = (landmarks[29].y + landmarks[30].y) / 2;
      const bodyHeight = Math.abs(landmarks[27].y - landmarks[0].y) || 0.001;
      return (1 - heelY / bodyHeight) * 100;
    }
    return angles.trunk;
  },

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
      if (val == null) return true; // missing angle = cannot fail this check
      return val < spec.threshold;
    },
    quality: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight)
        : angles[spec.key];
      if (val == null) return 1; // missing angle = neutral quality
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
      if (val == null) return true;
      return val > spec.threshold;
    },
    quality: (angles) => {
      const val = spec.useBestSide
        ? bestSide(angles, spec.left, spec.right, spec.visLeft, spec.visRight)
        : angles[spec.key];
      if (val == null) return 1;
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
      if (val == null) return true;
      return val >= spec.low && val <= spec.high;
    },
    quality: (angles) => {
      const val = angles[spec.key];
      if (val == null) return 1;
      return qualityRange(val, spec.low, spec.high, spec.margin || 10);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  symmetry: (spec) => ({
    name: spec.name,
    check: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return true;
      return Math.abs(angles[spec.left] - angles[spec.right]) < spec.threshold;
    },
    quality: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return 1;
      return qualitySymmetry(angles[spec.left], angles[spec.right], spec.threshold);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'major',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  // Body alignment center deviation: quality = 1 - |angle - center| / margin
  // Used for plank, push-up body alignment (target ~80°, margin 30°)
  centerDeviation: (spec) => ({
    name: spec.name,
    check: (angles) => {
      const val = angles[spec.key];
      if (val == null) return true;
      return Math.abs(val - spec.center) < spec.margin;
    },
    quality: (angles) => {
      const val = angles[spec.key];
      if (val == null) return 1;
      const dev = Math.abs(val - spec.center);
      return Math.max(0, 1 - dev / (spec.margin || 30));
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'major',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  // Average of bilateral angles then check above threshold
  averageAbove: (spec) => ({
    name: spec.name,
    check: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return true;
      return (angles[spec.left] + angles[spec.right]) / 2 > spec.threshold;
    },
    quality: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return 1;
      return qualityAbove((angles[spec.left] + angles[spec.right]) / 2, spec.threshold, spec.margin || 15);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
    citation: spec.citation,
    safetyNote: spec.safetyNote,
  }),

  // Average of bilateral angles then check within range
  averageRange: (spec) => ({
    name: spec.name,
    check: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return true;
      const avg = (angles[spec.left] + angles[spec.right]) / 2;
      return avg > spec.low && avg < spec.high;
    },
    quality: (angles) => {
      if (angles[spec.left] == null || angles[spec.right] == null) return 1;
      return qualityRange((angles[spec.left] + angles[spec.right]) / 2, spec.low, spec.high, spec.margin || 12);
    },
    good: spec.good,
    bad: spec.bad,
    severity: spec.severity || 'minor',
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
function compileExercise(dsl) {
  const valueCompiler = VALUE_COMPILERS[dsl.value?.type || 'bestSide'];
  if (!valueCompiler) throw new Error(`Unknown value type: ${dsl.value?.type}`);

  const compiledChecks = (dsl.formChecks || [])
    .filter(fc => {
      // Skip placeholder checks that always return true — they inflate form scores
      // without providing real feedback. These exist as documentation of what SHOULD
      // be checked but lack a real implementation (e.g. equipment-dependent checks
      // that can't be verified via pose landmarks alone).
      if (fc.type === 'custom' && fc.placeholder) return false;
      return true;
    })
    .map(fc => {
      const compiler = CHECK_COMPILERS[fc.type || 'custom'];
      if (!compiler) throw new Error(`Unknown check type: ${fc.type} in ${dsl.name}`);
      return compiler(fc);
    });

  const compiled = {
    name: dsl.name,
    category: dsl.category,
    muscles: dsl.muscles,
    joint: dsl.joint,
    getValue: valueCompiler(dsl.value || {}),
    downThreshold: dsl.downThreshold,
    upThreshold: dsl.upThreshold,
    formChecks: compiledChecks,
    scienceNotes: dsl.scienceNotes,
  };

  // Optional fields — only set if defined to avoid polluting objects
  if (dsl.amplitudeRatio != null) compiled.amplitudeRatio = dsl.amplitudeRatio;
  if (dsl.isIsometric) compiled.isIsometric = true;
  if (dsl.minIsometricDuration != null) compiled.minIsometricDuration = dsl.minIsometricDuration;
  if (dsl.minSpacing != null) compiled.minSpacing = dsl.minSpacing;
  if (dsl.limitations) compiled.limitations = dsl.limitations;

  return compiled;
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

// DSL definitions are in exerciseDefinitions.js — imported by exercises.js
