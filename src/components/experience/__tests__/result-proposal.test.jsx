import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { savedSet } from '../saved-set';
import { RESULT } from '../result-copy';

// 8 October 2026 (delegated decision of David, R8): a set the core refused may carry PSC's count
// (coreAnalysis.js, withProposal). The low-confidence screen opens on it as a proposal to confirm: labelled
// "Proposition de l'appli", no numeral of a counted set, no measure, no grade, and the key confirms it. Nothing is saved
// before that tap (e2e/proposal.spec.js). The words: test/real-phone/swarm/copy-proposal.md.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const seen = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
const hidden = seen.map((p, i) => ([12, 14, 16].includes(i) ? { ...p, visibility: 0.1 } : p));
const refused = { count: 0, refused: true, arm: 'right', reps: [], confidence: 0, metadata: { duration: 20 }, imageLandmarks: [hidden, hidden, hidden], worldLandmarks: [hidden, hidden, hidden], timestamps: [0, 0.1, 0.2] };
async function render(lang, result) {
  const store = { wv_lang: lang, wv_level: 'intermediate' };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} onClose={() => {}} /></LanguageProvider>);
}

describe('a refused set with a proposal of the app', () => {
  const withSix = { ...refused, proposal: { count: 6, reps: [], period: 2, confirm: false, ms: 40 } };
  it('opens on the proposal, labelled, with a key to confirm it and no measure (fr)', async () => {
    const fr = await render('fr', withSix);
    expect(fr).toContain('L’appli n’a pas pu compter cette série avec certitude.');
    expect(fr).toContain('data-testid="res-typed" aria-hidden="true">6</span>');
    expect(fr).toContain(`data-testid="res-proposal">${RESULT.fr.proposal(6)}</p>`);
    expect(fr).toContain('Proposition de l’appli : 6');
    expect(fr).toContain(RESULT.fr.proposalNote);
    expect(fr).toContain('Confirmer 6 répétitions');
    expect(fr).toContain('À confirmer');
    expect(fr).not.toContain('Saisi par vous');
    expect(fr).not.toContain('data-testid="res-numeral"');
    expect(fr).not.toMatch(/data-testid="(res-exp|set-account|res-sides|level-table|level-speed|saved-card)"/);
    expect(fr).not.toMatch(/class="(bars|res-wave)[" ]/);
    // The confirm key is enabled (the number is there), and "Refilmer" stays beside it.
    expect(fr).toMatch(/<button type="button" class="res-key is-primary press" data-testid="res-save">Confirmer 6 répétitions<\/button>/);
    expect(fr).toContain('Refilmer la série');
  });
  it('says the same in English', async () => {
    const en = await render('en', withSix);
    expect(en).toContain('The app’s proposal: 6');
    expect(en).toContain('Confirm 6 reps');
    expect(en).toContain('The app could not count this set with certainty.');
  });
  it('without a proposal, the refused screen is as it was: no number, Save waits', async () => {
    for (const r of [refused, { ...refused, proposal: null }, { ...refused, proposal: { count: 0 } }]) {
      const fr = await render('fr', r);
      expect(fr).toContain('L’appli n’a pas pu compter cette série.');
      expect(fr).not.toContain('data-testid="res-proposal"');
      expect(fr).toContain('data-testid="res-empty"');
      expect(fr).toMatch(/data-testid="res-save" disabled="">Enregistrer<\/button>/);
    }
  });
  it('never shows a proposal on a counted set', async () => {
    const counted = await render('fr', { ...refused, refused: false, count: 9, proposal: { count: 6 } });
    expect(counted).not.toContain('data-testid="res-proposal"');
  });
});

describe('the set saved from a proposal', () => {
  it('is the person’s count, typed or confirmed, with the proposal beside it and no count of the core', () => {
    const w = savedSet({ result: refused, lift: 'bicep_curl', n: 6, corrected: true, manual: true, proposal: 6, now: new Date('2026-10-08T10:00:00Z') });
    expect(w).toMatchObject({ reps: 6, source: 'manual', afterRefusal: true, machineResult: null, correctedResult: { reps: 6 }, proposal: { reps: 6, by: 'psc' }, repDetails: [], wave: null, sides: null });
    expect('proposal' in savedSet({ result: refused, lift: 'bicep_curl', n: 6, corrected: true, manual: true })).toBe(false);
  });
});
