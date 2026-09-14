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
    if (this._confidence >= AUTOLOCK_CONFIDENCE && this._margin >= AUTOLOCK_MARGIN) {
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

    // Seated: hips flexed (<130 mean) with low hip range
    if (hip.mean < 130 && hip.range < 20 && knee.mean < 140) return 'seated';

    // Hanging: shoulders very elevated, knees above hips range
    if (shoulder.mean > 140 && knee.mean > 100) return 'hanging';

    // Prone: trunk near horizontal (< 20), hips extended
    if (trunk.mean < 20 && hip.mean > 140) return 'prone';

    // Supine: trunk near horizontal + low hip range + elbows active
    if (trunk.mean < 20 && hip.mean > 130 && knee.range < 15 && elbow.range > 10) return 'supine';
    if (trunk.mean < 25 && hip.range > 15 && knee.mean > 70 && knee.mean < 130) return 'supine';

    // Supported (dip-like): mid-trunk, elbow+shoulder ROM
    if (elbow.range > 25 && shoulder.range > 15 && trunk.mean > 10 && trunk.mean < 40
        && knee.mean > 100) return 'supported';

    // Standing: knees and hips extended
    if (knee.mean > 130 && hip.mean > 130) return 'standing';

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

    return Math.max(0.01, score);
  }

  _scoreSeatedLeaf(id, f, mc) {
    const { knee, hip, elbow, shoulder, trunk } = f;

    if (mc === 'lower_push') {
      if (id === 'leg_press' || id === 'single_leg_press') {
        // Leg press: large knee + hip ROM, no arm movement
        return knee.range > 20 && hip.range > 15 ? 2.0 : 0.5;
      }
      if (id === 'leg_extension') {
        // Leg extension: knee extends, hip stays, dwell at extended position
        return knee.range > 10 && hip.range < 10 && knee.dwellHigh > 0.1 ? 2.0 : 0.5;
      }
    }

    if (mc === 'lower_pull') {
      if (id === 'leg_curl' || id === 'lying_leg_curl') {
        // Leg curl: knee flexes, dwell at flexed position
        return knee.range > 10 && knee.dwellLow > 0.1 ? 2.0 : 0.5;
      }
    }

    if (mc === 'upper_horizontal') {
      // Cannot distinguish push vs pull from pose alone
      // Use dwell patterns as weak signal
      if (id === 'seated_row' || id === 'machine_row' || id === 'cable_row_single') {
        return elbow.dwellLow > 0.1 ? 1.2 : 1.0;
      }
      if (id === 'machine_chest_press') {
        return elbow.dwellHigh > 0.1 ? 1.2 : 1.0;
      }
      return 1.0; // All equally likely
    }

    if (mc === 'upper_vertical') {
      if (id === 'lat_pulldown' || id === 'straight_arm_pulldown') {
        return shoulder.mean > 80 ? 1.5 : 0.5;
      }
      return 1.0;
    }

    if (mc === 'lower_isolation') {
      if (id === 'adductor_machine' || id === 'abductor_machine') return 1.0;
      if (id === 'seated_calf_raise') return knee.range < 5 ? 1.5 : 0.5;
    }

    return 1.0;
  }

  _scoreStandingLeaf(id, f, mc) {
    const { knee, hip, elbow, shoulder, trunk } = f;

    if (mc === 'lower_push') {
      const kneeAsym = Math.abs((f.knee.values?.[0] || 0) - (f.knee.values?.[1] || 0));
      if (id.includes('lunge') || id === 'bulgarian_split_squat' || id === 'step_up' || id === 'curtsy_lunge') {
        return kneeAsym > 20 ? 1.5 : 0.5;
      }
      if (id === 'calf_raise' || id.includes('calf')) {
        return knee.range < 10 && hip.range < 10 ? 1.5 : 0.3;
      }
      if (id === 'overhead_squat') return shoulder.mean > 130 ? 1.5 : 0.3;
      if (id === 'front_squat') return trunk.mean < 30 ? 1.3 : 0.8;
      if (id.includes('squat')) return knee.range > 25 ? 1.2 : 0.8;
    }

    if (mc === 'lower_pull') {
      if (id === 'good_morning') return knee.range < 10 ? 1.5 : 0.5;
      if (id === 'romanian_deadlift' || id === 'stiff_leg_deadlift') return knee.range < 15 ? 1.3 : 0.7;
      if (id === 'kettlebell_swing' || id === 'cable_pull_through') {
        return hip.range > 30 && shoulder.range > 30 ? 1.3 : 0.7;
      }
      if (id.includes('deadlift')) return knee.range > 10 ? 1.2 : 0.8;
    }

    if (mc === 'upper_push') {
      if (id.includes('raise')) {
        return shoulder.range > 20 && elbow.mean > 120 ? 1.3 : 0.7;
      }
      if (id === 'push_press') return knee.range > 10 ? 1.3 : 0.7;
      if (id.includes('press')) return elbow.range > 20 && shoulder.mean > 60 ? 1.2 : 0.8;
    }

    if (mc === 'upper_pull') {
      if (id === 'shrug' || id === 'dumbbell_shrug' || id === 'cable_shrug') {
        return shoulder.range < 15 && elbow.mean > 150 ? 1.5 : 0.5;
      }
      if (id.includes('rear_delt') || id === 'band_pull_apart') {
        return shoulder.range > 15 && elbow.mean > 120 ? 1.3 : 0.7;
      }
      if (id === 'face_pull') return shoulder.mean > 60 ? 1.2 : 0.8;
      if (id === 'upright_row') return shoulder.mean < 60 ? 1.2 : 0.8;
      if (id === 'pendlay_row') return trunk.mean > 55 ? 1.3 : 0.7;
      if (id.includes('row')) return trunk.mean > 30 ? 1.2 : 0.8;
    }

    if (mc === 'upper_isolation') {
      if (id.includes('curl') || id === 'hammer_curl') {
        return elbow.range > 15 && shoulder.range < 15 ? 1.3 : 0.7;
      }
      if (id.includes('tricep') || id.includes('pushdown') || id === 'kickback') {
        return elbow.range > 15 && shoulder.mean < 30 ? 1.3 : 0.7;
      }
      if (id === 'tricep_extension') return shoulder.mean > 100 ? 1.3 : 0.7;
      if (id.includes('cable') || id.includes('crossover') || id.includes('fly')) {
        return shoulder.range > 15 ? 1.2 : 0.8;
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
