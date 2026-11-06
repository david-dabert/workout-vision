import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.document ??= { createElement: () => any, fonts: { ready: Promise.resolve() } };
  globalThis.navigator ??= { hardwareConcurrency: 8, vibrate: () => {} };
  globalThis.matchMedia ??= () => ({ matches: false });
});

vi.mock('../lift-scenes', () => ({
  META: {
    squat: { fr: 'Squat', en: 'Squat', aliasFr: 'Flexion des jambes', aliasEn: 'Deep knee bend' },
    pushup: { fr: 'Pompes', en: 'Push-up', aliasFr: 'Pompe', aliasEn: 'Press-up' },
    lateral_raise: { fr: 'Élévations latérales', en: 'Lateral raise', aliasFr: 'Élévation latérale', aliasEn: 'Side raise' },
  },
  createLiftScene: () => () => {},
  hasFigure: () => false,
  liftView: () => null,
}));
vi.mock('../lift-meta', () => ({
  CARD_ORDER: ['squat', 'pushup', 'lateral_raise'],
  META: {
    squat: { fr: 'Squat', en: 'Squat' },
    pushup: { fr: 'Pompes', en: 'Push-up' },
    lateral_raise: { fr: 'Élévations latérales', en: 'Lateral raise' },
  },
}));
vi.mock('../sets', () => ({
  useSets: () => [],
  recentLifts: () => [],
  loadSets: () => Promise.resolve([]),
  knownSets: () => [],
  previousSet: () => null,
}));
vi.mock('../../../lib/phoneCollect', () => ({
  collectSwitchAtLoad: () => null,
  collectSwitchSeen: () => {},
  onCollectSwitch: () => () => {},
}));
vi.mock('../Install', () => ({
  InstallRow: () => null,
}));
vi.mock('../ExerciseList', () => ({
  default: () => null,
}));
vi.mock('../MovementOptimization.css', () => ({}));
vi.mock('../Choice.css', () => ({}));
vi.mock('../Entry.css', () => ({}));
vi.mock('../Report.css', () => ({}));

import { LanguageProvider } from '../../../lib/LanguageContext';
import MovementOptimizationCard from '../MovementOptimizationCard';
import { buildOptimizationMetrics } from '../report-sheet';
import Choice from '../Choice';
import Entry from '../Entry';
import Report from '../Report';

describe('No unmeasured metrics or invented physics in production markup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const FORBIDDEN_REGEX = /\b(Watts?|kJ|kcal|L5\/S1)\b|\b\d+\s*(?:W|N|kJ|kcal)\b/;

  it('renders MovementOptimizationCard with zero unmeasured physics units', () => {
    const reps = [
      { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 1.5, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4.0, endTime: 6.8, concentricSec: 1.2, eccentricSec: 1.6, romDegrees: 88, peakSpeed: 100, meanSpeed: 60 },
      { index: 3, startTime: 7.5, endTime: 10.7, concentricSec: 1.6, eccentricSec: 1.6, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];

    const htmlFr = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={true} />
    );
    expect(htmlFr).not.toMatch(FORBIDDEN_REGEX);

    const htmlEn = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={false} />
    );
    expect(htmlEn).not.toMatch(FORBIDDEN_REGEX);
  });

  it('builds optimization sheet metrics with zero unmeasured units or fallback physics', () => {
    const opt = {
      romScore: 92,
      averageRomDeg: 88,
      controlIndex: 85,
      averageEccentricSec: 1.8,
      timeUnderTensionSec: 12.4,
      tempoCadence: '2-0-1',
      formDistortionScore: 0.12,
      pathEfficiencyPercent: 88,
      hypertrophyReport: { avgStretchScore: 90, bounceCount: 0 },
    };

    const metricsFr = buildOptimizationMetrics(opt, true);
    for (const m of metricsFr) {
      expect(m.label).not.toMatch(FORBIDDEN_REGEX);
      expect(m.val).not.toMatch(FORBIDDEN_REGEX);
      expect(m.sub).not.toMatch(FORBIDDEN_REGEX);
      expect(m.val).not.toContain('Fémurs');
      expect(m.val).not.toContain('91 N');
      expect(m.val).not.toContain('917 N');
    }

    const metricsEn = buildOptimizationMetrics(opt, false);
    for (const m of metricsEn) {
      expect(m.label).not.toMatch(FORBIDDEN_REGEX);
      expect(m.val).not.toMatch(FORBIDDEN_REGEX);
      expect(m.sub).not.toMatch(FORBIDDEN_REGEX);
    }
  });

  it('renders Report sheet without any unmeasured units or compliance score', () => {
    const reps = [
      { startTime: 0, endTime: 1.5, romDegrees: 63.6, concentricSec: 1.0, eccentricSec: 0.5, peakSpeed: 120, meanSpeed: 80 },
      { startTime: 1.8, endTime: 3.2, romDegrees: 64.0, concentricSec: 0.93, eccentricSec: 0.5, peakSpeed: 125, meanSpeed: 82 },
      { startTime: 3.5, endTime: 4.9, romDegrees: 63.0, concentricSec: 0.93, eccentricSec: 0.5, peakSpeed: 118, meanSpeed: 79 },
    ];

    const store = { wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Report lift="squat" count={3} counted={3} reps={reps} onBack={() => {}} />
      </LanguageProvider>
    );

    expect(html).not.toMatch(FORBIDDEN_REGEX);
    expect(html).not.toContain('Standard d’élite');
    expect(html).not.toContain('sh-vbt-section');
    expect(html).not.toContain('sh-sticking-box');
  });

  it('renders Entry screen without inflated claims or unmeasured features in production', () => {
    const store = { wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });

    const htmlFr = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(htmlFr).not.toContain('Laboratoire de biomécanique');
    expect(htmlFr).not.toContain('Velocity-Based Training');
    expect(htmlFr).not.toContain('Zéro serveur');
    expect(htmlFr).not.toContain('entry-interactive');

    const storeEn = { wv_lang: 'en' };
    vi.stubGlobal('localStorage', { getItem: k => storeEn[k] ?? null, setItem: (k, v) => { storeEn[k] = String(v); } });

    const htmlEn = renderToStaticMarkup(
      <LanguageProvider>
        <Entry onEnter={() => {}} />
      </LanguageProvider>
    );

    expect(htmlEn).not.toContain('Biomechanics laboratory');
    expect(htmlEn).not.toContain('Velocity-Based Training');
    expect(htmlEn).not.toContain('Zero servers');
    expect(htmlEn).not.toContain('entry-interactive');
  });

  it('renders Choice screen with honest counts and unmeasured routes hidden in production', () => {
    const store = { wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Choice onChoose={() => {}} onGuide={() => {}} />
      </LanguageProvider>
    );

    expect(html).not.toContain('Zéro serveur');
    expect(html).toContain('La vidéo reste sur votre téléphone');
    expect(html).not.toContain('1 200+ variantes');
    expect(html).toContain('183 exercices et mouvements');
    expect(html).not.toContain('data-testid="choose-head-pro"');
    expect(html).not.toContain('data-testid="choice-reference"');
    expect(html).not.toContain('data-testid="choice-pro"');
    expect(html).not.toContain('data-testid="choose-head-explore"');
    expect(html).not.toContain('data-testid="choice-equine"');
    expect(html).not.toContain('data-testid="choice-sports"');
  });
});
