/**
 * Hierarchical exercise detector — three-level classification.
 *
 * Level 0 (Context):    seated / standing / prone / supine / hanging / supported
 * Level 1 (Movement):   upper_push / upper_pull / lower_push / lower_pull / etc.
 * Level 2 (Leaf):       specific exercise key from EXERCISES
 *
 * Uses the TemporalFeatureExtractor for windowed statistics and the
 * exercise ontology for structured candidate narrowing.
 *
 * Auto-lock gate: requires confidence >= 0.85, margin >= 0.15 over runner-up,
 * and 1 second of stability before locking without user confirmation.
 *
 * Seam: two calls from the consumer:
 *   detector.update({ landmarks, worldLandmarks, timestampMs })
 *   detector.lock(exerciseId)  // user confirms or corrects
 *
 * state.exercise is null when the leaf is ambiguous.
 */

import { extractJointAngles } from './poseAnalysis';
import { bestSide } from './exercises';
import { TemporalFeatureExtractor } from './temporalFeatures';
import { lookupExercise, exercisesInClass, filterByMode, ONTOLOGY } from './exerciseOntology';
import { AngleBuffer } from './repCounter';

// ---------------------------------------------------------------------------
// Auto-lock thresholds
// ---------------------------------------------------------------------------

const AUTOLOCK_CONFIDENCE = 0.85;
const AUTOLOCK_MARGIN = 0.15;
const AUTOLOCK_STABILITY_MS = 1000;

// Movement classes where monocular pose cannot reliably disambiguate exercises.
// Auto-lock is suppressed for these — user must confirm via chip selection.
const AUTOLOCK_BLOCKED_CLASSES = new Set([
  'upper_horizontal',    // seated row vs chest press — load direction invisible
  'lower_isolation',     // adductor vs abductor — identical joint trajectories
]);

// ---------------------------------------------------------------------------
// Local prior store (learned from corrections)
// ---------------------------------------------------------------------------

const LOCAL_PRIORS_KEY = 'wv_exercise_priors';

function loadLocalPriors() {
  try {
    const raw = localStorage.getItem(LOCAL_PRIORS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocalPriors(priors) {
  try {
    localStorage.setItem(LOCAL_PRIORS_KEY, JSON.stringify(priors));
  } catch { /* localStorage full or unavailable */ }
}

// ---------------------------------------------------------------------------
// HierarchicalDetector
// ---------------------------------------------------------------------------

export class HierarchicalDetector {
  /**
   * @param {object} opts
   * @param {number}  [opts.fps=30]
   * @param {'gym'|'home'} [opts.mode='gym']
   * @param {function} [opts.onModelPredict] - TF.js model hook, receives features, returns scores
   */
  constructor(opts = {}) {
    this._fps = opts.fps || 30;
    this._mode = opts.mode || 'gym';
    this._onModelPredict = opts.onModelPredict || null;
    this._temporal = new TemporalFeatureExtractor();
    this._smoother = new AngleBuffer(3);
    this._priors = loadLocalPriors();

    // State
    this._context = null;        // Level 0
    this._movementClass = null;  // Level 1
    this._exercise = null;       // Level 2 (null = ambiguous)
    this._locked = false;
    this._candidates = [];       // [{id, score}] sorted desc
    this._confidence = 0;
    this._margin = 0;

    // Auto-lock tracking
    this._stableExercise = null;
    this._stableStartMs = 0;

    // Frame counter
    this._frameCount = 0;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Process one frame.
   * @param {{ landmarks: Array, worldLandmarks?: Array, timestampMs: number }} frame
   * @returns {{ context: string|null, movementClass: string|null, exercise: string|null, candidates: Array, confidence: number, locked: boolean }}
   */
  update(frame) {
    this._frameCount++;
    const { landmarks, timestampMs } = frame;
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) return this.state;

    const angles = this._smoother.smooth(rawAngles);
    this._temporal.push(angles, timestampMs);

    const features = this._temporal.extract();
    if (!features) return this.state;

    // If already locked, keep returning locked state
    if (this._locked) return this.state;

    // Movement-energy gate: during rest pauses and seat adjustments,
    // all channels have near-zero range. Skip classification to avoid
    // context flips and chip spam on static frames.
    const totalRange = features.knee.range + features.hip.range +
      features.elbow.range + features.shoulder.range + features.trunk.range;
    if (totalRange < 8) return this.state; // sub-threshold motion, hold last state

    // Level 0: context detection
    this._context = this._classifyContext(features);

    // Level 1: movement class
    this._movementClass = this._classifyMovement(features, this._context);

    // Level 2: leaf candidates
    this._candidates = this._classifyLeaf(features, this._context, this._movementClass);

    // Apply local priors
    this._applyPriors();

    // Apply ML model if available
    if (this._onModelPredict) {
      this._applyModelScores(features);
    }

    // Compute confidence and margin
    if (this._candidates.length > 0) {
      this._confidence = this._candidates[0].score;
      this._margin = this._candidates.length > 1
        ? this._candidates[0].score - this._candidates[1].score
        : 1.0;
    } else {
      this._confidence = 0;
      this._margin = 0;
    }

    // Determine exercise (null if ambiguous)
    const topCandidate = this._candidates.length > 0 ? this._candidates[0].id : null;
    const autolockAllowed = !AUTOLOCK_BLOCKED_CLASSES.has(this._movementClass);
    if (autolockAllowed && this._confidence >= AUTOLOCK_CONFIDENCE && this._margin >= AUTOLOCK_MARGIN) {
      // Check stability for auto-lock
      if (topCandidate === this._stableExercise) {
        if (timestampMs - this._stableStartMs >= AUTOLOCK_STABILITY_MS) {
          this._exercise = topCandidate;
          this._locked = true;
        } else {
          this._exercise = topCandidate;
        }
      } else {
        this._stableExercise = topCandidate;
        this._stableStartMs = timestampMs;
        this._exercise = topCandidate;
      }
    } else {
      this._stableExercise = null;
      this._stableStartMs = 0;
      this._exercise = null; // ambiguous: show chips
    }

    return this.state;
  }

  /**
   * User confirms or corrects the exercise.
   * @param {string} exerciseId
   */
  lock(exerciseId) {
    this._exercise = exerciseId;
    this._locked = true;

    // Update local priors from this correction
    const info = lookupExercise(exerciseId);
    if (info) {
      const key = `${info.context}:${info.movementClass}`;
      if (!this._priors[key]) this._priors[key] = {};
      this._priors[key][exerciseId] = (this._priors[key][exerciseId] || 0) + 1;
      saveLocalPriors(this._priors);
    }
  }

  /**
   * Current detector state.
   */
  get state() {
    return {
      context: this._context,
      movementClass: this._movementClass,
      exercise: this._exercise,
      candidates: this._candidates.slice(0, 5),
      confidence: this._confidence,
      margin: this._margin,
      locked: this._locked,
      temporalFeatures: this._temporal.extract(),
    };
  }

  /**
   * Get detection info compatible with ExerciseAutoDetector.getDetectionInfo().
   */
  getDetectionInfo() {
    return {
      detected: this._exercise,
      confidence: this._confidence,
      isLowConfidence: this._confidence < 0.40,
      alternatives: this._candidates.slice(0, 3).map(c => ({
        name: c.id,
        confidence: c.score,
      })),
    };
  }

  /**
   * Get confidence (compatible with ExerciseAutoDetector).
   */
  getConfidence() {
    return this._confidence;
  }

  /**
   * Whether detection is low confidence.
   */
  isLowConfidence() {
    return this._confidence < 0.40;
  }

  reset() {
    this._temporal.reset();
    this._smoother.reset();
    this._context = null;
    this._movementClass = null;
    this._exercise = null;
    this._locked = false;
    this._candidates = [];
    this._confidence = 0;
    this._margin = 0;
    this._stableExercise = null;
    this._stableStartMs = 0;
    this._frameCount = 0;
  }

  // =========================================================================
  // Level 0: Context classification
  // =========================================================================

  _classifyContext(f) {
    const hip = f.hip, knee = f.knee, trunk = f.trunk, shoulder = f.shoulder, elbow = f.elbow;

    // Hanging: shoulders very elevated, knees above hips range
    // Check first — distinctive signature, no other context has shoulder mean > 140
    if (shoulder.mean > 140 && knee.mean > 100) return 'hanging';

    // Seated: hips flexed (<130 mean), trunk upright (<35), knees not fully extended.
    // Hip RANGE can be large (leg press has 30-40° hip ROM while seated).
    // The key is hip MEAN below standing threshold + upright trunk.
    if (hip.mean < 130 && trunk.mean < 35 && knee.mean < 150) return 'seated';

    // Standing: knees and hips extended (>130), trunk upright to moderately forward.
    // Must check before prone — a standing person with low trunk lean and extended
    // hips would otherwise match the prone rule.
    if (knee.mean > 130 && hip.mean > 130) return 'standing';

    // Prone: trunk near horizontal, hips extended, knees NOT fully extended
    // (face-down on a bench — knees typically bent or dangling, mean < 130)
    if (trunk.mean < 20 && hip.mean > 140 && knee.mean <= 130) return 'prone';

    // Supine: trunk near horizontal + elbows active (bench press family)
    // or hip ROM pattern (hip thrust / glute bridge)
    if (trunk.mean < 25 && hip.mean > 130 && knee.range < 15 && elbow.range > 10) return 'supine';

    // Supported (dip-like): mid-trunk, elbow+shoulder ROM, knees above waist
    if (elbow.range > 25 && shoulder.range > 15 && trunk.mean > 10 && trunk.mean < 40
        && knee.mean > 100) return 'supported';

    // Default fallback
    return 'standing';
  }

  // =========================================================================
  // Level 1: Movement class classification
  // =========================================================================

  _classifyMovement(f, context) {
    const classes = ONTOLOGY[context];
    if (!classes) return null;

    switch (context) {
      case 'seated': return this._classifySeatedMovement(f);
      case 'standing': return this._classifyStandingMovement(f);
      case 'hanging': return this._classifyHangingMovement(f);
      case 'prone': return this._classifyProneMovement(f);
      case 'supine': return this._classifySupineMovement(f);
      case 'supported': return this._classifySupportedMovement(f);
      default: return null;
    }
  }

  _classifySeatedMovement(f) {
    const { knee, hip, elbow, shoulder, trunk } = f;

    // Large knee ROM + low arm movement = lower body
    if (knee.range > 15 && elbow.range < 10) {
      if (hip.range > 12) return 'lower_push'; // leg press
      if (knee.mean < 100) return 'lower_pull'; // leg curl
      return 'lower_push'; // leg extension
    }

    // Isolation machines: adductor/abductor
    if (hip.range > 10 && knee.range < 10 && elbow.range < 10 && shoulder.range < 10) {
      return 'lower_isolation';
    }

    // Elbow ROM = upper body
    if (elbow.range > 8) {
      if (shoulder.mean > 80) return 'upper_vertical'; // lat pulldown
      if (shoulder.range > 10 && elbow.mean < 100) return 'upper_isolation'; // preacher curl
      return 'upper_horizontal'; // row or chest press (ambiguous)
    }

    // Shoulder ROM without elbow = upper vertical
    if (shoulder.range > 10) {
      return shoulder.mean > 80 ? 'upper_vertical' : 'upper_horizontal';
    }

    // Trunk ROM = core
    if (trunk.range > 10 && hip.range > 10) return 'core_seated';
    if (trunk.range > 8) return 'core_seated';

    // Back extension: trunk + hip ROM, arms/knees static
    if (hip.range > 15 && elbow.range < 10 && knee.range < 10) return 'lower_pull';

    return 'upper_horizontal';
  }

  _classifyStandingMovement(f) {
    const { knee, hip, elbow, shoulder, trunk } = f;

    // Explosive: high velocity + mixed ROM
    if (hip.range > 20 && shoulder.range > 25 && elbow.range > 15) return 'explosive';

    // Full body: battle rope, jumping jack, burpee patterns
    if (shoulder.range > 30 && knee.range > 10 && elbow.mean > 130) return 'full_body';
    if (trunk.range > 40 && knee.range > 30 && elbow.range > 20) return 'full_body';

    // Lower body: knee/hip dominant
    if (knee.range > 20 && knee.range > elbow.range * 1.5) {
      if (trunk.mean > 35 && hip.range > 20) return 'lower_pull'; // deadlift family
      return 'lower_push'; // squat family
    }

    if (hip.range > 25 && trunk.mean > 35) return 'lower_pull'; // deadlift/good morning

    // Upper isolation: elbow dominant, standing upright
    if (elbow.range > 15 && shoulder.range < 20 && knee.range < 10 && hip.range < 10) {
      return 'upper_isolation';
    }

    // Upper push: overhead or pressing
    if (elbow.range > 15 && shoulder.mean > 60) return 'upper_push';
    if (shoulder.range > 20 && elbow.mean > 130) return 'upper_push'; // raises

    // Upper pull: bent-over or cable
    if (elbow.range > 15 && trunk.mean > 30) return 'upper_pull';
    if (shoulder.range > 15 && trunk.mean > 30) return 'upper_pull';

    // Kettlebell swing: hip + shoulder ROM + explosive
    if (hip.range > 30 && shoulder.range > 30) return 'lower_pull';

    return 'lower_push';
  }

  _classifyHangingMovement(f) {
    const { elbow, hip, knee, shoulder } = f;

    if (elbow.range < 10 && shoulder.range < 10 && hip.range < 10) return 'iso_hold';
    if (hip.range > 20 || knee.range > 15) return 'core_hanging';
    if (elbow.range > 10) return 'upper_pull';
    return 'upper_pull';
  }

  _classifyProneMovement(f) {
    const { elbow, knee, hip, trunk, shoulder } = f;

    if (trunk.range < 8 && knee.range < 10 && elbow.range < 15) return 'core_prone';
    if (hip.range > 10 && elbow.range < 10) return 'back_extension';
    if (elbow.range > 15) return 'upper_push';
    return 'core_prone';
  }

  _classifySupineMovement(f) {
    const { elbow, knee, hip, trunk, shoulder } = f;

    // Hip movement = hip thrust / glute bridge
    if (hip.range > 15 && knee.range < 15 && elbow.range < 10) return 'lower_push_supine';

    // Elbow ROM = pressing or skull crusher
    if (elbow.range > 15) {
      if (shoulder.mean < 30 && shoulder.range < 15) return 'upper_isolation_supine';
      if (shoulder.range > 20) return 'upper_push';
      return 'upper_push';
    }

    // Trunk oscillation = core
    if (trunk.range > 8) return 'core_supine';
    if (hip.range > 5 && knee.mean > 150) return 'core_supine'; // flutter kicks

    return 'upper_push';
  }

  _classifySupportedMovement(f) {
    const { elbow, shoulder } = f;
    if (elbow.range > 20 && shoulder.range > 10) return 'dip';
    return 'inverted';
  }

  // =========================================================================
  // Level 2: Leaf classification (specialist)
  // =========================================================================

  _classifyLeaf(features, context, movementClass) {
    if (!context || !movementClass) return [];

    const candidates = exercisesInClass(context, movementClass);
    const filtered = filterByMode(candidates, this._mode);
    if (filtered.length === 0) return [];
    if (filtered.length === 1) return [{ id: filtered[0], score: 0.95 }];

    // Score each candidate based on feature match
    const scored = filtered.map(id => ({
      id,
      score: this._scoreCandidate(id, features, context, movementClass),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Normalize scores
    const total = scored.reduce((s, c) => s + c.score, 0);
    if (total > 0) {
      for (const c of scored) c.score = c.score / total;
    }

    return scored;
  }

  _scoreCandidate(exerciseId, features, context, movementClass) {
    const f = features;
    let score = 1.0;

    // Context-specific leaf disambiguation
    switch (context) {
      case 'seated':
        score = this._scoreSeatedLeaf(exerciseId, f, movementClass);
        break;
      case 'standing':
        score = this._scoreStandingLeaf(exerciseId, f, movementClass);
        break;
      case 'hanging':
        score = this._scoreHangingLeaf(exerciseId, f);
        break;
      case 'prone':
        score = this._scoreProneLeaf(exerciseId, f);
        break;
      case 'supine':
        score = this._scoreSupineLeaf(exerciseId, f);
        break;
      default:
        break;
    }

    // Visibility gate: pull score toward neutral (1.0) when key channels
    // are poorly tracked. This prevents noisy angles from dominating the
    // ranking on occluded gym footage (leg press hides feet, cables hide
    // one arm, lat pulldown drops shoulder visibility).
    const visWeight = this._visibilityWeight(f, context, movementClass);
    score = 1.0 + (score - 1.0) * visWeight;

    return Math.max(0.01, score);
  }

  /**
   * Compute a [0,1] weight reflecting how trustworthy the scoring channels
   * are for this context + movement class. 1.0 = fully visible, score is
   * used at full strength. Lower = score is pulled toward neutral 1.0.
   */
  _visibilityWeight(f, context, movementClass) {
    // Identify which channels matter for this bucket
    const weights = [];
    if (context === 'seated' || context === 'standing') {
      if (movementClass?.startsWith('lower')) {
        weights.push(f.knee.visibility, f.hip.visibility);
      } else if (movementClass?.startsWith('upper') || movementClass?.startsWith('core')) {
        weights.push(f.elbow.visibility, f.shoulder.visibility);
      }
    } else if (context === 'hanging') {
      weights.push(f.elbow.visibility, f.shoulder.visibility);
    } else if (context === 'prone' || context === 'supine') {
      weights.push(f.elbow.visibility, f.shoulder.visibility, f.hip.visibility);
    }

    if (weights.length === 0) return 1.0;

    // Mean of relevant channel visibilities, clamped to [0, 1]
    const mean = weights.reduce((s, v) => s + (v || 0), 0) / weights.length;

    // Smooth ramp: full trust above 0.7, linear fade below, floor at 0.3
    if (mean >= 0.7) return 1.0;
    if (mean <= 0.2) return 0.3;
    return 0.3 + (mean - 0.2) * (0.7 / 0.5); // linear from 0.3 to 1.0
  }

  _scoreSeatedLeaf(id, f, mc) {
    const { knee, hip, elbow, shoulder, trunk } = f;
    const corrKH = f.corr_knee_hip;
    const corrES = f.corr_elbow_shoulder;

    // ── seated.lower_push ──────────────────────────────────────────────
    // Key signal: hip involvement separates leg press from leg extension.
    // Knee-hip correlation separates compound (press) from isolation (extension).
    if (mc === 'lower_push') {
      if (id === 'leg_press' || id === 'single_leg_press') {
        // Leg press: knee AND hip both flex/extend in sync.
        // Large ROM on both. High knee-hip correlation (>0.6).
        let s = 1.0;
        s += knee.range > 30 ? 0.6 : knee.range > 20 ? 0.3 : 0;
        s += hip.range > 20 ? 0.6 : hip.range > 12 ? 0.3 : 0;
        s += corrKH > 0.7 ? 0.5 : corrKH > 0.5 ? 0.2 : 0;
        // Leg press has dwell at lockout (extended)
        s += knee.dwellHigh > 0.12 ? 0.2 : 0;
        // Penalise if hip is static (that's extension, not press)
        if (hip.range < 8) s *= 0.3;
        return s;
      }
      if (id === 'leg_extension') {
        // Leg extension: ONLY knees move. Hips static. Zero knee-hip correlation.
        // Strong dwell at top (isometric squeeze at full extension).
        let s = 1.0;
        s += knee.range > 25 ? 0.6 : knee.range > 15 ? 0.3 : 0;
        s += hip.range < 8 ? 0.8 : hip.range < 12 ? 0.3 : 0;
        s += Math.abs(corrKH) < 0.3 ? 0.4 : 0;
        s += knee.dwellHigh > 0.15 ? 0.3 : 0;
        // Penalise if hip moves a lot (that's a press, not extension)
        if (hip.range > 15) s *= 0.3;
        return s;
      }
      if (id === 'hack_squat' || id === 'smith_squat' || id === 'pendulum_squat') {
        // Squat-family machines: knee-dominant with moderate hip.
        // knee.range > hip.range. Moderate knee-hip correlation.
        let s = 1.0;
        s += knee.range > 25 ? 0.4 : 0;
        s += (hip.range > 8 && hip.range < 25) ? 0.3 : 0;
        s += (knee.range > hip.range * 1.3) ? 0.3 : 0;
        s += corrKH > 0.4 ? 0.2 : 0;
        return s;
      }
    }

    // ── seated.lower_pull ──────────────────────────────────────────────
    if (mc === 'lower_pull') {
      if (id === 'leg_curl' || id === 'lying_leg_curl') {
        // Leg curl: knee flexion against resistance. Dwell at flexed (low).
        // Hip stays mostly static.
        let s = 1.0;
        s += knee.range > 15 ? 0.5 : knee.range > 8 ? 0.2 : 0;
        s += hip.range < 10 ? 0.4 : 0;
        s += knee.dwellLow > 0.12 ? 0.4 : 0;
        // Negative knee-hip correlation or near-zero (hip static)
        s += Math.abs(corrKH) < 0.3 ? 0.2 : 0;
        return s;
      }
      if (id === 'seated_back_extension') {
        // Back extension: trunk and hip ROM, knees static
        let s = 1.0;
        s += trunk.range > 12 ? 0.5 : 0;
        s += hip.range > 10 ? 0.4 : 0;
        s += knee.range < 8 ? 0.3 : 0;
        return s;
      }
    }

    // ── seated.upper_horizontal (monocular ceiling) ────────────────────
    // Push vs pull is invisible to joint trajectory alone. But dwell patterns,
    // elbow mean, and elbow-shoulder correlation provide weak ranking signals.
    // All scores stay close together; chips are still shown.
    if (mc === 'upper_horizontal') {
      if (id === 'seated_row' || id === 'machine_row' || id === 'cable_row_single' || id === 'chest_supported_row') {
        // Row: elbows flex to contracted position (lower angle).
        // Dwell at low (squeeze). Elbow mean tends lower.
        let s = 1.0;
        s += elbow.dwellLow > 0.15 ? 0.25 : elbow.dwellLow > 0.08 ? 0.1 : 0;
        s += elbow.mean < 110 ? 0.15 : 0;
        // Negative elbow-shoulder correlation is a weak row signal
        // (elbows closing while shoulders retract)
        s += corrES < -0.2 ? 0.1 : 0;
        return s;
      }
      if (id === 'machine_chest_press') {
        // Press: elbows extend to lockout (higher angle).
        // Dwell at high (lockout). Elbow mean tends higher.
        let s = 1.0;
        s += elbow.dwellHigh > 0.15 ? 0.25 : elbow.dwellHigh > 0.08 ? 0.1 : 0;
        s += elbow.mean > 110 ? 0.15 : 0;
        // Positive elbow-shoulder correlation is a weak press signal
        s += corrES > 0.2 ? 0.1 : 0;
        return s;
      }
      return 1.0;
    }

    // ── seated.upper_vertical ──────────────────────────────────────────
    // Straight-arm pulldown is definitively separable (no elbow ROM).
    // Lat pulldown vs shoulder press: shoulder dwell pattern discriminates.
    if (mc === 'upper_vertical') {
      if (id === 'straight_arm_pulldown') {
        // Definitive: arms stay nearly straight, shoulder sweeps.
        let s = 0.5;
        s += elbow.range < 12 ? 1.5 : elbow.range < 20 ? 0.5 : 0;
        s += shoulder.range > 15 ? 0.5 : 0;
        // Penalise if elbows are bending a lot
        if (elbow.range > 25) s *= 0.2;
        return s;
      }
      if (id === 'lat_pulldown') {
        // Shoulder starts high (arms up on bar), comes down to chest.
        // Shoulder dwells LOW (contracted position, bar at chest).
        // Elbow ROM significant (extends to flexed). High shoulder mean.
        let s = 1.0;
        s += shoulder.mean > 80 ? 0.4 : shoulder.mean > 60 ? 0.2 : 0;
        s += elbow.range > 15 ? 0.3 : 0;
        s += shoulder.dwellLow > shoulder.dwellHigh ? 0.3 : 0;
        // Positive elbow-shoulder correlation (both come down together)
        s += corrES > 0.3 ? 0.2 : 0;
        // Penalise if shoulder dwell is mostly at top (that's pressing up)
        if (shoulder.dwellHigh > shoulder.dwellLow * 1.5) s *= 0.6;
        return s;
      }
      if (id === 'machine_shoulder_press' || id === 'seated_dumbbell_press') {
        // Pushes up from shoulder height to overhead lockout.
        // Shoulder dwells HIGH (lockout at top).
        // Elbow ROM significant (flexed to extended).
        let s = 1.0;
        s += shoulder.mean > 70 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.3 : 0;
        s += shoulder.dwellHigh > shoulder.dwellLow ? 0.3 : 0;
        // Positive elbow-shoulder correlation (both go up together)
        s += corrES > 0.3 ? 0.2 : 0;
        // Penalise if shoulder dwell is mostly at bottom (that's pulling down)
        if (shoulder.dwellLow > shoulder.dwellHigh * 1.5) s *= 0.6;
        return s;
      }
    }

    // ── seated.lower_isolation ─────────────────────────────────────────
    if (mc === 'lower_isolation') {
      if (id === 'adductor_machine' || id === 'abductor_machine') {
        // Both: hip ROM, knees/elbows static. Indistinguishable from each other.
        return hip.range > 8 ? 1.2 : 1.0;
      }
      if (id === 'seated_calf_raise') {
        // Ankle-only movement. Knee/hip/elbow all static. Very small knee range.
        let s = 0.5;
        s += knee.range < 5 ? 1.0 : 0;
        s += hip.range < 5 ? 0.3 : 0;
        s += elbow.range < 5 ? 0.2 : 0;
        return s;
      }
    }

    return 1.0;
  }

  _scoreStandingLeaf(id, f, mc) {
    const { knee, hip, elbow, shoulder, trunk } = f;
    const corrKH = f.corr_knee_hip;
    const corrES = f.corr_elbow_shoulder;
    const corrEK = f.corr_elbow_knee;

    // ── standing.lower_push ────────────────────────────────────────────
    if (mc === 'lower_push') {
      // Calf raises: near-zero knee/hip ROM, only ankle plantarflexion
      if (id === 'calf_raise' || id === 'donkey_calf_raise' || id === 'leg_press_calf_raise') {
        let s = 0.5;
        s += knee.range < 8 ? 1.0 : knee.range < 12 ? 0.3 : 0;
        s += hip.range < 8 ? 0.5 : 0;
        if (knee.range > 15) s *= 0.2; // definitely not calf if knees bend a lot
        return s;
      }
      // Overhead squat: shoulders overhead (>130°), plus squat ROM
      if (id === 'overhead_squat') {
        let s = 0.5;
        s += shoulder.mean > 140 ? 0.8 : shoulder.mean > 120 ? 0.4 : 0;
        s += knee.range > 20 ? 0.3 : 0;
        if (shoulder.mean < 100) s *= 0.2;
        return s;
      }
      // Front squat: upright torso (trunk < 25), deep knee bend
      if (id === 'front_squat') {
        let s = 1.0;
        s += trunk.mean < 25 ? 0.4 : trunk.mean < 35 ? 0.2 : 0;
        s += knee.range > 25 ? 0.3 : 0;
        s += elbow.mean > 100 ? 0.2 : 0; // elbows up in rack position
        return s;
      }
      // Unilateral: lunges, split squats, step-ups
      if (id.includes('lunge') || id === 'bulgarian_split_squat' || id === 'step_up' || id === 'curtsy_lunge') {
        // These produce asymmetric knee angles; hard to detect with bestSide
        // but cycles tend higher (alternating legs) and knee range is moderate
        let s = 1.0;
        s += knee.range > 15 ? 0.3 : 0;
        s += knee.cycles > 2 ? 0.2 : 0; // alternating legs = more cycles
        s += hip.range > 10 ? 0.2 : 0;
        return s;
      }
      // Generic squat family: large bilateral knee ROM, moderate-high hip ROM
      if (id.includes('squat') || id === 'belt_squat') {
        let s = 1.0;
        s += knee.range > 30 ? 0.5 : knee.range > 20 ? 0.2 : 0;
        s += hip.range > 15 ? 0.3 : 0;
        s += corrKH > 0.5 ? 0.2 : 0;
        return s;
      }
    }

    // ── standing.lower_pull ────────────────────────────────────────────
    if (mc === 'lower_pull') {
      // Good morning: knees nearly locked, hip hinge dominant
      if (id === 'good_morning') {
        let s = 0.5;
        s += knee.range < 10 ? 0.8 : knee.range < 15 ? 0.3 : 0;
        s += hip.range > 20 ? 0.5 : hip.range > 10 ? 0.2 : 0;
        s += trunk.mean > 35 ? 0.3 : 0;
        if (knee.range > 20) s *= 0.3;
        return s;
      }
      // RDL/stiff-leg: slight knee bend, large hip hinge
      if (id === 'romanian_deadlift' || id === 'stiff_leg_deadlift') {
        let s = 1.0;
        s += (knee.range > 5 && knee.range < 18) ? 0.4 : 0;
        s += hip.range > 20 ? 0.4 : 0;
        s += trunk.mean > 30 ? 0.2 : 0;
        return s;
      }
      // Swing / pull-through: explosive hip + shoulder ROM (arms swing)
      if (id === 'kettlebell_swing' || id === 'cable_pull_through') {
        let s = 0.5;
        s += hip.range > 30 ? 0.5 : hip.range > 20 ? 0.2 : 0;
        s += shoulder.range > 25 ? 0.5 : shoulder.range > 15 ? 0.2 : 0;
        s += hip.cycles > 1 ? 0.3 : 0; // explosive rep rate
        return s;
      }
      // Conventional / sumo deadlift: knee + hip both flex, trunk forward
      if (id.includes('deadlift')) {
        let s = 1.0;
        s += knee.range > 12 ? 0.3 : 0;
        s += hip.range > 15 ? 0.3 : 0;
        s += trunk.mean > 25 ? 0.2 : 0;
        s += corrKH > 0.4 ? 0.2 : 0;
        return s;
      }
      if (id === 'rack_pull') {
        let s = 1.0;
        s += knee.range < 15 ? 0.3 : 0; // partial ROM from rack
        s += hip.range > 10 ? 0.3 : 0;
        s += trunk.mean > 20 ? 0.2 : 0;
        return s;
      }
    }

    // ── standing.upper_push ────────────────────────────────────────────
    if (mc === 'upper_push') {
      // Raises: arms nearly straight, shoulder sweeps. Elbow stays extended.
      if (id.includes('raise')) {
        let s = 0.5;
        s += shoulder.range > 20 ? 0.5 : shoulder.range > 10 ? 0.2 : 0;
        s += elbow.mean > 130 ? 0.5 : elbow.mean > 110 ? 0.2 : 0;
        s += elbow.range < 15 ? 0.3 : 0; // arms stay straight-ish
        if (elbow.range > 30) s *= 0.4; // too much elbow bend = pressing
        return s;
      }
      // Push press: like OHP but with knee dip
      if (id === 'push_press') {
        let s = 1.0;
        s += knee.range > 8 ? 0.4 : 0; // leg drive
        s += shoulder.mean > 70 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.2 : 0;
        return s;
      }
      // Overhead / shoulder press family: elbow extends, shoulder high
      if (id.includes('press')) {
        let s = 1.0;
        s += elbow.range > 20 ? 0.4 : elbow.range > 12 ? 0.2 : 0;
        s += shoulder.mean > 70 ? 0.3 : 0;
        s += knee.range < 8 ? 0.2 : 0; // strict (no leg drive)
        return s;
      }
    }

    // ── standing.upper_pull ────────────────────────────────────────────
    if (mc === 'upper_pull') {
      // Shrugs: minimal ROM, shoulders elevate slightly, elbows straight
      if (id === 'shrug' || id === 'dumbbell_shrug' || id === 'cable_shrug') {
        let s = 0.5;
        s += shoulder.range < 15 ? 0.6 : 0;
        s += elbow.mean > 150 ? 0.5 : elbow.mean > 130 ? 0.2 : 0;
        s += elbow.range < 10 ? 0.3 : 0;
        if (elbow.range > 20) s *= 0.3; // not a shrug if elbows bend
        return s;
      }
      // Rear delt flies / pull-aparts: arms extended, shoulder abduction
      if (id.includes('rear_delt') || id === 'band_pull_apart') {
        let s = 0.5;
        s += shoulder.range > 15 ? 0.5 : 0;
        s += elbow.mean > 120 ? 0.4 : 0;
        s += elbow.range < 15 ? 0.2 : 0; // arms stay straight-ish
        return s;
      }
      // Face pull: elbows high, shoulders elevated
      if (id === 'face_pull') {
        let s = 1.0;
        s += shoulder.mean > 60 ? 0.3 : 0;
        s += elbow.mean > 80 ? 0.2 : 0;
        s += elbow.range > 10 ? 0.2 : 0;
        return s;
      }
      // Upright row: elbows rise to sides, shoulders below horizontal
      if (id === 'upright_row') {
        let s = 1.0;
        s += shoulder.mean < 70 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.2 : 0;
        s += shoulder.range > 15 ? 0.2 : 0;
        return s;
      }
      // Pendlay row: trunk nearly horizontal, explosive
      if (id === 'pendlay_row') {
        let s = 0.5;
        s += trunk.mean > 50 ? 0.6 : trunk.mean > 40 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.3 : 0;
        if (trunk.mean < 35) s *= 0.3;
        return s;
      }
      // Generic rows: bent-over trunk, elbow flexion
      if (id.includes('row')) {
        let s = 1.0;
        s += trunk.mean > 30 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.3 : 0;
        return s;
      }
    }

    // ── standing.upper_isolation ────────────────────────────────────────
    if (mc === 'upper_isolation') {
      // Curls: elbow flexion, shoulder stays still, arm at side
      if (id.includes('curl') || id === 'hammer_curl' || id === 'drag_curl') {
        let s = 1.0;
        s += elbow.range > 20 ? 0.4 : elbow.range > 12 ? 0.2 : 0;
        s += shoulder.range < 15 ? 0.3 : 0;
        s += shoulder.mean < 40 ? 0.2 : 0; // arm at side
        if (shoulder.range > 25) s *= 0.5; // too much shoulder = not isolation
        return s;
      }
      // Tricep pushdown / rope pushdown: elbow extension, shoulder static, arm at side
      if (id.includes('pushdown') || id === 'rope_pushdown' || id === 'kickback' || id === 'cable_kickback') {
        let s = 1.0;
        s += elbow.range > 15 ? 0.4 : 0;
        s += shoulder.range < 15 ? 0.3 : 0;
        s += shoulder.mean < 40 ? 0.2 : 0;
        return s;
      }
      // Overhead tricep extension: shoulder elevated, elbow ROM
      if (id === 'tricep_extension' || id === 'overhead_cable_tricep') {
        let s = 0.5;
        s += shoulder.mean > 100 ? 0.6 : shoulder.mean > 80 ? 0.3 : 0;
        s += elbow.range > 15 ? 0.4 : 0;
        if (shoulder.mean < 60) s *= 0.3;
        return s;
      }
      // Cable crossover / fly: shoulder dominant, wide arc, elbows mostly extended
      if (id.includes('cable') || id.includes('crossover') || id.includes('fly')) {
        let s = 1.0;
        s += shoulder.range > 20 ? 0.3 : 0;
        s += elbow.mean > 110 ? 0.2 : 0;
        return s;
      }
    }

    return 1.0;
  }

  _scoreHangingLeaf(id, f) {
    const { elbow, hip, knee } = f;
    if (id === 'dead_hang') return elbow.range < 10 ? 2.0 : 0.3;
    if (id === 'l_sit') return hip.mean < 100 && hip.range < 10 ? 1.5 : 0.5;
    if (id === 'toes_to_bar') return hip.range > 25 ? 1.3 : 0.7;
    if (id === 'hanging_leg_raise' || id === 'hanging_knee_raise') return hip.range > 20 ? 1.2 : 0.8;
    if (id === 'chin_up') return elbow.mean < 120 ? 1.2 : 0.8;
    if (id === 'muscle_up') return elbow.range > 30 ? 1.3 : 0.7;
    if (id.includes('pull_up')) return elbow.range > 15 ? 1.2 : 0.8;
    return 1.0;
  }

  _scoreProneLeaf(id, f) {
    const { elbow, trunk, hip, shoulder } = f;
    if (id === 'plank' || id === 'side_plank') return trunk.range < 8 && elbow.range < 10 ? 2.0 : 0.5;
    if (id === 'superman') return hip.range > 10 ? 1.3 : 0.7;
    if (id === 'diamond_push_up') return elbow.mean < 90 ? 1.3 : 0.8;
    if (id === 'pike_push_up') return shoulder.mean > 90 ? 1.3 : 0.8;
    if (id.includes('push_up')) return elbow.range > 20 ? 1.2 : 0.8;
    if (id.includes('back_extension') || id === 'reverse_hyperextension') return trunk.range > 10 ? 1.2 : 0.8;
    return 1.0;
  }

  _scoreSupineLeaf(id, f) {
    const { elbow, shoulder, hip, knee, trunk } = f;
    if (id === 'hip_thrust' || id === 'single_leg_hip_thrust') return hip.range > 20 ? 1.3 : 0.7;
    if (id === 'glute_bridge') return hip.range > 15 && hip.mean > 130 ? 1.3 : 0.7;
    if (id === 'skull_crusher') return shoulder.mean > 70 ? 1.3 : 0.7;
    if (id === 'dumbbell_fly') return shoulder.range > 20 && elbow.mean > 130 ? 1.3 : 0.7;
    if (id === 'close_grip_bench') return shoulder.mean < 40 ? 1.2 : 0.8;
    if (id.includes('bench_press') || id.includes('dumbbell_press')) return elbow.range > 15 ? 1.2 : 0.8;
    if (id === 'sit_up') return trunk.range > 15 ? 1.3 : 0.7;
    if (id === 'crunch') return trunk.range > 8 && trunk.range < 25 ? 1.3 : 0.7;
    if (id === 'v_up') return hip.range > 15 ? 1.3 : 0.7;
    if (id === 'flutter_kick') return hip.range > 5 && hip.range < 20 ? 1.3 : 0.7;
    if (id === 'hollow_body_hold') return trunk.range < 8 && shoulder.mean > 140 ? 1.5 : 0.5;
    return 1.0;
  }

  // =========================================================================
  // Prior and model application
  // =========================================================================

  _applyPriors() {
    if (this._candidates.length === 0 || !this._context || !this._movementClass) return;
    const key = `${this._context}:${this._movementClass}`;
    const priors = this._priors[key];
    if (!priors) return;

    const totalPrior = Object.values(priors).reduce((s, v) => s + v, 0);
    if (totalPrior === 0) return;

    // Blend: 80% feature score + 20% prior
    for (const c of this._candidates) {
      const priorCount = priors[c.id] || 0;
      const priorScore = priorCount / totalPrior;
      c.score = c.score * 0.8 + priorScore * 0.2;
    }

    this._candidates.sort((a, b) => b.score - a.score);
  }

  _applyModelScores(features) {
    if (!this._onModelPredict || this._candidates.length === 0) return;
    try {
      const scores = this._onModelPredict(features, this._candidates.map(c => c.id));
      if (!scores) return;
      // Blend: 60% feature + 40% model
      for (let i = 0; i < this._candidates.length; i++) {
        const modelScore = scores[this._candidates[i].id] || 0;
        this._candidates[i].score = this._candidates[i].score * 0.6 + modelScore * 0.4;
      }
      this._candidates.sort((a, b) => b.score - a.score);
    } catch { /* model failure is silent */ }
  }
}
