import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Kine.css', () => ({}));
vi.mock('../reference/ReferenceCompare.css', () => ({}));
vi.mock('../../lib/reference/readPose', () => ({ readPose: vi.fn() }));
// Without a media address, as CI builds; the deploy job sets the repository variable.
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

async function render(name, hash = '', lang = 'fr') {
  vi.stubEnv('VITE_KINE_MEDIA_URL', '');
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { location: { hash, origin: 'https://example.org', pathname: '/app/' } }));
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Screen } = await import(`./${name}.jsx`);
  return renderToStaticMarkup(<LanguageProvider><Screen onClose={() => {}} /></LanguageProvider>);
}

describe('the physiotherapist workspace', () => {
  it('opens on the programme, with the five tabs and Olivier\'s four exercises to add', async () => {
    const html = await render('KineWorkspace');
    expect(html).toContain('data-testid="kine-screen"');
    for (const tab of ['programme', 'library', 'invoice', 'compare', 'profile']) expect(html).toContain(`data-testid="kn-tab-${tab}"`);
    for (const id of ['mains-jointes', 'rotation-externe', 'abduction-horizontale', 'elevation-paliers']) expect(html).toContain(`data-testid="kn-add-${id}"`);
    // No link to send before an exercise is chosen.
    expect(html).not.toContain('data-testid="kn-send"');
    // Without a media address, it says the videos are not online yet.
    expect(html).toContain('data-testid="kn-no-media"');
  });
});

describe('the patient programme', () => {
  it('shows the programme of its link', async () => {
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', {
      kine: { name: 'Olivier', phone: '0600000000' }, patient: 'Christophe', perDay: 2, weeks: 6, note: 'Sans douleur.',
      items: [{ id: 'mains-jointes', reps: 10, sets: 5, note: 'Bien relâcher.' }, { id: 'rotation-externe', reps: 10, sets: 3 }],
    });
    const html = await render('KinePatient', link.slice(link.indexOf('#')));
    expect(html).toContain('Christophe, vos exercices');
    expect(html).toContain('Préparé par Olivier');
    expect(html).toContain('2 fois par jour, pendant 6 semaines');
    expect(html).toContain('Bien relâcher.');
    expect(html).toContain('href="tel:0600000000"');
    // Without a media address, no attempt can be filmed yet.
    expect(html).not.toContain('ne compare pas encore votre geste');
    expect(html).not.toContain('data-testid="kn-film-');
  });

  it('says so when the link does not open', async () => {
    expect(await render('KinePatient', '#kine-p=zbroken')).toContain('data-testid="kn-bad-link"');
  });
});

describe('a patient result', () => {
  it('shows the verdict and figures of its link', async () => {
    const { resultLink } = await import('../../lib/kine/links');
    const link = resultLink('https://example.org/app/', { id: 'mains-jointes', patient: 'Christophe', verdict: 'match', tempo: 1, joints: [{ name: 'rightShoulder', within: 0.95, range: 1 }], holds: [] });
    const html = await render('KineResult', link.slice(link.indexOf('#')));
    expect(html).toContain('data-testid="kn-result-verdict"');
    expect(html).toContain('Conforme à la référence');
    expect(html).toContain('Épaule droite');
  });
});
