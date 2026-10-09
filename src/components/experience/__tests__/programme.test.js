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
  resultsOf, encodeResults, decodeResults, plainResultsPayload, resultsLink, resultsPayloadOf, RESULT_LIMITS,
  keptLetter, lastDayOf, dayWords, timeWords, RESULTS_DAYS_BACK,
} from '../programme';
import { programmePdf, programmeSheet, programmeFileName, programmeQr, packNow, QR_MAX_VERSION, QR_SIDE, QR_BLOCK_MAX, QR_MODULE_MIN } from '../programme-pdf';
import { draftFromResults, isEmptyDraft, loadDrafts, saveDraft, newDraft, MAX_DRAFTS, keepReceived, loadReceived } from '../programme-store';
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
    expect(p.items[0]).toEqual({ index: 0, key: 'squat', target: { sets: 3, reps: 10 }, done: [10, 9, 10], kinds: ['a', 'a', 'a'], complete: true });
    expect(p.items[1]).toEqual({ index: 1, key: 'push_up', target: { sets: 4, reps: 12 }, done: [12], kinds: ['a'], complete: false });
    expect([p.complete, p.total]).toEqual([1, 2]);
    expect(p.last).toBe(at(17, 20));
    expect(progressOf(sample, id, [], now).last).toBe(null);
  });

  it('carries the exercise’s key in the target, so it never reaches another exercise’s set', () => {
    expect(plannedOf(id, 1, sample.items[1])).toEqual({ programme: id, item: 1, key: 'push_up', sets: 4, reps: 12, rest: sample.items[1].rest });
  });

  it('says how each set was kept: the app’s count, corrected, typed after a refusal, or the app’s proposal confirmed', () => {
    const result = { count: 10, reps: [], arm: 'right', confidence: 0.9, metadata: { duration: 20 } };
    const kept = o => keptLetter(savedSet({ result, lift: 'squat', ...o }));
    expect(kept({ n: 10, corrected: false })).toBe('a');
    expect(kept({ n: 8, corrected: true })).toBe('c');
    expect(kept({ n: 7, corrected: true, manual: true })).toBe('t');
    expect(kept({ n: 6, corrected: true, manual: true, proposal: 6 })).toBe('p');
    expect(kept({ n: 7, corrected: true, manual: true, proposal: 6 })).toBe('t');
    const sets = [set(0, 10, at(17, 5), { source: 'counter-core', machineResult: { reps: 10 } }), set(0, 8, at(17, 10), { source: 'manual' })];
    expect(progressOf(sample, id, sets, now).items[0].kinds).toEqual(['a', 't']);
  });

  it('finds the latest session of the week once its day is over, and none older or of another programme', () => {
    const days = n => now.getTime() - n * 86400000;
    expect(lastDayOf(sample, id, [set(0, 10, days(1)), set(1, 12, days(2))], now)).toEqual(new Date(days(1)));
    expect(lastDayOf(sample, id, [set(0, 10, days(RESULTS_DAYS_BACK + 1))], now)).toBe(null);
    expect(lastDayOf(sample, id, [{ ...set(0, 10, days(1)), planned: plannedOf('pother', 0, sample.items[0]) }], now)).toBe(null);
    expect(lastDayOf(sample, id, [{ ...set(0, 10, days(1)), exercise: 'deadlift' }], now)).toBe(null);
    expect(lastDayOf(sample, id, [], now)).toBe(null);
  });

  it('names a day and a time as a coach reads them', () => {
    expect(dayWords(new Date(2026, 9, 1), 'fr')).toBe('1er octobre');
    expect(dayWords(new Date(2026, 9, 8), 'fr')).toBe('8 octobre');
    expect(dayWords(new Date(2026, 9, 9), 'fr', { year: true })).toBe('9 octobre 2026');
    expect(dayWords(new Date(2026, 9, 1), 'en')).toBe('1 October');
    expect(timeWords('08:05', 'fr')).toBe(`8${NBSP}h${NBSP}05`);
    expect(timeWords('19:42', 'en')).toBe('19:42');
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
    expect(planned).toEqual({ programme: id, item: 0, key: 'squat', sets: 3, reps: 10, rest: 90 });
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

  it('keeps a confirmed proposal and a body check through a read, so the history and the results can tell them apart', () => {
    const result = { count: 0, reps: [], arm: null, confidence: null, metadata: { duration: 20 } };
    const stored = { id: 'w2', createdAt: 1, ...savedSet({ result, lift: 'squat', n: 6, corrected: true, manual: true, proposal: 6 }) };
    const read = validateWorkout(stored).sanitized;
    expect(read.proposal).toEqual({ reps: 6, by: 'psc' });
    expect(keptLetter(read)).toBe('p');
    expect(validateWorkout({ ...stored, bodyCheck: { agreement: 0.4, second: 9 } }).sanitized.bodyCheck).toEqual({ agreement: 0.4, second: 9 });
    for (const bad of [{ reps: 6 }, { reps: 6.5, by: 'psc' }, { reps: -1, by: 'psc' }, 'psc']) {
      expect('proposal' in validateWorkout({ ...stored, proposal: bad }).sanitized).toBe(false);
    }
    for (const bad of [{ agreement: 'x', second: 9 }, { agreement: 0.4, second: 9.5 }, 3]) {
      expect('bodyCheck' in validateWorkout({ ...stored, bodyCheck: bad }).sanitized).toBe(false);
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

  it('prints the link as a QR code with how to use it, and leaves it out without a link or for one too long to scan', async () => {
    const link = `https://david-dabert.github.io/workout-vision/#programme=z${'A'.repeat(400)}`;
    const qr = programmeQr(link);
    expect(qr.version).toBeLessThanOrEqual(QR_MAX_VERSION);
    expect(qr.size).toBe(17 + 4 * qr.version);
    // The three finder patterns: the corners' 7 x 7 squares are dark on their edge.
    for (const [r, c] of [[0, 0], [0, qr.size - 7], [qr.size - 7, 0]]) expect([0, 6].every(k => qr.dark(r + k, c) && qr.dark(r, c + k))).toBe(true);
    expect(programmeQr(null)).toBeNull();
    // Past version 37 even a block 200 points wide would set modules under 0.4 mm: no code (the coach is told, Pro.jsx).
    expect(programmeQr(`https://x/#programme=z${'a'.repeat(2600)}`)).toBeNull();
    expect(programmeQr(`https://x/#programme=z${'a'.repeat(9000)}`)).toBeNull();
    const withQr = await drawn(() => programmePdf(sample, { lang: 'fr', date, link }));
    const flat = withQr.text.replace(/\s/g, '');
    expect(flat).toContain('OUVRIRLEPROGRAMME');
    expect(withQr.text).not.toMatch(/Workout ?Vision/i);
    const without = await drawn(() => programmePdf(sample, { lang: 'fr', date }));
    expect(without.text.replace(/\s/g, '')).not.toContain('OUVRIRLEPROGRAMME');
    expect(withQr.blob.size).toBeGreaterThan(without.blob.size);
    // A short programme keeps its one page with the code.
    expect(withQr.pages).toBe(1);
  });

  it('draws a code past version 15 with the foot at the end of the sheet, its modules never under 0.4 mm', async () => {
    const top = programmeQr(`https://x/#programme=z${'a'.repeat(300)}`);
    expect([top.top, top.side]).toEqual([true, QR_SIDE]);
    expect(top.side / (top.size + 8)).toBeGreaterThanOrEqual(QR_MODULE_MIN - 1e-9);
    // Version 15 at 96 pt would set 0.398 mm modules: it goes to the end of the sheet.
    const n15 = Array.from({ length: 200 }, (_, k) => 380 + k).find(n => programmeQr(`https://x/#programme=z${'a'.repeat(n)}`).version === 15);
    expect(n15).toBeDefined();
    const v15 = programmeQr(`https://x/#programme=z${'a'.repeat(n15)}`);
    expect(v15.top).toBe(false);
    expect(v15.side / (v15.size + 8)).toBeGreaterThanOrEqual(QR_MODULE_MIN - 1e-9);
    for (const n of [600, 900, 1400, 2400]) {
      const qr = programmeQr(`https://x/#programme=z${'a'.repeat(n)}`);
      expect(qr.version).toBeGreaterThan(QR_MAX_VERSION);
      expect(qr.top).toBe(false);
      expect(qr.side).toBeGreaterThan(QR_SIDE);
      expect(qr.side).toBeLessThanOrEqual(QR_BLOCK_MAX);
      expect(qr.side / (qr.size + 8)).toBeGreaterThanOrEqual(QR_MODULE_MIN - 1e-9);
    }
    // A cued programme of 12 exercises: its packed link needs a block, which the sheet holds, with its label.
    const cues = ['Pause 1 s en haut, menton rentré', 'Descendre lentement, trois secondes', 'Coudes serrés le long du corps',
      'Omoplates basses, poitrine ouverte', 'Dos plat, hanches en arrière', 'Genoux dans l’axe des pieds', 'Monter jusqu’aux épaules, pas plus',
      'Pieds ancrés, fesses sur le banc', 'Serrer les fessiers en haut', 'Gainage, ne pas cambrer', 'Grand pas, buste droit', 'Respirer, tenir la ligne'];
    const items = cues.map((note, i) => ({ key: i % 2 ? 'squat' : 'push_up', sets: 3, reps: 10, rest: 90, note }));
    const long = { ...sample, items };
    const link = `https://david-dabert.github.io/workout-vision/#programme=${packNow(long)}`;
    const qr = programmeQr(link);
    expect(qr.top).toBe(false);
    const sheet = await drawn(() => programmePdf(long, { lang: 'fr', date, qr }));
    expect(sheet.text.replace(/\s/g, '')).toContain('OUVRIRLEPROGRAMME');
    expect(sheet.pages).toBeLessThanOrEqual(3);
  });

  it('packs the link at once, which the client’s phone reads back as the programme', async () => {
    const payload = packNow(sample);
    expect(payload[0]).toBe('z');
    expect(await decodeProgramme(payload)).toEqual({ ok: true, programme: sample });
    const one = { title: 'A', who: '', note: '', items: [{ key: 'squat', sets: 3, reps: 10, rest: 90, note: '' }] };
    expect(await decodeProgramme(packNow(one))).toEqual({ ok: true, programme: one });
  });

  it('reads its words from the copy, and names its file in ASCII', () => {
    const s = programmeSheet(sample, { lang: 'fr', date });
    expect(s.people).toEqual([['Pour', 'Camille'], ['Exercices', '2']]);
    expect(s.rows[0]).toEqual({ index: '01', name: 'Squat', note: 'Descendre lentement', target: `3${NBSP}×${NBSP}10`, rest: `1${NBSP}min${NBSP}30` });
    expect(programmeFileName(sample, { lang: 'fr', date })).toBe('programme-camille-2026-10-06.pdf');
    expect(programmeFileName({ ...sample, who: '' }, { lang: 'en', date })).toBe('programme-haut-du-corps-semaine-1-2026-10-06.pdf');
  });
});

describe('the coach’s drafts', () => {
  const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
  const draft = (title, who = '', at = 1) => ({ ...newDraft(at), title, who, items: [{ key: 'squat', sets: 3, reps: 10, rest: 90, note: '' }] });

  it('keeps nothing of an empty draft, and drops an old empty one at the next save', () => {
    vi.stubGlobal('localStorage', memory());
    try {
      expect(isEmptyDraft(newDraft())).toBe(true);
      expect(isEmptyDraft({ ...newDraft(), who: 'Camille' })).toBe(false);
      localStorage.setItem('wv_pro_drafts', JSON.stringify([newDraft(1), { id: 'x' }]));
      expect(saveDraft(draft('Semaine 1'))).toBe(true);
      expect(loadDrafts().map(d => d.title)).toEqual(['Semaine 1']);
    } finally { vi.unstubAllGlobals(); }
  });

  it('refuses a new draft past the cap, and never drops one the coach kept', () => {
    vi.stubGlobal('localStorage', memory());
    try {
      localStorage.setItem('wv_pro_drafts', JSON.stringify(Array.from({ length: MAX_DRAFTS }, (_, i) => draft(`P${i}`, '', i))));
      expect(saveDraft(draft('Une de plus'))).toBe('full');
      expect(loadDrafts()).toHaveLength(MAX_DRAFTS);
      // A draft already kept is still changed in place.
      const first = loadDrafts()[0];
      expect(saveDraft({ ...first, title: 'Renommé' })).toBe(true);
      expect(loadDrafts().some(d => d.title === 'Renommé')).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

  it('opens the coach’s own draft from a client’s results, or makes one from them', () => {
    vi.stubGlobal('localStorage', memory());
    try {
      const results = { title: 'Semaine 1', who: 'Camille', day: '2026-10-09', time: '', items: [{ key: 'squat', sets: 4, reps: 8, done: [8] }, { key: 'push_up', sets: 3, reps: 12, done: [] }] };
      const made = draftFromResults(results);
      expect(made.kept).toBe(true);
      expect(made.draft).toMatchObject({ title: 'Semaine 1', who: 'Camille', note: '' });
      expect(made.draft.items).toEqual([{ key: 'squat', sets: 4, reps: 8, rest: 90, note: '' }, { key: 'push_up', sets: 3, reps: 12, rest: 90, note: '' }]);
      // Once on the phone, the same results lead to that draft, with whatever the coach changed in it since.
      saveDraft({ ...made.draft, items: [{ ...made.draft.items[0], rest: 120, note: 'Lent' }] });
      const again = draftFromResults(results);
      expect(again.draft.id).toBe(made.draft.id);
      expect(again.draft.items[0]).toMatchObject({ rest: 120, note: 'Lent' });
      expect(draftFromResults({ ...results, who: 'Zine' }).draft.id).not.toBe(made.draft.id);
      // A draft's title as typed, with a double space or a no-break space: its link, and its results, carry one space.
      const typed = { ...newDraft(5), title: 'Semaine  2\u00A0: jambes', who: ' Lou ', items: [{ key: 'squat', sets: 3, reps: 10, rest: 120, note: 'Lent' }] };
      saveDraft(typed);
      expect(draftFromResults({ ...results, title: 'Semaine 2 : jambes', who: 'Lou' }).draft.id).toBe(typed.id);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('a programme the coach changed and sent again', () => {
  const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
  const v1 = { title: 'Haut du corps', who: 'Camille', note: '', items: [
    { key: 'squat', sets: 3, reps: 10, rest: 90, note: '' }, { key: 'push_up', sets: 3, reps: 12, rest: 60, note: '' }] };
  // The coach raised the squat's reps and put a curl first: every place moved.
  const v2 = { ...v1, items: [{ key: 'bicep_curl', sets: 3, reps: 10, rest: 60, note: '' }, { ...v1.items[0], reps: 12 }, v1.items[1]] };

  it('remembers the earlier version, which stays listed; another person’s programme is apart', () => {
    vi.stubGlobal('localStorage', memory());
    try {
      const id1 = keepReceived(v1, 1000), other = keepReceived({ ...v1, who: 'Zine' }, 1500), id2 = keepReceived(v2, 2000);
      const list = loadReceived();
      expect(list.map(r => r.id)).toEqual([id2, other, id1]);
      expect(list[0].previous).toEqual([id1]);
      expect(list[0].receivedAt).toBe(2000);
      expect(list[1].previous).toEqual([]);
      // The same version opened again keeps what it remembers.
      keepReceived(v2, 3000);
      expect(loadReceived()[0].previous).toEqual([id1]);
      // The earlier version's link opened again: it comes first, the newer one stays, and it borrows none of its sets.
      keepReceived(v1, 4000);
      const again = loadReceived();
      expect(again.map(r => r.id)).toEqual([id1, id2, other]);
      expect(again[0].previous).toEqual([]);
      expect(again[1].previous).toEqual([id1]);
    } finally { vi.unstubAllGlobals(); }
  });

  it('puts a set of the earlier version on the exercise with the target it was filmed for, when the exercise is there twice', () => {
    const w1 = { ...v1, items: [{ key: 'squat', sets: 3, reps: 10, rest: 90, note: '' }, { key: 'squat', sets: 2, reps: 20, rest: 60, note: '' }] };
    const w2 = { ...w1, items: [{ key: 'bicep_curl', sets: 3, reps: 10, rest: 60, note: '' }, ...w1.items] };
    const now = new Date(2026, 9, 9, 18, 30), at = m => new Date(2026, 9, 9, 18, m).getTime();
    const sets = [
      { exercise: 'squat', reps: 10, createdAt: at(1), planned: plannedOf('pw1', 0, w1.items[0]) },
      { exercise: 'squat', reps: 20, createdAt: at(5), planned: plannedOf('pw1', 1, w1.items[1]) },
    ];
    expect(progressOf(w2, ['pw2', 'pw1'], sets, now).items.map(i => i.done)).toEqual([[], [10], [20]]);
  });

  it('counts the sets of the day filmed from the earlier version, each with its exercise', () => {
    vi.stubGlobal('localStorage', memory());
    try {
      const id1 = keepReceived(v1, 1000), id2 = keepReceived(v2, 2000), now = new Date(2026, 9, 9, 18, 30);
      const at = m => new Date(2026, 9, 9, 18, m).getTime();
      const sets = [
        { exercise: 'squat', reps: 10, createdAt: at(1), planned: plannedOf(id1, 0, v1.items[0]) },
        { exercise: 'push_up', reps: 12, createdAt: at(5), planned: plannedOf(id1, 1, v1.items[1]) },
        { exercise: 'bicep_curl', reps: 10, createdAt: at(9), planned: plannedOf(id2, 0, v2.items[0]) },
      ];
      const progress = progressOf(v2, [id2, ...loadReceived().find(r => r.id === id2).previous], sets, now);
      expect(progress.items.map(i => i.done)).toEqual([[10], [10], [12]]);
      // Without the earlier version, its sets are not this programme's.
      expect(progressOf(v2, id2, sets, now).items.map(i => i.done)).toEqual([[10], [], []]);
      expect(lastDayOf(v2, [id2, id1], sets.slice(0, 2), now)).toEqual(new Date(at(5)));
    } finally { vi.unstubAllGlobals(); }
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

describe('the results sent back to the coach', () => {
  const now = new Date(2026, 9, 9, 18, 30);
  const saved = [
    { exercise: 'squat', reps: 10, source: 'counter-core', machineResult: { reps: 10 }, createdAt: new Date(2026, 9, 9, 18, 26).getTime(), planned: { programme: 'p1', item: 0 } },
    { exercise: 'squat', reps: 8, source: 'manual', afterRefusal: true, createdAt: new Date(2026, 9, 9, 18, 28).getTime(), planned: { programme: 'p1', item: 0 } },
  ];
  const results = () => resultsOf(sample, progressOf(sample, 'p1', saved, now), now);

  it('carry the day and the time of its latest set, and per exercise the target, the reps of each set saved that day and how each was kept', () => {
    expect(results()).toEqual({ title: 'Haut du corps, semaine 1', who: 'Camille', day: '2026-10-09', time: '18:28', items: [
      { key: 'squat', sets: 3, reps: 10, done: [10, 8], kinds: ['a', 't'] },
      { key: 'push_up', sets: 4, reps: 12, done: [], kinds: [] },
    ] });
  });

  it('a link of the day before, with no time and no kinds, still opens: its sets read as before', async () => {
    const old = { v: 1, t: 'Séance', d: '2026-10-09', x: [['squat', 3, 10, [10, 8]]] };
    expect(await decodeResults('j' + b64(JSON.stringify(old)))).toEqual({ ok: true, results: {
      title: 'Séance', who: '', day: '2026-10-09', time: '', items: [{ key: 'squat', sets: 3, reps: 10, done: [10, 8] }],
    } });
  });

  it('come back whole from the plain and the packed link, and the address gives their payload', async () => {
    const r = results();
    for (const payload of [plainResultsPayload(r), await encodeResults(r)]) expect(await decodeResults(payload)).toEqual({ ok: true, results: r });
    const link = resultsLink('https://example.test/workout-vision/#programme', plainResultsPayload(r));
    expect(link.startsWith('https://example.test/workout-vision/#resultats=j')).toBe(true);
    expect(resultsPayloadOf(new URL(link).hash)).toBe(plainResultsPayload(r));
    expect(resultsPayloadOf('#programme=jabc')).toBeNull();
  });

  it('refuse a damaged or forged link without throwing', async () => {
    const r = results();
    const forged = async x => decodeResults(b64(JSON.stringify(x)).replace(/^/, 'j'));
    const ok = { v: 1, t: 'Séance', d: '2026-10-09', x: [['squat', 3, 10, [10, 8]]] };
    expect((await forged(ok)).ok).toBe(true);
    expect(await decodeResults('')).toEqual({ ok: false, error: 'empty' });
    expect(await decodeResults('j!!')).toEqual({ ok: false, error: 'malformed' });
    expect(await forged({ ...ok, v: 2 })).toEqual({ ok: false, error: 'malformed' });
    expect(await forged({ ...ok, d: '9 octobre' })).toEqual({ ok: false, error: 'malformed' });
    expect(await forged({ ...ok, x: [['not_an_exercise', 3, 10, []]] })).toEqual({ ok: false, error: 'unknown-exercise' });
    expect(await forged({ ...ok, x: [['squat', 3, 10, [10, 1000]]] })).toEqual({ ok: false, error: 'bad-value' });
    expect(await forged({ ...ok, x: [['squat', 3, 10, [10, 8.5]]] })).toEqual({ ok: false, error: 'bad-value' });
    expect(await forged({ ...ok, x: [['squat', 3, 10, Array(RESULT_LIMITS.done + 1).fill(10)]] })).toEqual({ ok: false, error: 'bad-value' });
    expect(await forged({ ...ok, x: [['squat', 0, 10, []]] })).toEqual({ ok: false, error: 'bad-value' });
    expect(await forged({ ...ok, t: 'x'.repeat(200) })).toEqual({ ok: false, error: 'bad-value' });
    // The time and the kinds, when present, are checked as the rest: one letter per set, one string per exercise.
    expect((await forged({ ...ok, h: '07:05', k: ['ap'] })).ok).toBe(true);
    for (const bad of [{ h: '24:00' }, { h: '7:05' }, { h: 705 }, { k: ['a'] }, { k: ['ax'] }, { k: 'ap' }, { k: ['ap', ''] }, { k: [['a', 'p']] }]) {
      expect(await forged({ ...ok, ...bad })).toEqual({ ok: false, error: 'malformed' });
    }
    expect(r.items).toHaveLength(2);
  });
});
