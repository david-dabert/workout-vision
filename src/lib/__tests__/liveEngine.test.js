// The live engine's model loading (liveEngine.js, load): our own close while the model loads is no failure (a camera
// refused, then the live screen left: CI of 3 October), while a model that really fails is still a rejection the
// screen logs and shows.
import { describe, it, expect } from 'vitest';
import { createLiveEngine } from '../liveEngine';

// A pose worker that answers 'init' only when told to, with or without an error.
function fakeWorker() {
  const w = { posted: [], terminated: false, onmessage: null, onerror: null };
  w.postMessage = m => w.posted.push(m);
  w.terminate = () => { w.terminated = true; };
  w.answer = (error = null) => { const m = w.posted.find(p => p.type === 'init'); w.onmessage({ data: error ? { id: m.id, error } : { id: m.id } }); };
  return w;
}
const engineWith = worker => createLiveEngine({ lift: 'bicep_curl', video: {}, makeWorker: () => worker, raf: () => 0, cancelRaf: () => {} });

describe('live engine: loading the pose model', () => {
  it('resolves true once the model is in', async () => {
    const w = fakeWorker(), e = engineWith(w);
    const p = e.load();
    w.answer();
    await expect(p).resolves.toBe(true);
    e.dispose();
  });

  it('disposed while the model loads: resolves false, never rejects (our own close is no failure)', async () => {
    const w = fakeWorker(), e = engineWith(w);
    const p = e.load();
    e.dispose();
    expect(w.terminated).toBe(true);
    expect(e.disposed).toBe(true);
    await expect(p).resolves.toBe(false);
  });

  it('a model that fails still rejects, with its own error', async () => {
    const w = fakeWorker(), e = engineWith(w);
    const p = e.load();
    w.answer('no model');
    await expect(p).rejects.toThrow('no model');
    e.dispose();
  });

  it('a worker that crashes still rejects, even if the screen is left afterwards', async () => {
    const w = fakeWorker(), e = engineWith(w);
    const p = e.load();
    w.onerror({ message: 'worker crashed' });
    await expect(p).rejects.toThrow('worker crashed');
    e.dispose();
  });
});
