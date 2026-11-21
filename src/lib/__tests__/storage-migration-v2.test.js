// Card 059 (cards/059-one-data-store.md): One data store on the phone, versioned, that keeps each set's body points.
// Eval: a migration test from v1 to v2 keeps every set; a set saved today is recounted by today's core from its stored
// points to the same count; kiné data leaves localStorage; storage size per set printed (fflate, already a dependency).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { framesFromPoseFile } from '../lifterTrack.js';

// Setup in-memory mock for localforage
const stores = new Map();
vi.mock('localforage', () => ({
  default: {
    createInstance: ({ storeName }) => {
      const m = stores.get(storeName) ?? new Map();
      stores.set(storeName, m);
      return {
        getItem: async k => (m.has(k) ? structuredClone(m.get(k)) : null),
        setItem: async (k, v) => { m.set(k, structuredClone(v)); return v; },
        removeItem: async k => { m.delete(k); },
        iterate: async fn => { for (const [k, v] of m) { const r = fn(structuredClone(v), k); if (r !== undefined) return r; } },
        keys: async () => [...m.keys()],
      };
    },
  },
}));

// Setup localStorage on globalThis if running in Node environment
const localMap = new Map();
globalThis.localStorage = {
  getItem: k => localMap.get(k) ?? null,
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: k => localMap.delete(k),
  clear: () => localMap.clear(),
};

const storage = await import('../storage');
const { savedSet } = await import('../../components/experience/saved-set');
const kine = await import('../kine/store');
const { summarizeCount } = await import('../coreAnalysis');

const workouts = () => stores.get('workouts');
const meta = () => stores.get('meta');
const kineStore = () => stores.get('kine');

describe('Card 059: Storage schema migration v1 -> v2', () => {
  beforeEach(() => {
    workouts()?.clear();
    meta()?.clear();
    kineStore()?.clear();
    localMap.clear();
  });

  it('keeps 100% of existing sets and updates schemaVersion to 2', async () => {
    // Seed v1 workouts and meta version 1
    meta().set('schemaVersion', 1);
    const setA = { id: 's1', exercise: 'squat', reps: 10, createdAt: 1000, date: new Date(1000).toISOString(), machineResult: { reps: 10, confidence: 1 }, correctedResult: null };
    const setB = { id: 's2', exercise: 'bench_press', reps: 8, createdAt: 2000, date: new Date(2000).toISOString(), machineResult: { reps: 8, confidence: 0.95 }, correctedResult: null };
    workouts().set('s1', setA);
    workouts().set('s2', setB);

    await storage.checkAndMigrateSchema();

    expect(await meta().get('schemaVersion')).toBe(2);
    // Raw workout store keeps exact unchanged object
    expect(workouts().get('s1')).toEqual(setA);
    expect(workouts().get('s2')).toEqual(setB);
    expect(await storage.getWorkoutCount()).toBe(2);
    // Reading through storage getWorkout preserves all fields
    const loadedA = await storage.getWorkout('s1');
    expect(loadedA.id).toBe('s1');
    expect(loadedA.reps).toBe(10);
    expect(loadedA.exercise).toBe('squat');
    expect(loadedA.machineResult).toEqual(setA.machineResult);
  });
});

describe('Card 059: Stored body points compression & recounting', () => {
  it('compresses body points, saves them, and recounts to the exact same count', async () => {
    // Read the recorded iPhone set: IMG_4186-seated_row-label10.json.gz
    const gzPath = resolve(process.cwd(), 'test/real-phone/phone-poses/files/IMG_4186-seated_row-label10.json.gz');
    const gzBuf = readFileSync(gzPath);
    const file = JSON.parse(gunzipSync(gzBuf).toString());
    const frames = framesFromPoseFile(file);

    const timestamps = frames.map(fr => fr.t);
    const worldLandmarks = frames.map(fr => fr.poses[0]?.world ?? null);
    const imageLandmarks = frames.map(fr => fr.poses[0]?.image ?? null);

    // Baseline count with coreAnalysis
    const coreResult = summarizeCount(worldLandmarks, timestamps, 'seated_row', undefined, imageLandmarks);
    expect(coreResult.count).toBe(9); // Matches phoneCount for first pose

    // Compress landmarks using storage helper
    const compressed = storage.compressBodyPoints(worldLandmarks, timestamps);
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeGreaterThan(0);

    // Print compression metrics (Card 059 Eval)
    const rawBytes = new TextEncoder().encode(JSON.stringify({ worldLandmarks, timestamps })).length;
    const compBytes = compressed.length;
    const ratio = Math.round((1 - compBytes / rawBytes) * 100);
    console.log(`[Card 059 Storage Size] Raw: ${Math.round(rawBytes / 1024)} KB -> Compressed: ${Math.round(compBytes / 1024)} KB (${ratio}% space reduction)`);

    // Verify decompression restores identical structures
    const decompressed = storage.decompressBodyPoints(compressed);
    expect(decompressed.timestamps).toEqual(timestamps);
    expect(decompressed.worldLandmarks).toEqual(worldLandmarks);

    // Save set through savedSet and saveWorkout
    const fullResult = {
      ...coreResult,
      worldLandmarks,
      timestamps,
    };
    const kept = savedSet({ result: fullResult, lift: 'seated_row', n: coreResult.count, corrected: false });
    expect(kept.bodyPoints).toBe(compressed);
    expect(storage.decompressBodyPoints(kept.bodyPoints)).toEqual(decompressed);

    const savedId = await storage.saveWorkout(kept);
    const loaded = await storage.getWorkout(savedId);

    expect(loaded.bodyPoints).toBe(compressed);
    expect(storage.decompressBodyPoints(loaded.bodyPoints)).toEqual(decompressed);

    // Recount from stored record using today's core
    const recounted = storage.recountWorkout(loaded);
    expect(recounted).not.toBeNull();
    expect(recounted.count).toBe(coreResult.count);
    expect(recounted.reps.length).toBe(coreResult.reps.length);
  });
});

describe('Card 059: Kiné data leaves localStorage and moves to IndexedDB', () => {
  beforeEach(() => {
    localMap.clear();
    kineStore()?.clear();
  });

  it('migrates legacy localStorage kiné entries to IndexedDB and purges localStorage', async () => {
    // Seed legacy localStorage items
    const mockProfile = { name: 'Dr. Martin', title: 'Masseur-kinésithérapeute', fee: 45 };
    const mockSeq = { year: 2026, n: 12 };
    const mockAttempts = { p1: [{ id: 'ex1', date: '2026-11-20', verdict: 'green' }] };
    const mockResults = [{ id: 'r1', patient: 'Alice', date: '2026-11-20', verdict: 'good', joints: [], holds: [] }];
    const mockLabels = { p1: 'Alice Martin' };

    localStorage.setItem('wv_kine_profile', JSON.stringify(mockProfile));
    localStorage.setItem('wv_kine_invoice_seq', JSON.stringify(mockSeq));
    localStorage.setItem('wv_kine_attempts', JSON.stringify(mockAttempts));
    localStorage.setItem('wv_kine_results', JSON.stringify(mockResults));
    localStorage.setItem('wv_kine_labels', JSON.stringify(mockLabels));

    // Run schema migration
    await storage.migrateKineFromLocalStorage();

    // Verify data moved to kineStore in IndexedDB
    expect(await kineStore().get('profile')).toEqual(mockProfile);
    expect(await kineStore().get('invoice_seq')).toEqual(mockSeq);
    expect(await kineStore().get('attempts')).toEqual(mockAttempts);
    expect(await kineStore().get('results')).toEqual(mockResults);
    expect(await kineStore().get('labels')).toEqual(mockLabels);

    // Verify localStorage has been completely purged of those keys
    expect(localStorage.getItem('wv_kine_profile')).toBeNull();
    expect(localStorage.getItem('wv_kine_invoice_seq')).toBeNull();
    expect(localStorage.getItem('wv_kine_attempts')).toBeNull();
    expect(localStorage.getItem('wv_kine_results')).toBeNull();
    expect(localStorage.getItem('wv_kine_labels')).toBeNull();

    // Verify kine/store synchronous readers return the migrated data
    await kine.initKineStore(true);
    expect(kine.readProfile().name).toBe('Dr. Martin');
    expect(kine.nextInvoiceNumber(new Date(2026, 0, 1))).toBe('2026-0013');
    expect(kine.attemptsOf('p1')).toEqual(mockAttempts.p1);
    expect(kine.patientLabel('p1')).toBe('Alice Martin');
  });
});
