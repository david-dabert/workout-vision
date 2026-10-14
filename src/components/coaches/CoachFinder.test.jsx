import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./CoachFinder.css', () => ({}));
// The exercise names' module draws the guide's figures with the page when it loads: not in this test's Node.
vi.mock('../experience/exercise-info', () => ({ exerciseName: key => key }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: CoachFinder } = await import('./CoachFinder');
  return renderToStaticMarkup(
    <LanguageProvider>
      <CoachFinder onClose={() => {}} onHistory={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// Honesty pass of 14 October 2026 (FND-1 to FND-4): a demo with fictional placeholders, no verified practitioner.
describe('the coach finder', () => {
  for (const lang of ['en', 'fr']) {
    it(`shows fictional placeholders as such, and the way that works to send a set (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="coach-finder-screen"');
      expect(html).toContain('data-testid="city-paris"');
      expect(html).toContain('data-testid="filter-rehab"');
      expect(html).toContain(lang === 'fr' ? 'Coach exemple A' : 'Sample coach A');
      expect(html).toContain(lang === 'fr' ? 'Profil fictif' : 'Fictional profile');
      expect(html).toContain('data-testid="demo-badge"');
      expect(html).toContain('data-testid="send-to-coach"');
      expect(html).not.toMatch(/Verified|vérifiés|certifi|chiffr|encrypt|Julien Mercier|DPT|avis|reviews|★|Bêta Publique|Public Beta|géospatial|\[object Object\]|forme|form score/i);
    });
  }
});
