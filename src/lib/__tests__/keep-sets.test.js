// The backup file of the sets (keep-sets.js): what is written is what is read back, a foreign or newer file is
// refused whole, a damaged set is left out and counted, and restoring the same sets twice adds nothing.
import { describe, expect, it } from 'vitest';
import { BACKUP_KIND, backupFile, readBackup, restoreBackup } from '../keep-sets';

const set = (id, extra = {}) => ({ id, exercise: 'lateral_raise', reps: 8, createdAt: 1790900000000, repDetails: [{ index: 1, startTime: 0, endTime: 2 }], machineResult: { reps: 8 }, correctedResult: null, ...extra });

describe('the backup file', () => {
  it('reads back every set it holds, unchanged', () => {
    const sets = [set('a'), set('b', { reps: 12, corrected: true, machineResult: { reps: 8 }, correctedResult: { reps: 12 } })];
    const f = backupFile(sets, new Date('2026-10-02T12:00:00Z'));
    expect(f.name).toBe('workout-vision-series-2026-10-02.json');
    expect(readBackup(f.text)).toEqual({ sets, skipped: 0 });
  });
  it('refuses a file that is not a backup, and a later version', () => {
    expect(readBackup('not json').error).toBe('unreadable');
    expect(readBackup(JSON.stringify({ kind: 'other', sets: [] })).error).toBe('not-a-backup');
    expect(readBackup(JSON.stringify({ kind: BACKUP_KIND, version: 2, sets: [] })).error).toBe('newer-version');
  });
  it('leaves out a damaged set and counts it', () => {
    const text = JSON.stringify({ kind: BACKUP_KIND, version: 1, sets: [set('a'), { id: 'b', reps: 3 }, set('c', { reps: 2.5 }), set('d', { createdAt: 'never' }), null] });
    const r = readBackup(text);
    expect(r.sets.map(w => w.id)).toEqual(['a']);
    expect(r.skipped).toBe(4);
  });
  it('adds only the sets this phone does not hold', async () => {
    const store = new Map([['a', set('a')]]);
    const put = async w => { if (store.has(w.id)) return false; store.set(w.id, w); return true; };
    expect(await restoreBackup([set('a'), set('b')], put)).toEqual({ added: 1, present: 1 });
    expect(await restoreBackup([set('a'), set('b')], put)).toEqual({ added: 0, present: 2 });
    expect([...store.keys()]).toEqual(['a', 'b']);
  });
});

describe('a restore that stops part-way (audit of 2 October)', () => {
  it('returns what it wrote and how many it could not', async () => {
    const store = new Map();
    const put = async w => { if (store.size === 1) throw new DOMException('full', 'QuotaExceededError'); if (store.has(w.id)) return false; store.set(w.id, w); return true; };
    expect(await restoreBackup([set('a'), set('b'), set('c')], put)).toEqual({ added: 1, present: 0, failed: 2 });
  });
  it('throws when nothing at all could be written', async () => {
    await expect(restoreBackup([set('a')], async () => { throw new Error('closed'); })).rejects.toThrow('closed');
  });
});

describe('the backup file name', () => {
  it('carries the phone\'s own date, not the UTC one', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/Paris';
    try { expect(backupFile([], new Date('2026-10-02T22:30:00Z')).name).toBe('workout-vision-series-2026-10-03.json'); }
    finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; }
  });
});
