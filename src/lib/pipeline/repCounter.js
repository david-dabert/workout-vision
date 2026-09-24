/**
 * Layer 3: Finite State Machine Rep Counter
 *
 * Explicit FSM with states: IDLE -> ECCENTRIC -> CONCENTRIC -> IDLE (one rep)
 *
 * State transitions ONLY when:
 *   - Angle crosses threshold with hysteresis (minimum depth before transition)
 *   - Minimum time T_min elapsed since last transition (prevents double-counting)
 *   - Maximum time T_max not exceeded (prevents stuck states)
 *
 * This module is testable in isolation with just a JSON array of angles.
 * No dependencies on MediaPipe, DOM, React, or any external library.
 */

// ============================================================================
// FSM States
// ============================================================================

const STATE = {
  IDLE: 'IDLE',
  ECCENTRIC: 'ECCENTRIC',     // Moving toward bottom position
  CONCENTRIC: 'CONCENTRIC',   // Moving back to top position
};

// ============================================================================
// Per-exercise configuration
// ============================================================================

/**
 * Exercise-specific FSM configuration.
 *
 * - joint: which signal to track (matches kinematicEngine output)
 * - direction: 'down' means the signal DECREASES during eccentric phase
 *              'up' means the signal INCREASES during eccentric phase
 * - downThreshold: angle below which we consider "in the bottom"
 * - upThreshold: angle above which we consider "at the top"
 * - hysteresis: minimum angle change required to confirm a transition
 * - T_min: minimum time between state transitions (seconds)
 * - T_max: maximum time in one state before forcing transition (seconds)
 */
const EXERCISE_CONFIG = {
  bench_press: {
    direction: 'down',
    downThreshold: 95,
    upThreshold: 135,
    hysteresis: 15,
    T_min: 0.5,
    T_max: 8.0,
  },
  bicep_curl: {
    direction: 'down',
    downThreshold: 95,
    upThreshold: 130,
    hysteresis: 20,
    T_min: 0.4,
    T_max: 6.0,
  },
  lat_pulldown: {
    direction: 'down',
    downThreshold: 60,
    upThreshold: 110,
    hysteresis: 20,
    T_min: 0.5,
    T_max: 8.0,
  },
  lateral_raise: {
    direction: 'up',
    downThreshold: 45,
    upThreshold: 65,
    hysteresis: 10,
    T_min: 0.4,
    T_max: 6.0,
  },
  overhead_press: {
    direction: 'down',
    downThreshold: 110,
    upThreshold: 150,
    hysteresis: 15,
    T_min: 0.5,
    T_max: 8.0,
  },
};

/**
 * Get the FSM config for an exercise.
 * @param {string} exerciseName
 * @returns {Object}
 */
export function getRepCounterConfig(exerciseName) {
  return EXERCISE_CONFIG[exerciseName] || {
    direction: 'down',
    downThreshold: 90,
    upThreshold: 140,
    hysteresis: 15,
    T_min: 0.5,
    T_max: 8.0,
  };
}

// ============================================================================
// Main rep counting function (pure, stateless)
// ============================================================================

/**
 * Count reps from a smoothed angle signal using a finite state machine.
 *
 * @param {number[]} signal - Smoothed angle time series (from kinematicEngine)
 * @param {string} exerciseName - Exercise key
 * @param {number} fps - Frames per second (default 30)
 * @returns {Object} { count, reps: RepData[], confidence }
 *
 * RepData: { startFrame, peakFrame, valleyFrame, endFrame, peakAngle, valleyAngle, duration }
 */
export function countReps(signal, exerciseName, fps = 30) {
  if (!signal || signal.length < 6) {
    return { count: 0, reps: [], confidence: 0 };
  }

  const config = getRepCounterConfig(exerciseName);
  const dt = 1 / fps;
  const minFrames = Math.max(1, Math.round(config.T_min * fps));
  const maxFrames = Math.round(config.T_max * fps);

  // For 'up' direction exercises (like lateral raise), we invert the signal
  // so the FSM always works in 'down = eccentric' mode
  const isUpDirection = config.direction === 'up';
  const workSignal = isUpDirection ? signal.map(v => -v) : signal;
  const workDown = isUpDirection ? -config.upThreshold : config.downThreshold;
  const workUp = isUpDirection ? -config.downThreshold : config.upThreshold;
  const workHysteresis = config.hysteresis;

  let state = STATE.IDLE;
  let framesSinceTransition = 0;
  let repStartFrame = 0;
  let peakFrame = 0;
  let peakValue = -Infinity;
  let valleyFrame = 0;
  let valleyValue = Infinity;
  let lastTransitionFrame = 0;

  const reps = [];

  // Initial state: determine if we're starting at the top or bottom
  const initialValue = workSignal[0];
  const midpoint = (workDown + workUp) / 2;

  for (let i = 0; i < workSignal.length; i++) {
    const value = workSignal[i];
    framesSinceTransition = i - lastTransitionFrame;

    // Track peaks and valleys within current phase
    if (value > peakValue) {
      peakValue = value;
      peakFrame = i;
    }
    if (value < valleyValue) {
      valleyValue = value;
      valleyFrame = i;
    }

    // Force transition out of stuck state
    if (framesSinceTransition > maxFrames && state !== STATE.IDLE) {
      state = STATE.IDLE;
      lastTransitionFrame = i;
      peakValue = value;
      peakFrame = i;
      valleyValue = value;
      valleyFrame = i;
      continue;
    }

    switch (state) {
      case STATE.IDLE:
        // Wait for the signal to cross below the down threshold (entering eccentric)
        if (value <= workDown && framesSinceTransition >= minFrames) {
          state = STATE.ECCENTRIC;
          lastTransitionFrame = i;
          repStartFrame = peakFrame; // Rep started at the last peak
          valleyValue = value;
          valleyFrame = i;
        }
        // Also track: if we see clear downward movement from a peak
        if (peakValue - value >= workHysteresis && value < workUp && framesSinceTransition >= minFrames) {
          state = STATE.ECCENTRIC;
          lastTransitionFrame = i;
          repStartFrame = peakFrame;
          valleyValue = value;
          valleyFrame = i;
        }
        break;

      case STATE.ECCENTRIC:
        // Moving downward, tracking the valley
        if (value < valleyValue) {
          valleyValue = value;
          valleyFrame = i;
        }
        // Transition to CONCENTRIC when signal rises by hysteresis amount from valley
        if (value - valleyValue >= workHysteresis && framesSinceTransition >= minFrames) {
          state = STATE.CONCENTRIC;
          lastTransitionFrame = i;
          peakValue = value;
          peakFrame = i;
        }
        break;

      case STATE.CONCENTRIC:
        // Moving upward, tracking the peak
        if (value > peakValue) {
          peakValue = value;
          peakFrame = i;
        }
        // Transition to IDLE (one rep complete) when signal reaches up threshold
        // OR when we've risen enough from the valley
        if ((value >= workUp || peakValue >= workUp) && framesSinceTransition >= minFrames) {
          // One rep completed
          const rep = buildRepData(
            repStartFrame, peakFrame, valleyFrame, i,
            signal, isUpDirection, fps
          );
          reps.push(rep);

          state = STATE.IDLE;
          lastTransitionFrame = i;
          peakValue = value;
          peakFrame = i;
          valleyValue = value;
          valleyFrame = i;
        }
        break;
    }
  }

  // Check for a final incomplete rep: if we're in CONCENTRIC and close to the top
  if (state === STATE.CONCENTRIC && peakValue >= (workUp - workHysteresis)) {
    const rep = buildRepData(
      repStartFrame, peakFrame, valleyFrame, workSignal.length - 1,
      signal, isUpDirection, fps
    );
    reps.push(rep);
  }

  // Compute confidence based on consistency of rep durations
  const confidence = computeConfidence(reps, fps);

  return {
    count: reps.length,
    reps,
    confidence,
  };
}

// ============================================================================
// Helper functions (pure)
// ============================================================================

function buildRepData(startFrame, peakFrame, valleyFrame, endFrame, originalSignal, isInverted, fps) {
  const peakAngle = originalSignal[peakFrame];
  const valleyAngle = originalSignal[valleyFrame];
  const duration = (endFrame - startFrame) / fps;

  return {
    startFrame,
    peakFrame,
    valleyFrame,
    endFrame,
    peakAngle: Math.round(peakAngle * 10) / 10,
    valleyAngle: Math.round(valleyAngle * 10) / 10,
    duration: Math.round(duration * 100) / 100,
    rom: Math.round(Math.abs(peakAngle - valleyAngle) * 10) / 10,
    timestamp: startFrame / fps,
  };
}

function computeConfidence(reps, fps) {
  if (reps.length === 0) return 0;
  if (reps.length === 1) return 0.5;

  // Consistency of rep durations (coefficient of variation)
  const durations = reps.map(r => r.duration);
  const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
  if (mean === 0) return 0.3;

  const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length;
  const cv = Math.sqrt(variance) / mean;

  // CV < 0.2 = very consistent (confidence 0.9+)
  // CV < 0.5 = moderate consistency (confidence 0.6+)
  // CV > 0.5 = poor consistency (confidence 0.3+)
  const confidence = Math.max(0.3, Math.min(1.0, 1.0 - cv));

  return Math.round(confidence * 100) / 100;
}

/**
 * Count reps from raw angle array (convenience function for testing).
 * Applies no filtering; expects pre-filtered input.
 *
 * @param {number[]} angles - Array of angle values at 30fps
 * @param {string} exerciseName - Exercise key
 * @returns {Object} { count, reps, confidence }
 */
export function countRepsFromAngles(angles, exerciseName) {
  return countReps(angles, exerciseName, 30);
}
