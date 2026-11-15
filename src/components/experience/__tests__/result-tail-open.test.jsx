import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// A set whose video stops on a rise the count left out (coreAnalysis.js tailOpen, card 039, 15 November 2026): asked on
// David's #collecte phone only, until he chooses (card 039); every other phone shows the screen as before.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ knownSets: () => null, loadSets: () => Promise.resolve([]), refreshSets: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const rep = (index, t) => ({ index, startTime: t, endTime: t + 2, concentricSec: 1, eccentricSec: 1, romDegrees: 100 });
const nine = { count: 9, refused: false, arm: 'right', reps: Array.from({ length: 9 }, (_, i) => rep(i + 1, i * 2)), confidence: 0.9, metadata: { duration: 32 } };
async function render(result, { collect = false, lang = 'fr' } = {}) {
  const store = { wv_lang: lang, wv_level: 'intermediate', ...(collect ? { wv_collecte: '1' } : {}) };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} onClose={() => {}} onReplay={() => {}} /></LanguageProvider>);
}
const FR = 'Un mouvement en fin de vidéo n’a pas été compté : vérifiez le nombre.';
const EN = 'A movement at the end of the video was not counted: check the number.';

describe('a video that stops on a rise the count left out', () => {
  it('on the #collecte phone: the count to confirm, with its own cause, in French', async () => {
    const html = await render({ ...nine, tailOpen: true }, { collect: true });
    expect(html).toContain('L’appli n’a pas pu compter cette série avec certitude.');
    expect(html).toContain(FR);
    expect(html).toMatch(/data-testid="res-save"[^>]*>Confirmer 9 répétitions<\/button>/);
    expect(html).not.toContain('data-testid="res-yes"');
  });
  it('on the #collecte phone, in English: its own cause', async () => {
    expect(await render({ ...nine, tailOpen: true }, { collect: true, lang: 'en' })).toContain(EN);
  });
  it('on any other phone: the screen as before', async () => {
    expect(await render({ ...nine, tailOpen: true })).toBe(await render(nine));
  });
  it('a set the body check flags: its cause, not this one', async () => {
    const html = await render({ ...nine, tailOpen: true, bodyCheck: { flagged: true } }, { collect: true });
    expect(html).not.toContain(FR);
  });
});
