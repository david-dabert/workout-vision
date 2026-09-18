/**
 * State Machine Rep Counter — Hysteresis-based phase detection.
 *
 * Replaces valley counting with a biomechanically grounded state machine.
 * Instead of finding local minima in a noisy signal, models the actual
 * movement phases: REST → DESCENDING → BOTTOM → ASCENDING → REST.
 *
 * Why hysteresis works:
 *   Valley detection needs hand-tuned parameters per exercise (minSpacing,
 *   amplitudeRatio, prominence). The state machine uses TWO thresholds with
 *   a dead zone between them. The signal must cross through both bands to
 *   count a rep. This naturally prevents:
 *     - Jitter-induced double counting (noise stays within the dead zone)
 *     - Missed reps from strict minSpacing (no timing constraint needed)
 *     - Phantom reps from shallow oscillations (must reach the bottom band)
 *
 * References:
 *   - FormFit (github.com/anirudhleetcode-max/formfit): angle state machine
 *   - Squat-Detection-Rep-Counter: hysteresis gap pattern
 *   - PoseRAC (arXiv 2303.08450): two canonical poses per cycle
 *
 * The signal MUST be oriented so that valleys = reps (invert upstream
 * for exercises where peaks = reps). This is already handled by
 * adaptiveSignalSelect.
 */

import type { Cycle } from './types';

// ---------------------------------------------------------------------------
// One-Euro Filter — Adaptive low-pass for joint angle signals
//
// Cazenave J, 2012, "1€ Filter: A Simple Speed-based Low-pass Filter"
//
// Standard moving average has a fixed tradeoff: wide window = less jitter
// but lagged peaks. The One-Euro filter adapts: heavy smoothing when the
// signal is slow (suppresses jitter), light smoothing when fast (preserves
// peaks/valleys). This matters for rep counting because we need both:
// stable signal between reps AND sharp transitions at phase boundaries.
// ---------------------------------------------------------------------------

function oneEuroAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export function oneEuroFilter(
  signal: number[],
  fps: number,
  minCutoff = 1.0,
  beta = 0.007,
  dCutoff = 1.0,
): number[] {
  const N = signal.length;
  if (N < 2) return [...signal];
  const dt = 1 / fps;
  const out = new Array<number>(N);
  out[0] = signal[0];
  let xPrev = signal[0];
  let dxPrev = 0;

  for (let i = 1; i < N; i++) {
    const dx = (signal[i] - xPrev) / dt;
    const aDeriv = oneEuroAlpha(dCutoff, dt);
    const dxFiltered = aDeriv * dx + (1 - aDeriv) * dxPrev;

    const cutoff = minCutoff + beta * Math.abs(dxFiltered);
    const aSignal = oneEuroAlpha(cutoff, dt);
    const xFiltered = aSignal * signal[i] + (1 - aSignal) * xPrev;

    out[i] = xFiltered;
    xPrev = xFiltered;
    dxPrev = dxFiltered;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Percentile helper — robust min/max estimation
// ---------------------------------------------------------------------------

function percentile(signal: number[], p: number): number {
  const sorted = [...signal].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// State Machine Rep Counter
// ---------------------------------------------------------------------------

type Phase = 'above' | 'descending' | 'below' | 'ascending';

export interface StateMachineCycle {
  /** Frame where signal left the upper band (start of descent) */
  startFrame: number;
  /** Frame where signal reached its deepest point */
  bottomFrame: number;
  /** Frame where signal returned to the upper band (rep complete) */
  endFrame: number;
  /** Minimum signal value during this cycle */
  minValue: number;
  /** Maximum signal value (at start or end of cycle) */
  maxValue: number;
}

export interface StateMachineResult {
  reps: number;
  cycles: Cycle[];
  valleyFrames: number[];
  signalRange: number;
  [key: string]: unknown;
}

/**
 * Count reps using a hysteresis state machine.
 *
 * Derives adaptive thresholds from the signal's own range (5th/95th
 * percentile) rather than hardcoded exercise parameters. This separates
 * concerns: rep counting detects cycles regardless of ROM quality;
 * form checks (in scoring.ts) assess whether each rep met required ROM.
 *
 * @param signal - Smoothed signal where valleys = reps
 * @param fps - Frames per second
 * @param hysteresisFraction - Dead zone as fraction of range. Default 0.15.
 *   Higher = more noise rejection but may miss shallow reps.
 *   Lower = more sensitive but may double-count.
 *   0.15 is calibrated to MediaPipe's typical joint angle jitter (~3-5°)
 *   relative to typical exercise ROM (~60-100°): 5/80 ≈ 0.06, so 0.15
 *   provides 2.5× safety margin.
 */
export function countRepsStateMachine(
  signal: number[],
  fps: number,
  hysteresisFraction = 0.15,
): StateMachineResult {
  const N = signal.length;
  if (N < 6) return { reps: 0, cycles: [], valleyFrames: [], signalRange: 0 };

  // Robust range estimation: 5th/95th percentile avoids outlier frames
  // from setup motion, camera adjustments, or pose estimation glitches.
  const lo = percentile(signal, 0.05);
  const hi = percentile(signal, 0.95);
  const range = hi - lo;
  if (range < 3) return { reps: 0, cycles: [], valleyFrames: [], signalRange: range };

  const mid = (hi + lo) / 2;
  const halfGap = range * hysteresisFraction;
  const upperBand = mid + halfGap;
  const lowerBand = mid - halfGap;

  // Minimum rep duration: 0.3s prevents physiologically impossible reps.
  // No upper limit — variable tempo is fine.
  const minRepFrames = Math.max(2, Math.round(fps * 0.3));

  let state: Phase = signal[0] > upperBand ? 'above' : 'below';
  const rawCycles: StateMachineCycle[] = [];

  let repStartFrame = 0;
  let bottomFrame = 0;
  let bottomValue = signal[0];
  let peakValue = signal[0];

  for (let i = 1; i < N; i++) {
    const v = signal[i];

    switch (state) {
      case 'above':
        // In rest position. Track peak value.
        if (v > peakValue) peakValue = v;
        if (v < upperBand) {
          // Crossed below upper band — start descending
          state = 'descending';
          repStartFrame = i;
          bottomFrame = i;
          bottomValue = v;
        }
        break;

      case 'descending':
        // Moving toward bottom. Track deepest point.
        if (v < bottomValue) {
          bottomFrame = i;
          bottomValue = v;
        }
        if (v <= lowerBand) {
          // Reached the bottom band — confirm we're in the bottom zone
          state = 'below';
        }
        if (v > upperBand) {
          // Went back up without reaching bottom — false start, reset
          state = 'above';
          peakValue = v;
        }
        break;

      case 'below':
        // In the bottom zone. Track deepest point.
        if (v < bottomValue) {
          bottomFrame = i;
          bottomValue = v;
        }
        if (v > lowerBand) {
          // Started ascending out of bottom zone
          state = 'ascending';
        }
        break;

      case 'ascending':
        // Moving back toward rest position.
        if (v < bottomValue) {
          // Dipped back down — false ascent
          bottomFrame = i;
          bottomValue = v;
          state = 'below';
        } else if (v > upperBand) {
          // Crossed back above upper band — rep complete!
          const duration = i - repStartFrame;
          if (duration >= minRepFrames) {
            rawCycles.push({
              startFrame: repStartFrame,
              bottomFrame,
              endFrame: i,
              minValue: bottomValue,
              maxValue: Math.max(peakValue, v),
            });
          }
          state = 'above';
          peakValue = v;
          bottomValue = v;
        }
        break;
    }
  }

  // Convert to Cycle[] format expected by scoring.ts
  const cycles: Cycle[] = rawCycles.map(rc => ({
    start: rc.startFrame,
    end: rc.endFrame,
    min: rc.minValue,
    max: rc.maxValue,
    amplitude: rc.maxValue - rc.minValue,
    duration: rc.endFrame - rc.startFrame,
  }));

  const valleyFrames = rawCycles.map(rc => rc.bottomFrame);

  return {
    reps: rawCycles.length,
    cycles,
    valleyFrames,
    signalRange: range,
  };
}
