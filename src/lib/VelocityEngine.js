/**
 * VelocityEngine — The Physics Layer
 *
 * From position at 30fps, computes velocity, acceleration, jerk.
 * Detects concentric/eccentric phases from velocity sign changes.
 * Computes tempo, fatigue (velocity decay > 20%), power profile.
 *
 * Convergence items #2 (VBT) and #6 (concentric/eccentric detection).
 */

// ---------------------------------------------------------------------------
// Savitzky-Golay 1st derivative (5-point quadratic)
// Preserves peak shape better than finite differences
// ---------------------------------------------------------------------------

function savitzkyGolayDerivative(signal, dt) {
  const N = signal.length;
  if (N < 5) return new Array(N).fill(0);

  const out = new Array(N).fill(0);
  // 5-point SG first derivative coefficients: [-2, -1, 0, 1, 2] / (10 * dt)
  for (let i = 2; i < N - 2; i++) {
    out[i] = (-2 * signal[i - 2] - signal[i - 1] + signal[i + 1] + 2 * signal[i + 2]) / (10 * dt);
  }
  // Edge handling: simple finite differences
  if (N > 1) {
    out[0] = (signal[1] - signal[0]) / dt;
    out[1] = (signal[2] - signal[0]) / (2 * dt);
    out[N - 1] = (signal[N - 1] - signal[N - 2]) / dt;
    out[N - 2] = (signal[N - 1] - signal[N - 3]) / (2 * dt);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase detection: concentric / eccentric / isometric
// ---------------------------------------------------------------------------

function detectPhases(velocity, minVelocityThreshold = 0.005) {
  const phases = [];
  for (let i = 0; i < velocity.length; i++) {
    const v = velocity[i];
    if (Math.abs(v) < minVelocityThreshold) {
      phases.push('isometric');
    } else if (v > 0) {
      // Positive velocity = concentric (moving against gravity / shortening)
      // Convention: for Y-axis signals, negative Y = up = concentric
      // The caller should invert the signal if needed
      phases.push('concentric');
    } else {
      phases.push('eccentric');
    }
  }
  return phases;
}

// ---------------------------------------------------------------------------
// Segment phases into continuous blocks
// ---------------------------------------------------------------------------

function segmentPhases(phases) {
  if (phases.length === 0) return [];
  const segments = [];
  let currentPhase = phases[0];
  let start = 0;

  for (let i = 1; i <= phases.length; i++) {
    if (i === phases.length || phases[i] !== currentPhase) {
      segments.push({ phase: currentPhase, start, end: i - 1, duration: i - start });
      if (i < phases.length) {
        currentPhase = phases[i];
        start = i;
      }
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// VelocityEngine class
// ---------------------------------------------------------------------------

export class VelocityEngine {
  /**
   * @param {number} fps - frames per second of the signal
   */
  constructor(fps = 30) {
    this._fps = fps;
    this._dt = 1 / fps;
  }

  /**
   * Analyze a signal (e.g., primary joint angle or Y-position over time).
   * Returns velocity, acceleration, phases, tempo, fatigue, and power metrics.
   *
   * @param {number[]} signal - time series of values (angles or positions)
   * @param {number} [weightKg=0] - external load in kg (for power calculation)
   * @param {boolean} [invertForConcentric=false] - if true, negative velocity = concentric
   * @returns {VelocityAnalysis}
   */
  analyze(signal, weightKg = 0, invertForConcentric = false) {
    const N = signal.length;
    if (N < 5) return this._emptyResult();

    // Compute derivatives
    const velocity = savitzkyGolayDerivative(signal, this._dt);
    const acceleration = savitzkyGolayDerivative(velocity, this._dt);
    const jerk = savitzkyGolayDerivative(acceleration, this._dt);

    // Optionally invert velocity so concentric is always positive
    const signedVelocity = invertForConcentric
      ? velocity.map(v => -v)
      : velocity;

    // Detect phases
    const minThreshold = this._estimateNoiseFloor(signedVelocity) * 2;
    const phases = detectPhases(signedVelocity, minThreshold);
    const segments = segmentPhases(phases);

    // Extract rep-level metrics from phase segments
    const repMetrics = this._extractRepMetrics(segments, signedVelocity, signal);

    // Fatigue detection: compare first 2 reps' mean concentric velocity vs last 2
    const fatigue = this._computeFatigue(repMetrics);

    // Power estimation (simplified: P = F * v, F = mass * acceleration)
    const power = this._computePower(signedVelocity, acceleration, weightKg);

    // Smoothness: mean absolute jerk (lower = smoother)
    const meanAbsJerk = jerk.reduce((a, v) => a + Math.abs(v), 0) / N;

    return {
      velocity: signedVelocity,
      acceleration,
      jerk,
      phases,
      segments,
      repMetrics,
      fatigue,
      power,
      smoothness: 1 / (1 + meanAbsJerk), // 0-1, higher = smoother
      fps: this._fps,
    };
  }

  /**
   * Analyze per-rep velocity from rep boundaries.
   * More accurate when rep boundaries are already known from autocorrelation.
   *
   * @param {number[]} signal - time series
   * @param {Array<{startFrame, endFrame}>} repBoundaries
   * @param {number} weightKg
   * @returns {RepVelocityAnalysis[]}
   */
  analyzePerRep(signal, repBoundaries, weightKg = 0) {
    const results = [];

    for (const rep of repBoundaries) {
      const start = Math.max(0, rep.startFrame);
      const end = Math.min(signal.length - 1, rep.endFrame);
      if (end - start < 3) {
        results.push(null);
        continue;
      }

      const slice = signal.slice(start, end + 1);
      const vel = savitzkyGolayDerivative(slice, this._dt);

      // Find concentric phase (positive velocity peak region)
      let concentricStart = -1, concentricEnd = -1;
      let eccentricStart = -1, eccentricEnd = -1;

      // Simple approach: split rep at the velocity zero-crossing nearest to center
      const mid = Math.floor(vel.length / 2);
      let zeroCross = mid;
      for (let i = 1; i < vel.length - 1; i++) {
        if (vel[i] * vel[i + 1] <= 0) {
          if (Math.abs(i - mid) < Math.abs(zeroCross - mid)) {
            zeroCross = i;
          }
        }
      }

      // Determine which half is concentric based on mean velocity
      const firstHalfMeanVel = vel.slice(0, zeroCross).reduce((a, b) => a + b, 0) / Math.max(1, zeroCross);
      const secondHalfMeanVel = vel.slice(zeroCross).reduce((a, b) => a + b, 0) / Math.max(1, vel.length - zeroCross);

      let eccentricTime, concentricTime;
      if (Math.abs(firstHalfMeanVel) > Math.abs(secondHalfMeanVel)) {
        // First half has more movement — determine direction
        eccentricTime = zeroCross * this._dt;
        concentricTime = (vel.length - zeroCross) * this._dt;
      } else {
        eccentricTime = (vel.length - zeroCross) * this._dt;
        concentricTime = zeroCross * this._dt;
      }

      // Mean concentric velocity (absolute)
      const absVel = vel.map(Math.abs);
      const peakVelocity = Math.max(...absVel);
      const meanVelocity = absVel.reduce((a, b) => a + b, 0) / absVel.length;

      // Power: P = F * v ≈ weight * g * meanVelocity (for vertical movements)
      const peakPower = weightKg > 0 ? weightKg * 9.81 * peakVelocity : 0;
      const meanPower = weightKg > 0 ? weightKg * 9.81 * meanVelocity : 0;

      results.push({
        eccentricTime: Math.round(eccentricTime * 100) / 100,
        concentricTime: Math.round(concentricTime * 100) / 100,
        tempoRatio: concentricTime > 0 ? Math.round((eccentricTime / concentricTime) * 10) / 10 : 0,
        peakVelocity: Math.round(peakVelocity * 1000) / 1000,
        meanVelocity: Math.round(meanVelocity * 1000) / 1000,
        peakPowerW: Math.round(peakPower),
        meanPowerW: Math.round(meanPower),
      });
    }

    return results;
  }

  // ─── Private ───

  _emptyResult() {
    return {
      velocity: [], acceleration: [], jerk: [],
      phases: [], segments: [], repMetrics: [],
      fatigue: { detected: false, decay: 0, velocities: [] },
      power: { peakW: 0, meanW: 0 },
      smoothness: 0,
      fps: this._fps,
    };
  }

  _estimateNoiseFloor(velocity) {
    // Median absolute deviation of velocity
    const sorted = velocity.map(Math.abs).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.25)] || 0.001;
  }

  _extractRepMetrics(segments, velocity, signal) {
    // Group segments into rep cycles (eccentric → concentric pairs)
    const concentrics = segments.filter(s => s.phase === 'concentric');
    const eccentrics = segments.filter(s => s.phase === 'eccentric');

    return concentrics.map((c, i) => {
      const ecc = eccentrics[i] || null;
      const concentricVels = velocity.slice(c.start, c.end + 1);
      const meanConcentricVelocity = concentricVels.reduce((a, b) => a + Math.abs(b), 0) / concentricVels.length;
      const peakConcentricVelocity = Math.max(...concentricVels.map(Math.abs));

      return {
        concentricDuration: c.duration * (1 / this._fps),
        eccentricDuration: ecc ? ecc.duration * (1 / this._fps) : 0,
        meanConcentricVelocity,
        peakConcentricVelocity,
        tempoRatio: ecc ? (ecc.duration / c.duration) : 0,
      };
    });
  }

  _computeFatigue(repMetrics) {
    if (repMetrics.length < 4) {
      return { detected: false, decay: 0, velocities: repMetrics.map(r => r.meanConcentricVelocity) };
    }

    const velocities = repMetrics.map(r => r.meanConcentricVelocity);
    const firstTwo = (velocities[0] + velocities[1]) / 2;
    const lastTwo = (velocities[velocities.length - 2] + velocities[velocities.length - 1]) / 2;

    const decay = firstTwo > 0 ? 1 - (lastTwo / firstTwo) : 0;

    return {
      detected: decay > 0.20, // Baker's 20% threshold
      decay: Math.round(decay * 100) / 100,
      velocities: velocities.map(v => Math.round(v * 1000) / 1000),
      warning: decay > 0.20 ? 'Velocity loss >20% — consider ending set' : null,
    };
  }

  _computePower(velocity, acceleration, weightKg) {
    if (weightKg <= 0 || velocity.length === 0) {
      return { peakW: 0, meanW: 0 };
    }

    // P = F * v where F includes gravity and inertial component
    const powers = velocity.map((v, i) => {
      const force = weightKg * (9.81 + (acceleration[i] || 0));
      return Math.abs(force * v);
    });

    return {
      peakW: Math.round(Math.max(...powers)),
      meanW: Math.round(powers.reduce((a, b) => a + b, 0) / powers.length),
    };
  }
}
