import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { liftDefinition } from '../../lib/counting/core';
import { demoSet, demoResult, countAt, DEMO_LIFT } from './demo-set';
import { drawSkeleton, litSides } from './replay-draw';
import { Body, LITE } from './entry-scene';
import { fitFigure, figurePoints, litOnly, grainSize } from './demo-figure';
import { poseAt } from './replay-track';
import './Demo.css';
import { MEASURES_SHOWN, experimentalLabel } from './measures';

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
      <p className="eyebrow demo-eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
      <p className="demo-sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>
      <div className="demo-figure" data-reveal style={{ '--i': 2 }}><canvas ref={canvasRef} aria-hidden="true" /></div>
      {/* The count as the result screen sets it: the numeral, then its word under it. */}
      <div className="demo-count" data-count={shown}>
        <span key={shown} className="demo-numeral" aria-hidden="true">{shown}</span>
        <span className="res-label demo-word">{c.word(shown)}</span>
      </div>
      <p className="sr" role="status">{done ? c.done(result.count) : ''}</p>
      {/* Until the set ends, the result's place is held, hidden, so nothing moves when it lands. */}
      <div className={`demo-result${done ? ' appear' : ' is-held'}`} {...(done ? { 'data-testid': 'demo-result' } : { 'aria-hidden': true, inert: true })}>
        {/* Rep times are a measure not yet validated (measures.js): shown under the experimental label, as on the user's own set. */}
        {MEASURES_SHOWN && <p className="section-head demo-times-label">{c.times}</p>}
        {MEASURES_SHOWN && <p className="demo-times">{result.reps.map(r => <span key={r.index}>{`${secs.format(r.endTime - r.startTime)} s`}</span>)}</p>}
        {MEASURES_SHOWN && <p className="demo-exp" data-testid="demo-exp">{experimentalLabel(lang !== 'en')}</p>}
        <div className="actions demo-actions">
          <button type="button" className="btn-primary press" onClick={onStart}>{c.go}</button>
          {onReplay && <button type="button" className="btn-ghost press" onClick={onReplay}>{c.again}</button>}
        </div>
      </div>
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
    // The app's one body: the particle figure of the entry and the watch screen (design/SYSTEM.md, change 5).
    // Fewer grains than the entry's full-screen figure: the example's body is about half its height, and
    // additive grains packed into a smaller figure burn to white.
    const body = new Body(LITE ? 900 : 1300, 7), out = new Float32Array(66);
    let raf = 0, key = '';
    function draw(at) {
      const w = Math.max(1, Math.round(el.clientWidth * dpr)), h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      ctx.clearRect(0, 0, w, h);
      const lm = poseAt(set.image, set.timestamps, at);
      if (!lm) return;
      // The drawing fitted to the canvas, with room for the particle head (demo-figure.js).
      const box = fitFigure(set.vb, w, h);
      body.draw(ctx, figurePoints(lm, box, out), { alpha: 0.85, size: grainSize(box, dpr), time: reduced ? 1.5 : performance.now() / 1000, dpr, stars: 1 });
      // The measured joint drawn lit over the body, as the replay lights it.
      drawSkeleton(ctx, litOnly(lm, def.joint, sides[0]), box, sides, def, dpr);
    }
    // The canvas is redrawn at its new size whenever the layout changes it (the result appearing
    // under the figure shrinks it), at the moment last drawn.
    let shown = reduced ? still : 0;
    const observer = new ResizeObserver(() => draw(shown));
    observer.observe(el); draw(shown);
    if (reduced) return () => observer.disconnect();
    // The set's clock moves by the time between frames, each step capped: time away from the page
    // (the phone locked, another app) or a long stall does not play the set unseen (review, 29 September).
    let last = null;
    function frame(now) {
      const step = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      shown = Math.min(set.duration, shown + step);
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
    document.querySelector('.demo-screen .icon-btn')?.focus({ preventScroll: true, focusVisible: false });
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return <DemoView lang={lang} t={t} result={result} duration={set.duration} canvasRef={canvas}
    onClose={onClose} onStart={onStart} onReplay={reduced ? undefined : () => { setT(0); setRun(n => n + 1); }} />;
}
