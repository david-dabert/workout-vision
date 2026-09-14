/**
 * Tests for the HierarchicalDetector and supporting modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localforage before importing modules that transitively depend on poseAnalysis
vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { HierarchicalDetector } from '../hierarchicalDetector';
import { TemporalFeatureExtractor } from '../temporalFeatures';
import { lookupExercise, exercisesInContext, exercisesInClass, filterByMode, getAvailableExercises } from '../exerciseOntology';
import { featuresToVector, FEATURE_VECTOR_LENGTH } from '../modelHook';
import { fakeCurlFrame, fakeSquatFrame, fakeLandmarks } from './helpers';

// ---------------------------------------------------------------------------
// Exercise Ontology
// ---------------------------------------------------------------------------

describe('exerciseOntology', () => {
  it('lookupExercise returns context and movementClass for known exercises', () => {
    const info = lookupExercise('leg_press');
    expect(info).not.toBeNull();
    expect(info.context).toBe('seated');
    expect(info.movementClass).toBe('lower_push');
    expect(info.priority).toBe('P0');
  });

  it('lookupExercise returns null for unknown exercise', () => {
    expect(lookupExercise('nonexistent_exercise')).toBeNull();
  });

  it('exercisesInContext returns exercises for a context', () => {
    const seated = exercisesInContext('seated');
    expect(seated.length).toBeGreaterThan(5);
    expect(seated).toContain('leg_press');
    expect(seated).toContain('seated_row');
  });

  it('exercisesInClass returns exercises for a specific class', () => {
    const lowerPush = exercisesInClass('seated', 'lower_push');
    expect(lowerPush).toContain('leg_press');
    expect(lowerPush).toContain('leg_extension');
  });

  it('filterByMode gym returns everything', () => {
    const all = ['leg_press', 'squat', 'push_up'];
    expect(filterByMode(all, 'gym')).toEqual(all);
  });

  it('filterByMode home excludes machine exercises', () => {
    const all = ['leg_press', 'squat', 'push_up'];
    const home = filterByMode(all, 'home');
    expect(home).not.toContain('leg_press');
    expect(home).toContain('squat');
    expect(home).toContain('push_up');
  });

  it('getAvailableExercises returns more for gym than home', () => {
    const gym = getAvailableExercises('gym');
    const home = getAvailableExercises('home');
    expect(gym.length).toBeGreaterThan(home.length);
  });
});

// ---------------------------------------------------------------------------
// Temporal Feature Extractor
// ---------------------------------------------------------------------------

describe('TemporalFeatureExtractor', () => {
  it('returns null with insufficient data', () => {
    const ext = new TemporalFeatureExtractor();
    expect(ext.extract()).toBeNull();
  });

  it('extracts features from a window of angles', () => {
    const ext = new TemporalFeatureExtractor();
    // Push enough frames with varying angles
    for (let i = 0; i < 30; i++) {
      const t = i * 67; // ~15fps
      ext.push({
        leftKnee: 150 + 20 * Math.sin(i / 5),
        rightKnee: 150 + 20 * Math.sin(i / 5),
        leftHip: 160,
        rightHip: 160,
        leftElbow: 90 + 40 * Math.cos(i / 5),
        rightElbow: 90 + 40 * Math.cos(i / 5),
        leftShoulder: 30,
        rightShoulder: 30,
        trunk: 5,
        _visLeftKnee: 0.9,
        _visRightKnee: 0.9,
        _visLeftHip: 0.9,
        _visRightHip: 0.9,
        _visLeftElbow: 0.9,
        _visRightElbow: 0.9,
        _visLeftShoulder: 0.9,
        _visRightShoulder: 0.9,
      }, t);
    }

    const features = ext.extract();
    expect(features).not.toBeNull();
    expect(features.knee).toBeDefined();
    expect(features.knee.range).toBeGreaterThan(0);
    expect(features.elbow).toBeDefined();
    expect(features.elbow.range).toBeGreaterThan(0);
    expect(features.corr_knee_hip).toBeDefined();
    expect(typeof features.corr_elbow_shoulder).toBe('number');
  });

  it('reset clears the window', () => {
    const ext = new TemporalFeatureExtractor();
    for (let i = 0; i < 30; i++) {
      ext.push({ leftKnee: 150, rightKnee: 150, leftHip: 160, rightHip: 160,
        leftElbow: 90, rightElbow: 90, leftShoulder: 30, rightShoulder: 30, trunk: 5,
        _visLeftKnee: 0.9, _visRightKnee: 0.9, _visLeftHip: 0.9, _visRightHip: 0.9,
        _visLeftElbow: 0.9, _visRightElbow: 0.9, _visLeftShoulder: 0.9, _visRightShoulder: 0.9,
      }, i * 67);
    }
    ext.reset();
    expect(ext.extract()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Model Hook
// ---------------------------------------------------------------------------

describe('modelHook', () => {
  it('featuresToVector returns correct length', () => {
    const vec = featuresToVector(null);
    expect(vec.length).toBe(FEATURE_VECTOR_LENGTH);
  });

  it('featuresToVector extracts values from features', () => {
    const features = {
      knee: { range: 40, mean: 130, dwellLow: 0.1, dwellHigh: 0.2, cycles: 3 },
      hip: { range: 20, mean: 150, dwellLow: 0.05, dwellHigh: 0.1, cycles: 2 },
      elbow: { range: 60, mean: 100, dwellLow: 0.15, dwellHigh: 0.25, cycles: 4 },
      shoulder: { range: 10, mean: 40, dwellLow: 0.02, dwellHigh: 0.05, cycles: 1 },
      trunk: { range: 5, mean: 10, dwellLow: 0.3, dwellHigh: 0.4, cycles: 0 },
      corr_elbow_shoulder: 0.7,
      corr_knee_hip: 0.85,
      corr_elbow_knee: -0.2,
    };
    const vec = featuresToVector(features);
    expect(vec[0]).toBe(40); // knee_range
    expect(vec[1]).toBe(130); // knee_mean
  });
});

// ---------------------------------------------------------------------------
// P0 Leaf Scoring Rules
// ---------------------------------------------------------------------------

describe('P0 leaf scoring', () => {
  // Helper: build a minimal features object for scoring tests.
  // All channels default to low/zero values; override what matters.
  function makeFeatures(overrides = {}) {
    const ch = (o = {}) => ({
      range: 0, mean: 90, min: 80, max: 100, dwellLow: 0.1, dwellHigh: 0.1, cycles: 1, values: [],
      visibility: 0.95,
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

  let detector;
  beforeEach(() => {
    detector = new HierarchicalDetector({ fps: 10, mode: 'gym' });
  });

  // ── seated.lower_push ──

  it('leg_extension scores higher than leg_press when hip is static', () => {
    const f = makeFeatures({
      knee: { range: 40, mean: 120, dwellHigh: 0.2 },
      hip: { range: 4, mean: 100 },       // hip static = extension
      corr_knee_hip: 0.05,                 // near-zero correlation
    });
    const extScore = detector._scoreCandidate('leg_extension', f, 'seated', 'lower_push');
    const pressScore = detector._scoreCandidate('leg_press', f, 'seated', 'lower_push');
    expect(extScore).toBeGreaterThan(pressScore);
  });

  it('leg_press scores higher than leg_extension when hip moves with knee', () => {
    const f = makeFeatures({
      knee: { range: 45, mean: 120, dwellHigh: 0.15 },
      hip: { range: 30, mean: 110 },      // hip moves = press
      corr_knee_hip: 0.85,                 // high correlation
    });
    const pressScore = detector._scoreCandidate('leg_press', f, 'seated', 'lower_push');
    const extScore = detector._scoreCandidate('leg_extension', f, 'seated', 'lower_push');
    expect(pressScore).toBeGreaterThan(extScore);
  });

  // ── seated.upper_vertical ──

  it('straight_arm_pulldown scores highest when elbow ROM is near zero', () => {
    const f = makeFeatures({
      elbow: { range: 8, mean: 160 },     // arms stay straight
      shoulder: { range: 30, mean: 90 },
    });
    const sapScore = detector._scoreCandidate('straight_arm_pulldown', f, 'seated', 'upper_vertical');
    const latScore = detector._scoreCandidate('lat_pulldown', f, 'seated', 'upper_vertical');
    const pressScore = detector._scoreCandidate('machine_shoulder_press', f, 'seated', 'upper_vertical');
    expect(sapScore).toBeGreaterThan(latScore);
    expect(sapScore).toBeGreaterThan(pressScore);
  });

  it('lat_pulldown scores higher when shoulder dwells low', () => {
    const f = makeFeatures({
      elbow: { range: 30, mean: 110 },
      shoulder: { range: 40, mean: 90, dwellLow: 0.25, dwellHigh: 0.08 },
      corr_elbow_shoulder: 0.5,
    });
    const latScore = detector._scoreCandidate('lat_pulldown', f, 'seated', 'upper_vertical');
    const pressScore = detector._scoreCandidate('machine_shoulder_press', f, 'seated', 'upper_vertical');
    expect(latScore).toBeGreaterThan(pressScore);
  });

  it('machine_shoulder_press scores higher when shoulder dwells high', () => {
    const f = makeFeatures({
      elbow: { range: 30, mean: 110 },
      shoulder: { range: 40, mean: 90, dwellLow: 0.08, dwellHigh: 0.25 },
      corr_elbow_shoulder: 0.5,
    });
    const pressScore = detector._scoreCandidate('machine_shoulder_press', f, 'seated', 'upper_vertical');
    const latScore = detector._scoreCandidate('lat_pulldown', f, 'seated', 'upper_vertical');
    expect(pressScore).toBeGreaterThan(latScore);
  });

  // ── seated.upper_horizontal (weak signals, but ranking matters) ──

  it('seated_row ranks above chest_press when elbow dwells low', () => {
    const f = makeFeatures({
      elbow: { range: 25, mean: 100, dwellLow: 0.22, dwellHigh: 0.06 },
      corr_elbow_shoulder: -0.3,
    });
    const rowScore = detector._scoreCandidate('seated_row', f, 'seated', 'upper_horizontal');
    const pressScore = detector._scoreCandidate('machine_chest_press', f, 'seated', 'upper_horizontal');
    expect(rowScore).toBeGreaterThan(pressScore);
  });

  it('chest_press ranks above seated_row when elbow dwells high', () => {
    const f = makeFeatures({
      elbow: { range: 25, mean: 120, dwellLow: 0.06, dwellHigh: 0.22 },
      corr_elbow_shoulder: 0.3,
    });
    const pressScore = detector._scoreCandidate('machine_chest_press', f, 'seated', 'upper_horizontal');
    const rowScore = detector._scoreCandidate('seated_row', f, 'seated', 'upper_horizontal');
    expect(pressScore).toBeGreaterThan(rowScore);
  });

  // ── seated.lower_pull ──

  it('leg_curl scores higher when knee flexes with hip static', () => {
    const f = makeFeatures({
      knee: { range: 25, mean: 100, dwellLow: 0.2 },
      hip: { range: 5, mean: 100 },
      trunk: { range: 3, mean: 10 },
      corr_knee_hip: 0.05,
    });
    const curlScore = detector._scoreCandidate('leg_curl', f, 'seated', 'lower_pull');
    const backScore = detector._scoreCandidate('seated_back_extension', f, 'seated', 'lower_pull');
    expect(curlScore).toBeGreaterThan(backScore);
  });

  it('seated_back_extension scores higher when trunk and hip move', () => {
    const f = makeFeatures({
      knee: { range: 3, mean: 100 },
      hip: { range: 18, mean: 110 },
      trunk: { range: 20, mean: 25 },
    });
    const backScore = detector._scoreCandidate('seated_back_extension', f, 'seated', 'lower_pull');
    const curlScore = detector._scoreCandidate('leg_curl', f, 'seated', 'lower_pull');
    expect(backScore).toBeGreaterThan(curlScore);
  });

  // ── standing.lower_pull ──

  it('good_morning scores higher than deadlift when knees are locked', () => {
    const f = makeFeatures({
      knee: { range: 5, mean: 165 },
      hip: { range: 30, mean: 130 },
      trunk: { range: 25, mean: 40 },
    });
    const gmScore = detector._scoreCandidate('good_morning', f, 'standing', 'lower_pull');
    const dlScore = detector._scoreCandidate('deadlift', f, 'standing', 'lower_pull');
    expect(gmScore).toBeGreaterThan(dlScore);
  });

  // ── standing.upper_isolation ──

  it('curl scores higher than pushdown when shoulder is low and elbow flexes', () => {
    const f = makeFeatures({
      elbow: { range: 35, mean: 100 },
      shoulder: { range: 8, mean: 25 },
    });
    const curlScore = detector._scoreCandidate('bicep_curl', f, 'standing', 'upper_isolation');
    const pushScore = detector._scoreCandidate('cable_tricep_pushdown', f, 'standing', 'upper_isolation');
    // Both should be high for isolation, but curl slightly higher with these features
    expect(curlScore).toBeGreaterThanOrEqual(pushScore);
  });

  // ── visibility gating ──

  it('low visibility pulls score toward neutral', () => {
    const fHigh = makeFeatures({
      knee: { range: 40, mean: 120, dwellHigh: 0.2, visibility: 0.95 },
      hip: { range: 4, mean: 100, visibility: 0.95 },
      corr_knee_hip: 0.05,
    });
    const fLow = makeFeatures({
      knee: { range: 40, mean: 120, dwellHigh: 0.2, visibility: 0.15 },
      hip: { range: 4, mean: 100, visibility: 0.15 },
      corr_knee_hip: 0.05,
    });
    const scoreHigh = detector._scoreCandidate('leg_extension', fHigh, 'seated', 'lower_push');
    const scoreLow = detector._scoreCandidate('leg_extension', fLow, 'seated', 'lower_push');
    // High visibility should give stronger discrimination (further from 1.0)
    expect(Math.abs(scoreHigh - 1.0)).toBeGreaterThan(Math.abs(scoreLow - 1.0));
  });

  it('full visibility preserves original score', () => {
    const f = makeFeatures({
      knee: { range: 40, mean: 120, dwellHigh: 0.2, visibility: 0.95 },
      hip: { range: 30, mean: 110, visibility: 0.95 },
      corr_knee_hip: 0.85,
    });
    // visibilityWeight should be 1.0 at high visibility
    const weight = detector._visibilityWeight(f, 'seated', 'lower_push');
    expect(weight).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// HierarchicalDetector
// ---------------------------------------------------------------------------

describe('HierarchicalDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new HierarchicalDetector({ fps: 10, mode: 'gym' });
  });

  it('returns null state before enough frames', () => {
    const state = detector.update({
      landmarks: fakeCurlFrame(170),
      timestampMs: 0,
    });
    expect(state.exercise).toBeNull();
    expect(state.locked).toBe(false);
  });

  it('detects standing context from curl motion', () => {
    let lastState = null;
    for (let i = 0; i < 60; i++) {
      const phase = (i % 30) / 30;
      const elbowAngle = 105 + 65 * Math.cos(phase * 2 * Math.PI);
      lastState = detector.update({
        landmarks: fakeCurlFrame(elbowAngle),
        timestampMs: i * 100,
      });
    }
    // Should have classified a context
    expect(lastState.context).not.toBeNull();
  });

  it('lock() sets exercise and locked flag', () => {
    // Feed some frames first
    for (let i = 0; i < 30; i++) {
      detector.update({
        landmarks: fakeCurlFrame(105 + 65 * Math.cos((i / 20) * 2 * Math.PI)),
        timestampMs: i * 100,
      });
    }

    detector.lock('bicep_curl');
    const state = detector.state;
    expect(state.exercise).toBe('bicep_curl');
    expect(state.locked).toBe(true);
  });

  it('reset() clears all state', () => {
    for (let i = 0; i < 30; i++) {
      detector.update({
        landmarks: fakeCurlFrame(105 + 65 * Math.cos((i / 20) * 2 * Math.PI)),
        timestampMs: i * 100,
      });
    }
    detector.lock('bicep_curl');
    detector.reset();
    expect(detector.state.exercise).toBeNull();
    expect(detector.state.locked).toBe(false);
    expect(detector.state.context).toBeNull();
  });

  it('getDetectionInfo returns compatible format', () => {
    for (let i = 0; i < 60; i++) {
      detector.update({
        landmarks: fakeCurlFrame(105 + 65 * Math.cos((i / 30) * 2 * Math.PI)),
        timestampMs: i * 100,
      });
    }
    const info = detector.getDetectionInfo();
    expect(info).toHaveProperty('detected');
    expect(info).toHaveProperty('confidence');
    expect(info).toHaveProperty('isLowConfidence');
    expect(info).toHaveProperty('alternatives');
    expect(Array.isArray(info.alternatives)).toBe(true);
  });

  it('home mode excludes machine exercises from candidates', () => {
    const homeDetector = new HierarchicalDetector({ fps: 10, mode: 'home' });
    // Feed seated-looking frames
    for (let i = 0; i < 60; i++) {
      homeDetector.update({
        landmarks: fakeLandmarks(), // standing
        timestampMs: i * 100,
      });
    }
    const state = homeDetector.state;
    if (state.candidates && state.candidates.length > 0) {
      for (const c of state.candidates) {
        expect(c.id).not.toBe('leg_press');
        expect(c.id).not.toBe('lat_pulldown');
      }
    }
  });
});
