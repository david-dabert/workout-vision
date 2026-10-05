// A count typed by hand after the app refused a set is the person's, never the app's (Astra's review of 5 October):
// saveWorkout keeps the set's explicit machineResult: null; reading it back and restoring it from a backup keep it too.
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
        iterate: async fn => { for (const [k, v] of m) fn(structuredClone(v), k); },
        keys: async () => [...m.keys()],
      };
    },
  },
}));

const { saveWorkout, getWorkout, restoreWorkout } = await import('../storage');
const { savedSet } = await import('../../components/experience/saved-set');
const { backupFile, readBackup } = await import('../keep-sets');

const refused = { refused: true, metadata: { duration: 12 } };

describe('a count typed by hand after a refusal', () => {
  it('is saved with no machine result', async () => {
    const id = await saveWorkout(savedSet({ result: refused, lift: 'squat', n: 8, manual: true }));
    const back = await getWorkout(id);
    expect(back.machineResult).toBeNull();
    expect(back.correctedResult).toEqual({ reps: 8 });
    expect(back.source).toBe('manual');
  });

  it('keeps no machine result through a backup and its restore', async () => {
    const id = await saveWorkout(savedSet({ result: refused, lift: 'squat', n: 6, manual: true }));
    const saved = await getWorkout(id);
    const [entry] = readBackup(backupFile([saved]).text).sets;
    stores.get('workouts').delete(id);
    expect(await restoreWorkout(entry)).toBe(true);
    expect((await getWorkout(id)).machineResult).toBeNull();
  });

  it('still gives a set without the field its machine result (older records)', async () => {
    const id = await saveWorkout({ exercise: 'squat', reps: 9, confidence: 0.8, date: new Date().toISOString() });
    expect((await getWorkout(id)).machineResult).toEqual({ reps: 9, confidence: 0.8 });
  });
});

describe('the sets typed by hand before the fix', () => {
  it('get their machine result back to null, once, and nothing else changes', async () => {
    const { checkAndMigrateSchema } = await import('../storage');
    const wrong = { ...savedSet({ result: refused, lift: 'squat', n: 7, manual: true }), id: 'old-manual', machineResult: { reps: 7, confidence: null } };
    const counted = { exercise: 'squat', reps: 5, id: 'counted', createdAt: 1, date: '2026-10-04T10:00:00.000Z', machineResult: { reps: 5, confidence: 1 }, correctedResult: null };
    stores.get('workouts').set('old-manual', wrong); stores.get('workouts').set('counted', counted);
    await checkAndMigrateSchema();
    expect(stores.get('workouts').get('old-manual')).toEqual({ ...wrong, machineResult: null });
    expect(stores.get('workouts').get('counted')).toEqual(counted);
  });
});
