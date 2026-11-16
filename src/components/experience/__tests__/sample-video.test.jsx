import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ knownSets: () => [], loadSets: () => Promise.resolve([]), refreshSets: () => {} }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('react');
  vi.doUnmock('../../../lib/LanguageContext');
  vi.doUnmock('../../../lib/coreAnalysis');
});

const rep = (index, t) => ({ index, startTime: t, endTime: t + 2, concentricSec: 1, eccentricSec: 1, romDegrees: 100 });
const nine = {
  count: 9,
  refused: false,
  arm: 'right',
  reps: Array.from({ length: 9 }, (_, i) => rep(i + 1, i * 2)),
  confidence: 0.9,
  metadata: { duration: 12 },
  worldLandmarks: [[[0, 0, 0]]],
  timestamps: [0],
};

function stubBrowserEnv(lang = 'fr') {
  const store = { wv_lang: lang, wv_level: 'intermediate', wv_collecte: '1' };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
}

async function renderSample(lang, result, props = {}) {
  stubBrowserEnv(lang);
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(
    <LanguageProvider>
      <Result lift="bicep_curl" result={result} onClose={() => {}} onReplay={() => {}} onNewSet={() => {}} onRefilm={() => {}} {...props} />
    </LanguageProvider>,
  );
}

const walk = (node, hit) => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = walk(n, hit);
      if (found) return found;
    }
    return undefined;
  }
  if (!node || typeof node !== 'object' || !node.props) return undefined;
  return hit(node) ? node : walk(node.props.children, hit);
};

function createHookHarness() {
  let slots = [], i = 0, queue = [];
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, k) => Object.is(x, b[k]));
  return {
    reset() { slots = []; queue = []; i = 0; },
    begin() { i = 0; queue = []; },
    effects() { const q = queue; queue = []; return q.map(f => f()); },
    useState(init) {
      const k = i++;
      if (!(k in slots)) slots[k] = typeof init === 'function' ? init() : init;
      return [slots[k], v => { slots[k] = typeof v === 'function' ? v(slots[k]) : v; }];
    },
    useRef(init) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useEffect(fn, deps) { const k = i++; if (!(k in slots) || !same(slots[k], deps)) { slots[k] = deps; queue.push(fn); } },
    useLayoutEffect() {},
  };
}

describe('card 044: sample video result carries sample flag and never saves or collects', () => {
  it('marks counted sample results as Exemple/Sample with no save or confirm keys', async () => {
    const fr = await renderSample('fr', { ...nine, sample: true }, { planned: { programme: 'p1', item: 0, sets: 4, reps: 10, rest: 90 } });
    expect(fr).toContain('Exemple');
    expect(fr).toContain('non enregistr');
    expect(fr).not.toContain('C’est bien 9');
    expect(fr).not.toContain('À confirmer');
    expect(fr).not.toContain('data-testid="res-yes"');
    expect(fr).not.toContain('data-testid="res-save"');
    expect(fr).not.toContain('data-testid="res-alt"');
    expect(fr).not.toContain('data-testid="res-plan"');

    const en = await renderSample('en', { ...nine, sample: true });
    expect(en).toContain('Sample');
    expect(en).toContain('not saved');
    expect(en).not.toContain('Was it 9?');
    expect(en).not.toContain('data-testid="res-yes"');
  });

  it('marks low-confidence and refused sample results as Exemple without asking to check or save a number', async () => {
    const zero = await renderSample('fr', { ...nine, count: 0, reps: [], sample: true });
    expect(zero).toContain('Exemple');
    expect(zero).not.toContain('data-testid="res-save"');
    expect(zero).not.toContain('Combien en avez-vous fait');

    const refused = await renderSample('fr', { ...nine, count: 0, reps: [], refused: true, worldLandmarks: [], timestamps: [], sample: true });
    expect(refused).toContain('Exemple');
    expect(refused).not.toContain('data-testid="res-save"');
    expect(refused).not.toContain('Combien en avez-vous fait');

    // Low-confidence counted sample: Revoir appears once (Topbar), no prompt to verify a hidden number.
    const lowCounted = await renderSample('fr', { ...nine, sensitivity: { moved: true, counts: [7, 11] }, sample: true });
    expect(lowCounted).toContain('rp-open');
    expect(lowCounted).not.toContain('Revoir la vidéo');
    expect(lowCounted).not.toContain('vérifiez le nombre');

    // Refused universal proposal sample: never offers a proposal to verify without showing it, nor an empty .res-cause box.
    const uniProposal = await renderSample('fr', { ...nine, count: 0, reps: [], refused: true, universal: { hold: false }, proposal: { count: 8, by: 'universal' }, sample: true });
    expect(uniProposal).not.toContain('à vérifier');
    expect(uniProposal).not.toContain('data-testid="res-save"');
    expect(uniProposal).not.toMatch(/<div class="res-cause">[\s\S]*?<div><\/div><\/div>/);

    // Universal hold sample: Changer d'exercice appears once cleanly.
    const hold = await renderSample('fr', { count: 0, reps: [], refused: true, universal: { hold: true }, sample: true });
    expect(hold.match(/Changer d’exercice/g)).toHaveLength(1);
  });

  it('handles ez_curl route, fetch errors (no file-input click), and sample-vs-real abort races at runtime in Film.jsx', async () => {
    stubBrowserEnv('fr');
    const hooks = createHookHarness();
    vi.doMock('react', async orig => ({ ...(await orig()), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect, useLayoutEffect: hooks.useLayoutEffect }));
    vi.doMock('../../../lib/LanguageContext', () => ({ useT: () => ({ lang: 'fr' }) }));
    vi.doMock('../../../lib/liveCamera', () => ({ canOpenCamera: () => true, readFilmMode: () => 'video', writeFilmMode: () => {} }));
    vi.doMock('../../../lib/buildFlags', () => ({ liveBuild: () => true }));

    const fetchCalls = [];
    let rejectNext = false;
    let deferredResolve = null;
    vi.stubGlobal('fetch', (url, opts) => {
      fetchCalls.push({ url: String(url), signal: opts?.signal });
      if (String(url).includes('bodyweight-squat-9') && fetchCalls.length === 1) return Promise.resolve({ ok: true, blob: async () => new Blob(['w']) });
      if (rejectNext) return Promise.reject(new Error('offline'));
      return new Promise((resolve, reject) => {
        deferredResolve = resolve;
        opts?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      });
    });

    const { default: Film } = await import('../Film');
    const onFile = vi.fn();
    let tree;
    const render = async props => {
      hooks.begin();
      tree = Film({ lift: 'bicep_curl', onBack: () => {}, onFile, onLive: () => {}, onChangeLift: () => {}, ...props });
      hooks.effects();
      await new Promise(r => setImmediate(r));
    };

    // 1. Rejection on fetch shows alert error without falling back to file input click.
    rejectNext = true;
    await render({ lift: 'ez_curl' });
    await walk(tree, n => n.props?.['data-testid'] === 'film-sample-btn').props.onClick();
    await render({ lift: 'ez_curl' });
    expect(fetchCalls.some(c => c.url.includes('/demo/ez-curl-10.mp4'))).toBe(true);
    expect(walk(tree, n => n.props?.['data-testid'] === 'film-sample-error')).toBeTruthy();

    // 2. Picking a real video aborts pending sample fetch; deferred resolution never fires onFile(sample).
    rejectNext = false;
    hooks.reset();
    await render({ lift: 'bicep_curl' });
    const samplePromise = walk(tree, n => n.props?.['data-testid'] === 'film-sample-btn').props.onClick();
    const realFile = new File(['real'], 'real.mp4', { type: 'video/mp4' });
    walk(tree, n => n.type === 'input' && n.props?.capture === 'environment').props.onChange({ target: { files: [realFile] } });
    deferredResolve?.({ ok: true, blob: async () => new Blob(['demo']) });
    await samplePromise;
    await render({ lift: 'bicep_curl' });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(realFile);

    // 3. Switching to Live mode aborts a pending sample fetch so it cannot hijack #live -> #analyze.
    onFile.mockClear();
    hooks.reset();
    await render({ lift: 'bicep_curl', onLive: () => {} });
    const liveSamplePromise = walk(tree, n => n.props?.['data-testid'] === 'film-sample-btn').props.onClick();
    walk(tree, n => n.props?.['data-testid'] === 'mode-live').props.onClick();
    deferredResolve?.({ ok: true, blob: async () => new Blob(['demo']) });
    await liveSamplePromise;
    await render({ lift: 'bicep_curl', onLive: () => {} });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('omits by-hand save escape hatch on CoreUpload failure screens when sample={true}', async () => {
    stubBrowserEnv('fr');
    const hooks = createHookHarness();
    vi.doMock('react', async orig => ({ ...(await orig()), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect, useLayoutEffect: hooks.useLayoutEffect }));
    vi.doMock('../../../lib/LanguageContext', () => ({ useT: () => ({ lang: 'fr' }) }));
    vi.doMock('../../../lib/liveCamera', () => ({ canOpenCamera: () => true, readFilmMode: () => 'video', writeFilmMode: () => {} }));
    vi.doMock('../../../lib/buildFlags', () => ({ liveBuild: () => true }));
    vi.doMock('../../../lib/coreAnalysis', () => ({ analyzeCoreVideo: () => Promise.reject(Object.assign(new Error('decode failed'), { name: 'Error', decoder: 'webcodecs' })) }));
    vi.doMock('../../../lib/interruption', () => ({ watchInterruption: () => () => {}, whenVisible: () => Promise.resolve(), settleRun: async (_s, v) => v, holdScreenAwake: () => () => {}, isInterruption: () => false }));

    const { default: CoreUpload } = await import('../../CoreUpload');
    const file = new File(['demo'], 'bicep-curl-5.mp4', { type: 'video/mp4' });
    let tree;
    for (let k = 0; k < 4; k++) {
      hooks.begin();
      tree = CoreUpload({ initialLift: 'bicep_curl', initialFile: file, sample: true, onClose: () => {}, onRefilm: () => {} });
      hooks.effects();
      await new Promise(r => setImmediate(r));
    }
    const errEl = walk(tree, n => typeof n?.type === 'function' && n.type.name === 'AnalysisError');
    expect(errEl).toBeTruthy();
    expect(errEl.props.onByHand).toBeUndefined();
  });

  it('exposes canSaveResult and refuses both save and #collecte collection when result.sample is true', async () => {
    const [{ canSaveResult }, { collectThisSet }] = await Promise.all([
      import('../Result'),
      import('../../../lib/phoneCollect'),
    ]);

    expect(canSaveResult({ ...nine, sample: true })).toBe(false);
    expect(canSaveResult(nine)).toBe(true);

    const put = vi.fn(async () => {});
    const storage = { getItem: k => (k === 'wv_collecte' ? '1' : null) };
    const kept = await collectThisSet({
      result: { ...nine, sample: true },
      lift: 'bicep_curl',
      kept: 9,
      view: 'side',
      version: 'v-test',
      storage,
      put,
    });
    expect(kept).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });
});
