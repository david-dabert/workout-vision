/**
 * The coach's programme (Espace pro, 6 October 2026): the link's round trip, packed and plain; every bad link refused
 * without throwing; the length cap; planned against counted; the programme's PDF; the report's target line; and no
 * word of care in the new copy (wellness only).
 */
import { describe, it, expect, vi } from 'vitest';
// exercise-info.js (the names) reaches the drawing code, which reads the screen when it loads (as in exercise-name.test.js).
// jsPDF, seeing a window, takes its atob and btoa from it.
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1, atob: globalThis.atob, btoa: globalThis.btoa };
  globalThis.document ??= { createElement: () => any };
});
import {
  LIMITS, MAX_PAYLOAD, MAX_JSON, encodeProgramme, plainPayload, decodeProgramme, programmeOf, fromCompact, compact, payloadOf,
  programmeLink, programmeId, plannedOf, progressOf, toBase64url, targetText, cleanText,
} from '../programme';
import { programmePdf, programmeSheet, programmeFileName } from '../programme-pdf';
import { reportSheet } from '../report-sheet';
import { reportPdf } from '../report-pdf';
import { savedSet } from '../saved-set';
import { PRO, allStrings } from '../pro-copy';
import { jsPDF } from 'jspdf';
import { validateWorkout } from '../../../lib/validateSchema';

const NBSP = ' ';
const sample = {
  title: 'Haut du corps, semaine 1', who: 'Camille', note: 'Échauffement 10 min.\nBoire entre les séries.',
  items: [
    { key: 'squat', sets: 3, reps: 10, rest: 90, note: 'Descendre lentement' },
    { key: 'push_up', sets: 4, reps: 12, rest: 60, note: '' },
  ],
};
const b64 = text => toBase64url(new TextEncoder().encode(text));
const gz = async text => {
  const s = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  return 'z' + toBase64url(new Uint8Array(await new Response(s).arrayBuffer()));
};

describe('the programme link', () => {
  it('reads back what it wrote, packed and plain', async () => {
    for (const gzip of [true, false]) {
      const payload = await encodeProgramme(sample, { gzip });
      expect(payload).toMatch(/^[zj][A-Za-z0-9_-]+$/);
      if (!gzip) expect(payload[0]).toBe('j');
      const back = await decodeProgramme(payload);
      expect(back).toEqual({ ok: true, programme: sample });
    }
  });

  it('packs when packing is shorter, and keeps a full programme within the cap', async () => {
    const full = {
      title: 'T'.repeat(LIMITS.title), who: 'W'.repeat(LIMITS.who), note: 'Une note assez longue. '.repeat(26).slice(0, LIMITS.note).trim(),
      items: Array.from({ length: LIMITS.items }, (_, i) => ({ key: i % 2 ? 'squat' : 'deadlift', sets: 10, reps: 100, rest: 600, note: `Consigne ${i} `.repeat(14).slice(0, LIMITS.itemNote).trim() })),
    };
    const packed = await encodeProgramme(full), plain = await encodeProgramme(full, { gzip: false });
    expect(packed[0]).toBe('z');
    expect(packed.length).toBeLessThan(plain.length);
    expect(packed.length).toBeLessThanOrEqual(MAX_PAYLOAD);
    expect((await decodeProgramme(packed)).programme).toEqual(full);
    // A two-exercise programme makes a short link.
    expect((await encodeProgramme(sample)).length).toBeLessThan(260);
  });

  it('makes the plain payload at once, the same as the unpacked encoding (the link the share button has in hand)', async () => {
    expect(plainPayload(sample)).toBe(await encodeProgramme(sample, { gzip: false }));
    expect(await decodeProgramme(plainPayload(sample))).toEqual({ ok: true, programme: sample });
  });

  it('keeps accents and typographic marks whole', async () => {
    const p = { ...sample, title: 'Séance « été » — jambes', who: 'Zoé Lefèvre' };
    expect((await decodeProgramme(await encodeProgramme(p))).programme.title).toBe('Séance « été » — jambes');
  });

  it('refuses every bad payload, never throwing', async () => {
    const cases = [
      [undefined, 'empty'], ['', 'empty'], [42, 'empty'],
      ['x' + 'a'.repeat(10), 'malformed'], ['j<script>', 'malformed'], ['j' + '%%%', 'malformed'], ['z!!', 'malformed'],
      ['j' + b64('not json'), 'malformed'], ['j' + b64('[]'), 'malformed'], ['j' + b64('{"v":2,"t":"a","x":[["squat",3,10,90]]}'), 'malformed'],
      ['j' + b64('{"v":1,"t":"","x":[["squat",3,10,90]]}'), 'malformed'],
      ['j' + b64('{"v":1,"t":"a","x":[]}'), 'malformed'],
      ['j' + b64('{"v":1,"t":"a","x":[["Squat",3,10,90]]}'), 'malformed'],
      ['j' + b64('{"v":1,"t":"a","x":[["__proto__",3,10,90]]}'), 'unknown-exercise'],
      ['j' + b64('{"v":1,"t":"a","x":[["constructor",3,10,90]]}'), 'unknown-exercise'],
      ['j' + b64('{"v":1,"t":"a","x":[["chair_stand_test",3,10,90]]}'), 'unknown-exercise'],
      ['j' + b64('{"v":1,"t":"a","x":[["no_such_lift",3,10,90]]}'), 'unknown-exercise'],
      ['j' + b64('{"v":1,"t":"a","x":[["squat",0,10,90]]}'), 'bad-value'],
      ['j' + b64('{"v":1,"t":"a","x":[["squat",3,10.5,90]]}'), 'bad-value'],
      ['j' + b64('{"v":1,"t":"a","x":[["squat",3,10,9000]]}'), 'bad-value'],
      ['j' + b64('{"v":1,"t":"a","x":[["squat","3",10,90]]}'), 'bad-value'],
      ['j' + b64(`{"v":1,"t":"${'a'.repeat(LIMITS.title + 1)}","x":[["squat",3,10,90]]}`), 'bad-value'],
      ['j' + b64('{"v":1,"t":"a","w":{"x":1},"x":[["squat",3,10,90]]}'), 'bad-value'],
      ['j' + b64('{"v":1,"t":"a","x":[["squat",3,10,90,"n",7]]}'), 'malformed'],
      ['j' + toBase64url(new Uint8Array([0xff, 0xfe, 0x7b])), 'malformed'],
    ];
    for (const [payload, error] of cases) {
      const r = await decodeProgramme(payload);
      expect(r, String(payload).slice(0, 60)).toEqual({ ok: false, error });
    }
    // Too many exercises.
    const many = JSON.stringify({ v: 1, t: 'a', x: Array.from({ length: LIMITS.items + 1 }, () => ['squat', 3, 10, 90]) });
    expect(await decodeProgramme('j' + b64(many))).toEqual({ ok: false, error: 'malformed' });
  });

  it('caps the length: a long payload, and a small one that unpacks to too much, are refused', async () => {
    expect(await decodeProgramme('j' + 'A'.repeat(MAX_PAYLOAD))).toEqual({ ok: false, error: 'too-long' });
    const bomb = await gz(JSON.stringify({ v: 1, t: 'a', n: ' '.repeat(MAX_JSON * 4), x: [['squat', 3, 10, 90]] }));
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD);
    expect(await decodeProgramme(bomb)).toEqual({ ok: false, error: 'too-long' });
  });

  it('keeps text as text: control characters out, markup left as plain characters', async () => {
    const r = fromCompact({ v: 1, t: 'A\u0000B\u0007 <img src=x onerror=alert(1)>', n: 'l1\r\nl2\u0001', x: [['squat', 3, 10, 90]] });
    expect(r.ok).toBe(true);
    expect(r.programme.title).toBe('A B <img src=x onerror=alert(1)>');
    expect(r.programme.note).toBe('l1\nl2');
    expect(cleanText('  a \t b  ')).toBe('a b');
  });

  it('reads the payload from the address, and builds the link on the app’s own address', () => {
    expect(payloadOf('#programme=jAbC')).toBe('jAbC');
    expect(payloadOf('#/programme=zX-_')).toBe('zX-_');
    expect(payloadOf('#history')).toBe(null);
    expect(payloadOf('')).toBe(null);
    expect(programmeLink('https://example.org/workout-vision/#pro', 'jAb')).toBe('https://example.org/workout-vision/#programme=jAb');
  });

  it('names a programme by its content: the same twice is one', () => {
    expect(programmeId(sample)).toBe(programmeId(JSON.parse(JSON.stringify(sample))));
    expect(programmeId(sample)).not.toBe(programmeId({ ...sample, title: 'Autre' }));
    expect(programmeId(sample)).toMatch(/^p[0-9a-z]+$/);
  });

  it('takes a draft only once it has a title and an exercise, numbers brought into bounds', () => {
    expect(programmeOf({ title: '', who: '', note: '', items: sample.items })).toBe(null);
    expect(programmeOf({ title: 'A', who: '', note: '', items: [] })).toBe(null);
    const p = programmeOf({ title: ' A ', who: '', note: '', items: [{ key: 'squat', sets: 40, reps: 0, rest: 'x', note: ' n ' }, { key: 'chair_stand_test', sets: 1, reps: 1, rest: 0 }] });
    expect(p).toEqual({ title: 'A', who: '', note: '', items: [{ key: 'squat', sets: 10, reps: 1, rest: 90, note: 'n' }] });
    expect(compact(p)).toEqual({ v: 1, t: 'A', x: [['squat', 10, 1, 90, 'n']] });
    expect(compact({ ...p, items: [{ ...p.items[0], note: '' }] })).toEqual({ v: 1, t: 'A', x: [['squat', 10, 1, 90]] });
  });
});

describe('planned against counted', () => {
  const id = programmeId(sample);
  const now = new Date(2026, 9, 6, 18, 0);
  const at = (h, m = 0) => new Date(2026, 9, 6, h, m).getTime();
  const set = (item, reps, createdAt, extra = {}) => ({ exercise: sample.items[item].key, reps, createdAt, planned: plannedOf(id, item, sample.items[item]), ...extra });

  it('puts each set saved today beside its exercise’s target, oldest first', () => {
    const sets = [set(0, 9, at(17, 10)), set(0, 10, at(17, 5)), set(1, 12, at(17, 20)), set(0, 10, at(17, 15))];
    const p = progressOf(sample, id, sets, now);
    expect(p.items[0]).toEqual({ index: 0, key: 'squat', target: { sets: 3, reps: 10 }, done: [10, 9, 10], complete: true });
    expect(p.items[1]).toEqual({ index: 1, key: 'push_up', target: { sets: 4, reps: 12 }, done: [12], complete: false });
    expect([p.complete, p.total]).toEqual([1, 2]);
  });

  it('leaves out other days, other programmes and sets saved outside a programme', () => {
    const sets = [
      set(0, 10, new Date(2026, 9, 5, 17).getTime()),
      { ...set(0, 10, at(17)), planned: { ...plannedOf('pother', 0, sample.items[0]) } },
      { exercise: 'squat', reps: 10, createdAt: at(17) },
      { ...set(0, 10, at(17)), exercise: 'deadlift' },
    ];
    expect(progressOf(sample, id, sets, now).items[0].done).toEqual([]);
  });

  it('is kept with the set as saved, and printed on the report as "Prévu : 3 × 10"', () => {
    const planned = plannedOf(id, 0, sample.items[0]);
    expect(planned).toEqual({ programme: id, item: 0, sets: 3, reps: 10, rest: 90 });
    const result = { count: 10, reps: [], arm: 'right', confidence: 0.9, metadata: { duration: 30 }, timestamps: [] };
    expect(savedSet({ result, lift: 'squat', n: 10, corrected: false, planned }).planned).toEqual(planned);
    expect('planned' in savedSet({ result, lift: 'squat', n: 10, corrected: false })).toBe(false);
    expect(savedSet({ result, lift: 'squat', n: 8, corrected: true, manual: true, planned }).planned).toEqual(planned);
    expect(targetText(planned)).toBe(`3${NBSP}×${NBSP}10`);
    const base = { lang: 'fr', date: new Date(2026, 9, 6), liftName: 'Squat', count: 10, counted: 10, arm: 'right' };
    expect(reportSheet({ ...base, planned }).planned).toBe(`Prévu${NBSP}: 3${NBSP}×${NBSP}10`);
    expect(reportSheet({ ...base, lang: 'en', planned }).planned).toBe(`Planned: 3${NBSP}×${NBSP}10`);
    expect(reportSheet(base).planned).toBe('');
    expect(reportSheet({ ...base, planned: { sets: 'x' } }).planned).toBe('');
  });

  it('keeps the target through a read of the stored set, and drops one that is not a target', () => {
    const planned = plannedOf(id, 0, sample.items[0]);
    const stored = { id: 'w1', exercise: 'squat', reps: 10, createdAt: 1, planned };
    expect(validateWorkout(stored).sanitized.planned).toEqual(planned);
    for (const bad of [{ programme: 3 }, { ...planned, sets: 1.5 }, { ...planned, programme: 'x'.repeat(40) }, 'p1']) {
      expect('planned' in validateWorkout({ ...stored, planned: bad }).sanitized).toBe(false);
    }
  });

  it('sets the target on the report’s PDF, beside the count', () => {
    const planned = plannedOf(id, 0, sample.items[0]);
    const texts = [];
    const hook = ['preProcessText', ({ text }) => { texts.push(Array.isArray(text) ? text.join('') : text); }];
    jsPDF.API.events.push(hook);
    try { reportPdf(reportSheet({ lang: 'fr', date: new Date(2026, 9, 6), liftName: 'Squat', count: 9, counted: 9, arm: 'right', planned })); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
    expect(texts.join('')).toContain('Prévu');
    expect(texts.join('').replace(/\s/g, '')).toContain('3×10');
  });
});

describe('the programme’s PDF', () => {
  // jsPDF tells its listeners of every text it sets (its events, as its plugins use them); the pages are counted in
  // the file, as report.test.js counts them.
  async function drawn(run) {
    const texts = [];
    const hook = ['preProcessText', ({ text }) => { texts.push(Array.isArray(text) ? text.join('') : text); }];
    jsPDF.API.events.push(hook);
    let blob;
    try { blob = run(); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
    const pages = Buffer.from(await blob.arrayBuffer()).toString('latin1').match(/\/Type \/Page\b/g).length;
    return { text: texts.join(''), pages, blob };
  }
  const date = new Date(2026, 9, 6);

  it('sets the title, for whom, the date, each exercise with sets × reps, rest and cue, and the note', async () => {
    const { text, pages, blob } = await drawn(() => programmePdf(sample, { lang: 'fr', date }));
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
    expect(pages).toBe(1);
    const flat = text.replace(/\s/g, '');
    for (const s of ['PROGRAMME', '6OCTOBRE2026', 'Hautducorps', 'POUR', 'Camille', 'EXERCICE', 'SÉRIES×RÉP.', 'RÉCUP.', 'Squat', 'Descendrelentement', '3×10', '4×12', '1min30', '1min', 'NOTE', 'Échauffement10min.', 'Boireentrelesséries.']) expect(flat).toContain(s);
    expect(text).not.toMatch(/Workout ?Vision/i);
  });

  it('runs onto more pages for a long programme, numbering them, and writes the words in English', async () => {
    const long = { ...sample, items: Array.from({ length: LIMITS.items }, (_, i) => ({ key: 'squat', sets: 3, reps: 10, rest: 45, note: `Consigne ${i}, tempo lent, pause en bas` })) };
    const { text, pages } = await drawn(() => programmePdf(long, { lang: 'en', date }));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain(`1 / ${pages}`);
    expect(text.replace(/\s/g, '')).toContain('SETS×REPS');
  });

  it('reads its words from the copy, and names its file in ASCII', () => {
    const s = programmeSheet(sample, { lang: 'fr', date });
    expect(s.people).toEqual([['Pour', 'Camille'], ['Exercices', '2']]);
    expect(s.rows[0]).toEqual({ index: '01', name: 'Squat', note: 'Descendre lentement', target: `3${NBSP}×${NBSP}10`, rest: `1${NBSP}min${NBSP}30` });
    expect(programmeFileName(sample, { lang: 'fr', date })).toBe('programme-camille-2026-10-06.pdf');
    expect(programmeFileName({ ...sample, who: '' }, { lang: 'en', date })).toBe('programme-haut-du-corps-semaine-1-2026-10-06.pdf');
  });
});

describe('the copy of the programmes', () => {
  // Wellness only (6 October): no word of care. Physiotherapists are named as users, and only so; "kinésithérapeute" and
  // "physiotherapist" hold "thérap" inside a word, which the word boundary lets through.
  const MEDICAL = /\bpatients?\b|r[ée][ée]ducation|rehabilitat|diagnos|traitement|\bth[ée]rap|\btreatment|gu[ée]ri|\bheal|\bcure\b|\binjur|\bbless|douleur|\bpain\b|sympt[oô]m|patholog|m[ée]dic|sant[ée]/i;
  for (const lang of ['fr', 'en']) {
    it(`has no medical word (${lang})`, () => {
      const strings = allStrings(lang);
      expect(strings.length).toBeGreaterThan(80);
      for (const s of strings) expect(s, s).not.toMatch(MEDICAL);
    });
  }
  it('names coaches and physiotherapists as users', () => {
    expect(PRO.fr.choiceRowSub).toBe('Pour les coachs et les kinésithérapeutes');
    expect(PRO.en.choiceRowSub).toBe('For coaches and physiotherapists');
  });
  it('has the same keys in both languages', () => {
    const keys = o => Object.keys(o).sort();
    expect(keys(PRO.en)).toEqual(keys(PRO.fr));
    expect(keys(PRO.en.errors)).toEqual(keys(PRO.fr.errors));
  });
});
