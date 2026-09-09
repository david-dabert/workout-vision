/**
 * Landmark cache — IndexedDB persistence for pose landmarks.
 *
 * Keyed by SHA-256 hash of video file content + fps.
 * Same file = same hash = same landmarks. Deterministic.
 * Avoids re-running MediaPipe inference on previously analyzed videos.
 */

const CACHE_DB = 'workoutVisionCache';
const CACHE_STORE = 'landmarks';

function openCacheDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(CACHE_DB, 3);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
}

export async function getCachedLandmarks(key) {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const get = tx.objectStore(CACHE_STORE).get(key);
    get.onsuccess = () => resolve(get.result || null);
    get.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

export async function setCachedLandmarks(key, data) {
  const db = await openCacheDB();
  if (!db || !db.objectStoreNames.contains(CACHE_STORE)) return;
  return new Promise((resolve) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put(data, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}
