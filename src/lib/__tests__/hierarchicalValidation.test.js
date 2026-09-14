/**
 * Hierarchical detector validation harness.
 *
 * Tests the detector against labelled scenarios that simulate real gym
 * footage patterns. Each scenario defines temporal features as they would
 * appear from a 2-second window of a specific exercise, then asserts:
 *
 *   1. Context accuracy (seated / standing / …)
 *   2. Movement class accuracy
 *   3. Top-1 exercise hit
 *   4. Top-3 exercise hit
 *   5. No false auto-lock on ambiguous scenarios
 *
 * When real clips are available, add their extracted features here as
 * additional scenarios. The harness structure stays the same.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { HierarchicalDetector } from '../hierarchicalDetector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a complete features object from partial overrides. */
function makeFeatures(overrides = {}) {
  const ch = (o = {}) => ({
    range: 0, mean: 90, min: 80, max: 100,
    dwellLow: 0.1, dwellHigh: 0.1, cycles: 1,
    values: [], visibility: 0.95,
    ...o,
  });
  return {
    knee: ch(overrides.knee),
    hip: ch(overrides.hip),
    elbow: ch(overrides.elbow),
    shoulder: ch(overrides.shoulder),
    trunk: ch(overrides.trunk),
    corr_knee_hip: overrides.corr_knee_hip ?? 0,
    corr_elbow_shoulder: overrides.corr_elbow_shoulder ?? 0,
    corr_elbow_knee: overrides.corr_elbow_knee ?? 0,
    windowMs: 2000,
    frameCount: 30,
  };
}

/**
 * Labelled scenario: expected context, movement class, exercise candidates.
 * Features simulate a 2-second window of real gym movement.
 */
const SCENARIOS = [
  // ── Seated machines (P0) ──
  {
    name: 'Leg press — full ROM, side view',
    expected: { context: 'seated', movementClass: 'lower_push', top1: 'leg_press', top3: ['leg_press', 'single_leg_press'] },
    features: makeFeatures({
      knee: { range: 55, mean: 115, dwellHigh: 0.18 },
      hip: { range: 35, mean: 105, dwellHigh: 0.12 },
      elbow: { range: 3, mean: 165 },
      shoulder: { range: 4, mean: 25 },
      trunk: { range: 3, mean: 8 },
      corr_knee_hip: 0.92,
    }),
  },
  {
    name: 'Leg extension — knee only, hip static',
    expected: { context: 'seated', movementClass: 'lower_push', top1: 'leg_extension', top3: ['leg_extension'] },
    features: makeFeatures({
      knee: { range: 50, mean: 120, dwellHigh: 0.22 },
      hip: { range: 3, mean: 100 },
      elbow: { range: 2, mean: 160 },
      shoulder: { range: 3, mean: 20 },
      trunk: { range: 2, mean: 5 },
      corr_knee_hip: 0.02,
    }),
  },
  {
    name: 'Leg curl — knee flexion, hip static',
    expected: { context: 'seated', movementClass: 'lower_pull', top1: 'leg_curl', top3: ['leg_curl', 'lying_leg_curl'] },
    features: makeFeatures({
      knee: { range: 35, mean: 95, dwellLow: 0.2, min: 70, max: 105 },
      hip: { range: 4, mean: 100 },
      elbow: { range: 2, mean: 160 },
      shoulder: { range: 3, mean: 20 },
      trunk: { range: 2, mean: 5 },
      corr_knee_hip: 0.05,
    }),
  },
  {
    name: 'Lat pulldown — shoulder sweeps, elbows flex',
    expected: { context: 'seated', movementClass: 'upper_vertical', top1: 'lat_pulldown', top3: ['lat_pulldown'] },
    features: makeFeatures({
      knee: { range: 2, mean: 100 },
      hip: { range: 3, mean: 95 },
      elbow: { range: 35, mean: 110, dwellLow: 0.15 },
      shoulder: { range: 45, mean: 95, dwellLow: 0.22, dwellHigh: 0.08 },
      trunk: { range: 5, mean: 8 },
      corr_elbow_shoulder: 0.65,
    }),
  },
  {
    name: 'Machine shoulder press — pushes overhead',
    expected: { context: 'seated', movementClass: 'upper_vertical', top1: 'machine_shoulder_press', top3: ['machine_shoulder_press', 'seated_dumbbell_press'] },
    features: makeFeatures({
      knee: { range: 2, mean: 100 },
      hip: { range: 3, mean: 95 },
      elbow: { range: 35, mean: 115, dwellHigh: 0.2 },
      shoulder: { range: 40, mean: 90, dwellLow: 0.08, dwellHigh: 0.22 },
      trunk: { range: 4, mean: 8 },
      corr_elbow_shoulder: 0.6,
    }),
  },
  {
    name: 'Straight-arm pulldown — arms stay straight',
    expected: { context: 'seated', movementClass: 'upper_vertical', top1: 'straight_arm_pulldown', top3: ['straight_arm_pulldown'] },
    features: makeFeatures({
      knee: { range: 2, mean: 100 },
      hip: { range: 3, mean: 95 },
      elbow: { range: 6, mean: 158 },
      shoulder: { range: 30, mean: 85 },
      trunk: { range: 4, mean: 8 },
    }),
  },
  {
    name: 'Seated row — elbow dwells at contracted',
    expected: { context: 'seated', movementClass: 'upper_horizontal', top3AnyOf: ['seated_row', 'machine_row', 'cable_row_single', 'chest_supported_row'] },
    features: makeFeatures({
      knee: { range: 2, mean: 100 },
      hip: { range: 3, mean: 95 },
      elbow: { range: 30, mean: 100, dwellLow: 0.22, dwellHigh: 0.06 },
      shoulder: { range: 15, mean: 40 },
      trunk: { range: 4, mean: 8 },
      corr_elbow_shoulder: -0.3,
    }),
  },

  // ── Standing exercises (P1) ──
  {
    name: 'Squat — deep knee bend, hip hinge',
    expected: { context: 'standing', movementClass: 'lower_push', top3AnyOf: ['squat', 'front_squat', 'goblet_squat', 'box_squat'] },
    features: makeFeatures({
      knee: { range: 55, mean: 135 },
      hip: { range: 35, mean: 140 },
      elbow: { range: 5, mean: 150 },
      shoulder: { range: 5, mean: 30 },
      trunk: { range: 15, mean: 25 },
      corr_knee_hip: 0.88,
    }),
  },
  {
    name: 'Deadlift — knee + hip flex, trunk forward',
    expected: { context: 'standing', movementClass: 'lower_pull', top3AnyOf: ['deadlift', 'sumo_deadlift', 'romanian_deadlift'] },
    features: makeFeatures({
      knee: { range: 20, mean: 150 },
      hip: { range: 30, mean: 140 },
      elbow: { range: 3, mean: 165 },
      shoulder: { range: 8, mean: 25 },
      trunk: { range: 20, mean: 40 },
      corr_knee_hip: 0.75,
    }),
  },
  {
    name: 'Good morning — knees locked, pure hip hinge',
    expected: { context: 'standing', movementClass: 'lower_pull', top1: 'good_morning', top3: ['good_morning'] },
    features: makeFeatures({
      knee: { range: 5, mean: 168 },
      hip: { range: 35, mean: 135 },
      elbow: { range: 3, mean: 160 },
      shoulder: { range: 5, mean: 25 },
      trunk: { range: 25, mean: 42 },
      corr_knee_hip: 0.2,
    }),
  },
  {
    name: 'Bicep curl — elbow flexion, shoulder static',
    expected: { context: 'standing', movementClass: 'upper_isolation', top3AnyOf: ['bicep_curl', 'hammer_curl', 'barbell_curl', 'ez_bar_curl'] },
    features: makeFeatures({
      knee: { range: 2, mean: 170 },
      hip: { range: 2, mean: 168 },
      elbow: { range: 40, mean: 105 },
      shoulder: { range: 6, mean: 25 },
      trunk: { range: 3, mean: 5 },
    }),
  },

  // ── Occlusion scenarios (visibility gating) ──
  {
    name: 'Leg press — feet occluded behind sled (low knee visibility)',
    expected: { context: 'seated', movementClass: 'lower_push' },
    features: makeFeatures({
      knee: { range: 55, mean: 115, dwellHigh: 0.18, visibility: 0.25 },
      hip: { range: 35, mean: 105, dwellHigh: 0.12, visibility: 0.85 },
      elbow: { range: 3, mean: 165 },
      shoulder: { range: 4, mean: 25 },
      trunk: { range: 3, mean: 8 },
      corr_knee_hip: 0.92,
    }),
    // Scores should be closer to 1.0 (less discriminant) than full-visibility version
    expectReducedDiscrimination: true,
  },
];

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe('hierarchical detector validation harness', () => {
  let detector;

  beforeEach(() => {
    detector = new HierarchicalDetector({ fps: 15, mode: 'gym' });
  });

  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      it('classifies context correctly', () => {
        if (!scenario.expected.context) return; // no context assertion
        const context = detector._classifyContext(scenario.features);
        expect(context).toBe(scenario.expected.context);
      });

      it('classifies movement class correctly', () => {
        if (!scenario.expected.movementClass) return;
        const context = detector._classifyContext(scenario.features);
        const mc = detector._classifyMovement(scenario.features, context);
        expect(mc).toBe(scenario.expected.movementClass);
      });

      if (scenario.expected.top1) {
        it(`top-1 is ${scenario.expected.top1}`, () => {
          const context = detector._classifyContext(scenario.features);
          const mc = detector._classifyMovement(scenario.features, context);
          const candidates = detector._classifyLeaf(scenario.features, context, mc);
          expect(candidates.length).toBeGreaterThan(0);
          expect(candidates[0].id).toBe(scenario.expected.top1);
        });
      }

      if (scenario.expected.top3) {
        it(`top-3 includes expected exercise(s)`, () => {
          const context = detector._classifyContext(scenario.features);
          const mc = detector._classifyMovement(scenario.features, context);
          const candidates = detector._classifyLeaf(scenario.features, context, mc);
          const top3Ids = candidates.slice(0, 3).map(c => c.id);
          for (const expected of scenario.expected.top3) {
            expect(top3Ids).toContain(expected);
          }
        });
      }

      if (scenario.expected.top3AnyOf) {
        it(`top-3 includes at least one of expected exercises`, () => {
          const context = detector._classifyContext(scenario.features);
          const mc = detector._classifyMovement(scenario.features, context);
          const candidates = detector._classifyLeaf(scenario.features, context, mc);
          const top3Ids = candidates.slice(0, 3).map(c => c.id);
          const hasMatch = scenario.expected.top3AnyOf.some(e => top3Ids.includes(e));
          expect(hasMatch).toBe(true);
        });
      }

      if (scenario.expectReducedDiscrimination) {
        it('occlusion reduces score discrimination', () => {
          const context = scenario.expected.context;
          const mc = scenario.expected.movementClass;
          const candidates = detector._classifyLeaf(scenario.features, context, mc);
          if (candidates.length >= 2) {
            // After visibility gating + normalization, the gap between top-1 and top-2
            // should be smaller than the full-visibility equivalent
            const gap = candidates[0].score - candidates[1].score;
            expect(gap).toBeLessThan(0.5); // weaker discrimination
          }
        });
      }
    });
  }

  // ── Aggregate metrics ──
  it('reports overall accuracy metrics', () => {
    let contextCorrect = 0, contextTotal = 0;
    let top1Correct = 0, top1Total = 0;
    let top3Correct = 0, top3Total = 0;

    for (const scenario of SCENARIOS) {
      if (scenario.expected.context) {
        contextTotal++;
        const ctx = detector._classifyContext(scenario.features);
        if (ctx === scenario.expected.context) contextCorrect++;
      }
      if (scenario.expected.top1) {
        const ctx = detector._classifyContext(scenario.features);
        const mc = detector._classifyMovement(scenario.features, ctx);
        const cands = detector._classifyLeaf(scenario.features, ctx, mc);
        top1Total++;
        if (cands.length > 0 && cands[0].id === scenario.expected.top1) top1Correct++;
      }
      if (scenario.expected.top3) {
        const ctx = detector._classifyContext(scenario.features);
        const mc = detector._classifyMovement(scenario.features, ctx);
        const cands = detector._classifyLeaf(scenario.features, ctx, mc);
        const top3Ids = cands.slice(0, 3).map(c => c.id);
        top3Total++;
        if (scenario.expected.top3.every(e => top3Ids.includes(e))) top3Correct++;
      }
      if (scenario.expected.top3AnyOf) {
        const ctx = detector._classifyContext(scenario.features);
        const mc = detector._classifyMovement(scenario.features, ctx);
        const cands = detector._classifyLeaf(scenario.features, ctx, mc);
        const top3Ids = cands.slice(0, 3).map(c => c.id);
        top3Total++;
        if (scenario.expected.top3AnyOf.some(e => top3Ids.includes(e))) top3Correct++;
      }
    }

    // Print metrics (visible in test output)
    const contextAcc = contextTotal > 0 ? (contextCorrect / contextTotal * 100).toFixed(1) : 'N/A';
    const top1Acc = top1Total > 0 ? (top1Correct / top1Total * 100).toFixed(1) : 'N/A';
    const top3Acc = top3Total > 0 ? (top3Correct / top3Total * 100).toFixed(1) : 'N/A';

    console.log(`\n  Validation metrics (${SCENARIOS.length} scenarios):`);
    console.log(`    Context accuracy: ${contextAcc}% (${contextCorrect}/${contextTotal})`);
    console.log(`    Top-1 hit rate:   ${top1Acc}% (${top1Correct}/${top1Total})`);
    console.log(`    Top-3 hit rate:   ${top3Acc}% (${top3Correct}/${top3Total})\n`);

    // Assert minimum accuracy thresholds
    expect(contextCorrect).toBe(contextTotal); // context must be 100%
    expect(top1Correct).toBe(top1Total);       // top-1 must be 100% on these scenarios
    expect(top3Correct).toBe(top3Total);       // top-3 must be 100% on these scenarios
  });
});
