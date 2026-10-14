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

// Honesty pass of 14 October 2026 (BUD-1 to BUD-3): a labelled demo, fictional gyms, no assumed weights, no connect.
describe('the gym buddy demo', () => {
  for (const lang of ['en', 'fr']) {
    it(`shows fictional profiles as such and promises no roll-out or connection (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="gym-buddy-screen"');
      expect(html).toContain('data-testid="filter-ppl"');
      expect(html).toContain('data-testid="demo-badge"');
      expect(html).toContain(lang === 'fr' ? 'Salle exemple A' : 'Sample gym A');
      // Second review: French typography and words in the bios (18 h 30, 7 h; no "Powerlifter", no "Focus").
      if (lang === 'fr') expect(html).not.toMatch(/\d+h\d|\dh00|Powerlifter|Focus/);
      expect(html).toContain(lang === 'fr' ? 'Saisi à la main' : 'Typed by hand');
      expect(html).not.toMatch(/Basic-Fit|Fitness Park|Gymbox|Equinox|P2P|Synchronis|Synced|déploiement|rolling out|Proposer une séance|Request Training|créneau|schedule|parité|parity/i);
    });
  }
});
