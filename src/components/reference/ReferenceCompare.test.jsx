import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./ReferenceCompare.css', () => ({}));
// The pose pipeline is never reached before both videos are chosen and Compare is tapped.
vi.mock('../../lib/reference/readPose', () => ({ readPose: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: ReferenceCompare } = await import('./ReferenceCompare');
  return renderToStaticMarkup(<LanguageProvider><ReferenceCompare onClose={() => {}} /></LanguageProvider>);
}

describe('the reference comparison screen', () => {
  for (const lang of ['fr', 'en']) {
    it(`opens on the two videos to choose, Compare disabled until both are chosen (${lang})`, async () => {
      const html = await render(lang);
      expect(html).toContain('data-testid="reference-screen"');
      expect(html).toContain('data-testid="rc-ref"');
      expect(html).toContain('data-testid="rc-att"');
      expect(html).toMatch(/data-testid="rc-compare"[^>]*disabled|disabled[^>]*data-testid="rc-compare"/);
      expect(html).toContain('accept="video/*"');
      // No verdict, no number before any video is read (R8).
      expect(html).not.toContain('data-testid="rc-result"');
      expect(html).not.toMatch(/\d+\s?%/);
    });
  }

  it('says that the videos stay on the phone', async () => {
    expect(await render('fr')).toContain('Tout reste sur ce téléphone');
  });
});
