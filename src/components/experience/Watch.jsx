import { useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META } from './lift-scenes';
import { Body, mapPose, DPR } from './entry-scene';
import './Watch.css';

export default function Watch({ lift, progress, phase, landmarks, frameSize, onSkip }) {
  const { lang } = useT(), fr = lang === 'fr';
  const pct = Math.round(progress);
  const title = META[lift]?.[lang] || lift;
  const canvasRef = useRef(null);
  const bodyRef = useRef(null);
  const rafRef = useRef(null);
  const lmRef = useRef(null);
  const fsRef = useRef(null);

  lmRef.current = landmarks;
  fsRef.current = frameSize;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    bodyRef.current = new Body(1200, 42);
    const ctx = c.getContext('2d');
    const out = new Float32Array(66);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      c.width = c.clientWidth * DPR;
      c.height = c.clientHeight * DPR;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    resize();

    function drawFrame(now) {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      const lm = lmRef.current;
      const fs = fsRef.current;
      if (lm && lm.length >= 33) {
        const flat = new Float32Array(66);
        // Landmarks are normalised 0-1; scale by frame dimensions so
        // mapPose preserves the video's aspect ratio.
        const fw = fs ? fs[0] : 1, fh = fs ? fs[1] : 1;
        for (let i = 0; i < 33; i++) {
          flat[i * 2] = lm[i].x * fw;
          flat[i * 2 + 1] = lm[i].y * fh;
        }
        mapPose(flat, [fw, fh], { x: W * 0.1, y: H * 0.05, w: W * 0.8, h: H * 0.9 }, out);
        bodyRef.current.draw(ctx, out, {
          alpha: 0.7, time: now / 1000, dpr: DPR, size: 0.7, stars: 0.5,
        });
      }
    }

    let stopped = false;
    if (reduced) {
      // Under reduced motion, redraw on each new landmark without animation
      let lastLm = null;
      const check = () => {
        if (stopped) return;
        if (lmRef.current !== lastLm) {
          lastLm = lmRef.current;
          drawFrame(performance.now());
        }
        rafRef.current = requestAnimationFrame(check);
      };
      rafRef.current = requestAnimationFrame(check);
    } else {
      function loop(now) {
        if (stopped) return;
        drawFrame(now);
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); observer.disconnect(); };
  }, []);

  return <div className="wv-experience">
    <section className="screen is-active watch-screen" role="status" aria-live="polite">
      <div className="watch-top">
        <p className="eyebrow">{title}</p>
        <canvas ref={canvasRef} className="watch-body" aria-hidden="true" />
      </div>
      <div className="watch-bottom">
        <p className="pct" aria-label={`${pct}%`}>{pct}</p>
        <div className="watch-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <p className="privacy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <span>{fr ? 'Analysé sur votre téléphone. Rien n\u2019est envoyé.' : 'Analysed on your phone. Nothing is sent.'}</span>
        </p>
        <button className="text-btn press" type="button" onClick={onSkip}>{fr ? 'Annuler' : 'Cancel'}</button>
      </div>
    </section>
  </div>;
}
