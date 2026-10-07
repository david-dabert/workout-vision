// One full-screen stage under every screen after the entry, as in the
// prototype: drifting dust, plus whatever the current screen asks to draw
// (the live body during analysis, the ghost of the lift behind the result).
import { drawDust, DPR } from './entry-scene';
import { stillClock } from './still-clock';

const layers = new Set();
let dust = 0.5, canvas = null, ctx = null, raf = 0, reduced = false, held = false;
// The stage's time stands still while it is held, so the dust moves on from where it stood.
const clock = stillClock();
// And while the loop sleeps (no layer to draw, C9 below): the dust takes up again from its last frame.
const idle = stillClock();
const stageTime = now => idle.at(clock.at(now));

// Battery (C9, design review of 7 October 2026): the loop runs only while a screen draws on the stage (a layer:
// the body during analysis, Watch.jsx; the ghost behind the result, Result.jsx), with or without Reduce Motion. With
// no layer it draws one frame, the dust where it stands, and requests no more until a layer comes, the size or the
// dust changes, the page comes back into view or a swipe ends. Status: experimental (the saving is not yet measured
// on the iPhone; David measures frame time and battery there).
export function setDust(k) { if (k !== dust) { dust = k; kick(); } }
// While the lift cards are being swiped, the stage keeps its last frame: the scroll gets the frame
// budget. At the end of the swipe the dust moves on from that frame, with no jump.
export function holdStage(on) {
  if (on === held) return;
  held = on;
  const now = performance.now();
  if (on) clock.pause(now); else { clock.resume(now); kick(); }
}
export function addLayer(draw) {
  layers.add(draw); kick();
  return () => { layers.delete(draw); kick(); };
}
export function stageReduced() { return reduced; }
/** Whether the loop is requesting frames (for the tests). */
export function stageRunning() { return raf !== 0; }

function kick() { if (canvas && !raf) raf = requestAnimationFrame(frame); }

function frame(now) {
  raf = 0;
  if (!canvas) return;
  const running = layers.size > 0;
  if (running) { idle.resume(clock.at(now)); raf = requestAnimationFrame(frame); }
  if (document.hidden || held) return;
  const w = Math.max(1, Math.round(canvas.clientWidth * DPR)), h = Math.max(1, Math.round(canvas.clientHeight * DPR));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const t = reduced ? 1.5 : stageTime(now) / 1000;
  ctx.clearRect(0, 0, w, h);
  drawDust(ctx, w, h, t, dust);
  for (const draw of layers) draw(ctx, w, h, t, now);
  // The last frame before the loop sleeps: the stage's time stops with it.
  if (!running) idle.pause(clock.at(now));
}

export function mountStage(el) {
  canvas = el; ctx = el.getContext('2d');
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cancelAnimationFrame(raf); raf = 0; kick();
  const wake = () => kick();
  const shown = () => { if (!document.hidden) kick(); };
  window.addEventListener('resize', wake);
  document.addEventListener('visibilitychange', shown);
  return () => {
    cancelAnimationFrame(raf); raf = 0; canvas = null; ctx = null;
    window.removeEventListener('resize', wake);
    document.removeEventListener('visibilitychange', shown);
  };
}

// How present a screen's drawing should be, 0 to 1: it rises with the
// screen's fade-in and falls when the screen starts leaving, so what is
// drawn on the stage fades together with the screen above it.
export function presence(el, now, memo) {
  if (!el?.isConnected) return 0;
  if (!memo.born) memo.born = now;
  if (reduced) return el?.closest('.wv-leaving') ? 0 : 1;
  const rise = Math.min(1, Math.max(0, (now - memo.born - 50) / 800));
  if (el?.closest('.wv-leaving')) { if (!memo.left) memo.left = now; }
  else memo.left = 0;
  const fall = memo.left ? Math.max(0, 1 - (now - memo.left) / 450) : 1;
  return rise * fall;
}
