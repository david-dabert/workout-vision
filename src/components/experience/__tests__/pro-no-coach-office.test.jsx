// docs/FLAWS-2026-11.md #7: the coach's office (clients, contracts, accounting, nutrition; CoachSuite.jsx) widens the
// product before the count it rests on is proven (R16: "the core is proven before the product widens"). The production
// build offers the programme builder only; the office returns with VITE_EXTENDED_ROUTES=1 (buildFlags.js), as the
// other unproven areas do. Nothing is deleted.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../Report.css', () => ({}));
vi.mock('../Pro.css', () => ({}));
vi.mock('../lift-scenes', () => ({}));
vi.mock('../entry-scene', () => ({}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

async function render(lang, extended) {
  if (extended) vi.stubEnv('VITE_EXTENDED_ROUTES', '1');
  vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: lang })[k] ?? null, setItem() {}, removeItem() {} });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Pro } = await import('../Pro');
  return renderToStaticMarkup(<LanguageProvider><Pro onClose={() => {}} /></LanguageProvider>);
}

describe('the coach office is not offered in production (#7)', () => {
  for (const lang of ['fr', 'en']) {
    it(`offers the programme builder and no coach office, in ${lang}`, async () => {
      const html = await render(lang, false);
      expect(html).toContain('data-testid="pro-new"');
      expect(html).not.toContain('data-testid="tab-pro-business"');
      expect(html).not.toMatch(/Bureau du coach|Coach’s office/);
    });
  }

  it('the extended build offers it', async () => {
    const html = await render('fr', true);
    expect(html).toContain('data-testid="tab-pro-business"');
    expect(html).toContain('Bureau du coach');
  });
});
