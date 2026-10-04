import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// David's iPhone, 4 October: "We could not read this video" said nothing of the cause and offered no second try.
// The screen now names a frozen read, offers to start the analysis again, and carries the failure into the report.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0 }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function render(lang, props) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { AnalysisError } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><AnalysisError lift="bicep_curl" phase="pose" onClose={() => {}} onRestart={() => {}} onRefilm={() => {}} {...props} /></LanguageProvider>);
}
const frozen = { name: 'FrozenReadError', message: '412 of 460 pictures repeat the one before', decoder: 'rvfc' };

describe('the screen of an analysis that stopped', () => {
  it('names a frozen read, offers the analysis again first, and reports the failure', async () => {
    const fr = await render('fr', { failure: frozen });
    expect(fr).toContain('Le téléphone a mal lu cette vidéo.');
    expect(fr).toContain('Relancer l’analyse');
    expect(fr.indexOf('Relancer l’analyse')).toBeLessThan(fr.indexOf('Refilmer'));
    const mail = decodeURIComponent(fr.match(/href="(mailto:[^"]+)"/)[1].replace(/&amp;/g, '&'));
    expect(mail).toContain('Erreur : FrozenReadError: 412 of 460 pictures repeat the one before');
    expect(mail).toContain('Décodeur : rvfc');
    expect(mail).toContain('rien, la vidéo n’a pas pu être lue');
  });
  it('keeps the plain words for any other failure, with the same second try and report', async () => {
    const en = await render('en', { failure: { name: 'Error', message: 'unreadable', decoder: '' } });
    expect(en).toContain('We could not read this video.');
    expect(en).toContain('Start the analysis again');
    expect(en).toContain('Report this count');
  });
  it('asks for a reload when the model did not start, with no report', async () => {
    const en = await render('en', { phase: 'model', failure: { name: 'Error', message: 'model', decoder: '' } });
    expect(en).toContain('Reload the page');
    expect(en).not.toContain('Report this count');
  });
});
