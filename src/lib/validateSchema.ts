/**
 * Lightweight workout record validation (no external dependencies).
 * Used on IndexedDB reads to catch corrupted or legacy data gracefully.
 */

import { ValidationResult, WorkoutRecord } from './types';

/** The fields a read keeps (every other field is dropped); exported so a test holds every field saved-set.js writes. */
export const KNOWN_FIELDS: (keyof WorkoutRecord)[] = [
  'id', 'date', 'createdAt', 'updatedAt', 'schemaVersion',
  'exercise', 'exerciseKey', 'exerciseName',
  'reps', 'machineReps', 'repsOverridden',
  'formScore', 'weight', 'volume', 'duration',
  'diagnostics', 'bioAnalysis', 'repHistory', 'report',
  'confidence', 'progression', 'baselineComparison',
  'machineResult', 'correctedResult', 'recalibrated',
  'fileName', 'videoUrl', 'frames', 'fps',
  'autoDetected', 'detectionFailed',
  'workoutId',
  // The counting core's result screen writes these; reading them back keeps the arm and the app's own count.
  'source', 'arm', 'repDetails', 'repDetailsVersion', 'corrected',
  // The front-view left/right comparison (counting/symmetry.ts), kept for the report.
  'sides',
  // The measured angle over the set, compact, for the report's wave (components/experience/wave.js).
  'wave',
  // A refused set whose count the person typed (WP1.6): said so in the history and the report.
  'afterRefusal',
  // Where the body went unseen during the set (counting/doubt.js, saved-set.js): stored, read by no screen yet.
  'doubt',
  // The coach's target, for a set filmed from a programme (Espace pro, 6 October; programme.js, plannedOf).
  'planned',
  // The app's proposal on a refused set (saved-set.js), and a set the body check flagged: written since 8 October but
  // dropped here on every read until 9 October, so no screen could tell a confirmed proposal from a typed count.
  'proposal', 'bodyCheck',
  // The count the person gave before the app showed its own (blind.js, 9 October 2026), or null for "Je ne sais pas".
  'blind',
];

const DEFAULTS: Partial<WorkoutRecord> = {
  reps: 0,
  formScore: null,
  weight: 0,
  volume: 0,
  duration: 0,
  diagnostics: null,
  bioAnalysis: null,
  repHistory: null,
  report: null,
  confidence: null,
  machineResult: null,
  correctedResult: null,
  recalibrated: false,
  repsOverridden: false,
};

/**
 * Validate a workout record read from IndexedDB.
 * Returns { valid, errors, sanitized } where sanitized is a clean copy
 * with defaults applied for missing optional fields.
 */
export function validateWorkout(record: unknown): ValidationResult {
  const errors: string[] = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['not an object'], sanitized: null };
  }

  const r = record as Record<string, unknown>;

  // Required fields
  if (!r.id || typeof r.id !== 'string') errors.push('missing or invalid id');
  if (!r.date && !r.createdAt) errors.push('missing date');
  if (!r.exercise && !r.exerciseKey) errors.push('missing exercise');
  if (r.reps !== undefined && r.reps !== null) {
    if (typeof r.reps !== 'number' || r.reps < 0) errors.push('invalid reps');
  }

  // Optional fields type checks
  if (r.formScore !== undefined && r.formScore !== null && typeof r.formScore !== 'number') {
    errors.push('invalid formScore');
  }
  if (r.weight !== undefined && r.weight !== null && typeof r.weight !== 'number') {
    errors.push('invalid weight');
  }
  if (r.duration !== undefined && r.duration !== null && typeof r.duration !== 'number') {
    errors.push('invalid duration');
  }
  if (r.diagnostics !== undefined && r.diagnostics !== null && typeof r.diagnostics !== 'object') {
    errors.push('invalid diagnostics');
  }
  if (r.bioAnalysis !== undefined && r.bioAnalysis !== null && typeof r.bioAnalysis !== 'object') {
    errors.push('invalid bioAnalysis');
  }
  if (r.repHistory !== undefined && r.repHistory !== null && !Array.isArray(r.repHistory)) {
    errors.push('invalid repHistory');
  }

  // Build sanitized copy: known fields only, defaults for missing optionals
  const sanitized: Partial<WorkoutRecord> = {};
  for (const key of KNOWN_FIELDS) {
    if (r[key] !== undefined) {
      (sanitized as Record<string, unknown>)[key] = r[key];
    } else if (key in DEFAULTS) {
      (sanitized as Record<string, unknown>)[key] = DEFAULTS[key];
    }
  }
  // Per-rep details that are not a list of reps with finite times and ranges are dropped with their version, so a
  // restored backup can never break the report or the spreadsheet (audit FINDING-015).
  const reps = sanitized.repDetails as unknown;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (reps != null && !(Array.isArray(reps) && reps.every(r => r && typeof r === 'object'
    && num((r as Record<string, unknown>).startTime) && num((r as Record<string, unknown>).endTime) && num((r as Record<string, unknown>).romDegrees)))) {
    (sanitized as Record<string, unknown>).repDetails = null;
    (sanitized as Record<string, unknown>).repDetailsVersion = null;
  }
  // A wave that is not two arrays of equal length, up to 401 samples (wave.js, compactWave), numbers or null, is not drawn.
  const w = sanitized.wave as { t?: unknown; a?: unknown } | null | undefined;
  if (w != null && !(Array.isArray(w.t) && Array.isArray(w.a) && w.t.length === w.a.length && w.t.length <= 401
    && w.t.every(v => Number.isFinite(v)) && w.a.every(v => v === null || Number.isFinite(v)))) sanitized.wave = null;
  // A target that is not a programme's name, a place in it and whole numbers is dropped: the set stays, outside any
  // programme (a restored backup can hold anything).
  const p = sanitized.planned as Record<string, unknown> | null | undefined;
  const whole = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1000;
  if (p != null && !(typeof p === 'object' && typeof p.programme === 'string' && p.programme.length <= 32
    && whole(p.item) && whole(p.sets) && whole(p.reps) && whole(p.rest))) delete sanitized.planned;
  // A proposal that is not a whole count of the app's proposer, and a body check that is not its two numbers, are
  // dropped: the set stays, read as typed by hand or as counted.
  const pr = sanitized.proposal as Record<string, unknown> | null | undefined;
  if (pr != null && !(typeof pr === 'object' && whole(pr.reps) && pr.by === 'psc')) delete sanitized.proposal;
  const bc = sanitized.bodyCheck as Record<string, unknown> | null | undefined;
  if (bc != null && !(typeof bc === 'object' && (bc.agreement === null || num(bc.agreement))
    && (bc.second === null || whole(bc.second)))) delete sanitized.bodyCheck;
  // A blind answer that is not a count from 1 to 99 (or null) with the share of sets asked is dropped: the set stays.
  const bl = sanitized.blind as Record<string, unknown> | null | undefined;
  if (bl != null && !(typeof bl === 'object' && (bl.count === null || (Number.isInteger(bl.count) && (bl.count as number) >= 1 && (bl.count as number) <= 99))
    && num(bl.p) && (bl.p as number) >= 0 && (bl.p as number) <= 1)) delete sanitized.blind;
  // Preserve id and date even if validation fails
  if (r.id) sanitized.id = r.id as string;
  if (r.createdAt) sanitized.createdAt = r.createdAt as string;
  if (r.date) sanitized.date = r.date as string;

  return { valid: errors.length === 0, errors, sanitized: sanitized as WorkoutRecord };
}
