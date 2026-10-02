import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { createLiftScene, hasFigure, restBox } from './lift-scenes';
import { liftDefinition } from '../../lib/counting/core';
import { tierLabel } from '../../lib/liftTiers';
import { tierOf } from '../../lib/offer';
import { exerciseName, filmView, guideExercise } from './exercise-info';
import { GuideFrames } from './Guide';
import { FITNESS_TESTS } from '../../lib/fitness-tests';
import './Film.css';

export default function Film({ lift, onBack, onFile, hero: arrivedByTransition = false }) {
  const { lang } = useT(), fr = lang === 'fr';
  const canvas = useRef(null);
  const fileRef = useRef(null);
  // The frame takes the chosen card's name only for the View Transition that brings it in, then drops it,
  // so a Film screen still fading out never shares the name with the next one.
  const [hero, setHero] = useState(arrivedByTransition);
  useEffect(() => { if (!hero) return undefined; const t = setTimeout(() => setHero(false), 700); return () => clearTimeout(t); }, [hero]);
  const view = filmView(lift);
  const test = FITNESS_TESTS[lift] ?? null;
  // The nine card lifts show the framing of their reference set; every other exercise, the guide's drawings.
  const figure = hasFigure(lift), guide = figure ? null : guideExercise(lift);
  const tier = tierOf(lift);
  const [bw, bh] = figure ? restBox(lift) : [1, 1];

  // The frame takes the height left once everything else on the screen down to "Filmer ma série" is
  // laid out: a long name wraps to three lines, the guide's credit to three more (review 05 of step 2,
  // 29 September). That rest does not depend on the frame, so measuring it again settles at once.
  const screen = useRef(null), frame = useRef(null), action = useRef(null);
  useLayoutEffect(() => {
    const root = screen.current, f = frame.current, a = action.current;
    if (!root || !f || !a) return undefined;
    const top = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
    const set = () => root.style.setProperty('--rest-h', `${top(a) + a.offsetHeight - f.offsetHeight}px`);
    set();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set);
    // The section is at least a screen high and may not change when the text above the frame does,
    // so its content is watched as well (review 06).
    ro.observe(root);
    if (root.firstElementChild) ro.observe(root.firstElementChild);
    return () => ro.disconnect();
  }, [lift, lang]);

  useEffect(() => {
    if (!canvas.current) return;
    return createLiftScene(canvas.current, lift, 'rest');
  }, [lift]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  // Knee and hip lifts are filmed with the whole body in frame; arm lifts with at least head to hips, which is
  // what their count needs (the figure shows the reference set's own, wider framing).
  const wholeBody = ['knee', 'hip'].includes(liftDefinition(lift)?.joint);
  // A knee or hip exercise filmed from the front (a lateral lunge, a standing hip abduction) is filmed facing
  // the phone, as its view says; the whole body stays in frame either way (review of 29 September).
  const step1 = wholeBody && view === 'side'
    ? (fr ? 'Posez le téléphone à la verticale, sur le côté, pour qu\u2019il vous voie de profil.' : 'Stand the phone upright at your side, so it sees you in profile.')
    : view === 'side'
    ? (fr ? 'Posez le téléphone sur le côté, le bras qui travaille face à l\u2019objectif.' : 'Stand the phone at your side, working arm facing the lens.')
    : (fr ? 'Posez le téléphone face à vous, à la verticale.' : 'Stand the phone upright, facing you.');

  return <div className="wv-experience">
    <section ref={screen} className="screen is-active film-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{test ? (fr ? 'Test de condition physique' : 'Fitness test') : fr ? (view === 'side' ? 'Filmé de profil' : 'Filmé de face') : (view === 'side' ? 'Filmed from the side' : 'Filmed from the front')}</p>
      <h2 className="title" data-reveal style={{ '--i': 1 }}>{exerciseName(lift, lang)}</h2>
      {tier && <p className={`tier tier-${tier}`} data-reveal style={{ '--i': 1 }}>{tierLabel(tier, fr)}</p>}
      <div ref={frame} className="frame" data-reveal style={{ '--i': 2, aspectRatio: `${bw} / ${bh}`, '--ar': bw / bh, viewTransitionName: hero ? 'lift-hero' : undefined }}>
        {figure ? <canvas ref={canvas} aria-hidden="true" /> : guide && <GuideFrames exercise={guide} />}
        <svg className="corners" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 9V0h9M91 0h9v9M100 91v9h-9M9 100H0v-9" fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        <i className="scan" aria-hidden="true" />
      </div>
      {figure
        ? <p className="caption" data-reveal style={{ '--i': 3 }}>{fr ? 'Le cadrage de la série de référence' : 'The framing of the reference set'}</p>
        : <p className="caption" data-reveal style={{ '--i': 3 }}>{test || guide?.similar
          ? (fr ? 'Mouvement proche, d’après le guide. Dessins\u00A0: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0.' : 'A similar movement, from the guide. Drawings: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0.')
          : fr ? 'Le mouvement, d’après le guide. Dessins\u00A0: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0.' : 'The movement, from the guide. Drawings: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0.'}</p>}
      {/* A fitness test is filmed as its protocol says (fitness-tests.js): its own three steps. */}
      {test ? <ol className="steps" data-reveal style={{ '--i': 4 }}>
        {test.steps[fr ? 'fr' : 'en'].map((t, i) => <li key={i}><span className="n">{i + 1}</span><span>{t}</span></li>)}
      </ol> : <ol className="steps" data-reveal style={{ '--i': 4 }}>
        <li><span className="n">1</span><span>{step1}</span></li>
        <li><span className="n">2</span><span>{wholeBody ? (fr ? 'Le corps entier dans le cadre, pieds compris.' : 'Your whole body in the frame, feet included.') : (fr ? 'Au moins de la tête aux hanches dans le cadre, mains comprises.' : 'At least head to hips in the frame, hands included.')}</span></li>
        {/* From rest to rest, so no rep is cut at either end of the video (accuracy work, 30 September). */}
        <li><span className="n">3</span><span>{fr ? 'Toute la série, du départ au retour au repos.' : 'The whole set, from rest back to rest.'}</span></li>
      </ol>}
      <div className="actions" data-reveal style={{ '--i': 5 }}>
        <label ref={action} className="btn-primary tactile" role="button" tabIndex="0">
          <input ref={fileRef} type="file" accept="video/*,.mov" capture="environment" className="hx" tabIndex="-1" aria-hidden="true" onChange={handleFile} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" fill="currentColor" /></svg>
          <span>{test ? (fr ? 'Filmer le test' : 'Record the test') : (fr ? 'Filmer ma série' : 'Record my set')}</span>
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
