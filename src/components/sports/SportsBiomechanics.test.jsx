import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./SportsBiomechanics.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: SportsBiomechanics } = await import('./SportsBiomechanics');
  return renderToStaticMarkup(
    <LanguageProvider>
      <SportsBiomechanics onClose={() => {}} onOpenEquine={() => {}} onOpenVolleyball={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('SportsBiomechanics UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with sports biomechanics elements in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="sports-biomechanics-screen"');
      expect(html).toContain('data-testid="tab-golf"');
      expect(html).toContain('data-testid="tab-tennis"');
      expect(html).toContain('data-testid="tab-padel"');
      expect(html).toContain('data-testid="tab-baseball"');
      expect(html).toContain('data-testid="tab-cycling"');
      expect(html).toContain('data-testid="tab-rowing"');
      expect(html).toContain('data-testid="tab-skiing"');
      expect(html).toContain('data-testid="tab-swimming"');
      expect(html).toContain('data-testid="tab-equine-link"');
      expect(html).toContain('data-testid="tab-volleyball-link"');
      expect(html).toContain('data-testid="sports-demo-player-card"');
      expect(html).toContain('data-testid="sports-demo-player"');
      expect(html).toContain('data-testid="sports-demo-mode-analyzed"');
      expect(html).toContain('data-testid="sports-demo-mode-raw"');
      expect(html).toContain('data-testid="demo-download-btn"');
      expect(html).toContain('data-testid="demo-telemetry-strip"');
      expect(html).toContain('data-testid="sports-upload-btn"');
      expect(html).toContain('data-testid="card-golf-metrics"');
      expect(html).toContain('data-testid="sports-copy-report"');
      expect(html).toContain('data-testid="sports-mode-bar"');
      expect(html).toContain('data-testid="mode-landmarks"');
      expect(html).toContain('data-testid="mode-simulation"');
      expect(html).toContain('data-testid="sports-preset-section"');
      expect(html).toContain('X-Factor Stretch');
      expect(html).toContain('Tour Model');
    });
  }
});
