import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { keepsMeasures, savedSet } from '../saved-set';
import { RESULT } from '../result-copy';

// 8 October 2026 (R8): a counted set whose joint disagrees with the rest of the body (counting/bodyCheck.js,
// coreAnalysis.js withBodyCheck) opens on the low-confidence screen: the app's count in the slot as one to confirm, the
// count read from the whole body beside it when it differs, both labelled; no numeral of a measured set, no measure, no
// grade. Nothing is saved before a tap (e2e/bodycheck.spec.js). The words: test/real-phone/swarm/copy-bodycheck.md.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const reps = Array.from({ length: 14 }, (_, i) => ({ index: i + 1, startTime: i, endTime: i + 0.8, romDegrees: 60, concentricSec: 0.4, eccentricSec: 0.4 }));
const counted = { count: 14, refused: false, arm: 'left', reps, confidence: 0.9, metadata: { duration: 30 }, timestamps: [0, 0.1, 0.2], smoothedAngles: [150, 120, 150] };
const check = second => ({ agreement: 0.08, flagged: true, signals: [], second: second ? { count: second, reps: [] } : null, ms: 40 });
async function render(lang, result, lift = 'hack_squat', liveShown = null) {
  const store = { wv_lang: lang, wv_level: 'intermediate' };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift={lift} result={result} liveShown={liveShown} onClose={() => {}} /></LanguageProvider>);
}

describe('a counted set the body check flags', () => {
  it('opens on the app’s count to confirm, with the whole body’s count beside it, and no measure (fr)', async () => {
    const fr = await render('fr', { ...counted, bodyCheck: check(7) });
    expect(fr).toContain('L’appli n’a pas pu compter cette série avec certitude.');
    expect(fr).toContain(RESULT.fr.bodyCause('du genou'));
    expect(fr).toContain('Sur cette série, l’angle du genou ne bouge pas comme le reste de votre corps. L’appli a pu mal le lire.');
    expect(fr).toContain('data-testid="res-typed" aria-hidden="true">14</span>');
    expect(fr).toContain('aria-label="Deux comptes possibles" data-testid="res-candidates"');
    expect(fr).toMatch(/aria-pressed="true" data-testid="res-cand-joint"><span class="res-cand-n">14<\/span><span class="res-cand-from">D’après le genou<\/span>/);
    expect(fr).toMatch(/aria-pressed="false" data-testid="res-cand-body"><span class="res-cand-n">7<\/span><span class="res-cand-from">D’après tout le corps<\/span>/);
    expect(fr).toContain(`data-testid="res-body-note">${RESULT.fr.bodyNote}</p>`);
    expect(fr).toMatch(/<button type="button" class="res-key is-primary press" data-testid="res-save">Confirmer 14 répétitions<\/button>/);
    expect(fr).toContain('À confirmer');
    expect(fr).not.toContain('Saisi par vous');
    expect(fr).not.toContain('data-testid="res-numeral"');
    expect(fr).not.toContain('data-testid="ask-card"');
    expect(fr).not.toMatch(/data-testid="(res-exp|set-account|res-sides|level-table|level-speed|saved-card|res-proposal)"/);
    expect(fr).not.toMatch(/class="(bars|res-wave)[" ]/);
    expect(fr).toContain('Refilmer la série');
  });
  it('says the same in English, with the joint’s name', async () => {
    const en = await render('en', { ...counted, bodyCheck: check(7) }, 'bicep_curl');
    expect(en).toContain('In this set, the elbow angle does not move like the rest of your body. The app may have misread it.');
    expect(en).toContain('From the elbow');
    expect(en).toContain('From the whole body');
    expect(en).toContain('Confirm 14 reps');
  });
  it('with the same count from the whole body, or none, offers the one count, labelled', async () => {
    for (const second of [null, 14]) {
      const fr = await render('fr', { ...counted, bodyCheck: check(second) });
      expect(fr).not.toContain('data-testid="res-candidates"');
      expect(fr).toContain(`data-testid="res-bodycount">${RESULT.fr.bodyCounted(14)}</p>`);
      expect(fr).toContain('Compté par l’appli\u00A0: 14');
      expect(fr).toContain('Confirmer 14 répétitions');
    }
  });
  it('keeps the live screen’s line when the live count differed too', async () => {
    const fr = await render('fr', { ...counted, metadata: { duration: 30, live: true }, bodyCheck: check(7) }, 'hack_squat', 12);
    expect(fr).toContain(RESULT.fr.liveDiffers(12));
    expect(fr).toContain(RESULT.fr.bodyCause('du genou'));
  });
  it('leaves a set the check passed, or did not run on, as it was', async () => {
    for (const bodyCheck of [undefined, null, { ...check(7), flagged: false }]) {
      const fr = await render('fr', { ...counted, bodyCheck });
      expect(fr).toContain('data-testid="ask-card"');
      expect(fr).not.toContain('data-testid="fix-card"');
      expect(fr).not.toContain('res-candidates');
    }
    // A refused set never shows the check (it carries none: coreAnalysis.js withBodyCheck).
    const refused = await render('fr', { ...counted, count: 0, refused: true, worldLandmarks: [], timestamps: [], bodyCheck: check(7) });
    expect(refused).not.toContain('res-candidates');
    expect(refused).not.toContain('res-bodycount');
  });
});

describe('the set saved from a flagged screen', () => {
  const result = { ...counted, bodyCheck: check(7) };
  it('keeps the app’s count beside the person’s, and the check’s numbers', () => {
    const kept = savedSet({ result, lift: 'hack_squat', n: 14, corrected: false, now: new Date('2026-10-08T10:00:00Z') });
    expect(kept).toMatchObject({ reps: 14, source: 'counter-core', corrected: false, machineResult: { reps: 14 }, correctedResult: null, bodyCheck: { agreement: 0.08, second: 7 } });
    const other = savedSet({ result, lift: 'hack_squat', n: 7, corrected: true, now: new Date('2026-10-08T10:00:00Z') });
    expect(other).toMatchObject({ reps: 7, corrected: true, machineResult: { reps: 14 }, correctedResult: { reps: 7 }, bodyCheck: { second: 7 } });
  });
  it('keeps no measure of the doubted joint: no rep details, no left against right, no wave (R8)', () => {
    const sides = { status: 'measured' };
    for (const n of [14, 7]) {
      const kept = savedSet({ result, lift: 'hack_squat', n, corrected: n !== 14, sides });
      expect(kept).toMatchObject({ repDetails: [], sides: null, wave: null });
    }
    expect(keepsMeasures(result)).toBe(false);
  });
  it('says nothing of a check that did not flag, and keeps that set’s measures', () => {
    expect('bodyCheck' in savedSet({ result: { ...counted, bodyCheck: { ...check(null), flagged: false } }, lift: 'hack_squat', n: 14, corrected: false })).toBe(false);
    const plain = savedSet({ result: counted, lift: 'hack_squat', n: 14, corrected: false, sides: { status: 'measured' } });
    expect('bodyCheck' in plain).toBe(false);
    expect(plain.repDetails).toBe(reps);
    expect(plain.sides).toEqual({ status: 'measured' });
    for (const bodyCheck of [undefined, null, { ...check(7), flagged: false }]) expect(keepsMeasures({ ...counted, bodyCheck })).toBe(true);
  });
});
