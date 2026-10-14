import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Ergonomics.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Ergonomics } = await import('./Ergonomics');
  return renderToStaticMarkup(
    <LanguageProvider>
      <Ergonomics onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Honesty pass of 14 October 2026 (ERG-1 to ERG-4): the published equation on typed values, no invented L5/S1.
describe('the NIOSH calculator', () => {
  for (const lang of ['en', 'fr']) {
    it(`shows the RWL, the LI with NIOSH's wording and the worked product, and no L5/S1 or compliance claim (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="ergonomics-screen"');
      expect(html).toContain('data-testid="ergo-li-value"');
      expect(html).toContain('data-testid="ergo-rwl-value"');
      expect(html).toContain('data-testid="ergo-product"');
      expect(html).toContain('data-testid="slider-load"');
      expect(html).toContain('data-testid="select-frequency"');
      expect(html).toContain('NIOSH');
      expect(html).not.toMatch(/L5\/S1|3[\s\u00A0\u202F,.]?400|Conforme|Compliant|RGPD|GDPR|Enterprise|HUD|Squelett|Skeletal|REBA/);
      // The screen opens on the example it highlights: palletising with a twist, LI 1.79.
      expect(html).toContain(lang === 'fr' ? '1,79' : '1.79');
    });
  }
});

// Second review of 14 October 2026: outside the equation's domain, the calculation card gave "= 0 kg" and named the
// lowest multiplier under a result that said "aucune limite ni indice".
describe('a lift outside the equation', () => {
  async function card(lang, input) {
    const { calculateNioshLifting } = await import('../../lib/ergonomics');
    const { COPY } = await import('./niosh-copy');
    const { default: NioshProduct } = await import('./NioshProduct');
    const c = COPY[lang];
    const r = calculateNioshLifting({ loadWeightKg: 18, verticalOriginCm: 70, verticalTravelDistanceCm: 40, asymmetryAngleDeg: 45, frequencyLiftsPerMin: 0.2, duration: 'short', couplingQuality: 'good', ...input });
    const rows = [['HM', r.horizontalMultiplierHM, 'H'], ['VM', r.verticalMultiplierVM, 'V'], ['DM', r.distanceMultiplierDM, 'D'], ['AM', r.asymmetricMultiplierAM, 'A'], ['FM', r.frequencyMultiplierFM, 'F'], ['CM', r.couplingMultiplierCM, 'C']];
    return { r, html: decode(renderToStaticMarkup(<NioshProduct r={r} rows={rows} c={c} fr={lang === 'fr'} />)) };
  }
  for (const lang of ['fr', 'en']) {
    it(`gives no limit in kg, says "outside" on the factor and names the bound passed (${lang})`, async () => {
      const { r, html } = await card(lang, { horizontalDistanceCm: 70 });
      expect(r.riskCategory).toBe('outside');
      expect(html).not.toMatch(/kg</);
      expect(html).not.toMatch(/=\s*0/);
      expect(html).not.toMatch(/0[.,]00/);
      expect(html).not.toContain(lang === 'fr' ? 'coefficient le plus bas' : 'lowest multiplier');
      expect(html).toContain(lang === 'fr' ? 'hors domaine' : 'outside');
      expect(html).toContain(lang === 'fr' ? 'Hors domaine (H > 63 cm) : pas de limite calculée' : 'Outside the domain (H > 63 cm): no limit computed');
    });
  }
  it('inside the domain the card still gives the limit and the lowest multiplier', async () => {
    const { html } = await card('fr', { horizontalDistanceCm: 45 });
    expect(html).toMatch(/= [\d,]+ kg/);
    expect(html).toContain('coefficient le plus bas');
  });
  it('the frequency rows name the lift', async () => {
    const { COPY } = await import('./niosh-copy');
    expect(COPY.fr.perMin(0.2)).toBe('Au plus 1 levée toutes les 5 min');
    expect(COPY.fr.perMin(0.5)).toBe('0,5 levée par minute');
    expect(COPY.fr.perMin(4)).toBe('4 levées par minute');
    expect(COPY.en.perMin(1)).toBe('1 lift a minute');
    expect(COPY.en.perMin(0.2)).toBe('At most 1 lift every 5 min');
  });
});
