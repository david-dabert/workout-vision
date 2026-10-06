// Storage hardening (audit of 6 October, action 18): a corrupt record cannot stop the history from reading the
// others; a rolled-back build never lowers a newer schema version; a backup's set typed by hand after a refusal
// is restored with no machine result; every field the result screen saves survives a read.
import { describe, it, expect, vi } from 'vitest';

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
        // As localforage's IndexedDB driver: a value returned by the callback stops the iteration.
        iterate: async fn => { for (const [k, v] of m) { const r = fn(structuredClone(v), k); if (r !== undefined) return r; } },
        keys: async () => [...m.keys()],
      };
    },
  },
}));

const storage = await import('../storage');
const { savedSet } = await import('../../components/experience/saved-set');
const { KNOWN_FIELDS } = await import('../validateSchema');

const workouts = () => stores.get('workouts');
const good = (id, at) => ({ id, exercise: 'squat', reps: 5, createdAt: at, date: new Date(at).toISOString(), machineResult: { reps: 5, confidence: 1 }, correctedResult: null });

describe('a corrupt record in the sets', () => {
  it('is skipped by every read, never deleted, and the other sets are still read', async () => {
    workouts().clear();
    workouts().set('a', good('a', 1000)); workouts().set('bad-null', null); workouts().set('bad-text', 'oops'); workouts().set('b', good('b', 2000));
    expect((await storage.getWorkouts({ limit: 100 })).map(w => w.id)).toEqual(['b', 'a']);
    expect(await storage.getWorkoutCount()).toBe(2);
    expect((await storage.getRecentWorkouts(5)).map(w => w.id)).toEqual(['b', 'a']);
    expect((await storage.getWorkoutsByDateRange(0, 5000)).map(w => w.id)).toEqual(['b', 'a']);
    expect((await storage.getAllWorkouts()).map(w => w.id)).toEqual(['b', 'a']);
    expect((await storage.getLastWorkoutForExercise('squat', 'b')).id).toBe('a');
    expect(workouts().has('bad-null') && workouts().has('bad-text')).toBe(true);
  });

  it('does not stop the schema check', async () => {
    workouts().clear(); stores.get('meta').clear();
    workouts().set('bad-null', null); workouts().set('a', good('a', 1000));
    await storage.checkAndMigrateSchema();
    expect(stores.get('meta').get('schemaVersion')).toBe(storage.SCHEMA_VERSION);
    expect(stores.get('meta').get('manualProvenanceRepaired')).toBe(true);
    expect(workouts().get('bad-null')).toBeNull();
  });
});

describe('a stored schema version newer than the code', () => {
  it('is never lowered by an older build', async () => {
    stores.get('meta').set('schemaVersion', storage.SCHEMA_VERSION + 1);
    await storage.checkAndMigrateSchema();
    expect(stores.get('meta').get('schemaVersion')).toBe(storage.SCHEMA_VERSION + 1);
  });
});

describe('a set typed by hand after a refusal, restored from a backup', () => {
  it('keeps no machine result, even when the backup holds one (saved from 3 to 5 October)', async () => {
    workouts().clear();
    const wrong = { ...savedSet({ result: { refused: true, metadata: { duration: 9 } }, lift: 'squat', n: 7, manual: true }), id: 'm1', createdAt: 1000, machineResult: { reps: 7, confidence: null } };
    expect(await storage.restoreWorkout(wrong)).toBe(true);
    expect(workouts().get('m1')).toEqual({ ...wrong, machineResult: null });
  });

  it('leaves every other set as the backup holds it', async () => {
    const counted = good('c1', 1000);
    expect(await storage.restoreWorkout(counted)).toBe(true);
    expect(workouts().get('c1')).toEqual(counted);
    const logged = { ...good('l1', 1000), source: 'manual' }; // typed in the old manual log, not after a refusal
    expect(await storage.restoreWorkout(logged)).toBe(true);
    expect(workouts().get('l1')).toEqual(logged);
  });
});

describe('the fields the result screen saves', () => {
  it('are all known to the validator, so a read keeps them', () => {
    const result = { count: 6, reps: [], arm: 'left', confidence: 0.9, doubt: { lost: [] }, metadata: { duration: 20 }, timestamps: [] };
    const keys = new Set([
      ...Object.keys(savedSet({ result, lift: 'squat', n: 6, corrected: false })),
      ...Object.keys(savedSet({ result, lift: 'squat', n: 5, manual: true })),
      // added by saveWorkout
      'id', 'createdAt', 'schemaVersion',
    ]);
    expect([...keys].filter(k => !KNOWN_FIELDS.includes(k))).toEqual([]);
  });

  it('keep the set’s doubt through a save and a read', async () => {
    const result = { count: 6, reps: [], arm: 'left', confidence: 0.9, doubt: { lost: [[1, 2]] }, metadata: { duration: 20 }, timestamps: [] };
    const id = await storage.saveWorkout(savedSet({ result, lift: 'squat', n: 6, corrected: false }));
    expect((await storage.getWorkout(id)).doubt).toEqual({ lost: [[1, 2]] });
  });
});
