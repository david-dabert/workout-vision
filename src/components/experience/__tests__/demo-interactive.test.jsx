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
import { FALLBACK_DEMO_TELEMETRY } from '../demo-telemetry-data';

describe('Front Door Reframing & Interactive Biomechanics Lab Demo', () => {
  it('renders reframed biomechanics laboratory & VBT copy on Entry in French', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Laboratoire de biomécanique et Velocity-Based Training sur votre téléphone. Zéro capteur. Zéro serveur.');
    expect(html).toContain('Démo biomécanique (1 clic)');
    expect(html).toContain('entry-interactive');
  });

  it('renders reframed biomechanics laboratory & VBT copy on Entry in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Biomechanics laboratory and Velocity-Based Training on your phone. Zero sensors. Zero servers.');
    expect(html).toContain('Interactive Biomechanics Demo (1-click)');
    expect(html).toContain('entry-interactive');
  });

  it('renders interactive lab showcase banner on DemoView when onOpenLab is provided', () => {
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

    expect(html).toContain('demo-lab-banner');
    expect(html).toContain('Squat olympique · Analyse biomécanique');
    expect(html).toContain('Lancer l’analyse interactive (1 clic)');
  });

  it('renders interactive lab screen with sticking points, power in Watts, and trajectory diagnostics', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <DemoInteractiveLab onClose={() => {}} onStart={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('demo-interactive-lab');
    expect(html).toContain('Analyse biomécanique complète');
    expect(html).toContain('Démo Interactive · Squat Olympique');
    expect(html).toContain('demo-sticking-pin');
    // Movement optimization card with concentric power and metrics
    expect(html).toContain('movement-optimization-card');
    expect(html).toContain('Puissance concentrique');
    expect(html).toMatch(/\d+\s*W/);
    expect(html).toContain('Score d’amplitude (ROM)');
    expect(html).toContain('94%');
  });
});
