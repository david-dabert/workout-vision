import { describe, it, expect, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen and draws its sprites when it
// loads; a stand-in that accepts every call lets the names load outside a browser.
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { setsCsv, repsCsv, csvField, exportFiles, BOM } from '../sets-csv';
import { setMeasures, setTempo } from '../report-sheet';
import { liftDefinition } from '../../../lib/counting/core';

// Four whole reps with a slowdown, then one the video cut.
const rep = (index, startTime, conc, ecc, rom, extra = {}) => ({ index, startTime, endTime: startTime + conc + ecc + 0.2, concentricSec: conc, eccentricSec: ecc, romDegrees: rom, peakSpeed: 180.4 + index, meanSpeed: 90.6 + index, ...extra });
const REPS = [rep(1, 0, 1, 1.5, 120), rep(2, 3, 1.1, 1.5, 118), rep(3, 6, 1.4, 1.6, 116), rep(4, 9.5, 1.6, 1.7, 110), rep(5, 13, 0.4, 0, 60, { clipped: true })];
const AT = Date.UTC(2026, 8, 28, 8, 30, 0);

// A set saved by the result screen after a correction: 5 kept, 4 counted.
const counted = { id: 'a', exercise: 'bicep_curl', reps: 5, createdAt: AT, source: 'counter-core', duration: 21.36, corrected: true,
  machineResult: { reps: 4, confidence: 0.9 }, correctedResult: { reps: 5 }, repDetails: REPS, repDetailsVersion: 2 };
// A manual set with a load, saved later.
const manual = { id: 'b', exercise: 'squat', reps: 8, createdAt: AT + 3_600_000, source: 'manual', weight: 62.5, duration: 0,
  machineResult: { reps: 8, confidence: null }, correctedResult: null };
// An old upload with fields missing: no duration, no reps details, an old date field only.
const old = { id: 'c', exerciseKey: 'lateral_raise', reps: 10, date: new Date(AT - 86_400_000).toISOString(), source: 'upload', weight: 0 };

const lines = text => text.replace(BOM, '').split('\r\n').filter(Boolean);

describe('csvField: RFC 4180 quoting', () => {
  it('leaves plain fields bare and quotes the separator, quotes and line breaks', () => {
    expect(csvField('Squat', ',')).toBe('Squat');
    expect(csvField('a,b', ',')).toBe('"a,b"');
    expect(csvField('a,b', ';')).toBe('a,b');
    expect(csvField('a;b', ';')).toBe('"a;b"');
    expect(csvField('say "hi"', ',')).toBe('"say ""hi"""');
    expect(csvField('two\nlines', ';')).toBe('"two\nlines"');
    expect(csvField('cr\rhere', ',')).toBe('"cr\rhere"');
  });
  it('writes a missing value as an empty field', () => {
    expect(csvField(null, ',')).toBe('');
    expect(csvField(undefined, ';')).toBe('');
  });
});

describe('setsCsv', () => {
  it('starts with a BOM and a header row, ends rows with CRLF', () => {
    const text = setsCsv([counted], { lang: 'en' });
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(lines(text)[0].split(',')).toEqual(['Date', 'Exercise', 'Reps', 'Counted by the app', 'Corrected', 'Confirmed', 'Load (kg)', 'Duration (s)', 'Average tempo', 'Concentric speed change (%)']);
  });

  it('writes French with semicolons and decimal commas, English with commas and dots', () => {
    const fr = lines(setsCsv([manual], { lang: 'fr' }));
    expect(fr[0].split(';')[0]).toBe('Date');
    expect(fr[0]).toContain('Charge (kg)');
    expect(fr[1].split(';')[6]).toBe('62,5');
    const en = lines(setsCsv([manual], { lang: 'en' }));
    expect(en[1].split(',')[6]).toBe('62.5');
    // The duration keeps one decimal in each language.
    expect(lines(setsCsv([counted], { lang: 'fr' }))[1].split(';')[7]).toBe('21,4');
    expect(lines(setsCsv([counted], { lang: 'en' }))[1].split(',')[7]).toBe('21.4');
  });

  // A date and time as a spreadsheet reads one, in the phone's local time (review, 30 September:
  // Excel showed ISO with an offset as text).
  it('writes one row per set, oldest first, with a local date and time that reads back as the saved time', () => {
    const rows = lines(setsCsv([manual, counted, old], { lang: 'en' })).slice(1).map(r => r.split(','));
    expect(rows).toHaveLength(3);
    expect(rows.map(r => new Date(r[0].replace(' ', 'T')).getTime())).toEqual([AT - 86_400_000, AT, AT + 3_600_000]);
    for (const r of rows) expect(r[0]).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  });

  it('names the exercise in the phone language', () => {
    expect(lines(setsCsv([counted], { lang: 'fr' }))[1].split(';')[1]).toBe('Curl biceps');
    expect(lines(setsCsv([counted], { lang: 'en' }))[1].split(',')[1]).toBe('Biceps curl');
    // A caller may pass the screen's own naming.
    expect(lines(setsCsv([counted], { lang: 'en', name: () => 'Mine' }))[1].split(',')[1]).toBe('Mine');
  });

  it('keeps the final reps, the app count, corrected and confirmed apart', () => {
    const [, row] = lines(setsCsv([counted], { lang: 'fr' }));
    expect(row.split(';').slice(2, 6)).toEqual(['5', '4', 'oui', 'oui']);
    const [, en] = lines(setsCsv([counted], { lang: 'en' }));
    expect(en.split(',').slice(2, 6)).toEqual(['5', '4', 'yes', 'yes']);
  });

  it('leaves the app count and correction empty on a set entered by hand', () => {
    const [, row] = lines(setsCsv([manual], { lang: 'en' }));
    expect(row.split(',').slice(2, 6)).toEqual(['8', '', '', 'yes']);
  });

  it('marks an old upload unconfirmed and leaves every missing field empty', () => {
    const [, row] = lines(setsCsv([old], { lang: 'en' }));
    const f = row.split(',');
    expect(f[2]).toBe('10');
    expect(f[3]).toBe('10');
    expect(f[4]).toBe('no');
    expect(f[5]).toBe('no');
    expect(f.slice(6)).toEqual(['', '', '', '']); // weight 0 is no load; no duration, no reps details
  });

  it('writes the coach report\'s tempo (setTempo) and the speed change of setMeasures', () => {
    const [, row] = lines(setsCsv([counted], { lang: 'en' }));
    const f = row.split(',');
    expect(f[8]).toBe(setTempo(REPS, liftDefinition('bicep_curl').first, false));
    const change = setMeasures(REPS).speedChange;
    expect(change).not.toBeNull();
    expect(f[9]).toBe(String(change));
  });

  it('leaves the speed change empty under four whole reps', () => {
    const three = { ...counted, repDetails: REPS.slice(0, 3) };
    expect(setMeasures(three.repDetails).speedChange).toBeNull();
    const f = lines(setsCsv([three], { lang: 'en' }))[1].split(',');
    expect(f[9]).toBe('');
    expect(f[8]).not.toBe('');
  });

  it('ignores reps details measured before step 3c', () => {
    const before = { ...counted, repDetailsVersion: undefined };
    const f = lines(setsCsv([before], { lang: 'en' }))[1].split(',');
    expect(f.slice(8)).toEqual(['', '']);
  });

  it('writes a header only when there is no set', () => {
    expect(lines(setsCsv([], { lang: 'fr' }))).toHaveLength(1);
  });
});

describe('repsCsv', () => {
  it('writes one row per rep of the sets that hold measured reps', () => {
    const rows = lines(repsCsv([manual, counted, old], { lang: 'en' }));
    expect(rows[0].split(',')).toEqual(['Set date', 'Exercise', 'Rep', 'Range (°)', 'Concentric (s)', 'Eccentric (s)', 'Peak speed (°/s)', 'Mean speed (°/s)', 'Cut by the video']);
    expect(rows).toHaveLength(1 + REPS.length);
    const first = rows[1].split(',');
    expect(Date.parse(first[0])).toBe(AT);
    expect(first.slice(1)).toEqual(['Biceps curl', '1', '120', '1.00', '1.50', '181', '92', 'no']);
  });

  it('writes French with semicolons and decimal commas', () => {
    const rows = lines(repsCsv([counted], { lang: 'fr' }));
    expect(rows[0].split(';')).toEqual(['Date de la série', 'Exercice', 'Rép.', 'Amplitude (°)', 'Concentrique (s)', 'Excentrique (s)', 'Vitesse max (°/s)', 'Vitesse moyenne (°/s)', 'Coupée par la vidéo']);
    expect(rows[2].split(';').slice(1)).toEqual(['Curl biceps', '2', '118', '1,10', '1,50', '182', '93', 'non']);
  });

  it('leaves the times and speeds of a rep the video cut empty, as the report does', () => {
    const rows = lines(repsCsv([counted], { lang: 'en' }));
    expect(rows[5].split(',').slice(2)).toEqual(['5', '60', '', '', '', '', 'yes']);
  });

  it('is null when no set holds measured reps', () => {
    expect(repsCsv([manual, old], { lang: 'en' })).toBeNull();
    expect(repsCsv([{ ...counted, repDetailsVersion: 1 }], { lang: 'en' })).toBeNull();
  });
});

describe('exportFiles', () => {
  const now = new Date(2026, 8, 30, 12);
  it('names the files in ASCII, in the phone language, with the day', () => {
    expect(exportFiles([counted], { lang: 'fr', now }).map(f => f.name)).toEqual(['series-2026-09-30.csv', 'repetitions-2026-09-30.csv']);
    expect(exportFiles([counted], { lang: 'en', now }).map(f => f.name)).toEqual(['sets-2026-09-30.csv', 'reps-2026-09-30.csv']);
  });
  it('gives only the sets file when no set holds measured reps', () => {
    const files = exportFiles([manual], { lang: 'en', now });
    expect(files.map(f => f.name)).toEqual(['sets-2026-09-30.csv']);
    expect(files[0].text).toBe(setsCsv([manual], { lang: 'en' }));
  });
});

// Review, 30 September: the spreadsheet's tempo is the coach report's, to the tenth, never another one.
describe('the tempo, as the coach report writes it', () => {
  it('equals the report summary\'s tempo for the same set', async () => {
    const { reportSheet } = await import('../report-sheet');
    const sheet = reportSheet({ lang: 'en', date: new Date(AT), notes: '', liftName: 'x', count: 5, counted: 5, reps: REPS, first: 'concentric' });
    const tempo = sheet.summary.find(l => l.startsWith('Tempo')).split(': ')[1];
    const row = setsCsv([counted], { lang: 'en' }).slice(1).split('\r\n')[1];
    expect(row).toContain(tempo);
  });
});

// Review, 30 September: the file's separator and decimal mark follow the phone's own locale, where
// the spreadsheet will open it, not the app's language.
describe('the file format follows the phone', () => {
  it('an English app on a French phone writes semicolons and decimal commas', () => {
    const text = setsCsv([counted], { lang: 'en', locale: 'fr-FR' });
    expect(text.split('\r\n')[0]).toContain('Date;Exercise;');
    expect(text).toContain('21,4');
  });
  it('a French app on a US phone writes commas and decimal points', () => {
    const text = setsCsv([counted], { lang: 'fr', locale: 'en-US' });
    expect(text.split('\r\n')[0]).toContain('Date,Exercice,');
  });
});
