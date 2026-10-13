import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./GymBuddy.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: GymBuddy } = await import('./GymBuddy');
  return renderToStaticMarkup(
    <LanguageProvider>
      <GymBuddy onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('Gym Buddy Matcher UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with partner cards and split filters in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="gym-buddy-screen"');
      expect(html).toContain('data-testid="filter-ppl"');
      expect(html).toContain('data-testid="filter-upper_lower"');
      expect(html).toContain('Antoine D.');
      expect(html).toContain('Fitness Park République');
    });
  }
});
