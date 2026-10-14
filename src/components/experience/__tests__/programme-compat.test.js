/**
 * Links and data issued before the exercise sheet (holds, sides, frequency; 14 October 2026) keep opening and keep
 * their meaning. The fixtures below were made by the app as it stood at 854ae41, before any change to programme.js:
 * OLD_J by plainPayload, OLD_Z by packNow (programme-pdf.js), OLD_RESULTS by plainResultsPayload. This file ran green
 * on that commit first; it must stay green, unchanged, after it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compact, decodeProgramme, decodeResults, plainPayload, plannedOf, programmeId, programmeOf, progressOf,
} from '../programme';
import { keepReceived, loadReceived } from '../programme-store';

const OLD_JSON = '{"v":1,"t":"Fiche du 6 octobre","w":"Camille","n":"Échauffement 10 min.\\nBoire entre les séries.","x":[["squat",3,10,90,"Descendre lentement"],["push_up",4,12,60],["dead_bug",3,10,60]]}';
const OLD_J = 'jeyJ2IjoxLCJ0IjoiRmljaGUgZHUgNiBvY3RvYnJlIiwidyI6IkNhbWlsbGUiLCJuIjoiw4ljaGF1ZmZlbWVudCAxMCBtaW4uXG5Cb2lyZSBlbnRyZSBsZXMgc8Opcmllcy4iLCJ4IjpbWyJzcXVhdCIsMywxMCw5MCwiRGVzY2VuZHJlIGxlbnRlbWVudCJdLFsicHVzaF91cCIsNCwxMiw2MF0sWyJkZWFkX2J1ZyIsMywxMCw2MF1dfQ';
const OLD_Z = 'zH4sIAKXWz2oCAy2MSwrCMBRFtxLe-FESlYIdqriJWkqavNpAm9Z8VBAX4FJcRzdmWpxcuOd-XnCHQiAEKOBsVEdMR5azUYWxcQQIjxQc5WD6fnE2ufmjOhnblgaygQnOBmOziz2MxhFLKGlPnvn56wz5LK2eUJQl-FuUAXCLguOeI5zIK7J6rduwvkGFJUzRd3WcAHcoNpjzhWmSum7i9T9PsHr_AOM2XUm7AAAA';
const OLD_ID = 'pn7r47y';
const OLD_RESULTS = 'jeyJ2IjoxLCJ0IjoiRmljaGUgZHUgNiBvY3RvYnJlIiwidyI6IkNhbWlsbGUiLCJkIjoiMjAyNi0xMC0wOSIsImgiOiIxODoyOCIsIngiOltbInNxdWF0IiwzLDEwLFsxMCw4XV0sWyJwdXNoX3VwIiw0LDEyLFtdXSxbImRlYWRfYnVnIiwzLDEwLFtdXV0sImsiOlsiYXQiLCIiLCIiXX0';

// The programme as the app read it before the change.
const OLD = {
  title: 'Fiche du 6 octobre', who: 'Camille', note: 'Échauffement 10 min.\nBoire entre les séries.',
  items: [
    { key: 'squat', sets: 3, reps: 10, rest: 90, note: 'Descendre lentement' },
    { key: 'push_up', sets: 4, reps: 12, rest: 60, note: '' },
    { key: 'dead_bug', sets: 3, reps: 10, rest: 60, note: '' },
  ],
};

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
afterEach(() => { vi.unstubAllGlobals(); });

describe('a programme link issued before the exercise sheet', () => {
  it('opens, plain and packed, as the same programme, with no field it did not carry', async () => {
    for (const payload of [OLD_J, OLD_Z]) {
      const r = await decodeProgramme(payload);
      expect(r).toEqual({ ok: true, programme: OLD });
      expect(Object.keys(r.programme).sort()).toEqual(['items', 'note', 'title', 'who']);
      for (const item of r.programme.items) expect(Object.keys(item).sort()).toEqual(['key', 'note', 'reps', 'rest', 'sets']);
      expect('frequency' in r.programme).toBe(false);
    }
  });

  it('is written back byte for byte, and keeps its id', async () => {
    const { programme } = await decodeProgramme(OLD_J);
    expect(JSON.stringify(compact(programme))).toBe(OLD_JSON);
    expect(plainPayload(programme)).toBe(OLD_J);
    expect(programmeId(programme)).toBe(OLD_ID);
  });

  it('kept on a client’s phone, loads with the same id', () => {
    vi.stubGlobal('localStorage', memory());
    localStorage.setItem('wv_programmes', JSON.stringify([{ id: OLD_ID, data: JSON.parse(OLD_JSON), receivedAt: 1000, openedAt: 1000 }]));
    const list = loadReceived();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: OLD_ID, programme: OLD, previous: [] });
    // Opened again from its link, it is the same programme, not a new version.
    expect(keepReceived(OLD, 2000).id).toBe(OLD_ID);
    expect(loadReceived()).toHaveLength(1);
  });

  it('a set filmed from it lands on its exercise', () => {
    const now = new Date(2026, 9, 9, 18, 30);
    const set = { exercise: 'squat', reps: 10, createdAt: new Date(2026, 9, 9, 18, 10).getTime(), planned: { programme: OLD_ID, item: 0, key: 'squat', sets: 3, reps: 10, rest: 90 } };
    expect(plannedOf(OLD_ID, 0, OLD.items[0])).toEqual(set.planned);
    const p = progressOf(OLD, OLD_ID, [set], now);
    expect(p.items.map(i => i.done)).toEqual([[10], [], []]);
    expect(p.items.map(i => i.counted)).toEqual([true, true, false]);
    expect([p.complete, p.total]).toEqual([0, 2]);
  });

  it('a coach’s draft kept before reads as the same programme', () => {
    const draft = { id: 'dold', updatedAt: 1, title: ' Fiche du 6 octobre ', who: 'Camille', note: 'Échauffement 10 min.\nBoire entre les séries.', items: [
      { key: 'squat', sets: 3, reps: 10, rest: 90, note: 'Descendre lentement' },
      { key: 'push_up', sets: 4, reps: 12, rest: 60, note: '' },
      { key: 'dead_bug', sets: 3, reps: 10, rest: 60, note: '' },
    ] };
    const p = programmeOf(draft);
    expect(p).toEqual(OLD);
    expect(programmeId(p)).toBe(OLD_ID);
  });
});

describe('a results link issued before the exercise sheet', () => {
  it('opens unchanged, with its time and how each set was kept', async () => {
    expect(await decodeResults(OLD_RESULTS)).toEqual({ ok: true, results: {
      title: 'Fiche du 6 octobre', who: 'Camille', day: '2026-10-09', time: '18:28', items: [
        { key: 'squat', sets: 3, reps: 10, done: [10, 8], kinds: ['a', 't'] },
        { key: 'push_up', sets: 4, reps: 12, done: [], kinds: [] },
        { key: 'dead_bug', sets: 3, reps: 10, done: [], kinds: [] },
      ],
    } });
  });
});
