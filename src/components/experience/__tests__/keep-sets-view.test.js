// The history's backup and restore (KeepSets.jsx): what a restore reports, including when the sets are written
// but the list cannot be read again (review of 2 October), and where the iPhone warning applies (keep-sets.js).
import { describe, expect, it } from 'vitest';
import { restoreFlow, restoredLine } from '../keep-sets-view';
import { BACKUP_KIND, onIOS } from '../../../lib/keep-sets';

const file = sets => JSON.stringify({ kind: BACKUP_KIND, version: 1, sets });
const set = id => ({ id, exercise: 'bicep_curl', reps: 7, createdAt: 1790900000000 });

describe('a restore', () => {
  it('reports the sets added and those already here, with the list read again', async () => {
    const r = await restoreFlow(file([set('a'), set('b')]), true, { restore: async () => ({ added: 1, present: 1 }), list: async () => ['x'] });
    expect(r).toEqual({ note: '1 série restaurée. 1 était déjà sur ce téléphone.', sets: ['x'] });
  });
  it('still reports the sets added when the list cannot be read again', async () => {
    const r = await restoreFlow(file([set('a')]), true, { restore: async () => ({ added: 1, present: 0 }), list: async () => { throw new Error('read'); } });
    expect(r.note).toBe('1 série restaurée. Rouvrez vos séries pour les voir.');
    expect(r.sets).toBeUndefined();
  });
  it('says it failed only when the sets could not be written', async () => {
    const r = await restoreFlow(file([set('a')]), false, { restore: async () => { throw new Error('write'); }, list: async () => [] });
    expect(r.note).toBe('The backup could not be restored. Try again.');
  });
  it('counts plurals and unreadable sets in both languages', () => {
    expect(restoredLine({ added: 0, present: 3, skipped: 2 }, true)).toBe('0 série restaurée. 3 étaient déjà sur ce téléphone. 2 séries illisibles n’ont pas été restaurées.');
    expect(restoredLine({ added: 2, skipped: 1 }, false)).toBe('2 sets restored. 1 unreadable set was not restored.');
  });
});

describe('the iPhone warning', () => {
  it('applies to iPhone, iPad and iPadOS, not to Android or a desktop', () => {
    expect(onIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true);
    expect(onIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(onIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })).toBe(false);
    expect(onIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });
});
