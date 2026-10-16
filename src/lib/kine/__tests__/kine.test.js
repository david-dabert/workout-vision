import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIBRARY, exerciseById } from '../library.js';
import { cleanProgramme, cleanResult, pack, payloadAfter, programmeLink, PROGRAMME_KEY, resultLink, resultPayload, RESULT_KEY, unpack } from '../links.js';

describe('the reference library', () => {
  it('holds Olivier\'s four exercises, each with steps in both languages and its dosage', () => {
    expect(LIBRARY.map(e => e.id)).toEqual(['mains-jointes', 'rotation-externe', 'abduction-horizontale', 'elevation-paliers']);
    for (const e of LIBRARY) {
      expect(e.fr.steps.length).toBeGreaterThan(1);
      expect(e.en.steps.length).toBe(e.fr.steps.length);
      expect(e.dosage.reps).toBeGreaterThan(0);
    }
  });

  it('compares all four, exercises 2 and 3 on where a segment points rather than on joint angles (R8)', () => {
    expect(LIBRARY.every(e => e.compare)).toBe(true);
    expect(Object.keys(exerciseById('rotation-externe').measures.directions)).toEqual(['leftForearm']);
    expect(Object.keys(exerciseById('abduction-horizontale').measures.directions)).toEqual(['leftArm']);
    expect(exerciseById('mains-jointes').measures).toBeUndefined();
  });
});

const programme = {
  kine: { name: 'Olivier', phone: '06 00 00 00 00', email: 'o@example.org' }, patient: 'Christophe', perDay: 2, weeks: 6,
  note: 'Pas de douleur au-delà de 3 sur 10.', date: '2026-10-15',
  items: [{ id: 'mains-jointes', reps: 10, sets: 5, note: 'Bien relâcher.' }, { id: 'abduction-horizontale', reps: 10, sets: 3, note: '' }],
};

describe('programme and result links', () => {
  it('carries a programme whole through its link', () => {
    const link = programmeLink('https://example.org/app/#old', programme);
    expect(link.startsWith(`https://example.org/app/#${PROGRAMME_KEY}`)).toBe(true);
    expect(cleanProgramme(unpack(payloadAfter(link.slice(link.indexOf('#')), PROGRAMME_KEY)))).toEqual({ v: 1, ...programme });
  });

  it('drops unknown exercises and clamps numbers', () => {
    const p = cleanProgramme({ ...programme, perDay: 99, items: [{ id: 'nope' }, { id: 'mains-jointes', reps: -3, sets: 400 }] });
    expect(p.perDay).toBe(1);
    expect(p.items).toEqual([{ id: 'mains-jointes', reps: 10, sets: 3, note: '' }]);
    expect(cleanProgramme({ items: [{ id: 'nope' }] })).toBeNull();
  });

  it('refuses a malformed or oversized payload', () => {
    expect(unpack('zzzz')).toBeNull();
    expect(unpack('j' + 'A'.repeat(20000))).toBeNull();
    expect(unpack(null)).toBeNull();
  });

  it('carries the treated side, only for an exercise done with one arm', () => {
    const p = cleanProgramme({ ...programme, items: [{ id: 'abduction-horizontale', side: 'right' }, { id: 'mains-jointes', side: 'right' }, { id: 'rotation-externe', side: 'up' }] });
    expect(p.items.map(i => i.side)).toEqual(['right', undefined, undefined]);
  });

  it('turns control characters of a link into spaces', () => {
    expect(cleanProgramme({ ...programme, patient: 'Chris\u0000tophe\n' }).patient).toBe('Chris tophe');
  });

  it('carries a result as figures only', () => {
    const link = resultLink('https://example.org/app/', {
      id: 'mains-jointes', patient: 'Christophe', kine: 'Olivier', date: '2026-10-15T18:00', verdict: 'revise', tempo: 1.3456,
      joints: [{ name: 'rightShoulder', within: 0.523, range: 0.651 }], holds: [{ ref: 106.4, att: 91.2, refSec: 1.7, attSec: 0, status: 'short' }],
      video: 'must not travel',
    });
    const r = cleanResult(unpack(payloadAfter(link.slice(link.indexOf('#')), RESULT_KEY)));
    expect(r).toMatchObject({ verdict: 'revise', tempo: 1.35, joints: [{ name: 'rightShoulder', within: 0.52, range: 0.65 }], holds: [{ ref: 106, att: 91, status: 'short' }] });
    expect(JSON.stringify(r)).not.toContain('must not travel');
  });

  it('admits only known measure names, clamps shares, and drops a date that is not one', () => {
    const r = cleanResult({ id: 'mains-jointes', date: 'not a date at all', joints: [{ name: '__proto__', within: 0.9 }, { name: 'rightShoulder', within: 42, range: -1 }, { name: 'rightShoulder', within: 0.1 }] });
    expect(r.joints).toEqual([{ name: 'rightShoulder', within: 1, range: 0 }]);
    expect(r.date).toBe('');
  });

  it('finds the result link in pasted text, words and other "#" around it', () => {
    const link = resultLink('https://example.org/app/', { id: 'mains-jointes', verdict: 'match', joints: [], holds: [] });
    const payload = link.slice(link.indexOf(RESULT_KEY) + RESULT_KEY.length);
    expect(resultPayload(`Séance #2 : ${link} merci !`)).toBe(payload);
    expect(resultPayload('rien ici')).toBeNull();
  });

  it('packs to the shorter of plain and gzip', () => {
    expect(pack({ a: 1 })[0]).toBe('j');
    expect(pack({ text: 'répété '.repeat(200) })[0]).toBe('z');
  });
});

describe('the media address', () => {
  // The deploy job builds with the repository variable set, CI without it: each case sets its own value.
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it('gives no media URL without an address set for the build', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', '');
    vi.resetModules();
    const { mediaUrl, hasMedia } = await import('../library.js');
    expect(hasMedia()).toBe(false);
    expect(mediaUrl(exerciseById('mains-jointes'))).toBeNull();
  });

  it('reads the videos from the address the build names', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', 'https://media.example.org');
    vi.resetModules();
    const { mediaUrl } = await import('../library.js');
    expect(mediaUrl(exerciseById('mains-jointes'))).toBe('https://media.example.org/olivier-1-mains-jointes.mp4');
  });
});
