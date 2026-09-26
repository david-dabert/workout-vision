import { useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, restPose } from './lift-scenes';
import { Body, mapPose, SPR, DPR, LITE } from './entry-scene';
import { addLayer, setDust, stageReduced, presence } from './stage-loop';
import './Watch.css';

const SEEN = 0.5;      // a joint counts for the body box when the model sees it at least this well
const DRAWN = 0.3;     // below this a joint is not drawn at all
const TORSO = [11, 12, 23, 24];

// Grows a box around the visible joints of one sample, in frame pixels.
function jointBox(lm, fw, fh) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 33; i++) {
    const p = lm[i];
    if (!p || p.visibility < SEEN) continue;
    const x = p.x * fw, y = p.y * fh;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return null;
  const px = (x1 - x0) * 0.1 + 8, py = (y1 - y0) * 0.1 + 8;
  return { x0: x0 - px, y0: y0 - py, x1: x1 + px, y1: y1 + py };
}

function drawTrail(ctx, tr, alpha) {
  ctx.globalCompositeOperation = 'lighter';
  const n = tr.length / 2;
  for (let i = 0; i < n; i++) {
    const k = i / n, sz = (1 + k * 6) * DPR;
    ctx.globalAlpha = k * k * 0.55 * alpha;
    ctx.drawImage(SPR[0], tr[i * 2] - sz, tr[i * 2 + 1] - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

export default function Watch({ lift, progress, phase, landmarks, frameSize, onSkip }) {
  const { lang } = useT(), fr = lang === 'fr';
  const title = META[lift]?.[lang] || lift;
  // Loading until the first body arrives; a later frame without a person does not count as loading.
  const seenBody = useRef(false);
  if (landmarks) seenBody.current = true;
  const loading = phase !== 'extracting' || !seenBody.current;
  const live = useRef({});
  live.current = { lm: landmarks, fs: frameSize, progress };
  const topRef = useRef(null), bottomRef = useRef(null), pctRef = useRef(null), barRef = useRef(null);

  useEffect(() => {
    setDust(1);
    const reduced = stageReduced();
    const body = new Body(LITE ? 1700 : 2600, 7);
    const ghost = restPose(lift);
    const cur = new Float32Array(66).fill(NaN), prev = new Float32Array(66).fill(NaN), disp = new Float32Array(66);
    const flat = new Float32Array(66), out = new Float32Array(66);
    const box = { x0: 0, y0: 0, x1: 1, y1: 1 }, target = { x0: 0, y0: 0, x1: 1, y1: 1 };
    const seen = { left: 0, right: 0 }, trail = [];
    let lastLm = null, have = false, tArr = 0, gap = 66, firstAt = 0, lastPose = 0;
    let shown = 0, shownInt = -1, area = null;
    const memo = {};

    const measure = () => {
      const a = topRef.current?.getBoundingClientRect(), b = bottomRef.current?.getBoundingClientRect();
      if (a && b) area = { top: a.bottom + 20, bottom: b.top - 16 };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current.closest('.watch-screen'));

    const writePct = (n) => {
      const el = pctRef.current; if (!el) return;
      const digits = String(n).split('').map(d => `<span class="d">${d}</span>`).join('');
      el.innerHTML = `${digits}<span class="u">${fr ? ' %' : '%'}</span>`;
    };

    const off = addLayer((ctx, W, H, t, now) => {
      const L = live.current;
      // Progress: eased, so the bar and the number glide instead of jumping.
      const p = Math.max(0, Math.min(100, L.progress || 0));
      shown = reduced ? p : shown + (p - shown) * 0.18;
      if (Math.abs(p - shown) < 0.05) shown = p;
      const n = Math.round(shown);
      if (n !== shownInt) { shownInt = n; writePct(n); }
      if (barRef.current) barRef.current.style.width = `${shown.toFixed(2)}%`;

      // A new sample becomes the target; the figure moves to it over one sample interval.
      if (L.lm !== lastLm) {
        lastLm = L.lm;
        if (L.lm && L.lm.length >= 33) {
          const fw = L.fs?.[0] || 1, fh = L.fs?.[1] || 1;
          prev.set(have ? disp : cur);
          for (let i = 0; i < 33; i++) {
            const q = L.lm[i], keep = TORSO.includes(i) || q.visibility >= DRAWN;
            cur[i * 2] = keep ? q.x * fw : NaN; cur[i * 2 + 1] = keep ? q.y * fh : NaN;
          }
          if (!have) prev.set(cur);
          const b = jointBox(L.lm, fw, fh);
          if (b) { Object.assign(target, b); if (!have) Object.assign(box, b); }
          seen.left = seen.left * 0.9 + 0.1 * (L.lm[13].visibility + L.lm[15].visibility);
          seen.right = seen.right * 0.9 + 0.1 * (L.lm[14].visibility + L.lm[16].visibility);
          if (have) gap = gap * 0.8 + Math.min(400, Math.max(20, now - tArr)) * 0.2;
          tArr = now; lastPose = now; if (!firstAt) firstAt = now; have = true;
        }
      }

      const here = presence(topRef.current, now, memo);
      if (here <= 0) return;
      const top = area && area.bottom - area.top > 120 ? area.top * DPR : H * 0.11;
      const hgt = area && area.bottom - area.top > 120 ? (area.bottom - area.top) * DPR : H * 0.6;
      const rect = { x: W * 0.06, y: top, w: W * 0.88, h: hgt };

      // Before the first sample: the reference pose, faint and breathing, so the screen is never still.
      const born = have ? Math.min(1, (now - firstAt) / 600) : 0;
      if (born < 1) {
        mapPose(ghost.p, ghost.vb, rect, out);
        body.draw(ctx, out, { alpha: 0.25 * (1 - born) * here, time: t, dpr: DPR, size: 0.9, breathe: reduced ? 0 : Math.sin(t * 1.1) * 0.012 });
      }
      if (!have) return;

      const u = reduced ? 1 : Math.min(1, (now - tArr) / gap);
      for (let k = 0; k < 66; k++) {
        const a = prev[k], b = cur[k];
        disp[k] = Number.isNaN(a) ? b : Number.isNaN(b) ? a : a + (b - a) * u;
      }
      for (const key of ['x0', 'y0', 'x1', 'y1']) box[key] += (target[key] - box[key]) * (reduced ? 1 : 0.1);
      for (let i = 0; i < 33; i++) { flat[i * 2] = disp[i * 2] - box.x0; flat[i * 2 + 1] = disp[i * 2 + 1] - box.y0; }
      mapPose(flat, [Math.max(1, box.x1 - box.x0), Math.max(1, box.y1 - box.y0)], rect, out);

      // Held through missed samples; fades only after 0.4 s without a body.
      const alpha = here * born * (1 - Math.min(1, Math.max(0, now - lastPose - 400) / 300));
      const arm = seen.left > seen.right ? 'left' : 'right';
      if (!reduced) {
        const wi = arm === 'left' ? 30 : 32;
        if (!Number.isNaN(out[wi])) {
          // The trail follows the wrist while it moves and shrinks away when it stops.
          const n = trail.length, moved = !n || Math.hypot(out[wi] - trail[n - 2], out[wi + 1] - trail[n - 1]) > 0.8 * DPR;
          if (moved) { trail.push(out[wi], out[wi + 1]); if (trail.length > 70) trail.splice(0, 2); } else trail.splice(0, 2);
        }
        drawTrail(ctx, trail, alpha);
      }
      body.draw(ctx, out, { alpha, time: t, dpr: DPR, arm, stars: 1 });
    });
    return () => { off(); ro.disconnect(); setDust(0.5); };
  }, [lift, fr]);

  const pct = Math.round(progress);
  return <div className="wv-experience">
    <section className="screen is-active watch-screen">
      <div className="watch-top" ref={topRef}>
        <p className="eyebrow">{title} · {loading ? (fr ? 'Chargement' : 'Loading') : (fr ? 'Analyse' : 'Analysis')}</p>
      </div>
      <div className="watch-space" />
      <div className="watch-bottom" ref={bottomRef}>
        <p className={`pct${loading ? ' is-loading' : ''}`} ref={pctRef} aria-hidden="true" />
        <div className={`watch-progress${loading ? ' is-loading' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={fr ? 'Analyse' : 'Analysis'}><i ref={barRef} /></div>
        <p className="privacy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <span>{fr ? 'Analysé sur votre téléphone. Rien n’est envoyé.' : 'Analysed on your phone. Nothing is sent.'}</span>
        </p>
        <button className="text-btn press" type="button" onClick={onSkip}>{fr ? 'Annuler' : 'Cancel'}</button>
      </div>
    </section>
  </div>;
}
