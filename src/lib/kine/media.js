// A built-in reference's pose (library.js): its landmarks read beforehand, at the media address beside its video
// (<file>.pose.json: { width, height, timestamps, landmarks: [[x, y, visibility] x 33] | null per sample }), or, when
// that file is missing, read on the phone from the video itself by the app's own pipeline (readPose.js). Kept for the
// session once loaded, and on the phone (IndexedDB) once read there, so a patient waits for it once. Status: convention.
import { readPose } from '../reference/readPose';
import { mediaUrl } from './library';

const cache = new Map();

// The phone's store of reference poses read on it: one IndexedDB store, keyed by the reference's file name. Every
// failure (private browsing, no IndexedDB) is a miss, never an error.
const DB = 'wv-kine', STORE = 'poses';
function db() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function stored(key) {
  const d = await db();
  if (!d) return null;
  return new Promise(resolve => {
    try {
      const get = d.transaction(STORE).objectStore(STORE).get(key);
      get.onsuccess = () => resolve(get.result ?? null);
      get.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function store(key, value) {
  const d = await db();
  if (!d) return;
  try { d.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key); } catch { /* storage blocked */ }
}

export function poseFromJson(j) {
  const imageLandmarks = j.landmarks.map(f => (f ? f.map(([x, y, v]) => ({ x, y, z: 0, visibility: v })) : null));
  return { imageLandmarks, timestamps: j.timestamps, width: j.width, height: j.height, aspect: j.width / j.height };
}

export async function loadReferencePose(exercise, { signal, onProgress } = {}) {
  if (cache.has(exercise.id)) return cache.get(exercise.id);
  let pose = null;
  const poseUrl = mediaUrl(exercise, 'pose.json');
  if (poseUrl) {
    try {
      const r = await fetch(poseUrl, { signal });
      if (r.ok) pose = poseFromJson(await r.json());
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }
  if (!pose) pose = await stored(exercise.file);
  if (!pose) {
    const videoUrl = mediaUrl(exercise, 'mp4');
    if (!videoUrl) throw new Error('No media address for the reference videos');
    const blob = await (await fetch(videoUrl, { signal })).blob();
    pose = await readPose(new File([blob], `${exercise.file}.mp4`, { type: blob.type || 'video/mp4' }), { signal, onProgress });
    await store(exercise.file, pose);
  }
  cache.set(exercise.id, pose);
  return pose;
}
