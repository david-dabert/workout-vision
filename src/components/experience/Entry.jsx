import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { createEntryScene } from './entry-scene';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist-mono/400.css';
import './Entry.css';

// The approved prototype's three lines, unchanged in both languages.
const COPY = {
  fr: ['Votre corps est un temple.', 'Il est ici observé avec soin.', 'Rien ne quitte votre téléphone.', 'Entrer', 'Afficher l’entrée sans attendre', 'Version de test'],
  en: ['Your body is a temple.', 'Here it is observed with care.', 'Nothing leaves your phone.', 'Enter', 'Show the entry now', 'Test version'],
};

export function shouldShowEntry() {
  if (new URLSearchParams(location.search).has('entry')) return true;
  try { return localStorage.getItem('wv_seen_entry') !== 'true'; } catch { return true; }
}

export default function Entry({ onEnter }) {
  const { lang } = useT();
  const text = COPY[lang] || COPY.fr;
  const canvas = useRef(null), scene = useRef(null), timer = useRef(null), leaving = useRef(false);
  const [phase, setPhase] = useState('');
  const [skipped, setSkipped] = useState(false);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    let cancelled = false;
    const fontTimeout = new Promise(resolve => { timer.current = setTimeout(resolve, 1400); });
    Promise.race([document.fonts.ready, fontTimeout]).then(() => {
      if (cancelled) return;
      clearTimeout(timer.current);
      scene.current = createEntryScene(canvas.current, reduced.current);
      setPhase('play');
    });
    return () => { cancelled = true; clearTimeout(timer.current); scene.current?.dispose(); };
  }, []);

  function enter() {
    if (leaving.current) return;
    leaving.current = true;
    // The actual checkbox change supplies Safari's switch tick; no synthetic click.
    navigator.vibrate?.(10);
    scene.current?.leave();
    setPhase('play leaving');
    try { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_seen_landing', 'true'); } catch { /* storage unavailable */ }
    const url = new URL(location.href);
    url.searchParams.delete('entry');
    history.replaceState(history.state, '', url);
    timer.current = setTimeout(onEnter, reduced.current ? 10 : 820);
  }

  return <div className="entry-experience">
    <canvas ref={canvas} className="entry-stage" aria-hidden="true" />
    <div className="vignette" aria-hidden="true" />
    <section className={`screen entry is-active ${phase} ${skipped ? 'skip' : ''}`} aria-label="Workout Vision">
      <button className="entry-skip" type="button" aria-label={text[4]} onClick={() => { scene.current?.skip(); setSkipped(true); }} />
      <p className="brand">Workout Vision</p>
      <div className="entry-copy">
        <h1 className="entry-l1"><span className="mask"><span>{text[0]}</span></span></h1>
        <p className="entry-l2"><span className="mask"><span>{text[1]}</span></span></p>
        <p className="entry-l3">{text[2]}</p>
        <label className="enter tactile" role="button" tabIndex={0} aria-label={text[3]}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); } }}>
          <input type="checkbox" {...{ switch: '' }} className="hx" tabIndex={-1} aria-hidden="true" onChange={enter} />
          <span>{text[3]}</span>
        </label>
        <p className="entry-test">{text[5]}</p>
      </div>
    </section>
  </div>;
}
