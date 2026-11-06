import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../../lib/LanguageContext';
import SampleDemoModal from '../SampleDemoModal';

describe('SampleDemoModal (Meeting Demo Mode)', () => {
  it('renders the sample squat analysis metrics and honest boundaries in French', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <SampleDemoModal onClose={() => {}} onTryWithCamera={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Squat en salle (7 répétitions)');
    expect(html).toContain('Exemple type certifié');
    expect(html).toContain('Exécuté sur le téléphone');
    expect(html).toContain('82°');
    expect(html).toContain('2,1 s');
    expect(html).toContain('Transparence et limites de mesure\u00A0:');
    expect(html).toContain('Non mesuré\u00A0:');
    expect(html).toContain('Vitesse de barre en m/s (VBT)');
    expect(html).toContain('Essayer avec ma caméra');
  });

  it('renders the sample squat analysis metrics and honest boundaries in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <SampleDemoModal onClose={() => {}} onTryWithCamera={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Gym Squat (7 Repetitions)');
    expect(html).toContain('Calibrated Sample Set');
    expect(html).toContain('Processed On-Device');
    expect(html).toContain('82°');
    expect(html).toContain('Transparency &amp; Measurement Limits:');
    expect(html).toContain('Not measured:');
    expect(html).toContain('Bar speed in m/s (VBT)');
    expect(html).toContain('Try with camera');
  });
});
