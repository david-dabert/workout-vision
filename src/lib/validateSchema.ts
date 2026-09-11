/**
 * Lightweight workout record validation (no external dependencies).
 * Used on IndexedDB reads to catch corrupted or legacy data gracefully.
 */

import { ValidationResult, WorkoutRecord } from './types';

const KNOWN_FIELDS: (keyof WorkoutRecord)[] = [
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
  // Preserve id and date even if validation fails
  if (r.id) sanitized.id = r.id as string;
  if (r.createdAt) sanitized.createdAt = r.createdAt as string;
  if (r.date) sanitized.date = r.date as string;

  return { valid: errors.length === 0, errors, sanitized: sanitized as WorkoutRecord };
}
