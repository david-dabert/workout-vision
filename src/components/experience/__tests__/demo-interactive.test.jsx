import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  globalThis.document ??= { createElement: () => any, fonts: { ready: Promise.resolve() } };
  globalThis.navigator ??= { hardwareConcurrency: 8, vibrate: () => {} };
  globalThis.matchMedia ??= () => ({ matches: false });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../../lib/LanguageContext';
import Entry from '../Entry';
import { DemoView } from '../Demo';
import DemoInteractiveLab from '../DemoInteractiveLab';

describe('Front Door Reframing & Interactive Biomechanics Lab Demo', () => {
  it('renders honest repetition counting copy on Entry in French', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Comptage de répétitions et analyse du mouvement sur votre téléphone.');
    expect(html).not.toContain('entry-interactive');
  });

  it('renders honest repetition counting copy on Entry in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Repetition counting and movement analysis on your phone.');
    expect(html).not.toContain('entry-interactive');
  });

  it('hides unmeasured interactive lab button in DemoVideos in production', () => {
    const mockResult = { reps: [], count: 5 };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <DemoView
          lang="fr"
          t={0}
          result={mockResult}
          duration={10}
          canvasRef={{ current: null }}
          onClose={() => {}}
          onStart={() => {}}
          onReplay={() => {}}
          onOpenLab={() => {}}
        />
      </LanguageProvider>
    );

    expect(html).not.toContain('demo-video-lab-btn');
  });

  it('renders interactive lab screen with real telemetry facts and controls', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const mockTelemetry = {
      lift: 'bicep_curl',
      count: 5,
      label: 5,
      reps: [{ startTime: 0, endTime: 1.5, romDegrees: 100 }],
      angles: [160, 50, 160],
      timestamps: [0, 1, 2],
    };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <DemoInteractiveLab onClose={() => {}} onStart={() => {}} initialTelemetry={mockTelemetry} />
      </LanguageProvider>
    );

    expect(html).toContain('demo-interactive-lab');
    expect(html).toContain('Voyez ce que l’appli voit.');
    expect(html).toContain('Série réelle');
    expect(html).toContain('demo-lab-facts');
    expect(html).toContain('Ce que l’appli a mesuré');
    expect(html).toContain('Répétitions');
    expect(html).toContain('Amplitude moyenne');
    expect(html).toContain('Filmer ma propre série');
  });
});
