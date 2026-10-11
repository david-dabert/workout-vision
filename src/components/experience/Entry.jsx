import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { createEntryScene } from './entry-scene';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist-mono/400.css';
import './Entry.css';

// The approved prototype's three lines, unchanged in both languages. The last, the way to the
// example (Demo.jsx), awaits David's approval (test/real-phone/swarm/copy-B.md).
const COPY = {
  fr: ['Votre corps est\u00A0un\u00A0temple.', 'Il est ici observé avec soin.', 'Rien ne quitte votre téléphone.', 'Entrer', 'Afficher l’entrée sans attendre', 'Version de test', 'Voir un exemple'],
  en: ['Your body is a\u00A0temple.', 'Here it is observed with care.', 'Nothing leaves your phone.', 'Enter', 'Show the entry now', 'Test version', 'See an example'],
};

export function shouldShowEntry() {
  if (new URLSearchParams(location.search).has('entry')) return true;
  try { return localStorage.getItem('wv_seen_entry') !== 'true'; } catch { return true; }
}

export default function Entry({ onEnter }) {
  const { lang } = useT();
  const text = COPY[lang] || COPY.fr;
  const canvas = useRef(null), scene = useRef(null), fontTimer = useRef(null), leaveTimer = useRef(null), leaving = useRef(false);
  const brand = useRef(null), copy = useRef(null);
  const [phase, setPhase] = useState('');
  const [skipped, setSkipped] = useState(false);
  // The example's screen, loaded at the tap and shown only once its code is in.
  const [Demo, setDemo] = useState(null);
  const demoBtn = useRef(null), demoLoading = useRef(false);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    let cancelled = false;
    const fontTimeout = new Promise(resolve => { fontTimer.current = setTimeout(resolve, 1400); });
    // The figure is fitted between the brand and the text block.
    const bounds = () => (brand.current && copy.current
      ? { top: brand.current.getBoundingClientRect().bottom, bottom: copy.current.getBoundingClientRect().top }
      : null);
    Promise.race([document.fonts.ready, fontTimeout]).then(() => {
      if (cancelled) return;
      clearTimeout(fontTimer.current);
      scene.current = createEntryScene(canvas.current, reduced.current, bounds);
      setPhase('play');
    });
    return () => { cancelled = true; clearTimeout(fontTimer.current); clearTimeout(leaveTimer.current); scene.current?.dispose(); };
  }, []);

  function openDemo() {
    // Once "Entrer" is tapped the entry is leaving: a late tap, or a late load, opens nothing (review, 29 September).
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

  function enter() {
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
    history.replaceState(history.state, '', url);
    leaveTimer.current = setTimeout(onEnter, reduced.current ? 10 : 820);
  }

  return <div className="entry-experience wv-experience">
    <canvas ref={canvas} className="entry-stage" aria-hidden="true" />
    <div className="vignette" aria-hidden="true" />
    <section className={`screen entry is-active ${phase} ${skipped ? 'skip' : ''}${Demo ? ' demo-open' : ''}`} aria-label="Workout Vision" inert={Demo ? true : undefined}>
      <button className="entry-skip" type="button" aria-label={text[4]} onClick={() => { scene.current?.skip(); setSkipped(true); }} />
      <p className="brand" ref={brand}>Workout Vision</p>
      <div className="entry-copy" ref={copy}>
        <h1 className="entry-l1"><span className="mask"><span>{text[0]}</span></span></h1>
        <p className="entry-l2"><span className="mask"><span>{text[1]}</span></span></p>
        <p className="entry-l3">{text[2]}</p>
        <button type="button" className="enter tactile" aria-label={text[3]} onClick={enter}>
          <span>{text[3]}</span>
        </button>
        <button type="button" className="entry-demo" ref={demoBtn} onClick={openDemo}>{text[6]}</button>
        <p className="entry-test">{text[5]}</p>
      </div>
    </section>
    {Demo && <Demo onClose={closeDemo} onStart={enter} />}
  </div>;
}
