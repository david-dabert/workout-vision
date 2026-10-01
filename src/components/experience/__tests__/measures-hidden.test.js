// The measures beyond the count are shown under the experimental label while none is validated
// (measures.js, David's order of 1 October 2026); switched off, none reaches the account, the opener,
// the report or the exports, for new sets and for sets saved before.
import { describe, expect, it, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads: the stand-in of
// sets-csv.test.js lets it load outside a browser.
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { MEASURES_SHOWN, experimentalLabel } from '../measures';
import { setAccount } from '../set-account';
import { setOpener } from '../set-opener';
import { reportSheet } from '../report-sheet';
import { setsCsv, repsCsv, exportFiles } from '../sets-csv';

const reps = Array.from({ length: 6 }, (_, i) => ({
  index: i + 1, startTime: i * 3, endTime: i * 3 + 2.5, romDegrees: i === 2 ? 50 : 100,
  concentricSec: 1 + i * 0.2, eccentricSec: 1.3, peakSpeed: 110, meanSpeed: 70,
}));
const MEASURE = /°|%|tempo|vitesse|speed|amplitude|range|tension|▾|conc\.|exc\.|ecc\.|plus courte|shorter|plus lente|slower|plus rapide|faster/i;

describe('measures shown under a label, or hidden when switched off', () => {
  it('the flag is on, and the report puts the experimental label beside its measures', () => {
    expect(MEASURES_SHOWN).toBe(true);
    for (const lang of ['fr', 'en']) {
      const s = reportSheet({ lang, date: new Date(2026, 9, 1), liftName: 'Curl', count: 6, counted: 6, arm: 'right', reps, first: 'concentric', notes: '' });
      expect(s.rows.length).toBe(6);
      expect(s.experimental).toBe(experimentalLabel(lang === 'fr'));
    }
    expect(experimentalLabel(true)).toBe('Mesures expérimentales\u00A0: estimées par l’app, pas encore validées.');
  });

  it('the account keeps the count comparison and the tip, and says no measure', () => {
    for (const fr of [true, false]) {
      const a = setAccount({ reps, first: 'concentric', fr, name: 'Curl', count: 6, previous: 5, nth: 2, measures: false });
      expect(a.short).toEqual([]);
      expect(a.lines).toEqual([fr ? '1 répétition de plus que votre dernière série.' : '1 more rep than your last set.']);
      for (const l of [...a.lines, a.tip, a.cheer]) expect(l).not.toMatch(MEASURE);
    }
  });

  it('the opener says the count alone', () => {
    expect(setOpener({ reps, fr: true, count: 6, counted: 6, measures: false })).toBe('Série de 6 répétitions.');
    expect(setOpener({ reps, fr: false, count: 1, counted: 1, measures: false })).toBe('A set of one rep.');
    expect(setOpener({ reps, fr: false, count: 7, counted: 6, measures: false })).toBe('You counted 7 reps.');
  });

  it('the report has no table, no short-rep note and, of the summary, the previous count alone', () => {
    for (const lang of ['fr', 'en']) {
      const s = reportSheet({ lang, date: new Date(2026, 9, 1), liftName: 'Curl', count: 6, counted: 6, arm: 'right', reps, first: 'concentric', notes: '',
        previousSet: { count: 5, reps, date: new Date(2026, 8, 29) }, measures: false });
      expect(s.columns).toEqual([]);
      expect(s.rows).toEqual([]);
      expect(s.shortRepNote).toBe('');
      expect(s.summary).toEqual([lang === 'fr' ? 'Série du 29 sept. : 5 rép.' : 'Set of 29 Sept: 5 reps']);
      for (const l of [s.opener, ...s.summary]) expect(l).not.toMatch(MEASURE);
    }
  });

  it('the sets file has no tempo or speed column, and there is no reps file, for old sets too', () => {
    const sets = [
      { id: 'a', exercise: 'bicep_curl', reps: 6, repDetails: reps, repDetailsVersion: 2, createdAt: Date.UTC(2026, 8, 29), source: 'counter-core', machineResult: { reps: 6 } },
      { id: 'b', exercise: 'bicep_curl', reps: 8, repDetails: reps, repDetailsVersion: 2, createdAt: Date.UTC(2026, 9, 1), source: 'counter-core', corrected: true, machineResult: { reps: 6 }, correctedResult: { reps: 8 } },
    ];
    for (const lang of ['fr', 'en']) {
      const csv = setsCsv(sets, { lang, measures: false });
      const [header, ...rows] = csv.replace(/^﻿/, '').trim().split(/\r\n/);
      expect(header).not.toMatch(/tempo|vitesse|speed/i);
      const width = header.split(lang === 'fr' ? ';' : ',').length;
      for (const r of rows) expect(r.split(lang === 'fr' ? ';' : ',').length).toBe(width);
      expect(repsCsv(sets, { lang, measures: false })).toBeNull();
      expect(exportFiles(sets, { lang }).map(f => f.name)).toHaveLength(2);
      expect(exportFiles(sets, { lang, measures: false }).map(f => f.name)).toHaveLength(1);
    }
  });

  it('after a correction, the app\'s reps are never named as the saved set\'s reps', () => {
    for (const fr of [true, false]) {
      const a = setAccount({ reps, first: 'concentric', fr, name: 'Curl', count: 8, previous: null, nth: null, corrected: true });
      for (const l of a.lines) expect(l).not.toMatch(/répétition \d|Rep \d|deux dernières|last two/);
      expect(a.short).toEqual([]);
    }
    const s = reportSheet({ lang: 'fr', date: new Date(2026, 9, 1), liftName: 'Curl', count: 8, counted: 6, arm: 'right', reps, first: 'concentric', notes: '' });
    expect(s.columns[0]).toBe('Repère');
    expect(reportSheet({ lang: 'en', date: new Date(2026, 9, 1), liftName: 'Curl', count: 6, counted: 6, arm: 'right', reps, first: 'concentric', notes: '' }).columns[0]).toBe('Rep');
  });
});
