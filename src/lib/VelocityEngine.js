/**
 * VelocityEngine — The Physics Layer
 *
 * From position at 30fps, computes velocity, acceleration, jerk.
 * Detects concentric/eccentric phases from velocity sign changes.
 * Computes tempo, fatigue (linear regression on rep velocities), angular velocity metrics.
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

    // Fatigue detection: linear regression on rep concentric velocities
    const fatigue = this._computeFatigue(repMetrics);

    // Angular velocity metrics (signal is in degrees, so velocity is deg/s)
    const power = this._computeAngularVelocityMetrics(signedVelocity);

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

      // Split eccentric and concentric phases using velocity sign.
      // Concentric = positive velocity frames, eccentric = negative velocity frames.
      let concentricFrames = 0;
      let eccentricFrames = 0;
      let concentricVelSum = 0;
      let eccentricVelSum = 0;
      let peakConcentricVel = 0;
      let peakEccentricVel = 0;

      for (let j = 0; j < vel.length; j++) {
        if (vel[j] > 0) {
          concentricFrames++;
          concentricVelSum += vel[j];
          if (vel[j] > peakConcentricVel) peakConcentricVel = vel[j];
        } else if (vel[j] < 0) {
          eccentricFrames++;
          eccentricVelSum += Math.abs(vel[j]);
          const absV = Math.abs(vel[j]);
          if (absV > peakEccentricVel) peakEccentricVel = absV;
        }
      }

      const eccentricTime = eccentricFrames * this._dt;
      const concentricTime = concentricFrames * this._dt;

      // Angular velocity metrics (deg/s)
      const absVel = vel.map(Math.abs);
      const peakAngularVelocity = Math.max(...absVel);
      const meanAngularVelocity = absVel.reduce((a, b) => a + b, 0) / absVel.length;

      results.push({
        eccentricTime: Math.round(eccentricTime * 100) / 100,
        concentricTime: Math.round(concentricTime * 100) / 100,
        tempoRatio: concentricTime > 0 ? Math.round((eccentricTime / concentricTime) * 10) / 10 : 0,
        peakVelocity: Math.round(peakAngularVelocity * 1000) / 1000,
        meanVelocity: Math.round(meanAngularVelocity * 1000) / 1000,
        peakAngularVelocity: Math.round(peakAngularVelocity * 1000) / 1000,
        meanAngularVelocity: Math.round(meanAngularVelocity * 1000) / 1000,
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
      power: { peakAngularVelocity: 0, meanAngularVelocity: 0, unit: 'deg/s' },
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
    const velocities = repMetrics.map(r => r.meanConcentricVelocity);

    if (velocities.length < 3) {
      return { detected: false, decay: 0, slope: 0, velocities: velocities.map(v => Math.round(v * 1000) / 1000) };
    }

    // Linear regression on rep velocities: y = mx + b
    // slope m < 0 means velocity is declining (fatigue)
    const n = velocities.length;
    const sumX = velocities.reduce((s, _, i) => s + i, 0);
    const sumY = velocities.reduce((s, v) => s + v, 0);
    const sumXY = velocities.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = velocities.reduce((s, _, i) => s + i * i, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const meanVel = sumY / n;
    const decay = meanVel > 0 ? -slope / meanVel : 0; // normalized decay rate per rep

    return {
      detected: decay > 0.20, // Baker's 20% threshold
      decay: Math.round(decay * 100) / 100,
      slope: Math.round(slope * 10000) / 10000,
      velocities: velocities.map(v => Math.round(v * 1000) / 1000),
      warning: decay > 0.20 ? 'Velocity loss exceeded 20% across the set' : null,
    };
  }

  _computeAngularVelocityMetrics(velocity) {
    if (velocity.length === 0) {
      return { peakAngularVelocity: 0, meanAngularVelocity: 0, unit: 'deg/s' };
    }

    const absVel = velocity.map(Math.abs);
    const peakAngularVelocity = Math.round(Math.max(...absVel) * 1000) / 1000;
    const meanAngularVelocity = Math.round(
      (absVel.reduce((a, b) => a + b, 0) / absVel.length) * 1000
    ) / 1000;

    return { peakAngularVelocity, meanAngularVelocity, unit: 'deg/s' };
  }
}
