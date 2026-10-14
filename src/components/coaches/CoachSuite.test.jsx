import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./CoachSuite.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: CoachSuite } = await import('./CoachSuite');
  return renderToStaticMarkup(
    <LanguageProvider>
      <CoachSuite onAddToProgramme={() => {}} onSelectClient={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('Coach Business OS & Suite Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders all 4 tabs and workspace panels in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="coach-suite"');
      expect(html).toContain('data-testid="tab-clients"');
      expect(html).toContain('data-testid="tab-accounting"');
      expect(html).toContain('data-testid="tab-nutrition"');
      expect(html).toContain('data-testid="tab-physio"');
      expect(html).toContain('data-testid="section-clients"');
      expect(html).toContain('data-testid="btn-add-client"');
    });
  }
});

// Honesty pass of 14 October 2026 (wave 2B): the office prints no identity it was not given, and says what is missing.
describe('the office after the honesty pass', () => {
  async function renderAccounting(lang, profile = {}) {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const { default: CoachAccounting } = await import('./CoachAccounting');
    return decode(renderToStaticMarkup(<CoachAccounting fr={lang === 'fr'} clients={[]} selectedClient={null} profile={profile} onSaveProfile={async () => {}} />));
  }
  it('shows no made-up SIRET, carte pro, insurer, brand or rate, and lists what the invoice lacks', async () => {
    const html = await renderAccounting('fr');
    expect(html).not.toMatch(/842 918 203|ED-75-2023|MACSF|Basic-Fit|Coach Thomas|21[.,]1|21[.,]3|Reste à Vivre|Conforme/);
    expect(html).toContain('data-testid="inv-missing"');
    expect(html).toContain('un SIRET valide (votre fiche)');
    expect(html).not.toContain('data-testid="inv-preview"');
    expect(html).toContain('25,6 %');
    expect(html).toContain('Revenu estimé avant impôt');
  });
  it('previews the invoice once the coach’s file is complete, with no number before it is issued', async () => {
    const html = await renderAccounting('fr', { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001' });
    // The client and the price are still missing: no preview yet.
    expect(html).toContain('le nom du client');
    expect(html).not.toContain('un SIRET valide');
  });
  for (const lang of ['en', 'fr']) {
    it(`the clients tab promises no telemetry and counts no linked set (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).not.toMatch(/télémétrie|telemetry|isoler ses séries/i);
      expect(html).toContain(lang === 'fr' ? 'Aucun client pour l’instant.' : 'No client yet.');
    });
  }
});
