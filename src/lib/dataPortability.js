/**
 * Cross-device data export/import using native CompressionStream API.
 * Packages all IndexedDB stores into a single .wv file (gzipped JSON).
 */

import localforage from 'localforage';

const DATA_VERSION = 2;

// Mirror the store instances from storage.js
const stores = {
  profile: localforage.createInstance({ name: 'workoutVision', storeName: 'profile' }),
  workouts: localforage.createInstance({ name: 'workoutVision', storeName: 'workouts' }),
  medical: localforage.createInstance({ name: 'workoutVision', storeName: 'medical' }),
  food: localforage.createInstance({ name: 'workoutVision', storeName: 'food' }),
  milestones: localforage.createInstance({ name: 'workoutVision', storeName: 'milestones' }),
};

/** Collect all items from a localforage instance into an array. */
async function collectStore(store) {
  const items = [];
  await store.iterate((value, key) => {
    items.push({ key, value });
  });
  return items;
}

/**
 * Export all data from IndexedDB into a compressed .wv blob.
 * Returns { blob, summary } where summary counts each data type.
 */
export async function exportAllData() {
  const profile = await stores.profile.getItem('userProfile');
  const workoutItems = await collectStore(stores.workouts);
  const medicalItems = await collectStore(stores.medical);
  const foodItems = await collectStore(stores.food);
  const milestones = await stores.milestones.getItem('achieved');

  const payload = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile || null,
    workouts: workoutItems.map(i => i.value),
    medical: medicalItems.map(i => i.value),
    food: foodItems.map(i => i.value),
    milestones: milestones || {},
  };

  const jsonStr = JSON.stringify(payload);
  const blob = await compressToBlob(jsonStr);

  const summary = {
    profile: profile ? 1 : 0,
    workouts: workoutItems.length,
    medical: medicalItems.length,
    food: foodItems.length,
    milestones: milestones ? Object.keys(milestones).length : 0,
  };

  return { blob, summary, payload };
}

/**
 * Trigger a download of the .wv file.
 */
export function downloadBlob(blob) {
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workoutvision-${date}.wv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate a base64 data URL from the payload for QR code sharing.
 * Only works for small datasets (QR codes have ~3KB practical limit).
 * Returns null if the data is too large.
 */
export async function generateDataUrl(payload) {
  const jsonStr = JSON.stringify(payload);
  if (jsonStr.length > 2000) return null; // too large for QR
  const compressed = await compressToBlob(jsonStr);
  const buf = await compressed.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `data:application/x-workoutvision;base64,${base64}`;
}

/**
 * Read and decompress a .wv file, returning the parsed JSON and a summary.
 * Throws on invalid files.
 */
export async function readImportFile(file) {
  const buf = await file.arrayBuffer();
  let jsonStr;

  try {
    jsonStr = await decompressFromBuffer(buf);
  } catch (_) {
    // Fallback: maybe it's an uncompressed JSON file (v1 backup)
    const decoder = new TextDecoder();
    jsonStr = decoder.decode(buf);
  }

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (_) {
    throw new Error('INVALID_FORMAT');
  }

  if (!data.version) {
    throw new Error('MISSING_VERSION');
  }

  const summary = {
    profile: data.profile ? 1 : 0,
    workouts: Array.isArray(data.workouts) ? data.workouts.length : 0,
    medical: Array.isArray(data.medical) ? data.medical.length : 0,
    food: Array.isArray(data.food) ? data.food.length : 0,
    milestones: data.milestones ? Object.keys(data.milestones).length : 0,
    exportedAt: data.exportedAt || null,
    version: data.version,
  };

  return { data, summary };
}

/**
 * Import data into IndexedDB.
 * @param {object} data - parsed JSON from readImportFile
 * @param {'merge'|'replace'} mode - merge adds to existing, replace clears first
 * @param {function} onProgress - callback(step, total) for progress updates
 */
export async function importData(data, mode = 'merge', onProgress = null) {
  const steps = [];

  if (data.profile) steps.push('profile');
  if (data.workouts?.length) steps.push('workouts');
  if (data.medical?.length) steps.push('medical');
  if (data.food?.length) steps.push('food');
  if (data.milestones && Object.keys(data.milestones).length) steps.push('milestones');

  const total = steps.length;
  let current = 0;

  const report = (step) => {
    current++;
    if (onProgress) onProgress(current, total);
  };

  // Replace mode: clear stores before writing
  if (mode === 'replace') {
    await stores.profile.clear();
    await stores.workouts.clear();
    await stores.medical.clear();
    await stores.food.clear();
    await stores.milestones.clear();
  }

  if (data.profile) {
    await stores.profile.setItem('userProfile', {
      ...data.profile,
      updatedAt: Date.now(),
    });
    report('profile');
  }

  if (data.workouts?.length) {
    for (const w of data.workouts) {
      const key = w.id || `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (mode === 'merge') {
        const existing = await stores.workouts.getItem(key);
        if (existing) continue; // skip duplicates in merge mode
      }
      await stores.workouts.setItem(key, { ...w, id: key });
    }
    report('workouts');
  }

  if (data.medical?.length) {
    for (const r of data.medical) {
      const key = r.id || `medical_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (mode === 'merge') {
        const existing = await stores.medical.getItem(key);
        if (existing) continue;
      }
      await stores.medical.setItem(key, { ...r, id: key });
    }
    report('medical');
  }

  if (data.food?.length) {
    for (const f of data.food) {
      const key = f.id || `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (mode === 'merge') {
        const existing = await stores.food.getItem(key);
        if (existing) continue;
      }
      await stores.food.setItem(key, { ...f, id: key });
    }
    report('food');
  }

  if (data.milestones && Object.keys(data.milestones).length) {
    if (mode === 'merge') {
      const existing = await stores.milestones.getItem('achieved') || {};
      await stores.milestones.setItem('achieved', { ...existing, ...data.milestones });
    } else {
      await stores.milestones.setItem('achieved', data.milestones);
    }
    report('milestones');
  }

  return { success: true };
}

// ─── Compression helpers using native streams ───

async function compressToBlob(str) {
  const encoder = new TextEncoder();
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(str));
      controller.close();
    },
  });

  const compressedStream = inputStream.pipeThrough(new CompressionStream('gzip'));
  const reader = compressedStream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return new Blob(chunks, { type: 'application/x-workoutvision' });
}

async function decompressFromBuffer(buffer) {
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });

  const decompressedStream = inputStream.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressedStream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map(c => decoder.decode(c, { stream: true })).join('') + decoder.decode();
}
