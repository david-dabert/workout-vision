import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PessacClinicSpecialtyHub from '../PessacClinicSpecialtyHub';

describe('PessacClinicSpecialtyHub component', () => {
  it('renders the multi-specialty hub header and tabs', () => {
    const html = renderToStaticMarkup(
      <PessacClinicSpecialtyHub initialSpecialty="knee" />
    );

    expect(html).toContain('data-testid="pessac-specialty-hub"');
    expect(html).toContain('Clinique de Kinésithérapie de Pessac');
    expect(html).toContain('Plateforme Cinématique Multi-Spécialités');
    expect(html).toContain('data-testid="pessac-tab-knee"');
    expect(html).toContain('data-testid="pessac-tab-shoulder"');
    expect(html).toContain('data-testid="pessac-tab-lumbar"');
    expect(html).toContain('data-testid="pessac-tab-hip"');
    expect(html).toContain('data-testid="pessac-tab-ankle"');
    expect(html).toContain('data-testid="pessac-tab-cervical"');
  });

  it('renders the knee clinical panel with valgus and LSI metrics', () => {
    const html = renderToStaticMarkup(
      <PessacClinicSpecialtyHub initialSpecialty="knee" />
    );

    expect(html).toContain('data-testid="knee-clinical-panel"');
    expect(html).toContain('Valgus Dynamique');
    expect(html).toContain('Extension Terminale');
    expect(html).toContain('Symétrie Membre (LSI)');
    expect(html).toContain('96\u00A0%');
  });

  it('has zero em-dashes in its rendered HTML', () => {
    const html = renderToStaticMarkup(
      <PessacClinicSpecialtyHub initialSpecialty="knee" />
    );
    expect(html).not.toContain('—');
  });
});
