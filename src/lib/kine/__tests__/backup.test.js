import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collect, makeBackup, openBackup, restore } from '../backup.js';

// A storage like localStorage, in memory; `failAt` makes the n-th setItem throw (a full storage).
function memory(init = {}, failAt = 0) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  let writes = 0;
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { writes++; if (failAt && writes === failAt) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    dump: () => Object.fromEntries([...m].map(([k, v]) => [k, JSON.parse(v)])),
  };
}

const result = (date, patient = 'Christophe', verdict = 'match') => ({ v: 1, id: 'mains-jointes', patient, kine: '', date, prog: '', verdict, tempo: null, joints: [], holds: [] });
const r1 = result('2026-10-16T09:00'), r2 = result('2026-10-20T09:00', 'Christophe', 'revise');

describe('the backup file', () => {
  it('holds every physio key, and nothing else', () => {
    const s = memory({ wv_kine_results: [r1], wv_kine_profile: { name: 'Olivier' }, wv_lang: 'fr', wv_kine_last_backup: '2026-10-01' });
    expect(Object.keys(collect(s)).sort()).toEqual(['wv_kine_profile', 'wv_kine_results']);
  });

  it('opens with its password only, and gives back what it holds', async () => {
    const s = memory({ wv_kine_results: [r1, r2], wv_kine_profile: { name: 'Olivier' } });
    const file = await makeBackup('correct horse', { storage: s });
    expect(file).not.toContain('Christophe');
    await expect(openBackup(file, 'wrong horse')).rejects.toThrow('wrong-password');
    await expect(openBackup('{"kind":"other"}', 'x')).rejects.toThrow('not-backup');
    const forged = JSON.stringify({ ...JSON.parse(file), iterations: 50000000 });
    await expect(openBackup(forged, 'correct horse')).rejects.toThrow('not-backup');
    expect((await openBackup(file, 'correct horse')).data.wv_kine_results).toEqual([r1, r2]);
  }, 20000);

  it('refuses a short password', async () => {
    await expect(makeBackup('short', { storage: memory() })).rejects.toThrow('password-short');
  });
});

describe('restoring', () => {
  it('joins results without duplicates, by the follow-up\'s own rule', () => {
    const s = memory({ wv_kine_results: [r1] });
    const r = restore({ wv_kine_results: [{ ...r1, patient: ' christophe ' }, r2] }, s);
    expect(r).toMatchObject({ ok: true, added: 1 });
    expect(s.dump().wv_kine_results).toEqual([r1, r2]);
  });

  it('fills the practice\'s empty fields and keeps the phone\'s own', () => {
    const s = memory({ wv_kine_profile: { name: 'Olivier (ce téléphone)', rpps: '' } });
    const r = restore({ wv_kine_profile: { name: 'Olivier (sauvegarde)', rpps: '10101', fee: 45, hack: 'x' } }, s);
    expect(r.filled).toBe(2);
    expect(s.dump().wv_kine_profile).toEqual({ name: 'Olivier (ce téléphone)', rpps: '10101', fee: 45 });
  });

  it('keeps the higher invoice number, never a lower one', () => {
    const s = memory({ wv_kine_invoice_seq: { year: 2026, n: 9 } });
    restore({ wv_kine_invoice_seq: { year: 2026, n: 4 } }, s);
    expect(s.dump().wv_kine_invoice_seq).toEqual({ year: 2026, n: 9 });
    restore({ wv_kine_invoice_seq: { year: 2026, n: 12 } }, s);
    expect(s.dump().wv_kine_invoice_seq).toEqual({ year: 2026, n: 12 });
  });

  it('leaves out values of the wrong type, so the follow-up and the invoices keep working', () => {
    const s = memory({ wv_kine_invoice_seq: { year: 2026, n: 9 } });
    const r = restore({ wv_kine_results: {}, wv_kine_invoice_seq: [1, 2], wv_kine_other: 'x', wv_kine_profile: 'Olivier' }, s);
    expect(r.skipped).toBe(4);
    expect(s.dump()).toEqual({ wv_kine_invoice_seq: { year: 2026, n: 9 } });
    expect(restore({ wv_kine_results: [null, { id: 'nope' }, r1] }, s)).toMatchObject({ added: 1, skipped: 2 });
  });

  it('keeps everything the phone holds within the follow-up\'s limit, and says what it left out', () => {
    const phone = Array.from({ length: 800 }, (_, i) => result(`2026-01-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, `p${i}`));
    const backup = Array.from({ length: 600 }, (_, i) => result(`2026-02-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, `q${i}`));
    const s = memory({ wv_kine_results: phone });
    const r = restore({ wv_kine_results: backup }, s);
    expect(r).toMatchObject({ added: 200, dropped: 400 });
    const kept = s.dump().wv_kine_results;
    expect(kept).toHaveLength(1000);
    expect(phone.every(p => kept.some(k => k.patient === p.patient))).toBe(true);
  });

  it('writes nothing when the storage refuses part of it', () => {
    const s = memory({ wv_kine_profile: { name: '' } }, 2);
    const r = restore({ wv_kine_results: [r1], wv_kine_profile: { name: 'Olivier' } }, s);
    expect(r.ok).toBe(false);
    expect(s.dump()).toEqual({ wv_kine_profile: { name: '' } });
  });
});

describe('the backup screen', () => {
  let store;
  beforeEach(() => { store = {}; vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }); });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('counts a backup only when the physiotherapist says the file is put away', async () => {
    const { lastBackup, markBackedUp } = await import('../backup.js');
    expect(lastBackup()).toBeNull();
    markBackedUp(new Date('2026-10-16T10:00:00Z'));
    expect(lastBackup()).toBe('2026-10-16T10:00:00.000Z');
  });
});
