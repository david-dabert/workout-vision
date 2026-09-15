/**
 * Internal types for the rep counting engine.
 * These are not part of the public API — use ../types.ts for shared types.
 */

import type { LandmarkArray, JointAngles, RepHistoryEntry, FormResultEntry } from '../types';

/** Exercise definition with compiled getValue/formChecks (from untyped exercises.js) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Exercise = any;

/** Valley counting result from valleyCounter.js */
export interface ValleyResult {
  reps: number;
  valleyFrames: number[];
  signalRange: number;
  [key: string]: unknown;
}

/** Signal candidate for adaptive selection */
export interface SignalCandidate {
  name: string;
  countSignal: number[];
  original: number[];
  inv: boolean;
}

/** Cycle boundary from valley positions */
export interface Cycle {
  start: number;
  end: number;
  min: number;
  max: number;
  amplitude: number;
  duration: number;
}

/** Diagnostic candidate entry */
export interface DiagCandidate {
  name: string;
  reps: number;
  score: number;
  consistency: number;
  winner: boolean;
}

/** Constructor options for RepCounter */
export interface RepCounterOptions {
  mode?: 'video' | 'live';
  fps?: number;
  userInjuries?: string[];
  weightKg?: number;
}
