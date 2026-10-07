import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { createEntryScene } from './entry-scene';
import { eventsActive } from '../../lib/events';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
// The count's face (C1, design review of 7 October 2026): Geist 700, preloaded by index.html.
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/400.css';
import './Entry.css';

// The entry's words (C2 of the design review, 7 October 2026): what the app does first, then a way in, then the
// example. "Votre corps est un temple." moved to the head of À propos (about-copy.js). Register vous (R10). All
// pending David's approval: test/real-phone/swarm/copy-entry.md. U+202F is not needed (no ? ! ; or « »).
const COPY = {
  fr: {
    title: 'Filmez votre série.', line: 'L’appli compte vos répétitions, sur votre téléphone.',
    privacy: 'La vidéo reste sur votre téléphone.', start: 'Commencer',
    test: 'Version de test', demo: 'Voir un exemple', credit: 'Conçue à Bordeaux par David Dabert',
  },
  en: {
    title: 'Film your set.', line: 'The app counts your reps, on your phone.',
    privacy: 'The video stays on your phone.', start: 'Start',
    test: 'Test version', demo: 'See an example', credit: 'Made in Bordeaux by David Dabert',
  },
};
// Where the build sends anonymous usage counts (src/lib/events.js), the privacy line must stay true: it speaks of the
// video only, which never leaves the phone unless the user shares it. The switch stays, so the line with the counts
// on can differ again; today the one sentence is true in both states (design review, 7 October 2026).
const COUNTED = {
  fr: 'La vidéo reste sur votre téléphone.',
  en: 'The video stays on your phone.',
};

export function shouldShowEntry() {
  if (new URLSearchParams(location.search).has('entry')) return true;
  try { return localStorage.getItem('wv_seen_entry') !== 'true'; } catch { return true; }
}

export default function Entry({ onEnter }) {
  const { lang } = useT();
  const text = COPY[lang] || COPY.fr;
  const canvas = useRef(null), scene = useRef(null), fontTimer = useRef(null), leaveTimer = useRef(null), leaving = useRef(false);
  const view = useRef(null);
  const [phase, setPhase] = useState('');
  const [skipped, setSkipped] = useState(false);
  // The example's screen, loaded at the tap and shown only once its code is in.
  const [Demo, setDemo] = useState(null);
  const demoBtn = useRef(null), demoLoading = useRef(false);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    let cancelled = false;
    // The words wait for their faces at most 450 ms, so everything is in place and tappable within about 1.2 s
    // (C2, design review of 7 October 2026). The faces are bundled and preloaded (index.html), so this is rare.
    const fontTimeout = new Promise(resolve => { fontTimer.current = setTimeout(resolve, 450); });
    // The figure is fitted in the viewfinder, between the masthead and the words.
    const bounds = () => {
      if (!view.current) return null;
      const r = view.current.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    Promise.race([document.fonts.ready, fontTimeout]).then(() => {
      if (cancelled) return;
      clearTimeout(fontTimer.current);
      scene.current = createEntryScene(canvas.current, reduced.current, bounds);
      setPhase('play');
    });
    return () => { cancelled = true; clearTimeout(fontTimer.current); clearTimeout(leaveTimer.current); scene.current?.dispose(); };
  }, []);

  function openDemo() {
    // Once "Commencer" is tapped the entry is leaving: a late tap, or a late load, opens nothing (review, 29 September).
    if (demoLoading.current || leaving.current) return;
    demoLoading.current = true;
    import('./Demo').then(m => { if (!leaving.current) { scene.current?.pause(); setDemo(() => m.default); } }, err => {
      // As a screen whose code cannot load: the error screen and its Reload, never a dead tap.
      setDemo(() => () => { throw err; });
    }).finally(() => { demoLoading.current = false; });
  }
  function closeDemo() {
    setDemo(null);
    scene.current?.resume();
    requestAnimationFrame(() => demoBtn.current?.focus({ preventScroll: true }));
  }

  // "Commencer" leads to the choice of lift; the credit, to À propos (its address, read by the router once the app
  // mounts). Either way the entry has been seen.
  function enter(to) {
    if (leaving.current) return;
    leaving.current = true;
    // No switch input: on iOS Safari it takes drags that begin on it. The tick is navigator.vibrate where it exists.
    navigator.vibrate?.(10);
    scene.current?.resume(); // from the example's "À vous": the figure leaves as from the entry
    scene.current?.leave();
    setPhase('play leaving');
    try { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_seen_landing', 'true'); } catch { /* storage unavailable */ }
    const url = new URL(location.href);
    url.searchParams.delete('entry');
    if (to === 'about') url.hash = 'about';
    history.replaceState(history.state, '', url);
    leaveTimer.current = setTimeout(onEnter, reduced.current ? 10 : 820);
  }

  return <div className="entry-experience wv-experience">
    <canvas ref={canvas} className="entry-stage" aria-hidden="true" />
    <div className="vignette" aria-hidden="true" />
    <section className={`screen entry is-active ${phase} ${skipped ? 'skip' : ''}${Demo ? ' demo-open' : ''}`} aria-label="WorkoutVision" inert={Demo ? true : undefined}>
      {/* A tap anywhere shows the entry at once: for the eye only. VoiceOver and the keyboard read the words as they
          are, and the layer goes once used, so it no longer lies over the screen (second audit, 3 October). */}
      {!skipped && <button className="entry-skip" type="button" tabIndex={-1} aria-hidden="true" onClick={() => { scene.current?.skip(); setSkipped(true); }} />}
      {/* The status line: the serif wordmark over a 2 px rule, and the test status as words. */}
      <header className="entry-mast">
        <p className="brand">WorkoutVision</p>
        <p className="entry-test">{text.test}</p>
      </header>
      {/* The viewfinder: four corners, and in it the figure of light (entry-scene.js), drawn on the stage behind. */}
      <div className="entry-view" ref={view} aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="entry-copy">
        <h1 className="entry-l1"><span className="mask"><span>{text.title}</span></span></h1>
        <p className="entry-l2">{text.line}</p>
        <p className="entry-l3">
          <svg viewBox="0 0 16 20" width="16" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="1.5" y="8.5" width="13" height="10" rx="1.5" /><path d="M4.5 8.5V5.5a3.5 3.5 0 0 1 7 0v3" /></svg>
          <span>{eventsActive() ? COUNTED[lang === 'en' ? 'en' : 'fr'] : text.privacy}</span>
        </p>
        <div className="entry-keys">
          <button type="button" className="enter tactile" onClick={() => enter()}><span>{text.start}</span></button>
          <button type="button" className="entry-demo press" ref={demoBtn} onClick={openDemo}>{text.demo}</button>
        </div>
        <a className="entry-credit" href="#about" onClick={e => { e.preventDefault(); enter('about'); }}>{text.credit}{'\u00A0'}<span aria-hidden="true">›</span></a>
      </div>
    </section>
    {Demo && <Demo onClose={closeDemo} onStart={enter} />}
  </div>;
}
