import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// C9 of the design review (7 October 2026): the stage under every screen requests frames only while a screen draws
// on it (Watch.jsx, Result.jsx), with or without Reduce Motion; with no layer it draws one frame and sleeps, and a
// layer, a resize, a change of dust, the page shown again or the end of a swipe draws one more.
vi.mock('../entry-scene', () => ({ DPR: 1, drawDust: (...a) => dusts.push(a[4]) }));
let dusts = [];
let queued = [], listeners = {}, docListeners = {}, reduce = false;
const run = (now = 16) => { const q = queued; queued = []; for (const cb of q) cb?.(now); };
const canvas = { clientWidth: 390, clientHeight: 844, width: 0, height: 0, getContext: () => ({ clearRect() {} }) };

beforeEach(() => {
  vi.resetModules();
  dusts = []; queued = []; listeners = {}; docListeners = {}; reduce = false;
  vi.stubGlobal('requestAnimationFrame', cb => { queued.push(cb); return queued.length; });
  vi.stubGlobal('cancelAnimationFrame', id => { if (id) queued[id - 1] = null; });
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
  vi.stubGlobal('window', { addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: k => { delete listeners[k]; } });
  vi.stubGlobal('document', { hidden: false, addEventListener: (k, f) => { docListeners[k] = f; }, removeEventListener: k => { delete docListeners[k]; } });
  vi.stubGlobal('performance', { now: () => 0 });
});
afterEach(() => { vi.unstubAllGlobals(); });

for (const r of [false, true]) {
  describe(r ? 'under Reduce Motion' : 'with motion', () => {
    it('draws one frame with no layer, then requests none', async () => {
      reduce = r;
      const s = await import('../stage-loop');
      const off = s.mountStage(canvas);
      expect(s.stageRunning()).toBe(true);
      run();
      expect(dusts).toHaveLength(1);
      expect(s.stageRunning()).toBe(false);
      expect(queued.filter(Boolean)).toHaveLength(0);
      off();
    });

    it('runs while a layer draws, and draws one last frame without it when it goes', async () => {
      reduce = r;
      const s = await import('../stage-loop');
      const off = s.mountStage(canvas);
      run();
      const drawn = [];
      const remove = s.addLayer(() => drawn.push(1));
      for (let i = 0; i < 5; i++) run(16 * (i + 2));
      expect(drawn).toHaveLength(5);
      expect(s.stageRunning()).toBe(true);
      remove();
      run(200); // the frame already requested: drawn without the layer, the loop stops
      expect(drawn).toHaveLength(5);
      expect(s.stageRunning()).toBe(false);
      run(216);
      expect(dusts).toHaveLength(7);
      off();
    });
  });
}

describe('waking the sleeping stage', () => {
  it('draws one frame on a resize, a new dust, the page shown again and the end of a swipe', async () => {
    const s = await import('../stage-loop');
    const off = s.mountStage(canvas);
    run();
    listeners.resize(); run();
    expect(dusts).toHaveLength(2);
    s.setDust(1); run();
    expect(dusts.at(-1)).toBe(1);
    s.setDust(1); // unchanged: nothing to draw
    expect(s.stageRunning()).toBe(false);
    docListeners.visibilitychange(); run();
    s.holdStage(true); s.holdStage(false); run();
    expect(dusts).toHaveLength(5);
    expect(s.stageRunning()).toBe(false);
    off();
    expect(listeners.resize).toBeUndefined();
    expect(docListeners.visibilitychange).toBeUndefined();
  });

  it('draws nothing while the page is hidden, and catches up when it shows', async () => {
    const s = await import('../stage-loop');
    const off = s.mountStage(canvas);
    document.hidden = true;
    run();
    expect(dusts).toHaveLength(0);
    expect(s.stageRunning()).toBe(false);
    document.hidden = false;
    docListeners.visibilitychange(); run();
    expect(dusts).toHaveLength(1);
    off();
  });
});
