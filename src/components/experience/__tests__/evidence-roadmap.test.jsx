import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../../lib/LanguageContext';
import EvidenceRoadmap from '../EvidenceRoadmap';

describe('EvidenceRoadmap (Dated Evidence & Technical Roadmap)', () => {
  it('renders the 3 distinct sections (Disponible, Expérimental, Feuille de route) in French', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <EvidenceRoadmap onBack={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Preuves et feuille de route');
    expect(html).toContain('Mesure certifiée au 6 novembre 2026');
    expect(html).toContain('1. Disponible (Version Pilote)');
    expect(html).toContain('13 / 15');
    expect(html).toContain('13 / 16');
    expect(html).toContain('2. Expérimental (En recherche)');
    expect(html).toContain('Développé couché et Développé militaire');
    expect(html).toContain('3. Feuille de route (Engagements R&amp;D)');
    expect(html).toContain('PLAN.md Règle 14');
  });

  it('renders the 3 distinct sections in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <EvidenceRoadmap onBack={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Evidence &amp; Roadmap');
    expect(html).toContain('Certified baseline as of 6 November 2026');
    expect(html).toContain('1. Available (Pilot Version)');
    expect(html).toContain('13 / 15');
    expect(html).toContain('2. Experimental (Under research)');
    expect(html).toContain('3. Roadmap (R&amp;D Commitments)');
    expect(html).toContain('PLAN.md Rule 14');
  });
});
