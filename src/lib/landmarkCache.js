/**
 * Landmark cache — IndexedDB persistence for pose landmarks.
 *
 * Keyed by SHA-256 hash of video file content + fps.
 * Same file = same hash = same landmarks. Deterministic.
 * Avoids re-running MediaPipe inference on previously analyzed videos.
 *
 * Features:
 * - LRU eviction when entry count exceeds MAX_ENTRIES (default 50)
 * - Size-based eviction when estimated storage exceeds MAX_BYTES (default 100MB)
 * - Partial checkpoint support for progressive caching during extraction
 * - Timestamps on every entry for LRU ordering
 */

const CACHE_DB = 'workoutVisionCache';
const CACHE_STORE = 'landmarks';
const DB_VERSION = 4; // bumped from 3 to add meta store
const META_STORE = 'meta'; // stores { key, accessedAt, estimatedBytes }

const MAX_ENTRIES = 50;
const MAX_BYTES = 100 * 1024 * 1024; // 100MB

function openCacheDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(CACHE_DB, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: 'key' });
        metaStore.createIndex('accessedAt', 'accessedAt', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
}

/**
 * Estimate the byte size of a landmarks array.
 * Each landmark has x, y, z, visibility (4 floats = ~32 bytes per landmark).
 * 33 landmarks per frame. Plus JSON overhead.
 */
function estimateBytes(data) {
  if (!data || !Array.isArray(data)) return 0;
  // 33 landmarks * 4 properties * 8 bytes (float64 in JS) * frameCount
  // Plus ~50% JSON overhead estimate
  return Math.round(data.length * 33 * 4 * 8 * 1.5);
}

/**
 * Update access timestamp for LRU tracking.
 */
async function touchMeta(db, key, estimatedBytes) {
  if (!db || !db.objectStoreNames.contains(META_STORE)) return;
  try {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({
      key,
      accessedAt: Date.now(),
      estimatedBytes: estimatedBytes || 0,
    });
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // Meta tracking is best-effort
  }
}

export async function getCachedLandmarks(key) {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const get = tx.objectStore(CACHE_STORE).get(key);
    get.onsuccess = () => {
      const result = get.result || null;
      if (result) {
        // Update access time in background (don't block the read)
        touchMeta(db, key, estimateBytes(result)).catch(() => {});
      }
      resolve(result);
    };
    get.onerror = () => resolve(null);
    tx.oncomplete = () => {
      if (!get.result) db.close();
    };
  });
}

export async function setCachedLandmarks(key, data) {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return;

  // Evict if needed before writing
  await evictIfNeeded(db);

  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put(data, key);
    tx.oncomplete = () => {
      // Update meta in background
      touchMeta(db, key, estimateBytes(data)).then(() => db.close()).catch(() => db.close());
      resolve();
    };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/**
 * Save a partial checkpoint during frame extraction.
 * Uses a separate key suffix so it doesn't overwrite final cache.
 *
 * @param {string} key - Base cache key
 * @param {Array} data - Partial landmarks array
 * @param {number} frameIndex - Last frame index included
 */
export async function savePartialCheckpoint(key, data, frameIndex) {
  const checkpointKey = `${key}__partial`;
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put({ landmarks: data, lastFrame: frameIndex, timestamp: Date.now() }, checkpointKey);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/**
 * Load a partial checkpoint if one exists.
 *
 * @param {string} key - Base cache key
 * @returns {Promise<{landmarks: Array, lastFrame: number}|null>}
 */
export async function loadPartialCheckpoint(key) {
  const checkpointKey = `${key}__partial`;
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const get = tx.objectStore(CACHE_STORE).get(checkpointKey);
    get.onsuccess = () => resolve(get.result || null);
    get.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove the partial checkpoint after final cache is saved.
 *
 * @param {string} key - Base cache key
 */
export async function clearPartialCheckpoint(key) {
  const checkpointKey = `${key}__partial`;
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).delete(checkpointKey);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/**
 * Evict oldest entries if cache exceeds limits.
 */
async function evictIfNeeded(db) {
  if (!db || !db.objectStoreNames.contains(META_STORE)) return;

  try {
    // Read all meta entries
    const entries = await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.index('accessedAt').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // Filter out partial checkpoint entries from eviction consideration
    const realEntries = entries.filter(e => !e.key.endsWith('__partial'));

    // Check if eviction is needed
    const totalBytes = realEntries.reduce((sum, e) => sum + (e.estimatedBytes || 0), 0);
    if (realEntries.length <= MAX_ENTRIES && totalBytes <= MAX_BYTES) return;

    // Sort by accessedAt ascending (oldest first)
    realEntries.sort((a, b) => (a.accessedAt || 0) - (b.accessedAt || 0));

    // Determine how many to evict
    const keysToEvict = [];
    let currentCount = realEntries.length;
    let currentBytes = totalBytes;

    for (const entry of realEntries) {
      if (currentCount <= MAX_ENTRIES && currentBytes <= MAX_BYTES) break;
      keysToEvict.push(entry.key);
      currentCount--;
      currentBytes -= (entry.estimatedBytes || 0);
    }

    if (keysToEvict.length === 0) return;

    // Delete evicted entries from both stores
    const tx = db.transaction([CACHE_STORE, META_STORE], 'readwrite');
    const landmarkStore = tx.objectStore(CACHE_STORE);
    const metaStore = tx.objectStore(META_STORE);
    for (const key of keysToEvict) {
      landmarkStore.delete(key);
      metaStore.delete(key);
      // Also clean up any partial checkpoints for evicted entries
      landmarkStore.delete(`${key}__partial`);
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // Eviction is best-effort
  }
}

/**
 * Get the estimated total cache size in bytes.
 * @returns {Promise<number>}
 */
export async function getCacheSize() {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(META_STORE)) return 0;
  try {
    const entries = await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return entries.reduce((sum, e) => sum + (e.estimatedBytes || 0), 0);
  } catch {
    db.close();
    return 0;
  }
}

/**
 * Evict the oldest cache entry.
 * @returns {Promise<string|null>} The key that was evicted, or null
 */
export async function evictOldest() {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(META_STORE)) return null;
  try {
    // Get the oldest entry
    const oldest = await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const idx = tx.objectStore(META_STORE).index('accessedAt');
      const req = idx.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        resolve(cursor ? cursor.value : null);
      };
      req.onerror = () => resolve(null);
    });

    if (!oldest) { db.close(); return null; }

    // Skip partial checkpoints
    if (oldest.key.endsWith('__partial')) { db.close(); return null; }

    // Delete it
    const tx = db.transaction([CACHE_STORE, META_STORE], 'readwrite');
    tx.objectStore(CACHE_STORE).delete(oldest.key);
    tx.objectStore(META_STORE).delete(oldest.key);
    tx.objectStore(CACHE_STORE).delete(`${oldest.key}__partial`);
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    db.close();
    return oldest.key;
  } catch {
    db.close();
    return null;
  }
}
