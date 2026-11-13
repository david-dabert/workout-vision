// Card 016, second part (cards/016-accuracy-on-the-shipping-gate.md; docs/FLAWS-2026-11.md #16): the guard against
// unmeasured numbers reads the numbers a production screen renders, not a list of words. Every number with a unit in
// the session report, as production renders it, must be of a kind measures.js lets production show: degrees and seconds
// (range and tempo, MEASURES_SHOWN, under the experimental label), and nothing else. A force, a mass, a power, an energy,
// a speed or a percentage on the sheet fails, whatever word stands beside it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MEASURES_SHOWN, UNVALIDATED_BIOMECHANICS_SHOWN, experimentalLabel } from '../measures';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null }));
afterEach(() => vi.unstubAllGlobals());

const UNIT = /(\d+(?:[.,]\d+)?)\s?(°\/s|°|%|s\b|N\b|kg\b|W\b|J\b|cm\b|m\/s|kcal|bpm)/g;
/** The units production may show beside a number, and the switch that lets it. */
const ALLOWED = { '°': () => MEASURES_SHOWN, s: () => MEASURES_SHOWN };

const reps = Array.from({ length: 6 }, (_, i) => ({ startTime: i * 1.6, endTime: i * 1.6 + 1.4, romDegrees: 63 + i * 0.3, concentricSec: 0.9, eccentricSec: 0.5, peakSpeed: 120, meanSpeed: 80 }));

async function sheetText(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Report } = await import('../Report');
  const html = renderToStaticMarkup(<LanguageProvider><Report lift="lateral_raise" count={6} counted={6} arm="left" reps={reps} pain={7} rpe={9} onBack={() => {}} /></LanguageProvider>);
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| | /g, ' ').replace(/&#x27;|&#39;/g, '\'');
}

describe('card 016: the numbers a production screen renders', () => {
  it('runs with the switches as production ships them', () => {
    expect(UNVALIDATED_BIOMECHANICS_SHOWN).toBe(false);
  });

  for (const lang of ['fr', 'en']) {
    it(`the session report (${lang}) shows no number with a unit production may not show`, async () => {
      const text = await sheetText(lang);
      const found = [...text.matchAll(UNIT)].map(m => ({ token: m[0], unit: m[2] }));
      const refused = found.filter(f => !(ALLOWED[f.unit]?.()));
      expect(refused.map(f => f.token)).toEqual([]);
      // The measures it does show stand under the experimental label (measures.js, R8).
      if (found.length) expect(text).toContain(experimentalLabel(lang === 'fr').replace(/ /g, ' '));
    });
  }

  it('would refuse a force, a percentage or a speed on the sheet', () => {
    const text = 'Charge 917 N, perte de vitesse 34 %, 1,2 m/s, 120 °/s';
    const refused = [...text.matchAll(UNIT)].filter(m => !(ALLOWED[m[2]]?.()));
    expect(refused.map(m => m[0])).toEqual(['917 N', '34 %', '1,2 m/s', '120 °/s']);
  });
});
