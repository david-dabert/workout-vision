import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { savedSet } from '../saved-set';
import { bestLines, exerciseProgress, storedLoad } from '../progress';
import { setsCsv } from '../sets-csv';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', async orig => ({ ...(await orig()), knownSets: () => [], loadSets: () => Promise.resolve([]), refreshSets: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const rep = (index, t) => ({ index, startTime: t, endTime: t + 2, concentricSec: 1, eccentricSec: 1, romDegrees: 100 });
const counted = { count: 7, refused: false, arm: 'right', reps: Array.from({ length: 7 }, (_, i) => rep(i + 1, i * 2)), confidence: 0.9, metadata: { duration: 22 } };

describe('optional load after saving (card 032)', () => {
  it('offers no load field before the count is saved', async () => {
    const store = { wv_lang: 'fr', wv_level: 'intermediate' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Result } = await import('../Result');
    const html = renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={counted} onClose={() => {}} onReplay={() => {}} /></LanguageProvider>);
    expect(html).not.toContain('saved-load');
  });

  it('stores no weight field (and never 0) when a counted set is saved without a load', () => {
    const kept = savedSet({ result: counted, lift: 'bicep_curl', n: 7, corrected: false });
    expect('weight' in kept).toBe(false);
    expect(storedLoad(kept)).toBeNull();
  });

  it('parses and formats positive loads in kg and updates history, record by load and CSV export', async () => {
    const { parseLoadKg, formatLoadKg } = await import('../saved-set');
    expect(parseLoadKg('60')).toBe(60);
    expect(parseLoadKg('62,5')).toBe(62.5);
    expect(parseLoadKg(' 62.5 ')).toBe(62.5);
    for (const bad of ['', '   ', '0', '-10', 'abc', 'Infinity']) expect(parseLoadKg(bad)).toBeNull();
    expect(formatLoadKg(60, true)).toBe('60\u00A0kg');
    expect(formatLoadKg(62.5, true)).toBe('62,5\u00A0kg');
    expect(formatLoadKg(62.5, false)).toBe('62.5\u00A0kg');

    const base = Date.UTC(2026, 10, 14, 10, 0, 0);
    const prior = { id: 'c0', exercise: 'bicep_curl', reps: 5, source: 'counter-core', corrected: false, weight: 50, createdAt: base - 60_000 };
    const current = { id: 'c1', ...savedSet({ result: counted, lift: 'bicep_curl', n: 7, corrected: false, now: new Date(base) }), createdAt: base, weight: 60 };
    const [prog] = exerciseProgress([current, prior]);
    expect(bestLines(prog.bests, true)).toContain('Charge max\u00A0: 60\u00A0kg × 7');
    const heaviestReps = { ...prior, id: 'c4', reps: 10, createdAt: base - 120_000 };
    const heavier = { id: 'c2', exercise: 'bicep_curl', reps: 4, source: 'counter-core', corrected: false, weight: 70, createdAt: base + 60_000 };
    const at60 = { id: 'c3', ...savedSet({ result: counted, lift: 'bicep_curl', n: 8, corrected: false, now: new Date(base + 120_000) }), createdAt: base + 120_000, weight: 60 };
    const [progAtLoad] = exerciseProgress([at60, heavier, current, heaviestReps]);
    expect(bestLines(progAtLoad.bests, true)).toContain('Record à 60\u00A0kg\u00A0: 8\u00A0répétitions');
    const csvRows = setsCsv([current], { lang: 'fr' }).slice(1).split('\r\n').filter(Boolean);
    expect(csvRows[0].split(';')[6]).toBe('Charge (kg)');
    expect(csvRows[1].split(';')[6]).toBe('60');
  });

  it('shows 60 kg in the history row metadata when stored', async () => {
    const store = { wv_lang: 'fr', wv_level: 'intermediate' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.doMock('../sets', () => ({
      knownSets: () => [{ id: 'c1', exercise: 'bicep_curl', reps: 7, duration: 22, arm: 'right', weight: 60, source: 'counter-core', corrected: false, createdAt: Date.UTC(2026, 10, 14, 10, 0, 0) }],
      loadSets: () => Promise.resolve([]),
      onSetsChanged: () => () => {},
      removeSet: async () => {},
      countedBy: w => w.reps,
      proposedBy: () => null,
      setTime: w => w.createdAt,
    }));
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: History } = await import('../History');
    const html = renderToStaticMarkup(<LanguageProvider><History onClose={() => {}} /></LanguageProvider>);
    expect(html).toContain('60\u00A0kg');
  });
});
