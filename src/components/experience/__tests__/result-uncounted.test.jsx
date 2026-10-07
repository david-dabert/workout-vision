import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { savedSet } from '../saved-set';
import { countedBy } from '../sets';
import { setsCsv } from '../sets-csv';
import { reportSheet } from '../report-sheet';
import { contribution } from '../../../lib/contribute';

// R8 (CLAUDE.md), 3 October 2026: a set the counter did not refuse but found no rep in is not a measured 0.
// The result screen asserts no number, no measure and no mark: it says the set could not be counted and asks
// "How many did you do?". The set is saved as a correction: the app's 0 beside the person's count.
// 7 October 2026 (C4, final direction, screen 05b): the words are the app's ("l'appli"), pending David's approval
// (test/real-phone/swarm/copy-result.md), and the keys are the result's square keys (res-key).
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const zero = { count: 0, refused: false, arm: 'right', reps: [], confidence: 0.4, metadata: { duration: 20 }, timestamps: [0, 0.1, 0.2], smoothedAngles: [150, 151, 150] };
async function render(lang, result, level = 'intermediate') {
  const store = { wv_lang: lang, wv_level: level };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} onClose={() => {}} /></LanguageProvider>);
}

describe('a set counted 0 that was not refused', () => {
  for (const level of ['beginner', 'intermediate', 'expert']) {
    it(`asks for the count with no number, no measure and no mark (${level})`, async () => {
      const en = await render('en', zero, level);
      expect(en).toContain('The app could not count this set.');
      expect(en).toContain('data-testid="fix-card"');
      expect(en).toContain('How many did you do?');
      expect(en).not.toContain('data-testid="ask-card"');
      expect(en).not.toContain('Was it 0');
      expect(en).not.toContain('data-testid="res-numeral"');
      expect(en).not.toMatch(/reps? counted/);
      expect(en).not.toMatch(/data-testid="(res-exp|set-account|res-sides|level-table|level-speed)"/);
      expect(en).not.toMatch(/class="(bars|res-wave)[" ]/);
      // Save waits for the person's count: the 0 the stepper opens on is never saved as theirs.
      expect(en).toMatch(/<button type="button" class="res-key is-primary press" data-testid="res-save" disabled="">Save<\/button>/);
    });
  }
  it('says the same in French', async () => {
    const fr = await render('fr', zero);
    expect(fr).toContain('L’appli n’a pas pu compter cette série.');
    expect(fr).toContain('Combien en avez-vous fait ?');
    expect(fr).not.toContain('C’est bien 0');
    expect(fr).not.toContain('data-testid="res-numeral"');
  });
  it('leaves a counted set and a refused set as they were', async () => {
    const nine = await render('en', { ...zero, count: 9, reps: [] });
    expect(nine).toContain('data-testid="ask-card"');
    expect(nine).not.toContain('data-testid="fix-card"');
    expect(nine).not.toContain('data-testid="res-uncounted"');
    const refused = await render('en', { ...zero, refused: true, worldLandmarks: [], timestamps: [] });
    expect(refused).toContain('The app could not count this set.');
    // A refused set offers the count by hand at once (05b), with no number of the app, and the way to film again.
    expect(refused).toContain('data-testid="fix-card"');
    expect(refused).not.toContain('data-testid="res-numeral"');
    expect(refused).toContain('Record the set again');
  });
});

describe('the set saved after the app counted none', () => {
  const w = { id: 'z', ...savedSet({ result: zero, lift: 'bicep_curl', n: 8, corrected: true, sides: { status: 'measured' }, now: new Date('2026-10-03T10:00:00Z') }) };
  it('keeps the app’s 0 apart from the person’s count, as a correction', () => {
    expect(w.reps).toBe(8);
    expect(w.corrected).toBe(true);
    expect(w.machineResult).toEqual({ reps: 0, confidence: 0.4 });
    expect(w.correctedResult).toEqual({ reps: 8 });
    expect(w.repDetails).toEqual([]);
    expect(w.sides).toBe(null);
    expect(countedBy(w)).toBe(0);
  });
  it('is a corrected set in the spreadsheet, the report and the contribution, with no measure', () => {
    const rows = setsCsv([w], { lang: 'en', locale: 'en', measures: true }).replace('﻿', '').trim().split('\r\n');
    expect(rows[1].split(',').slice(2, 5)).toEqual(['8', '0', 'yes']);
    expect(rows[1].split(',').slice(8).every(v => v === '')).toBe(true);
    const sheet = reportSheet({ lang: 'en', date: new Date('2026-10-03T10:00:00Z'), liftName: 'Biceps curl', count: 8, counted: 0, arm: 'right', reps: [], lift: 'bicep_curl', wave: w.wave, measures: true });
    expect(sheet.corrected).toBe('Counted by the app: 0. Corrected: 8.');
    expect(sheet.opener).toBe('You counted 8 reps.');
    expect(sheet.wave).toBe(null);
    const c = contribution({ result: zero, lift: 'bicep_curl', kept: 8, setId: 'z', appVersion: 'test', device: {} });
    expect([c.count, c.appCount, c.corrected]).toEqual([8, 0, true]);
  });
});
