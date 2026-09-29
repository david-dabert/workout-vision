import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { liftDefinition } from '../../lib/counting/core';
import { demoSet, demoResult, countAt, DEMO_LIFT } from './demo-set';
import { drawSkeleton, litSides } from './replay-draw';
import { poseAt } from './replay-track';
import './Demo.css';

// The entry's example (feature B): a drawn squat that the counting core counts as it plays. It is
// labelled as an example throughout, so no one takes it for their own set. Words awaiting David's
// approval: test/real-phone/swarm/copy-B.md.
const COPY = {
  fr: {
    tag: 'Exemple', close: 'Fermer l’exemple', eyebrow: 'Squat dessiné',
    sub: 'Un squat dessiné pour l’exemple, compté par l’app comme votre série le sera.',
    word: n => (n > 1 ? 'Répétitions' : 'Répétition'),
    done: n => `Fin de série : ${n} ${n > 1 ? 'répétitions comptées' : 'répétition comptée'}.`,
    times: 'Durée de chaque répétition', go: 'À vous', again: 'Revoir l’exemple',
  },
  en: {
    tag: 'Example', close: 'Close the example', eyebrow: 'Drawn squat',
    sub: 'A squat drawn for the example, counted by the app as your set will be.',
    word: n => (n === 1 ? 'Rep' : 'Reps'),
    done: n => `End of set: ${n} ${n === 1 ? 'rep' : 'reps'} counted.`,
    times: 'Time of each rep', go: 'Your turn', again: 'Watch again',
  },
};

/** The screen at time t of the example; the figure is drawn by the caller into canvasRef. */
export function DemoView({ lang, t, result, duration, canvasRef, onClose, onStart, onReplay }) {
  const c = COPY[lang] || COPY.fr;
  const shown = countAt(result.reps, t), done = t >= duration;
  const secs = new Intl.NumberFormat(lang === 'en' ? 'en' : 'fr', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <div className="wv-experience demo-experience">
    <section className="screen is-active demo-screen" aria-label={c.tag}><div className="wrap demo-wrap">
      <div className="topbar">
        <button type="button" className="icon-btn press" onClick={onClose} aria-label={c.close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="pill demo-tag">{c.tag}</span>
      </div>
      <p className="eyebrow demo-eyebrow">{c.eyebrow}</p>
      <p className="demo-sub">{c.sub}</p>
      <div className="demo-figure"><canvas ref={canvasRef} aria-hidden="true" /></div>
      <div className="demo-count" data-count={shown}>
        <span key={shown} className="demo-numeral mono" aria-hidden="true">{shown}</span>
        <span className="demo-word">{c.word(shown)}</span>
      </div>
      <p className="sr" role="status">{done ? c.done(result.count) : ''}</p>
      {done && <div className="demo-result appear" data-testid="demo-result">
        <p className="demo-done">{c.done(result.count)}</p>
        <p className="eyebrow demo-times-label">{c.times}</p>
        <p className="demo-times mono">{result.reps.map(r => <span key={r.index}>{`${secs.format(r.endTime - r.startTime)} s`}</span>)}</p>
        <div className="actions demo-actions">
          <button type="button" className="btn-primary press" onClick={onStart}>{c.go}</button>
          {onReplay && <button type="button" className="btn-ghost press" onClick={onReplay}>{c.again}</button>}
        </div>
      </div>}
    </div></section>
  </div>;
}

export default function Demo({ onClose, onStart }) {
  const { lang } = useT();
  // Built and counted once per page (demo-set.js keeps them), so every render sees the same set.
  const set = demoSet(), result = demoResult();
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Under Reduce Motion the set is not played: the figure stays at the depth of the first rep, the
  // count is there at once, and there is nothing to watch again.
  const still = result.reps.length ? (result.reps[0].startTime + result.reps[0].endTime) / 2 : 0;
  const [t, setT] = useState(reduced ? set.duration : 0);
  const [run, setRun] = useState(0);
  const canvas = useRef(null);

  useEffect(() => {
    const el = canvas.current, ctx = el.getContext('2d'), def = liftDefinition(DEMO_LIFT), sides = litSides(def, result.arm);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const start = performance.now();
    let raf = 0, key = '';
    function draw(at) {
      const w = Math.max(1, Math.round(el.clientWidth * dpr)), h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      ctx.clearRect(0, 0, w, h);
      const lm = poseAt(set.image, set.timestamps, at);
      if (!lm) return;
      // The drawing's box, fitted to the canvas and centred.
      const [bw, bh] = set.vb, k = Math.min(w / bw, h / bh);
      const box = { ox: (w - bw * k) / 2, oy: (h - bh * k) / 2, w: bw * k, h: bh * k };
      // A head, which the replay's skeleton leaves out: a ring about the ears, so the drawing reads as a body.
      const hx = box.ox + (lm[7].x + lm[8].x) / 2 * box.w, hy = box.oy + (lm[7].y + lm[8].y) / 2 * box.h;
      const r = Math.hypot((lm[11].x - lm[7].x) * box.w, (lm[11].y - lm[7].y) * box.h) * 0.45;
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(239, 232, 220, 0.85)';
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.stroke();
      drawSkeleton(ctx, lm, box, sides, def, dpr);
    }
    // The canvas is redrawn at its new size whenever the layout changes it (the result appearing
    // under the figure shrinks it), at the moment last drawn.
    let shown = reduced ? still : 0;
    const observer = new ResizeObserver(() => draw(shown));
    observer.observe(el); draw(shown);
    if (reduced) return () => observer.disconnect();
    function frame(now) {
      shown = Math.min(set.duration, (now - start) / 1000);
      draw(shown);
      // React renders only when the counter or the end changes, not on every frame.
      const next = `${countAt(result.reps, shown)}/${shown >= set.duration}`;
      if (next !== key) { key = next; setT(shown); }
      if (shown < set.duration) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [run, reduced, set, result, still]);

  // Escape closes the example, as its close button does.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    document.querySelector('.demo-screen .icon-btn')?.focus({ preventScroll: true });
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return <DemoView lang={lang} t={t} result={result} duration={set.duration} canvasRef={canvas}
    onClose={onClose} onStart={onStart} onReplay={reduced ? undefined : () => { setT(0); setRun(n => n + 1); }} />;
}
