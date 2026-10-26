import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
  globalThis.navigator ??= { hardwareConcurrency: 8 };
});

vi.mock('../../../lib/phoneCollect', () => ({
  collectSwitchAtLoad: () => null,
  collectSwitchSeen: () => {},
  onCollectSwitch: () => () => {},
}));
vi.mock('../Choice.css', () => ({}));
vi.mock('../sets', () => ({
  useSets: () => [],
  recentLifts: () => [],
}));
vi.mock('../lift-scenes', () => ({
  META: {
    squat: { fr: 'Squat', en: 'Squat', aliasFr: 'Flexion des jambes', aliasEn: 'Deep knee bend' },
    pushup: { fr: 'Pompes', en: 'Push-up', aliasFr: 'Pompe', aliasEn: 'Press-up' },
    lateral_raise: { fr: 'Élévations latérales', en: 'Lateral raise', aliasFr: 'Élévation latérale', aliasEn: 'Side raise' },
  },
  createLiftScene: () => () => {},
}));
vi.mock('../lift-meta', () => ({
  CARD_ORDER: ['squat', 'pushup', 'lateral_raise'],
}));
vi.mock('../Install', () => ({
  InstallRow: () => null,
}));
vi.mock('../ExerciseList', () => ({
  default: () => null,
}));

import Choice from '../Choice';
import { LanguageProvider } from '../../../lib/LanguageContext';

function renderChoice(lang = 'fr') {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
  return renderToStaticMarkup(
    <LanguageProvider>
      <Choice onChoose={() => {}} onGuide={() => {}} />
    </LanguageProvider>
  );
}

describe('Choice screen Universal Catalog Search Entry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the universal catalog row button in French', () => {
    const html = renderChoice('fr');
    expect(html).toContain('data-testid="choice-catalog-search"');
    expect(html).toContain('Catalogue universel');
    expect(html).toContain('1\u00A0200+ variantes, machines et mouvements');
  });

  it('renders the universal catalog row button in English', () => {
    const html = renderChoice('en');
    expect(html).toContain('data-testid="choice-catalog-search"');
    expect(html).toContain('Universal catalog');
    expect(html).toContain('1,200+ variations, machines and movements');
  });
});
