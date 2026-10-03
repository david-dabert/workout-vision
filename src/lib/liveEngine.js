// Live counting (Film screen, "En direct"): the camera, the sampling and the pose model, without any screen.
//
// The camera's picture is sampled 15 times a second (TARGET_FPS, the rate the core is built for), each sample
// scaled to at most 640 px on its long side (MAX_LONG_SIDE) and read into pixels exactly as the recorded path reads a
// decoded frame (coreAnalysis.js), then sent to the same pose worker (corePoseWorker.js), in order, one at a time.
// The landmarks go to the live counter (liveCounter.js), which counts with summarizeCount. Nothing is recorded: each
// sample's pixels are dropped once the pose model has read them, and only the landmarks are kept, on the phone.
import { TARGET_FPS, MAX_LONG_SIDE } from './extractionConfig';
import { createLiveCounter, LIVE_EVAL_MS } from './liveCounter';

/** One sample every 66.7 ms: the core's 15 Hz. Status: validated (the rate every real-phone clip was counted at). */
export const SAMPLE_MS = 1000 / TARGET_FPS;

/**
 * Samples waiting for the pose model before the phone is judged too slow to count live: two seconds of them. Past
 * that the set stops and the person is asked to record instead: dropping samples would count a set the core was
 * never built for, and the queue would only grow. About 0.9 MB each at 360 x 640. Status: convention (UNSOURCED).
 */
export const MAX_BACKLOG = 2 * TARGET_FPS;

/**
 * Before the set, the pose model's time per sample, averaged over the preview: above one sample's interval it
 * cannot keep up, and the screen says so before the set starts. Status: convention, from SAMPLE_MS.
 */
export const SLOW_MS = SAMPLE_MS;

/** How long one answer of the pose worker may take before the run is given up, in ms. Status: convention. */
const WORKER_TIMEOUT_MS = 20000;

/**
 * The size a camera picture is read at, as frameExtractor.js scales a decoded frame: at most MAX_LONG_SIDE on its long
 * side, rounded down to even numbers when scaled, never enlarged.
 */
export function sampleSize(width, height, max = MAX_LONG_SIDE) {
  const long = Math.max(width, height);
  if (!(long > max)) return [width, height];
  const scale = max / long;
  const w = Math.round(width * scale), h = Math.round(height * scale);
  return [w - (w % 2), h - (h % 2)];
}

// The pose worker of the recorded path, asked one sample at a time.
function poseClient(makeWorker) {
  const worker = makeWorker();
  let id = 0;
  const pending = new Map();
  const failAll = error => { for (const r of pending.values()) { clearTimeout(r.timer); r.reject(error); } pending.clear(); };
  worker.onmessage = ({ data }) => {
    const r = pending.get(data.id);
    if (!r) return;
    clearTimeout(r.timer);
    pending.delete(data.id);
    if (data.error) r.reject(new Error(data.error)); else r.resolve(data);
  };
  worker.onerror = event => failAll(new Error(event?.message || 'Pose worker failed'));
  const send = (message, transfer = []) => new Promise((resolve, reject) => {
    const requestId = id++;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Pose worker timed out')); }, WORKER_TIMEOUT_MS);
    pending.set(requestId, { resolve, reject, timer });
    worker.postMessage({ ...message, id: requestId }, transfer);
  });
  return {
    init: () => send({ type: 'init' }),
    detect: (pixels, width, height, timestamp) => send({ pixels, width, height, timestamp }, [pixels]),
    close: () => { worker.terminate(); failAll(new DOMException('Closed', 'AbortError')); },
  };
}

/**
 * The live engine for one lift, reading the camera picture shown in `video`.
 * Callbacks: onPose(imageLandmarks|null, width, height) for each sample read; onPreview({ body, ms }) before the set;
 * onCount(evaluate()) about twice a second during the set; onRep(n) when a new count is announced; onSlow() when
 * the phone cannot keep up; onFull() at the longest set; onError(error).
 */
export function createLiveEngine({
  lift, video,
  onPose = () => {}, onPreview = () => {}, onCount = () => {}, onRep = () => {}, onSlow = () => {}, onFull = () => {}, onError = () => {},
  makeWorker = () => new Worker(new URL('./corePoseWorker.js', import.meta.url)),
  now = () => performance.now(),
  raf = cb => requestAnimationFrame(cb), cancelRaf = h => cancelAnimationFrame(h),
}) {
  let pose = null, ready = null, closed = false;
  let mode = 'idle'; // idle | preview | set | paused | draining | stopped
  let counter = null, t0 = 0, next = 0, index = 0, previewAt = -Infinity, previewMs = null;
  let rafId = 0, evalTimer = 0, evalMs = 0, busy = false;
  const queue = [];
  let canvas = null, ctx = null, drained = null;

  function grab() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2) return null;
    const [w, h] = sampleSize(vw, vh);
    // A canvas of the page, as the recorded path reads its frames (frameExtractor.js): drawing a <video> into one
    // works in every browser that opens the camera.
    if (!canvas) {
      canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(video, 0, 0, w, h);
    return { pixels: ctx.getImageData(0, 0, w, h).data.buffer, width: w, height: h };
  }

  async function pump() {
    if (busy || closed) return;
    const sample = queue.shift();
    if (!sample) { if (drained && mode === 'draining') { const d = drained; drained = null; d(); } return; }
    busy = true;
    try {
      const out = await pose.detect(sample.pixels, sample.width, sample.height, sample.timestamp);
      if (closed) return;
      if (sample.kind === 'set' && counter) {
        counter.push({ image: out.image, world: out.world, t: sample.t, width: sample.width, height: sample.height });
        if (counter.full && mode === 'set') { mode = 'draining'; onFull(); }
      } else if (sample.kind === 'preview') {
        const ms = now() - sample.at;
        previewMs = previewMs === null ? ms : previewMs * 0.8 + ms * 0.2;
        onPreview({ body: !!out.world, ms: previewMs });
      }
      onPose(out.image, sample.width, sample.height);
    } catch (e) {
      if (!closed) { mode = 'stopped'; onError(e); }
      if (drained) { const d = drained; drained = null; d(); }
      return;
    } finally { busy = false; }
    pump();
  }

  function tick() {
    if (closed) return;
    rafId = raf(tick);
    const at = now();
    if (mode === 'preview') {
      // Before the set, a sample now and then, only while the model is free: it shows the person whether they are
      // in the picture, and warms the model. These samples are never counted.
      if (!busy && !queue.length && at - previewAt >= SAMPLE_MS) {
        const s = grab();
        if (s) { previewAt = at; queue.push({ ...s, kind: 'preview', at, timestamp: 1 }); pump(); }
      }
      return;
    }
    if (mode !== 'set' || at < next) return;
    const s = grab();
    if (!s) return;
    // The sample's own time, from the start of the set: when the page could not keep up for more than one interval,
    // the gap stays in the times, as a decoder's missing frames would, and the clock starts again from now.
    const t = (at - t0) / 1000;
    next = at - next > SAMPLE_MS ? at + SAMPLE_MS : next + SAMPLE_MS;
    // The worker resets its image smoothing on timestamp 0, the set's first sample, as for a video's first.
    queue.push({ ...s, kind: 'set', t, timestamp: index * 1000 / TARGET_FPS });
    index += 1;
    if (queue.length > MAX_BACKLOG) { mode = 'stopped'; queue.length = 0; onSlow(); return; }
    pump();
  }

  function evaluate() {
    if (mode !== 'set' || !counter) return;
    const start = now();
    const e = counter.evaluate();
    evalMs = now() - start;
    onCount(e);
    if (e.announce !== null) onRep(e.announce);
    // A count that takes long spaces the next one out, so it never holds up the sampling.
    evalTimer = setTimeout(evaluate, Math.max(LIVE_EVAL_MS, evalMs * 10));
  }

  return {
    get mode() { return mode; },
    get samples() { return counter?.length ?? 0; },
    get previewMs() { return previewMs; },
    /**
     * Loads the pose model in its worker; resolves with true once it can read a sample, and rejects when the model
     * fails. Resolves with false when the engine was disposed before the model was in: our own close aborts the
     * loading (poseClient, close), which is expected and no failure, so it is never logged nor shown (a camera
     * refused, then the screen left while the model loads: CI of 3 October, e2e/live.spec.js).
     */
    load() {
      if (!ready) {
        pose = poseClient(makeWorker);
        ready = pose.init().then(() => !closed, error => { if (closed) return false; throw error; });
      }
      return ready;
    },
    /** True once dispose() was called. */
    get disposed() { return closed; },
    /** The camera picture is in `video`: samples are read now and then to show whether the person is in view. */
    preview() {
      if (closed) return;
      mode = 'preview';
      if (!rafId) rafId = raf(tick);
    },
    /** The set starts now: every sample from here is counted. */
    startSet() {
      if (closed) return;
      counter = createLiveCounter(lift);
      queue.length = 0;
      t0 = now(); next = t0; index = 0;
      mode = 'set';
      if (!rafId) rafId = raf(tick);
      clearTimeout(evalTimer);
      evalTimer = setTimeout(evaluate, LIVE_EVAL_MS);
    },
    /** The page was hidden: no sample is taken until the set is resumed or stopped. */
    pause() {
      if (mode === 'set') mode = 'paused';
      clearTimeout(evalTimer);
    },
    /**
     * The set ends: the samples already taken are read, then the whole set is counted as the recorded path counts
     * a video. Resolves with the result, or null when no sample was taken; rejects with FrozenSkeletonsError
     * when the camera's picture stood still (liveCounter.js, finish).
     */
    async stopSet() {
      clearTimeout(evalTimer);
      if (!counter) return null;
      mode = 'draining';
      if (busy || queue.length) await new Promise(resolve => { drained = resolve; pump(); });
      mode = 'stopped';
      return counter.length ? counter.finish() : null;
    },
    /** Everything stops: the loop, the timers and the worker. The camera is the caller's to close. */
    dispose() {
      closed = true; mode = 'stopped';
      cancelRaf(rafId); rafId = 0;
      clearTimeout(evalTimer);
      queue.length = 0;
      if (drained) { const d = drained; drained = null; d(); }
      pose?.close();
    },
  };
}
