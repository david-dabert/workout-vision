/**
 * Lightweight workout record validation (no external dependencies).
 * Used on IndexedDB reads to catch corrupted or legacy data gracefully.
 */

const KNOWN_FIELDS = [
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

const DEFAULTS = {
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
 *
 * @param {*} record
 * @returns {{ valid: boolean, errors: string[], sanitized: Object|null }}
 */
export function validateWorkout(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['not an object'], sanitized: null };
  }

  // Required fields
  if (!record.id || typeof record.id !== 'string') errors.push('missing or invalid id');
  if (!record.date && !record.createdAt) errors.push('missing date');
  if (!record.exercise && !record.exerciseKey) errors.push('missing exercise');
  if (record.reps !== undefined && record.reps !== null) {
    if (typeof record.reps !== 'number' || record.reps < 0) errors.push('invalid reps');
  }

  // Optional fields type checks
  if (record.formScore !== undefined && record.formScore !== null && typeof record.formScore !== 'number') {
    errors.push('invalid formScore');
  }
  if (record.weight !== undefined && record.weight !== null && typeof record.weight !== 'number') {
    errors.push('invalid weight');
  }
  if (record.duration !== undefined && record.duration !== null && typeof record.duration !== 'number') {
    errors.push('invalid duration');
  }
  if (record.diagnostics !== undefined && record.diagnostics !== null && typeof record.diagnostics !== 'object') {
    errors.push('invalid diagnostics');
  }
  if (record.bioAnalysis !== undefined && record.bioAnalysis !== null && typeof record.bioAnalysis !== 'object') {
    errors.push('invalid bioAnalysis');
  }
  if (record.repHistory !== undefined && record.repHistory !== null && !Array.isArray(record.repHistory)) {
    errors.push('invalid repHistory');
  }

  // Build sanitized copy: known fields only, defaults for missing optionals
  const sanitized = {};
  for (const key of KNOWN_FIELDS) {
    if (record[key] !== undefined) {
      sanitized[key] = record[key];
    } else if (key in DEFAULTS) {
      sanitized[key] = DEFAULTS[key];
    }
  }
  // Preserve id and date even if validation fails
  if (record.id) sanitized.id = record.id;
  if (record.createdAt) sanitized.createdAt = record.createdAt;
  if (record.date) sanitized.date = record.date;

  return { valid: errors.length === 0, errors, sanitized };
}
