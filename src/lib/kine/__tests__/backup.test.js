import { describe, expect, it } from 'vitest';
import { collect, makeBackup, openBackup, restore } from '../backup.js';

// A storage like localStorage, in memory.
function memory(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    dump: () => Object.fromEntries([...m].map(([k, v]) => [k, JSON.parse(v)])),
  };
}

const r1 = { v: 1, id: 'mains-jointes', patient: 'Christophe', date: '2026-10-16T09:00', verdict: 'match', joints: [], holds: [] };
const r2 = { ...r1, date: '2026-10-20T09:00', verdict: 'revise' };

describe('the backup', () => {
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
    const opened = await openBackup(file, 'correct horse');
    expect(opened.data.wv_kine_results).toEqual([r1, r2]);
  }, 20000);

  it('refuses a short password', async () => {
    await expect(makeBackup('short', { storage: memory() })).rejects.toThrow('password-short');
  });

  it('merges on restore: lists joined without duplicates, the higher invoice number kept, the rest left as it is', () => {
    const s = memory({ wv_kine_results: [r1], wv_kine_profile: { name: 'Olivier (ce téléphone)' }, wv_kine_invoice_seq: { year: 2026, n: 9 } });
    const added = restore({ wv_kine_results: [r1, r2], wv_kine_profile: { name: 'Olivier (sauvegarde)' }, wv_kine_invoice_seq: { year: 2026, n: 12 }, wv_lang: 'en' }, s);
    expect(added).toBe(1);
    expect(s.dump()).toEqual({ wv_kine_results: [r1, r2], wv_kine_profile: { name: 'Olivier (ce téléphone)' }, wv_kine_invoice_seq: { year: 2026, n: 12 } });
  });

  it('fills an empty phone from the backup', () => {
    const s = memory();
    restore({ wv_kine_profile: { name: 'Olivier' }, wv_kine_results: [r1] }, s);
    expect(s.dump()).toEqual({ wv_kine_profile: { name: 'Olivier' }, wv_kine_results: [r1] });
  });
});
