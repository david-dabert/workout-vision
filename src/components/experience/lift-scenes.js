import poses from './lift-poses.json';
import { Body, mapPose, DPR, LITE } from './entry-scene';
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
function decodeFrame(s) {
  const o = new Float32Array(66);
  for (let i = 0; i < 33; i++) {
    const a = s.charAt(i * 4), b = s.charAt(i * 4 + 1);
    if (a === 'z' && b === 'z') { o[i * 2] = NaN; o[i * 2 + 1] = NaN; continue; }
    o[i * 2] = DIG.indexOf(a) * 36 + DIG.indexOf(b);
    o[i * 2 + 1] = DIG.indexOf(s.charAt(i * 4 + 2)) * 36 + DIG.indexOf(s.charAt(i * 4 + 3));
  }
  return o;
}
function lerpPose(frames, fi, out) {
  const n = frames.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(fi)));
  const j = Math.min(n - 1, i + 1);
  const u = fi - i, a = frames[i], b = frames[j];
  for (let k = 0; k < 66; k++) { const x = a[k], y = b[k]; out[k] = Number.isNaN(x) ? y : Number.isNaN(y) ? x : x + (y - x) * u; }
  return out;
}


export { LIFTS, META } from './lift-meta';
import { LIFTS } from './lift-meta';
import { stillClock } from './still-clock';
export function createLiftScene(canvas, lift, mode = 'loop', { paused = false } = {}) {
  const k = LIFTS.indexOf(lift), data = poses[lift];
  const ctx = canvas.getContext('2d'), body = new Body(mode === 'loop' ? (LITE ? 700 : 1000) : 1100, mode === 'loop' ? 100 + k : 21);
  const frames = data.loop.f.map(decodeFrame), buf = new Float32Array(66), out = new Float32Array(66);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A looping scene made paused (a card of the rail away from the centre) draws once and waits.
  let frame, disposed = false, drawn = false, running = !reduced && !(paused && mode === 'loop');
  // The scene's own clock stands still while the scene is paused, so a card that becomes the
  // centre moves on from the pose it kept, instead of jumping to where its loop would have been.
  const clock = stillClock(performance.now(), !running);
  function draw(now) {
    const W = canvas.width, H = canvas.height, t = reduced ? 1.5 : clock.at(now) / 1000;
    ctx.clearRect(0, 0, W, H);
    if (mode === 'loop') {
      const n = frames.length, fi = reduced ? n * 0.55 : (t * 15 + k * 9) % n;
      lerpPose(frames, fi, buf);
      mapPose(buf, data.loop.vb, { x: W * 0.1, y: H * 0.04, w: W * 0.8, h: H * 0.9 }, out);
      body.draw(ctx, out, { alpha: 0.95, time: t, dpr: DPR, size: 0.85, stars: 0.8 });
    } else {
      mapPose(new Float32Array(data.rest.p.map(v => v < 0 ? NaN : v)), data.rest.vb, { x: 0, y: 0, w: W, h: H }, out);
      body.draw(ctx, out, { alpha: 0.9, time: t, dpr: DPR, size: 0.8, stars: 0.8 });
    }
  }
  // Setting a canvas's size clears it, even to the same size: the first observation of the
  // ResizeObserver, which repeats the size already set, neither clears nor redraws the figure.
  function size() {
    const w = Math.max(1, Math.round(canvas.clientWidth * DPR)), h = Math.max(1, Math.round(canvas.clientHeight * DPR));
    if (drawn && canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h; drawn = true;
    draw(performance.now());
  }
  function loop(now) { if (disposed || !running) return; draw(now); frame = requestAnimationFrame(loop); }
  const observer = new ResizeObserver(size); observer.observe(canvas); size();
  if (running) frame = requestAnimationFrame(loop);
  const dispose = () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); };
  // A card off the centre stops drawing and keeps its last frame; it resumes from that frame.
  dispose.setRunning = on => {
    if (reduced || mode !== 'loop' || disposed || on === running) return;
    running = on;
    const now = performance.now();
    if (on) { clock.resume(now); frame = requestAnimationFrame(loop); } else { clock.pause(now); cancelAnimationFrame(frame); }
  };
  return dispose;
}
export const liftView = lift => poses[lift].view;
// The reference framing's size, for the phone outline on the filming screen.
export const restBox = lift => poses[lift].rest.vb;
// The reference pose at rest, as flat [x0, y0, x1, y1, ...] in its own box.
export function restPose(lift) {
  const r = poses[lift].rest;
  return { p: new Float32Array(r.p.map(v => (v < 0 ? NaN : v))), vb: r.vb };
}
// The reference pose at the top of the movement, when the data has one.
export function topPose(lift) {
  const d = poses[lift], src = d.top || d.rest;
  return { p: new Float32Array(src.p.map(v => (v < 0 ? NaN : v))), vb: src.vb };
}
