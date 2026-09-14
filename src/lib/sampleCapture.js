/**
 * Sample capture — IndexedDB storage of labelled temporal feature windows.
 *
 * Every time the user confirms or corrects an exercise via the picker,
 * the current temporal feature window is saved as a labelled training sample.
 * Samples can be exported as JSONL for offline model training.
 *
 * Schema per sample:
 *   { id, exerciseId, context, movementClass, features, timestamp }
 *
 * Features are the output of TemporalFeatureExtractor.extract() at the
 * moment of confirmation, minus the raw values arrays (too large).
 */

const DB_NAME = 'wv_training_samples';
const STORE_NAME = 'samples';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('exerciseId', 'exerciseId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
}

/**
 * Strip raw values arrays from features to reduce storage size.
 * Keep only the computed statistics.
 */
function compactFeatures(features) {
  if (!features) return null;
  const compact = {};
  for (const [key, val] of Object.entries(features)) {
    if (val && typeof val === 'object' && 'values' in val) {
      const { values, ...stats } = val;
      compact[key] = stats;
    } else {
      compact[key] = val;
    }
  }
  return compact;
}

/**
 * Save a labelled training sample.
 * @param {string} exerciseId - confirmed exercise key
 * @param {string} context - Level 0 classification
 * @param {string} movementClass - Level 1 classification
 * @param {object} features - temporal features at confirmation time
 * @param {boolean} wasCorrection - true if user overrode the detector's guess
 */
export async function saveSample(exerciseId, context, movementClass, features, wasCorrection = false) {
  const db = await openDB();
  if (!db) return;

  const sample = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId,
    context: context || 'unknown',
    movementClass: movementClass || 'unknown',
    features: compactFeatures(features),
    wasCorrection,
    timestamp: Date.now(),
  };

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(sample);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/**
 * Get all stored samples.
 * @returns {Promise<Array>}
 */
export async function getAllSamples() {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); resolve([]); };
  });
}

/**
 * Get sample count per exercise.
 * @returns {Promise<Record<string, number>>}
 */
export async function getSampleCounts() {
  const samples = await getAllSamples();
  const counts = {};
  for (const s of samples) {
    counts[s.exerciseId] = (counts[s.exerciseId] || 0) + 1;
  }
  return counts;
}

/**
 * Export all samples as JSONL string (one JSON object per line).
 * @returns {Promise<string>}
 */
export async function exportSamplesJSONL() {
  const samples = await getAllSamples();
  return samples.map(s => JSON.stringify(s)).join('\n');
}

/**
 * Export samples as a downloadable Blob.
 * @returns {Promise<Blob>}
 */
export async function exportSamplesBlob() {
  const jsonl = await exportSamplesJSONL();
  return new Blob([jsonl], { type: 'application/jsonl' });
}

/**
 * Clear all training samples.
 * @returns {Promise<void>}
 */
export async function clearSamples() {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/**
 * Get total sample count.
 * @returns {Promise<number>}
 */
export async function getSampleCount() {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => { db.close(); resolve(req.result || 0); };
    req.onerror = () => { db.close(); resolve(0); };
  });
}
