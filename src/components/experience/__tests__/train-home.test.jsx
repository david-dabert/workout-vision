import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../../lib/LanguageContext';
import TrainHome from '../TrainHome';

describe('TrainHome (First-Minute Calling Card Screen)', () => {
  it('renders truthful headline and scoped privacy pledge in French', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <TrainHome />
      </LanguageProvider>
    );

    expect(html).toContain('Comptez et analysez vos séries directement sur votre téléphone.');
    expect(html).toContain('Zéro capteur. Zéro serveur. Votre vidéo et vos mouvements restent strictement sur votre appareil.');
    expect(html).toContain('Version Pilote');
    expect(html).toContain('100\u00A0% sur l’appareil');
    expect(html).toContain('Analyser une série');
    expect(html).toContain('Tester une analyse type (30\u00A0s)');
  });

  it('renders truthful headline and scoped privacy pledge in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <TrainHome />
      </LanguageProvider>
    );

    expect(html).toContain('Count and review a filmed set on your phone.');
    expect(html).toContain('Zero sensors. Zero servers. Your video and movement data stay on your phone during rep counting.');
    expect(html).toContain('Pilot Version');
    expect(html).toContain('100% On-Device');
    expect(html).toContain('Analyze a set');
    expect(html).toContain('Try a sample analysis (30s)');
  });

  it('renders all 7 Pilot exercise cards with their respective joints', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <TrainHome />
      </LanguageProvider>
    );

    expect(html).toContain('Squat');
    expect(html).toContain('Curl biceps');
    expect(html).toContain('Élévations latérales');
    expect(html).toContain('Tirage vertical');
    expect(html).toContain('Hip Thrust');
    expect(html).toContain('Soulevé de terre roumain');
    expect(html).toContain('Presse à cuisses');
  });
});
