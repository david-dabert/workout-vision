import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The result after the blind question (blind.js, CoreUpload.jsx; 9 October 2026, pillar 1). The person gave their
// count before the app showed its own: the screen opens on it. Equal to the app's, the app's count to confirm as usual;
// different, the person's number to save in one tap with the app's beside it; on a refused set, in the slot, with the
// app's proposal still labelled as the app's. "Je ne sais pas" changes nothing.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ knownSets: () => null, loadSets: () => Promise.resolve([]), refreshSets: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const rep = (index, t) => ({ index, startTime: t, endTime: t + 2, concentricSec: 1, eccentricSec: 1, romDegrees: 100 });
const nine = { count: 9, refused: false, arm: 'right', reps: Array.from({ length: 9 }, (_, i) => rep(i + 1, i * 2)), confidence: 0.9, metadata: { duration: 32 } };
const refused = { count: 0, refused: true, arm: null, reps: [], confidence: null, proposal: { count: 6 }, metadata: { duration: 20 }, imageLandmarks: [] };
async function render(result, blind) {
  const store = { wv_lang: 'fr', wv_level: 'intermediate' };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} blind={blind} onClose={() => {}} onReplay={() => {}} /></LanguageProvider>);
}

describe('a counted set', () => {
  it('blind count equal to the app\'s: the app\'s count to confirm, as without the question', async () => {
    const html = await render(nine, { count: 9, p: 1 });
    expect(html).toContain('C’est bien 9\u00a0?');
    expect(html).toMatch(/data-testid="res-yes">Oui, 9 répétitions<\/button>/);
    expect(html).toBe(await render(nine, null));
  });
  it('blind count different: the person\'s number, saved in one tap, with the app\'s count beside it', async () => {
    const html = await render(nine, { count: 8, p: 1 });
    expect(html).toContain('Combien en avez-vous fait\u00a0?');
    expect(html).toMatch(/<span class="numeral tick is-typed" aria-hidden="true" data-testid="res-numeral">8<\/span>/);
    expect(html).toContain('Saisi par vous');
    expect(html).toContain('Compté par l’appli\u00a0: 9.');
    expect(html).toMatch(/data-testid="res-save">Enregistrer 8 répétitions<\/button>/);
    expect(html).not.toContain('data-testid="res-yes"');
  });
  it('"Je ne sais pas": the screen as without the question', async () => {
    expect(await render(nine, { count: null, p: 1 })).toBe(await render(nine, null));
  });
});

describe('a refused set', () => {
  it('opens the slot on the blind count, the app\'s proposal still shown as the app\'s', async () => {
    const html = await render(refused, { count: 7, p: 1 });
    expect(html).toMatch(/data-testid="res-typed" aria-hidden="true">7<\/span>/);
    expect(html).toContain('Proposition de l’appli\u00a0: 6');
    expect(html).toContain('Saisi par vous');
    expect(html).toMatch(/data-testid="res-save"[^>]*>Enregistrer 7 répétitions<\/button>/);
  });
  it('blind count equal to the proposal: the proposal to confirm', async () => {
    const html = await render(refused, { count: 6, p: 1 });
    expect(html).toMatch(/data-testid="res-save"[^>]*>Confirmer 6 répétitions<\/button>/);
  });
});

// The count's two neighbours in one tap (result-choices.js; pillar 2): on the #collecte phone only, on a counted set.
describe('the one-tap neighbours', () => {
  async function renderOn(result, collect, props = {}) {
    const store = { wv_lang: 'fr', wv_level: 'intermediate', ...(collect ? { wv_collecte: '1' } : {}) };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Result } = await import('../Result');
    return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} onClose={() => {}} onReplay={() => {}} {...props} /></LanguageProvider>);
  }
  it('offers one fewer and one more, in numeric order, under the app\'s count', async () => {
    const html = await renderOn(nine, true);
    expect(html).toContain('data-testid="res-alts"');
    expect(html).toContain('Ou :');
    expect([...html.matchAll(/aria-label="Enregistrer (\d+) répétitions" data-testid="res-alt"|data-testid="res-alt"[^>]*>(\d+)</g)].length).toBe(2);
    expect(html.indexOf('>8</button>')).toBeLessThan(html.indexOf('>10</button>'));
  });
  it('offers nothing on another phone, on a refused set, or once the number is the person\'s', async () => {
    expect(await renderOn(nine, false)).not.toContain('res-alts');
    expect(await renderOn(refused, true)).not.toContain('res-alts');
    expect(await renderOn(nine, true, { blind: { count: 8, p: 1 } })).not.toContain('res-alts');
    expect(await renderOn({ ...nine, bodyCheck: { flagged: true, agreement: 0.2 } }, true)).not.toContain('res-alts');
  });
});
