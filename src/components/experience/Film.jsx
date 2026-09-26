import { useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { createLiftScene, META, liftView, restBox } from './lift-scenes';
import './Film.css';

export default function Film({ lift, onBack, onFile }) {
  const { lang } = useT(), fr = lang === 'fr';
  const canvas = useRef(null);
  const fileRef = useRef(null);
  const view = liftView(lift);

  const [bw, bh] = restBox(lift);

  useEffect(() => {
    if (!canvas.current) return;
    return createLiftScene(canvas.current, lift, 'rest');
  }, [lift]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  const step1 = view === 'side'
    ? (fr ? 'Posez le téléphone sur le côté, le bras qui travaille face à l\u2019objectif.' : 'Stand the phone at your side, working arm facing the lens.')
    : (fr ? 'Posez le téléphone face à vous, à la verticale.' : 'Stand the phone upright, facing you.');

  return <div className="wv-experience">
    <section className="screen is-active film-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{fr ? (view === 'side' ? 'Filmé de profil' : 'Filmé de face') : (view === 'side' ? 'Filmed from the side' : 'Filmed from the front')}</p>
      <h2 className="title" data-reveal style={{ '--i': 1 }}>{META[lift]?.[lang] || lift}</h2>
      <div className="frame" data-reveal style={{ '--i': 2, aspectRatio: `${bw} / ${bh}`, '--ar': bw / bh }}>
        <canvas ref={canvas} aria-hidden="true" />
        <svg className="corners" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 9V0h9M91 0h9v9M100 91v9h-9M9 100H0v-9" fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        <i className="scan" aria-hidden="true" />
      </div>
      <p className="caption" data-reveal style={{ '--i': 3 }}>{fr ? 'Le cadrage de la série de référence' : 'The framing of the reference set'}</p>
      <ol className="steps" data-reveal style={{ '--i': 4 }}>
        <li><span className="n">1</span><span>{step1}</span></li>
        <li><span className="n">2</span><span>{fr ? 'De la tête aux hanches dans le cadre, mains comprises.' : 'Head to hips in the frame, hands included.'}</span></li>
        <li><span className="n">3</span><span>{fr ? 'Une série, puis arrêtez la vidéo.' : 'One set, then stop recording.'}</span></li>
      </ol>
      <div className="actions" data-reveal style={{ '--i': 5 }}>
        <label className="btn-primary tactile" role="button" tabIndex="0">
          <input ref={fileRef} type="file" accept="video/*,.mov" capture="environment" className="hx" tabIndex="-1" aria-hidden="true" onChange={handleFile} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" fill="currentColor" /></svg>
          <span>{fr ? 'Filmer ma série' : 'Record my set'}</span>
        </label>
        <label className="btn-ghost press" role="button" tabIndex="0">
          <input type="file" accept="video/*,.mov" className="hx" tabIndex="-1" aria-hidden="true" onChange={handleFile} />
          <span>{fr ? 'Choisir une vidéo' : 'Choose a video'}</span>
        </label>
      </div>
      <p className="privacy" data-reveal style={{ '--i': 6 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        <span>{fr ? 'La vidéo reste sur votre téléphone.' : 'The video stays on your phone.'}</span>
      </p>
    </div></section>
  </div>;
}
