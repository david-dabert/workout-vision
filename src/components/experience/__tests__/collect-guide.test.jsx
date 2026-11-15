import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function stubEnv(store) {
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
}

describe('CollectGuide (#guide-collecte, card 040)', () => {
  it('renders the 4 French collector steps with exact UI labels when inactive', async () => {
    stubEnv({ wv_lang: 'fr' });
    const [{ LanguageProvider }, { default: CollectGuide }] = await Promise.all([
      import('../../../lib/LanguageContext'),
      import('../CollectGuide.jsx'),
    ]);
    const html = renderToStaticMarkup(
      <LanguageProvider><CollectGuide onClose={() => {}} /></LanguageProvider>,
    );
    expect(html).toContain('Envoyer vos séries de test.');
    expect(html).toContain('#collecte');
    expect(html).toContain('Choisir une vidéo');
    expect(html).toContain('à l’aveugle');
    expect(html).toContain('Vos séries');
    expect(html).toContain('Envoyer les séries collectées');
    expect(html).toContain('Activer la collecte sur ce téléphone');
  });

  it('shows active status when wv_collecte is already enabled', async () => {
    stubEnv({ wv_lang: 'fr', wv_collecte: '1' });
    const [{ LanguageProvider }, { default: CollectGuide }] = await Promise.all([
      import('../../../lib/LanguageContext'),
      import('../CollectGuide.jsx'),
    ]);
    const html = renderToStaticMarkup(
      <LanguageProvider><CollectGuide onClose={() => {}} /></LanguageProvider>,
    );
    expect(html).toContain('déjà activée sur ce téléphone');
    expect(html).toContain('Ouvrir l’appli avec #collecte');
  });
});
