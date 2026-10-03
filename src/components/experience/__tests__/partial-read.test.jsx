import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Third audit, C08: a read whose samples went back in time reached the screen as read = NaN, and it said
// "Only NaN% of the video was analysed". It now gives the "read twice" line, already in use.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0 }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function render(lang, props) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { AnalysisIncomplete } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><AnalysisIncomplete lift="bicep_curl" decoder="rvfc" onClose={() => {}} onRestart={() => {}} onRefilm={() => {}} {...props} /></LanguageProvider>);
}
describe('the incomplete screen on a read out of time order', () => {
  it('says part of the video was read twice, in English and French, with no NaN', async () => {
    const en = await render('en', { read: 439, expected: 439, disordered: true });
    expect(en).toContain('Part of the video was read twice.');
    expect(en).not.toMatch(/NaN|100%/);
    const fr = await render('fr', { read: 439, expected: 439, disordered: true });
    expect(fr).toContain('Une partie de la vidéo a été lue deux fois.');
    expect(fr).not.toMatch(/NaN/);
  });
  it('still gives the share of a short read', async () => {
    expect(await render('en', { read: 181, expected: 439 })).toContain('Only 41% of the video was analysed.');
  });
  it('never formats a share that is not a number', async () => {
    expect(await render('en', { read: NaN, expected: 439 })).not.toMatch(/NaN/);
  });
});
