// Ported from design/experience-prototype.html: particle geometry, seeds and rendering unchanged.
import entry from './entry-pose.json';
const DPR = Math.min(2, window.devicePixelRatio || 1);
const LITE = (navigator.hardwareConcurrency || 8) <= 4;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k * k;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sprite(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,251,242,1)'); gr.addColorStop(0.16, `rgba(${r},${g},${b},0.95)`);
  gr.addColorStop(0.42, `rgba(${r},${g},${b},0.3)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
}
const SPR = [sprite(255, 238, 208), sprite(242, 198, 134), sprite(214, 150, 76)];
const PARTS = [
  { k: 'torso', w: 3.0 }, { k: 'head', w: 1.0 }, { k: 'neck', w: 0.22, r: 0.07 },
  { k: 'seg', a: 11, b: 13, r: 0.085, w: 0.72, arm: 'left' }, { k: 'seg', a: 12, b: 14, r: 0.085, w: 0.72, arm: 'right' },
  { k: 'seg', a: 13, b: 15, r: 0.064, w: 0.58, arm: 'left' }, { k: 'seg', a: 14, b: 16, r: 0.064, w: 0.58, arm: 'right' },
  { k: 'hand', a: 15, b1: 17, b2: 19, r: 0.05, w: 0.16, arm: 'left' }, { k: 'hand', a: 16, b1: 18, b2: 20, r: 0.05, w: 0.16, arm: 'right' },
  { k: 'seg', a: 23, b: 25, r: 0.125, w: 1.1 }, { k: 'seg', a: 24, b: 26, r: 0.125, w: 1.1 },
  { k: 'seg', a: 25, b: 27, r: 0.082, w: 0.82 }, { k: 'seg', a: 26, b: 28, r: 0.082, w: 0.82 },
  { k: 'seg', a: 29, b: 31, r: 0.04, w: 0.18 }, { k: 'seg', a: 30, b: 32, r: 0.04, w: 0.18 }
];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const ARM_JOINTS = { left: [11, 13, 15], right: [12, 14, 16] };

class Body {
  constructor(n, seed) {
    const r = rng(seed); const W = PARTS.reduce((a, p) => a + p.w, 0); this.p = []; this.o = { x: 0, y: 0 };
    PARTS.forEach((part, pi) => {
      const m = Math.round(n * part.w / W);
      for (let i = 0; i < m; i++) {
        const p = { pi, ph: r() * 6.283, fr: 0.6 + r() * 1.9, tint: r() < 0.5 ? 0 : (r() < 0.72 ? 1 : 2), halo: r() < 0.08, sz: 0.5 + Math.pow(r(), 2.2) * 1.6, d: r() };
        if (part.k === 'torso') {
          let u = r(); if (r() < 0.42) u = r() < 0.5 ? r() * 0.07 : 1 - r() * 0.07;
          p.u = u; p.v = r(); const s = Math.abs(2 * u - 1); p.b = 0.26 + 0.26 * (1 - s * s) + 0.72 * Math.pow(s, 9);
        } else if (part.k === 'head') {
          const rim = r() < 0.45; p.th = r() * 6.283; p.rho = rim ? 0.86 + r() * 0.14 : Math.sqrt(r()) * 0.88;
          p.b = 0.3 + 0.25 * (1 - p.rho) + (rim ? 0.55 : 0);
        } else {
          p.t = -0.1 + r() * 1.2; const s = r() < 0.7 ? Math.cos(r() * Math.PI) : 2 * r() - 1; p.s = s;
          p.b = 0.28 + 0.3 * (1 - s * s) + 0.66 * Math.pow(Math.abs(s), 10);
        }
        this.p.push(p);
      }
    });
  }
  geom(P) {
    const msx = (P[22] + P[24]) / 2, msy = (P[23] + P[25]) / 2, mhx = (P[46] + P[48]) / 2, mhy = (P[47] + P[49]) / 2;
    let sx = mhx - msx, sy = mhy - msy; const L = Math.hypot(sx, sy) || 1; sx /= L; sy /= L;
    const nx = -sy, ny = sx;
    const shw = Math.abs((P[24] - P[22]) * nx + (P[25] - P[23]) * ny) / 2;
    const hpw = Math.abs((P[48] - P[46]) * nx + (P[49] - P[47]) * ny) / 2;
    let hx = 0, hy = 0, hc = 0;
    for (let i = 0; i <= 10; i++) if (!Number.isNaN(P[i * 2])) { hx += P[i * 2]; hy += P[i * 2 + 1]; hc++; }
    if (hc) { hx /= hc; hy /= hc; } else { hx = msx - sx * 0.45 * L; hy = msy - sy * 0.45 * L; }
    hx -= sx * 0.05 * L; hy -= sy * 0.05 * L;
    return { msx, msy, mhx, mhy, sx, sy, nx, ny, L, wt: Math.max(shw, 0.2 * L), wb: Math.max(hpw, 0.17 * L), hx, hy, cx: (msx + mhx) / 2, cy: (msy + mhy) / 2 };
  }
  seg(ax, ay, bx, by, R, p) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    let s = p.s, t = p.t, x, y;
    if (t < 0) { const c = t / 0.1; s *= Math.sqrt(Math.max(0, 1 - c * c)); x = ax + ux * c * R * 0.9; y = ay + uy * c * R * 0.9; }
    else if (t > 1) { const c = (t - 1) / 0.1; s *= Math.sqrt(Math.max(0, 1 - c * c)); x = bx + ux * c * R * 0.9; y = by + uy * c * R * 0.9; }
    else { x = ax + dx * t; y = ay + dy * t; }
    this.o.x = x + nx * s * R; this.o.y = y + ny * s * R; return true;
  }
  place(p, P, G) {
    const part = PARTS[p.pi];
    if (part.k === 'torso') {
      const w = (G.wt + (G.wb - G.wt) * p.v) * (1 - 0.1 * Math.sin(Math.PI * p.v)); const o = (2 * p.u - 1) * w;
      this.o.x = G.msx + (G.mhx - G.msx) * p.v + G.nx * o; this.o.y = G.msy + (G.mhy - G.msy) * p.v + G.ny * o; return true;
    }
    if (part.k === 'head') {
      const a = Math.cos(p.th) * p.rho * 0.16 * G.L, c = Math.sin(p.th) * p.rho * 0.2 * G.L;
      this.o.x = G.hx + G.nx * a + G.sx * c; this.o.y = G.hy + G.ny * a + G.sy * c; return true;
    }
    if (part.k === 'neck') return this.seg(G.msx, G.msy, G.hx + G.sx * 0.14 * G.L, G.hy + G.sy * 0.14 * G.L, part.r * G.L, p);
    if (part.k === 'hand') {
      const a = part.a * 2, b1 = part.b1 * 2, b2 = part.b2 * 2;
      if (Number.isNaN(P[a]) || Number.isNaN(P[b1]) || Number.isNaN(P[b2])) return false;
      const bx = (P[b1] + P[b2]) / 2, by = (P[b1 + 1] + P[b2 + 1]) / 2;
      return this.seg(P[a], P[a + 1], P[a] + (bx - P[a]) * 1.25, P[a + 1] + (by - P[a + 1]) * 1.25, part.r * G.L, p);
    }
    const a = part.a * 2, b = part.b * 2;
    if (Number.isNaN(P[a]) || Number.isNaN(P[b])) return false;
    return this.seg(P[a], P[a + 1], P[b], P[b + 1], part.r * G.L, p);
  }
  draw(ctx, P, o) {
    if (Number.isNaN(P[22]) || Number.isNaN(P[24]) || Number.isNaN(P[46]) || Number.isNaN(P[48])) return;
    const G = this.geom(P), t = o.time, dpr = o.dpr, k0 = o.size || 1, br = 1 + (o.breathe || 0);
    const as = o.assemble, ex = o.explode;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.p) {
      if (!this.place(p, P, G)) continue;
      let x = this.o.x, y = this.o.y;
      if (br !== 1) { x = G.cx + (x - G.cx) * br; y = G.cy + (y - G.cy) * br; }
      x += Math.sin(t * 0.7 + p.ph) * 0.4 * dpr; y += Math.cos(t * 0.6 + p.ph * 1.3) * 0.4 * dpr;
      let a = p.b * o.alpha * (0.72 + 0.28 * Math.sin(t * p.fr + p.ph));
      if (o.arm && PARTS[p.pi].arm === o.arm) a *= 1.75;
      if (as) {
        const yn = clamp((y - as.top) / (as.bot - as.top));
        const k = clamp((as.t - (0.3 + yn * 0.75 + p.d * 0.45)) / 1.25);
        if (k <= 0) continue;
        const e = easeOut(k), sx = as.x, sy = as.top + (as.bot - as.top) * p.d;
        x = sx + (x - sx) * e; y = sy + (y - sy) * e; a *= Math.min(1, k * 1.8) * (1 + (1 - e) * 1.4);
      }
      if (ex) {
        const dx = x - G.cx, dy = y - G.cy, dd = Math.hypot(dx, dy) || 1, push = Math.pow(ex.t, 1.5) * (170 + p.d * 460) * dpr;
        x += dx / dd * push; y += dy / dd * push - ex.t * 70 * dpr; a *= Math.max(0, 1 - ex.t / 0.85);
      }
      if (a < 0.004) continue;
      const size = (p.halo ? 8 + p.sz * 8 : 1.5 + p.sz * 1.9) * dpr * k0;
      ctx.globalAlpha = Math.min(1, p.halo ? a * 0.09 : a);
      ctx.drawImage(SPR[p.tint], x - size, y - size, size * 2, size * 2);
    }
    if (o.stars && !ex) {
      for (const j of JOINTS) {
        if (Number.isNaN(P[j * 2])) continue;
        let x = P[j * 2], y = P[j * 2 + 1];
        if (br !== 1) { x = G.cx + (x - G.cx) * br; y = G.cy + (y - G.cy) * br; }
        const hot = o.arm && ARM_JOINTS[o.arm].includes(j);
        let a = o.alpha * o.stars * (hot ? 1 : 0.7) * (0.8 + 0.2 * Math.sin(t * 2 + j));
        if (as) { const yn = clamp((y - as.top) / (as.bot - as.top)); a *= clamp((as.t - 1.2 - yn * 0.6) / 0.6); }
        if (a <= 0) continue;
        const size = (hot ? 5.5 : 3.6) * dpr * k0;
        ctx.globalAlpha = Math.min(1, a); ctx.drawImage(SPR[0], x - size, y - size, size * 2, size * 2);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}
function mapPose(src, box, rect, out, shiftX) {
  const s = Math.min(rect.w / box[0], rect.h / box[1]);
  const ox = rect.x + (rect.w - box[0] * s) / 2, oy = rect.y + (rect.h - box[1] * s) / 2, sh = shiftX || 0;
  for (let i = 0; i < 33; i++) { const x = src[i * 2], y = src[i * 2 + 1]; out[i * 2] = Number.isNaN(x) ? NaN : ox + (x + sh) * s; out[i * 2 + 1] = Number.isNaN(y) ? NaN : oy + y * s; }
  return s;
}
const DUST = (() => { const r = rng(11); return Array.from({ length: 48 }, () => ({ x: r(), y: r(), v: 0.004 + r() * 0.012, s: 0.6 + r() * 1.8, a: 0.04 + r() * 0.14, ph: r() * 6.28 })); })();
function drawDust(ctx, W, H, t, k) {
  ctx.globalCompositeOperation = 'lighter';
  for (const m of DUST) {
    const y = (((m.y - t * m.v) % 1) + 1) % 1, x = m.x + Math.sin(t * 0.3 + m.ph) * 0.012, sz = m.s * DPR * 2.2;
    ctx.globalAlpha = m.a * k * (0.6 + 0.4 * Math.sin(t * 0.8 + m.ph));
    ctx.drawImage(SPR[1], x * W - sz, y * H - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}


export function createEntryScene(canvas, reduced) {
  const ctx = canvas.getContext('2d');
  const big = new Body(LITE ? 1700 : 2600, 7);
  const pose = new Float32Array(entry.p), P2 = new Float32Array(66);
  const stage = { entryStart: performance.now(), explodeAt: 0 };
  let frame = 0, disposed = false;
  function draw(now) {
    if (disposed) return;
    const W = canvas.width, H = canvas.height, t = reduced ? 1.5 : now / 1000;
    ctx.clearRect(0, 0, W, H);
    drawDust(ctx, W, H, t, 1);
    const e = reduced ? 9 : (now - stage.entryStart) / 1000;
    const rect = { x: W * 0.1, y: H * 0.085, w: W * 0.8, h: H * 0.49 };
    drawDoor(ctx, W, H, e, rect, now);
    mapPose(pose, entry.vb, rect, P2);
    big.draw(ctx, P2, {
      alpha: 1, time: t, dpr: DPR, stars: 1, breathe: reduced ? 0 : Math.sin(t * 1.1) * 0.012,
      assemble: reduced ? null : { t: e, x: W / 2, top: rect.y - H * 0.02, bot: rect.y + rect.h + H * 0.02 },
      explode: !reduced && stage.explodeAt ? { t: (now - stage.explodeAt) / 1000 } : null
    });
  }
  function size() {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * DPR));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * DPR));
    draw(performance.now());
  }
  function loop(now) { draw(now); if (!disposed) frame = requestAnimationFrame(loop); }
  const observer = new ResizeObserver(size);
  observer.observe(canvas); size();
  if (!reduced) frame = requestAnimationFrame(loop);
  return {
    skip() { stage.entryStart = performance.now() - 6000; draw(performance.now()); },
    leave() { if (!reduced) stage.explodeAt = performance.now(); },
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); }
  };
function drawDoor(ctx, W, H, e, rect, now) {
  const cx = W / 2, top = rect.y - H * 0.045, bot = rect.y + rect.h + H * 0.045;
  const hh = (bot - top) * easeOut(clamp(e / 1.1)), y0 = (top + bot) / 2 - hh / 2;
  let inten = e < 1.7 ? 1 : Math.max(0.32, 1 - (e - 1.7) * 0.45), lw = 1.4 * DPR;
  if (stage.explodeAt) {
    const x = (now - stage.explodeAt) / 1000;
    lw = 1.4 * DPR + easeIn(clamp(x / 0.7)) * W * 1.2;
    inten = x < 0.35 ? 1 : Math.max(0, 1 - (x - 0.35) / 0.55);
  }
  if (hh < 1) return;
  ctx.globalCompositeOperation = 'lighter';
  if (lw > 8 * DPR) {
    ctx.globalAlpha = Math.min(1, inten * 1.1);
    ctx.drawImage(SPR[0], cx - lw / 2, y0 - hh * 0.15, lw, hh * 1.3);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return;
  }
  const gw = 110 * DPR + lw;
  const g1 = ctx.createLinearGradient(cx - gw, 0, cx + gw, 0);
  g1.addColorStop(0, 'rgba(232,189,126,0)'); g1.addColorStop(0.5, `rgba(232,189,126,${0.09 * inten})`); g1.addColorStop(1, 'rgba(232,189,126,0)');
  ctx.fillStyle = g1; ctx.fillRect(cx - gw, y0, gw * 2, hh);
  const g2 = ctx.createLinearGradient(0, y0, 0, y0 + hh);
  g2.addColorStop(0, 'rgba(255,240,215,0)'); g2.addColorStop(0.5, `rgba(255,240,215,${0.9 * inten})`); g2.addColorStop(1, 'rgba(255,240,215,0)');
  ctx.fillStyle = g2; ctx.fillRect(cx - lw / 2, y0, lw, hh);
  ctx.globalCompositeOperation = 'source-over';
}
}
