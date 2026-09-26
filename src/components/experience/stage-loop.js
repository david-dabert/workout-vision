// One full-screen stage under every screen after the entry, as in the
// prototype: drifting dust, plus whatever the current screen asks to draw
// (the live body during analysis, the ghost of the lift behind the result).
import { drawDust, DPR } from './entry-scene';

const layers = new Set();
let dust = 0.5, canvas = null, ctx = null, raf = 0, reduced = false;

export function setDust(k) { dust = k; }
export function addLayer(draw) { layers.add(draw); return () => layers.delete(draw); }
export function stageReduced() { return reduced; }

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!canvas || document.hidden) return;
  const w = Math.max(1, Math.round(canvas.clientWidth * DPR)), h = Math.max(1, Math.round(canvas.clientHeight * DPR));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const t = reduced ? 1.5 : now / 1000;
  ctx.clearRect(0, 0, w, h);
  drawDust(ctx, w, h, t, dust);
  for (const draw of layers) draw(ctx, w, h, t, now);
}

export function mountStage(el) {
  canvas = el; ctx = el.getContext('2d');
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); raf = 0; canvas = null; ctx = null; };
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
