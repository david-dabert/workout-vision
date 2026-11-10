import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../Kine.css', () => ({}));
vi.mock('../../reference/ReferenceCompare.css', () => ({}));
vi.mock('../../../lib/reference/readPose', () => ({ readPose: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('VITE_KINE_MEDIA_URL', '');
  vi.stubEnv('VITE_GLIMPSE_URL', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('KineWorkspace specialties integration', () => {
  it('renders the Bilan Pessac tab and mounts PessacClinicSpecialtyHub in French and English', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal('localStorage', { getItem: (k) => (k === 'wv_lang' ? 'fr' : null), setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal('window', { location: { hash: '', origin: 'https://example.org', pathname: '/app/' } });

    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: KineWorkspace } = await import('../KineWorkspace');

    const htmlFr = renderToStaticMarkup(
      <LanguageProvider>
        <KineWorkspace onClose={() => {}} />
      </LanguageProvider>
    );

    expect(htmlFr).toContain('data-testid="kn-tab-specialties"');
    expect(htmlFr).toContain('Bilan Pessac');
  });
});
