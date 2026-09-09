/**
 * Centralized configuration for all analysis thresholds and parameters.
 *
 * Every magic number previously hardcoded across repCounter.js, exercises.js,
 * exerciseDetector.js, biomechanics.js, poseAnalysis.js, and SignalExtractor3D.js
 * is extracted here so tuning happens in one place.
 *
 * Grouped by module of origin.
 */

// ---------------------------------------------------------------------------
// repCounter.js — YIN autocorrelation
// ---------------------------------------------------------------------------

/** CMNDF threshold for YIN period detection (lower = stricter) */
export const YIN_CMNDF_THRESHOLD = 0.35;

/** Adaptive CMNDF: threshold for narrow-range signals (< 15 deg) */
export const YIN_CMNDF_THRESHOLD_NARROW = 0.25;

/** Adaptive CMNDF: threshold for wide-range signals (> 60 deg) */
export const YIN_CMNDF_THRESHOLD_WIDE = 0.40;

/** Signal range boundary for narrow classification (degrees, angle signals) */
export const YIN_NARROW_RANGE_DEG = 15;

/** Signal range boundary for wide classification (degrees, angle signals) */
export const YIN_WIDE_RANGE_DEG = 60;

/** Sub-harmonic refinement thresholds per divisor */
export const YIN_SUB_HARMONIC_THRESHOLDS = { 2: 0.78, 3: 0.60, 4: 0.50 };

/** Sub-harmonic maximum drift ratio before rejecting a candidate */
export const YIN_SUB_HARMONIC_MAX_DRIFT = 0.30;

/** Minimum confidence to accept a YIN result */
export const YIN_MIN_CONFIDENCE = 0.15;

/** Peak-counting CMNDF threshold for cross-check validation */
export const YIN_PEAK_CMNDF_THRESHOLD = 0.92;

/** Narrow-ROM confidence penalties (angle signals only) */
export const ROM_CONFIDENCE_PENALTIES = [
  { below: 20, factor: 0.3 },
  { below: 40, factor: 0.6 },
  { below: 60, factor: 0.85 },
];

// ---------------------------------------------------------------------------
// repCounter.js — live mode hysteresis
// ---------------------------------------------------------------------------

/** Minimum milliseconds between live-mode reps */
export const LIVE_DEBOUNCE_MS = 600;

// ---------------------------------------------------------------------------
// repCounter.js — consensus voting
// ---------------------------------------------------------------------------

/** Shoulder instability penalty applied to wristShoulderDist signals */
export const SHOULDER_INSTABILITY_MAX_PENALTY = 0.4;

/** Exercises where shoulders are expected stationary (bench, lying) */
export const SHOULDER_PINNED_EXERCISES = [
  'bench_press', 'lying_curl', 'lying_tricep_extension', 'skull_crusher',
];

// ---------------------------------------------------------------------------
// repCounter.js — candidate scoring weights
// ---------------------------------------------------------------------------

export const CANDIDATE_SCORE_WEIGHTS = {
  rom: 0.30,
  direction: 0.20,
  duration: 0.15,
  smoothness: 0.10,
  poseQuality: 0.15,
  exerciseConf: 0.10,
};

// ---------------------------------------------------------------------------
// repCounter.js — uncertain rep thresholds
// ---------------------------------------------------------------------------

/** Composite confidence above which all reps are confirmed */
export const REP_CONFIDENCE_HIGH = 0.85;

/** Composite confidence above which only the last rep is uncertain */
export const REP_CONFIDENCE_MEDIUM = 0.65;

// ---------------------------------------------------------------------------
// exercises.js — visibility
// ---------------------------------------------------------------------------

/** Unified visibility threshold for landmark quality gates */
export const VISIBILITY_THRESHOLD = 0.55;

// ---------------------------------------------------------------------------
// biomechanics.js
// ---------------------------------------------------------------------------

/** Default height in meters for velocity normalization */
export const NORM_TO_METERS_DEFAULT = 1.7;

/** Minimum visibility for bilateral asymmetry comparison */
export const ASYMMETRY_VIS_MIN = 0.5;

// ---------------------------------------------------------------------------
// biomechanics.js — peak-valley detection
// ---------------------------------------------------------------------------

/** Minimum prominence as fraction of global range */
export const PEAK_PROMINENCE_FRACTION = 0.30;

/** Minimum absolute prominence in degrees */
export const PEAK_MIN_PROMINENCE_DEG = 12;

/** Minimum frame gap between detected extrema */
export const PEAK_MIN_FRAME_GAP = 3;

// ---------------------------------------------------------------------------
// poseAnalysis.js — ghost pose decay
// ---------------------------------------------------------------------------

/** Consecutive ghost frames before visibility starts decaying */
export const GHOST_DECAY_START = 5;

/** Visibility decay rate per ghost frame beyond GHOST_DECAY_START */
export const GHOST_DECAY_RATE = 0.20;

/** Consecutive ghost frames before returning null instead of stale pose */
export const GHOST_MAX_FRAMES = 15;

/** Pinned MediaPipe WASM version (avoid @latest instability) */
export const MEDIAPIPE_WASM_VERSION = '0.10.8';

// ---------------------------------------------------------------------------
// exerciseDetector.js
// ---------------------------------------------------------------------------

/** Smoother window size for low fps (<=5) */
export const DETECTOR_SMOOTHER_WINDOW_LOW_FPS = 2;

/** Smoother window size for normal fps */
export const DETECTOR_SMOOTHER_WINDOW_NORMAL = 3;

/** Minimum frame buffer size */
export const DETECTOR_MIN_BUFFER_SIZE = 8;

/** Required confidence votes at low fps (<=5) */
export const DETECTOR_REQUIRED_CONFIDENCE_LOW_FPS = 4;

/** Required confidence votes at normal fps */
export const DETECTOR_REQUIRED_CONFIDENCE_NORMAL = 8;

/** Minimum frames before detection can fire (low fps) */
export const DETECTOR_MIN_FRAMES_LOW_FPS = 5;

/** Minimum frames before detection can fire (normal fps) */
export const DETECTOR_MIN_FRAMES_NORMAL = 8;

/** Vote window multiplier relative to fps */
export const DETECTOR_VOTE_WINDOW_FPS_MULT = 1.5;

/** Minimum vote window size */
export const DETECTOR_VOTE_WINDOW_MIN = 12;

/** Minimum fraction of votes for winner to be declared */
export const DETECTOR_VOTE_MAJORITY = 0.50;

/** Confidence below which exercise detection is considered unknown */
export const DETECTOR_UNKNOWN_THRESHOLD = 0.40;

// ---------------------------------------------------------------------------
// SignalExtractor3D.js
// ---------------------------------------------------------------------------

/** (no standalone thresholds — signals are pure extraction) */

// ---------------------------------------------------------------------------
// Production vs benchmark FPS / frame limits
// ---------------------------------------------------------------------------

export const PRODUCTION = {
  DEFAULT_FPS: 30,
  MAX_FRAMES: 900, // 30s at 30fps
};

export const BENCHMARK = {
  DEFAULT_FPS: 10,
  MAX_FRAMES: 300,
};

// ---------------------------------------------------------------------------
// Exercise period bounds (seconds) — calibrated per exercise
// Moved from repCounter.js static method for central tuning
// ---------------------------------------------------------------------------

export const REP_PERIOD_BOUNDS = {
  battle_rope:       { min: 0.3, max: 3.0 },
  bench_press:       { min: 0.7, max: 4.0 },
  bicep_curl:        { min: 1.0, max: 4.0 },
  hammer_curl:       { min: 0.8, max: 4.0 },
  squat:             { min: 0.8, max: 4.0 },
  goblet_squat:      { min: 0.8, max: 4.0 },
  front_squat:       { min: 0.8, max: 4.0 },
  deadlift:          { min: 1.2, max: 5.0 },
  romanian_deadlift: { min: 1.2, max: 5.0 },
  pull_up:           { min: 1.0, max: 4.0 },
  chin_up:           { min: 1.0, max: 4.0 },
  push_up:           { min: 1.0, max: 4.0 },
  sit_up:            { min: 0.3, max: 3.0 },
  crunch:            { min: 0.3, max: 3.0 },
  front_raise:       { min: 1.0, max: 4.0 },
  lateral_raise:     { min: 1.0, max: 4.0 },
  overhead_press:    { min: 1.0, max: 4.0 },
  shoulder_press:    { min: 1.0, max: 4.0 },
  lunge:             { min: 1.0, max: 4.0 },
  bent_over_row:     { min: 0.8, max: 4.0 },
  upright_row:       { min: 0.8, max: 4.0 },
  tricep_extension:  { min: 0.8, max: 4.0 },
  tricep_pushdown:   { min: 0.8, max: 4.0 },
  leg_press:         { min: 1.0, max: 4.0 },
  leg_extension:     { min: 0.8, max: 4.0 },
  leg_curl:          { min: 0.8, max: 4.0 },
  calf_raise:        { min: 0.5, max: 3.0 },
  _default:          { min: 0.6, max: 4.0 },
};

/**
 * Look up period bounds for an exercise, falling back to _default.
 * @param {string} exerciseKey
 * @returns {{ min: number, max: number }}
 */
export function getRepPeriodBounds(exerciseKey) {
  return REP_PERIOD_BOUNDS[exerciseKey] || REP_PERIOD_BOUNDS._default;
}
