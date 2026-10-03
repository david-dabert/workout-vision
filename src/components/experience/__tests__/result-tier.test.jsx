import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// 3 October 2026: the tiers follow the evidence (test/real-phone/accuracy/tiers.test.ts). The result screen prints
// the lift's tier under its name: the lateral raise, Experimental since that day, says so in full; a Beta lift says Beta.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function render(lang, lift) {
  const store = { wv_lang: lang, wv_level: 'beginner' };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  const html = renderToStaticMarkup(<LanguageProvider><Result lift={lift} result={{ count: 9, refused: false, arm: 'right', reps: [], metadata: { duration: 30 } }} onClose={() => {}} /></LanguageProvider>);
  return html.match(/<p class="tier tier-([a-z]+)">([^<]*)<\/p>/);
}
describe('the tier on the result screen', () => {
  it('labels the lateral raise Experimental, in English and French', async () => {
    const en = await render('en', 'lateral_raise');
    expect(en?.slice(1)).toEqual(['experimental', 'Experimental: we are still learning this exercise']);
    const fr = await render('fr', 'lateral_raise');
    expect(fr?.slice(1)).toEqual(['experimental', 'Expérimental : nous apprenons encore cet exercice']);
  });
  it('labels a Beta lift Beta', async () => {
    expect((await render('en', 'hip_thrust'))?.slice(1)).toEqual(['beta', 'Beta']);
    expect((await render('fr', 'bicep_curl'))?.slice(1)).toEqual(['beta', 'Bêta']);
  });
});
