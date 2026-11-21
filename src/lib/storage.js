/**
 * Local storage layer using IndexedDB (via localforage) for all user data.
 * Everything stays on device.
 */

import localforage from 'localforage';
import { gzipSync, gunzipSync } from 'fflate';
import { calculateBMR, ACTIVITY_MULTIPLIERS } from './nutrition';
import { validateWorkout } from './validateSchema';
import { summarizeCount } from './coreAnalysis';

const profileStore = localforage.createInstance({ name: 'workoutVision', storeName: 'profile' });
const workoutStore = localforage.createInstance({ name: 'workoutVision', storeName: 'workouts' });
const medicalStore = localforage.createInstance({ name: 'workoutVision', storeName: 'medical' });
const foodStore = localforage.createInstance({ name: 'workoutVision', storeName: 'food' });
const milestoneStore = localforage.createInstance({ name: 'workoutVision', storeName: 'milestones' });
const metaStore = localforage.createInstance({ name: 'workoutVision', storeName: 'meta' });
export const kineStore = localforage.createInstance({ name: 'workoutVision', storeName: 'kine' });

/** A stored record the app can read: an object, not null, not a list. */
export const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every record of a store, each given to fn. A record that is not an object (null, a string: a corrupt or foreign
 * write) is skipped and left where it is, never deleted; a callback that throws on one record is logged and the
 * others are still read. In localforage's IndexedDB driver a throw inside the iterate callback leaves its promise
 * unsettled, so one corrupt record made the history wait forever and hid its restore (audit of 6 October, action 18).
 * fn's return value never stops the iteration.
 */
function eachRecord(store, fn) {
  return store.iterate((value, key) => {
    if (!isRecord(value)) return;
    try { fn(value, key); } catch (e) { console.warn('[Storage] Record skipped:', key, e); }
  });
}

/** Current schema version. Increment when workout record shape changes (Card 059: v2 for body points & unified store). */
export const SCHEMA_VERSION = 2;

let runningMigration = null;

/**
 * Check and run schema migrations on app start.
 * Safe to call multiple times; only migrates if version is behind.
 * @returns {Promise<void>}
 */
export async function checkAndMigrateSchema() {
  if (runningMigration) return runningMigration;
  return (runningMigration = (async () => {
    try {
      await _repairManualProvenance();
      const storedVersion = await metaStore.getItem('schemaVersion');
      // A version this build knows, or a newer one written by a later build: nothing to do. A rolled-back build never
      // lowers it, so the later build's data is not marked as older than it is (audit of 6 October, action 18).
      if (typeof storedVersion === 'number' && storedVersion >= SCHEMA_VERSION) return;

      // Run migrations in order
      if (!storedVersion || storedVersion < 1) {
        await _migrateToV1();
      }
      if (!storedVersion || storedVersion < 2) {
        await _migrateToV2();
      }

      await metaStore.setItem('schemaVersion', SCHEMA_VERSION);
    } catch (e) {
      console.warn('[Storage] Schema migration failed:', e);
    } finally {
      runningMigration = null;
    }
  })());
}

/**
 * Once per phone: a count typed by hand after a refusal (afterRefusal, saved-set.js) was stored from 3 to 5 October
 * with the typed count as the app's machineResult (saveWorkout's old fallback). The app measured nothing, so its
 * machineResult goes back to null; nothing else in the set changes (Astra's review of 5 October).
 */
/** A count typed by hand after the app refused the set (saved-set.js, manual): the app measured nothing. */
const typedAfterRefusal = w => w?.afterRefusal === true && w.source === 'manual';

async function _repairManualProvenance() {
  if (await metaStore.getItem('manualProvenanceRepaired')) return;
  const fix = [];
  await eachRecord(workoutStore, (value, key) => {
    if (typedAfterRefusal(value) && value.machineResult != null) fix.push({ key, value });
  });
  for (const { key, value } of fix) await workoutStore.setItem(key, { ...value, machineResult: null });
  await metaStore.setItem('manualProvenanceRepaired', true);
}

/**
 * Migration to v1: ensure all workout records have required fields,
 * and add machineResult/correctedResult fields if missing.
 */
async function _migrateToV1() {
  const workouts = [];
  await eachRecord(workoutStore, (value, key) => {
    workouts.push({ key, value });
  });

  for (const { key, value } of workouts) {
    let modified = false;
    // Ensure required fields exist
    if (!value.id) { value.id = key; modified = true; }
    if (!value.createdAt && !value.date) { value.createdAt = Date.now(); modified = true; }
    // Add machine/corrected result fields if missing
    if (value.reps != null && value.machineResult === undefined) {
      value.machineResult = { reps: value.reps, confidence: value.confidence || null };
      modified = true;
    }
    if (value.correctedResult === undefined) {
      value.correctedResult = null;
      modified = true;
    }
    if (modified) {
      await workoutStore.setItem(key, value);
    }
  }
}

/**
 * Migration to v2 (Card 059): migrates legacy kiné records from localStorage into IndexedDB (kineStore),
 * and advances the meta store schemaVersion to 2 while keeping 100% of existing workout records intact.
 */
async function _migrateToV2() {
  await migrateKineFromLocalStorage();
}

/**
 * Migrates legacy kiné records from plain localStorage into IndexedDB kineStore (Card 059).
 * Safe to call repeatedly; removes localStorage keys once migrated into IndexedDB.
 */
export async function migrateKineFromLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  const kineKeys = [
    { ls: 'wv_kine_profile', kine: 'profile' },
    { ls: 'wv_kine_invoice_seq', kine: 'invoice_seq' },
    { ls: 'wv_kine_attempts', kine: 'attempts' },
    { ls: 'wv_kine_results', kine: 'results' },
    { ls: 'wv_kine_labels', kine: 'labels' },
  ];
  for (const { ls, kine } of kineKeys) {
    try {
      const raw = localStorage.getItem(ls);
      if (raw) {
        const parsed = JSON.parse(raw);
        const existing = await kineStore.getItem(kine);
        if (!existing) {
          await kineStore.setItem(kine, parsed);
        }
        localStorage.removeItem(ls);
      }
    } catch (e) {
      console.warn('[Storage] Failed to migrate kiné key:', ls, e);
    }
  }
}

/**
 * Compress body landmark points and timestamps into a compact base64 string using gzip (Card 059).
 * @param {Array} worldLandmarks Array of frame landmarks
 * @param {number[]} timestamps Array of timestamps (seconds)
 * @returns {string|null} base64 gzip payload or null
 */
export function compressBodyPoints(worldLandmarks, timestamps) {
  if (!Array.isArray(worldLandmarks) || !Array.isArray(timestamps) || worldLandmarks.length === 0) return null;
  try {
    const json = JSON.stringify({ worldLandmarks, timestamps });
    const bytes = new TextEncoder().encode(json);
    const gzipped = gzipSync(bytes, { level: 9, mtime: 0 });
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(gzipped).toString('base64');
    }
    let binary = '';
    const len = gzipped.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(gzipped[i]);
    return btoa(binary);
  } catch (e) {
    console.warn('[Storage] Failed to compress body points:', e);
    return null;
  }
}

/**
 * Decompress a base64 gzip payload into { worldLandmarks, timestamps } (Card 059).
 * @param {string} compressed
 * @returns {{ worldLandmarks: Array, timestamps: number[] }|null}
 */
export function decompressBodyPoints(compressed) {
  if (typeof compressed !== 'string' || !compressed) return null;
  try {
    let bytes;
    if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(compressed, 'base64'));
    } else {
      const binary = atob(compressed);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    }
    const unzipped = gunzipSync(bytes);
    const text = new TextDecoder().decode(unzipped);
    return JSON.parse(text);
  } catch (e) {
    console.warn('[Storage] Failed to decompress body points:', e);
    return null;
  }
}

/**
 * Recounts a workout from its stored compressed body points using the current counting engine (Card 059).
 * @param {Object} workout A stored workout record
 * @returns {Object|null} Recount summary or null if no body points
 */
export function recountWorkout(workout) {
  const points = workout?.bodyPoints
    ? decompressBodyPoints(workout.bodyPoints)
    : (workout?.worldLandmarks && workout?.timestamps ? { worldLandmarks: workout.worldLandmarks, timestamps: workout.timestamps } : null);
  if (!points || !points.worldLandmarks || !points.timestamps) return null;
  const lift = workout.exercise || workout.exerciseKey;
  if (!lift) return null;
  return summarizeCount(points.worldLandmarks, points.timestamps, lift);
}

/**
 * Validate a workout record before writing.
 * @param {Object} workout
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWorkoutRecord(workout) {
  const errors = [];
  if (!workout) {
    return { valid: false, errors: ['Workout is null'] };
  }
  if (!workout.exercise && !workout.exerciseKey) {
    errors.push('Missing exercise identifier');
  }
  if (workout.reps == null && workout.machineResult == null) {
    errors.push('Missing rep count');
  }
  return { valid: errors.length === 0, errors };
}

// User profile
export async function saveProfile(profile) {
  await profileStore.setItem('userProfile', {
    ...profile,
    updatedAt: Date.now(),
  });
}

export async function getProfile() {
  return await profileStore.getItem('userProfile');
}

// Workouts
/**
 * Save a workout record to IndexedDB.
 * Validates required fields and preserves machine vs corrected results.
 * @param {Object} workout
 * @returns {Promise<string>} record ID
 */
export async function saveWorkout(workout) {
  const { valid, errors } = validateWorkoutRecord(workout);
  if (!valid) {
    console.warn('[Storage] Workout validation warnings:', errors);
  }

  const id = `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    ...workout,
    createdAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
    // Preserve machine result alongside any user correction. A set that states machineResult: null (a count typed by
    // hand after the app refused the set, saved-set.js) keeps it: the app measured nothing, and the typed count is not
    // to be stored as the app's (Astra's review of 5 October). The default applies only when the field is absent.
    machineResult: workout.machineResult !== undefined ? workout.machineResult : (workout.reps != null ? { reps: workout.reps, confidence: workout.confidence || null } : null),
    correctedResult: workout.correctedResult || null,
  };
  await workoutStore.setItem(id, entry);
  return id;
}

/**
 * Put back a set read from a backup file (keep-sets.js), under its own id and dates, unless a set with that id
 * is already on this phone: restoring the same file twice adds nothing.
 * @returns {Promise<boolean>} whether the set was added
 */
export async function restoreWorkout(entry) {
  if (!entry?.id || (await workoutStore.getItem(entry.id))) return false;
  // A count typed by hand after a refusal is restored with no machine result, as saveWorkout keeps it and
  // _repairManualProvenance repairs it: a backup made from 3 to 5 October holds the typed count as the app's,
  // and the repair has already run on this phone (audit of 6 October, action 18).
  await workoutStore.setItem(entry.id, typedAfterRefusal(entry) ? { ...entry, machineResult: null } : entry);
  return true;
}

export async function getWorkout(id) {
  const record = await workoutStore.getItem(id);
  if (record) {
    const { valid, errors, sanitized } = validateWorkout(record);
    if (!valid) {
      console.warn('[Storage] Workout validation issues on read:', id, errors);
    }
    return sanitized || record;
  }
  return record;
}

/**
 * Paginated workout retrieval with filtering.
 * Uses cursor-based pagination over the full store, applying filters during iteration
 * so only matching records are counted toward limit/offset.
 *
 * @param {Object} options
 * @param {number} [options.limit=50] - max records to return
 * @param {number} [options.offset=0] - records to skip
 * @param {string} [options.exercise] - filter by exercise key
 * @param {number|string|Date} [options.dateFrom] - inclusive start (timestamp, ISO string, or Date)
 * @param {number|string|Date} [options.dateTo] - inclusive end (timestamp, ISO string, or Date)
 * @returns {Promise<Array>} sorted newest-first
 */
export async function getWorkouts(options = {}) {
  await checkAndMigrateSchema();
  const { limit = 50, offset = 0, exercise, dateFrom, dateTo } = options;
  const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toTs = dateTo ? new Date(dateTo).getTime() : null;

  const all = [];
  await eachRecord(workoutStore, (value) => {
    // Apply filters during iteration
    if (exercise && value.exercise !== exercise) return;
    const ts = value.createdAt || new Date(value.date).getTime();
    if (fromTs && ts < fromTs) return;
    if (toTs && ts > toTs) return;
    const { valid, errors, sanitized } = validateWorkout(value);
    if (!valid) {
      console.warn('[Storage] Workout validation issues:', value.id, errors);
    }
    all.push(sanitized || value);
  });

  // Sort newest first, on the time the screens use (sets.js setTime: createdAt, else the date), then apply
  // offset/limit. A set with a date alone, or a createdAt that is not a number, no longer breaks the order (third
  // audit, C16).
  const time = w => { const v = new Date(w.createdAt ?? w.date).getTime(); return Number.isFinite(v) ? v : 0; };
  all.sort((a, b) => time(b) - time(a));
  return all.slice(offset, offset + limit);
}

/**
 * Count total workouts (optionally filtered).
 *
 * @param {Object} [filters]
 * @param {string} [filters.exercise] - filter by exercise key
 * @param {number|string|Date} [filters.dateFrom]
 * @param {number|string|Date} [filters.dateTo]
 * @returns {Promise<number>}
 */
export async function getWorkoutCount(filters = {}) {
  const { exercise, dateFrom, dateTo } = filters;
  const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toTs = dateTo ? new Date(dateTo).getTime() : null;

  let count = 0;
  await eachRecord(workoutStore, (value) => {
    if (exercise && value.exercise !== exercise) return;
    const ts = value.createdAt || new Date(value.date).getTime();
    if (fromTs && ts < fromTs) return;
    if (toTs && ts > toTs) return;
    count++;
  });
  return count;
}

/**
 * Get the N most recent workouts efficiently.
 * Iterates the full store but only keeps the top N in a min-heap-like structure.
 *
 * @param {number} n - number of recent workouts to return
 * @returns {Promise<Array>} sorted newest-first
 */
export async function getRecentWorkouts(n = 10) {
  const recent = [];
  await eachRecord(workoutStore, (value) => {
    const ts = value.createdAt || 0;
    if (recent.length < n) {
      recent.push(value);
      // Keep sorted so [n-1] is the oldest in our window
      if (recent.length === n) {
        recent.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } else if (ts > (recent[n - 1].createdAt || 0)) {
      recent[n - 1] = value;
      recent.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  });
  // Final sort in case we collected fewer than n
  return recent.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Get workouts within a date range (optimized for weekly/monthly views).
 *
 * @param {number|string|Date} dateFrom - inclusive start
 * @param {number|string|Date} dateTo - inclusive end
 * @returns {Promise<Array>} sorted newest-first
 */
export async function getWorkoutsByDateRange(dateFrom, dateTo) {
  const fromTs = new Date(dateFrom).getTime();
  const toTs = new Date(dateTo).getTime();
  const results = [];
  await eachRecord(workoutStore, (value) => {
    const ts = value.createdAt || new Date(value.date).getTime();
    if (ts >= fromTs && ts <= toTs) {
      results.push(value);
    }
  });
  return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * @deprecated Use getWorkouts() for paginated access or getRecentWorkouts() for dashboard.
 * Kept for backward compatibility. Internally delegates to getWorkouts with no limit cap.
 */
export async function getAllWorkouts() {
  const workouts = [];
  await eachRecord(workoutStore, (value) => {
    const { valid, errors, sanitized } = validateWorkout(value);
    if (!valid) {
      console.warn('[Storage] Workout validation issues:', value.id, errors);
    }
    workouts.push(sanitized || value);
  });
  return workouts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Get the most recent workout for a specific exercise, excluding a given ID.
 * Avoids loading all workouts into memory.
 */
export async function getLastWorkoutForExercise(exerciseKey, excludeId) {
  let best = null;
  await eachRecord(workoutStore, (value) => {
    if (value.exercise !== exerciseKey) return;
    if (excludeId && value.id === excludeId) return;
    if (!best || (value.createdAt || 0) > (best.createdAt || 0)) {
      best = value;
    }
  });
  return best;
}

export async function updateWorkout(id, updates) {
  const existing = await workoutStore.getItem(id);
  if (!existing) return;
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  for (const [k, v] of Object.entries(updates || {})) {
    if (v === undefined) delete updated[k];
  }
  await workoutStore.setItem(id, updated);
  return updated;
}

export async function deleteWorkout(id) {
  await workoutStore.removeItem(id);
}

// Medical records
export async function saveMedicalRecord(record) {
  const id = `medical_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    ...record,
    uploadedAt: Date.now(),
  };
  await medicalStore.setItem(id, entry);
  return id;
}

export async function getMedicalRecords() {
  const records = [];
  await eachRecord(medicalStore, (value) => {
    records.push(value);
  });
  return records.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function deleteMedicalRecord(id) {
  await medicalStore.removeItem(id);
}

// Food log
export async function saveFoodEntry(entry) {
  const id = `food_${Date.now()}`;
  const record = {
    id,
    ...entry,
    loggedAt: Date.now(),
  };
  await foodStore.setItem(id, record);
  return id;
}

export async function getFoodLog(dateStr) {
  const entries = [];
  await eachRecord(foodStore, (value) => {
    entries.push(value);
  });
  if (dateStr) {
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);
    return entries
      .filter(e => e.loggedAt >= dayStart.getTime() && e.loggedAt <= dayEnd.getTime())
      .sort((a, b) => b.loggedAt - a.loggedAt);
  }
  return entries.sort((a, b) => b.loggedAt - a.loggedAt);
}

export async function deleteFoodEntry(id) {
  await foodStore.removeItem(id);
}

/**
 * Calculate physiological baselines from profile.
 * Based on validated equations from exercise physiology literature.
 */
export function calculateBaselines(profile) {
  if (!profile) return null;

  const { weight, height, age, sex, ethnicity } = profile;
  const weightKg = parseFloat(weight);
  let heightCm = parseFloat(height);
  const ageYears = parseFloat(age);

  if (!weightKg || !heightCm || !ageYears) return null;

  // Auto-detect meters vs cm: if height < 3, user entered meters (e.g. 1.89)
  if (heightCm > 0 && heightCm < 3) heightCm = heightCm * 100;

  // Sanity: reject clearly impossible values
  if (weightKg < 20 || weightKg > 300 || heightCm < 80 || heightCm > 260 || ageYears < 5 || ageYears > 120) return null;

  // BMI
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  // BMR using Mifflin-St Jeor (1990) : single source in nutrition.js
  const bmr = calculateBMR(weightKg, heightCm, ageYears, sex);

  // Body fat estimation (Deurenberg 1991, BMI-based; SEE 4-5%)
  let estimatedBF;
  if (sex === 'male') {
    estimatedBF = 1.2 * bmi + 0.23 * ageYears - 16.2;
  } else {
    estimatedBF = 1.2 * bmi + 0.23 * ageYears - 5.4;
  }

  // Max heart rate (Tanaka 2001: more accurate than 220-age)
  const maxHR = 208 - 0.7 * ageYears;

  // Training zones (Karvonen method)
  const restHR = parseFloat(profile.restingHR) || 70;
  const zones = {
    warmup: { min: Math.round(restHR + 0.5 * (maxHR - restHR)), max: Math.round(restHR + 0.6 * (maxHR - restHR)) },
    fatBurn: { min: Math.round(restHR + 0.6 * (maxHR - restHR)), max: Math.round(restHR + 0.7 * (maxHR - restHR)) },
    cardio: { min: Math.round(restHR + 0.7 * (maxHR - restHR)), max: Math.round(restHR + 0.8 * (maxHR - restHR)) },
    peak: { min: Math.round(restHR + 0.8 * (maxHR - restHR)), max: Math.round(restHR + 0.9 * (maxHR - restHR)) },
  };

  // 1RM estimation ranges by exercise (Brzycki 1993 inspired, population-adjusted)
  // These are rough population baselines, not prescriptions
  const strengthBaselines = getStrengthBaselines(weightKg, ageYears, sex, ethnicity);

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmr: Math.round(bmr),
    estimatedBF: Math.round(estimatedBF * 10) / 10,
    maxHR: Math.round(maxHR),
    zones,
    strengthBaselines,
    tdeeMultipliers: Object.fromEntries(
      Object.entries(ACTIVITY_MULTIPLIERS).map(([k, v]) => [k, Math.round(bmr * v)])
    ),
  };
}

function getStrengthBaselines(weightKg, age, sex, _ethnicity) {
  // Population-level strength standards (Lon Kilgore et al., Practical Programming)
  // Expressed as multipliers of bodyweight for untrained individuals
  const baselines = sex === 'male'
    ? { squat: 0.75, deadlift: 1.0, benchPress: 0.65, overheadPress: 0.4 }
    : { squat: 0.5, deadlift: 0.65, benchPress: 0.35, overheadPress: 0.25 };

  // Age adjustment (strength peaks ~25-35, declines ~1% per year after 40)
  let ageMultiplier = 1;
  if (age > 40) ageMultiplier = 1 - (age - 40) * 0.01;
  if (age < 20) ageMultiplier = 0.85;

  return {
    squat: Math.round(weightKg * baselines.squat * ageMultiplier),
    deadlift: Math.round(weightKg * baselines.deadlift * ageMultiplier),
    benchPress: Math.round(weightKg * baselines.benchPress * ageMultiplier),
    overheadPress: Math.round(weightKg * baselines.overheadPress * ageMultiplier),
    note: 'Untrained baseline estimates (kg). Actual capacity varies by training history.',
  };
}

// Data export/import helpers (thin wrappers for direct storage access)

/**
 * Export all data as a plain object for backup or transfer.
 */
export async function exportAllData() {
  const [workouts, profile] = await Promise.all([
    getAllWorkouts(),
    getProfile(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile,
    workouts,
  };
}

/**
 * Import data from an export object.
 * @param {Object} data - export object with version, profile, workouts
 * @returns {{ profileImported: boolean, workoutsImported: number }}
 */
export async function importData(data) {
  if (!data || (data.version !== 1 && data.version !== 2)) throw new Error('Invalid export format');
  if (data.profile) await saveProfile(data.profile);
  if (data.workouts && Array.isArray(data.workouts)) {
    for (const w of data.workouts) {
      await workoutStore.setItem(w.id || `workout-${Date.now()}-${Math.random()}`, w);
    }
  }
  return { profileImported: !!data.profile, workoutsImported: data.workouts?.length || 0 };
}

// Milestones
export async function getMilestones() {
  return (await milestoneStore.getItem('achieved')) || {};
}

export async function saveMilestones(milestones) {
  await milestoneStore.setItem('achieved', milestones);
}
