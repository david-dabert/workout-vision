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

  it('scans all string literals reachable from main.jsx with extended routes off and fails on unmeasured metrics and sticking terms', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const parser = await import('@babel/parser');
    const traverseModule = await import('@babel/traverse');
    const traverse = traverseModule.default?.default || traverseModule.default;

    const visited = new Set();
    const root = path.resolve('src/main.jsx');

    function resolveImport(source, fromFile) {
      if (!source.startsWith('.')) return null;
      const dir = path.dirname(fromFile);
      const extensions = ['.jsx', '.js', '.tsx', '.ts', '/index.js', '/index.jsx', '/index.ts'];
      const candidate = path.resolve(dir, source);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      for (const ext of extensions) {
        if (fs.existsSync(candidate + ext)) return candidate + ext;
      }
      return null;
    }

    function crawl(file) {
      if (visited.has(file)) return;
      visited.add(file);
      if (!file.endsWith('.js') && !file.endsWith('.jsx') && !file.endsWith('.ts') && !file.endsWith('.tsx')) return;
      let code;
      try {
        code = fs.readFileSync(file, 'utf8');
      } catch {
        return;
      }
      let ast;
      try {
        ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      } catch {
        return;
      }

      traverse(ast, {
        ImportDeclaration(p) {
          const src = p.node.source.value;
          const resolved = resolveImport(src, file);
          if (resolved && resolved.includes('/src/') && !resolved.includes('/__tests__/') && !resolved.includes('.test.')) {
            crawl(resolved);
          }
        },
        CallExpression(p) {
          if (p.node.callee.type === 'Import') {
            const arg = p.node.arguments[0];
            if (arg && arg.type === 'StringLiteral') {
              const src = arg.value;
              if (file.endsWith('src/App.jsx')) {
                const extended = ['InvestorShowcaseModal', 'Equine', 'SportsBiomechanics', 'CoachFinder', 'GymBuddy', 'Ergonomics', 'Kine', 'Chat', 'Activity', 'Showcase', 'Manifesto', 'Pro', 'Programme'];
                if (extended.some(ex => src.includes(ex))) return;
              }
              const resolved = resolveImport(src, file);
              if (resolved && resolved.includes('/src/') && !resolved.includes('/__tests__/') && !resolved.includes('.test.')) {
                crawl(resolved);
              }
            }
          }
        }
      });
    }

    crawl(root);

    const FORBIDDEN = [
      { name: 'Watts', re: /\bWatts?\b/ },
      { name: 'kJ', re: /\bkJ\b/ },
      { name: 'kcal', re: /\bkcal\b/ },
      { name: 'L5/S1', re: /\bL5\/S1\b/ },
      { name: 'Point de blocage', re: /Point de blocage/i },
      { name: 'sticking', re: /\bsticking\b/i },
      { name: 'W (power unit)', re: /(?:\b\d+\s*W\b|^\s*W\s*$)/ },
      { name: 'N (force unit)', re: /(?:\b\d+\s*N\b|^\s*N\s*$|N·m)/ },
    ];

    const violations = [];

    for (const file of visited) {
      const rel = path.relative(process.cwd(), file);
      if (!rel.startsWith('src/components/') && !rel.startsWith('src/lib/')) continue;
      if (rel.startsWith('src/lib/counting/')) continue;
      if (!file.endsWith('.js') && !file.endsWith('.jsx') && !file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      if (rel.includes('pdf-fonts/fonts.js')) continue;

      const code = fs.readFileSync(file, 'utf8');
      let ast;
      try {
        ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
      } catch {
        continue;
      }

      traverse(ast, {
        StringLiteral(p) {
          if (p.parentPath.isImportDeclaration() || p.parentPath.isExportDeclaration()) return;
          if (p.parentPath.isCallExpression() && (p.parentPath.node.callee.name === 'require' || p.parentPath.node.callee.type === 'Import')) return;
          if (p.parentPath.isObjectProperty() && p.parentPath.node.key === p.node) return;

          const val = p.node.value;
          for (const f of FORBIDDEN) {
            if (f.re.test(val)) {
              violations.push({ file: rel, line: p.node.loc?.start.line, text: val, violation: f.name });
            }
          }
        },
        JSXText(p) {
          const val = p.node.value;
          for (const f of FORBIDDEN) {
            if (f.re.test(val)) {
              violations.push({ file: rel, line: p.node.loc?.start.line, text: val.trim(), violation: f.name });
            }
          }
        },
        TemplateLiteral(p) {
          for (const quasi of p.node.quasis) {
            const val = quasi.value.raw;
            for (const f of FORBIDDEN) {
              if (f.re.test(val)) {
                violations.push({ file: rel, line: quasi.loc?.start.line, text: val.trim(), violation: f.name });
              }
            }
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
