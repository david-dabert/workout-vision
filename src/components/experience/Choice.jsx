import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { FITNESS_TESTS } from '../../lib/fitness-tests';
import { useT } from '../../lib/LanguageContext';
import { LIFTS, META, createLiftScene } from './lift-scenes';
import { useSets } from './sets';
import { holdStage } from './stage-loop';
import { TIERS, tierLabel } from '../../lib/liftTiers';
import './Choice.css';

// The list of every counted exercise loads after the choice has shown (ExerciseList.jsx).
// If its code cannot load (offline, after an update), the choice shows without it: the cards stay.
const ExerciseList = lazy(() => import('./ExerciseList').catch(() => ({ default: () => null })));

// A visit that opens on saved sets is a return: the choice greets it, as in the prototype.
let returning = null;

// On the rail, a card's figure is made only when the card comes within one rail's width of
// the view, so opening the choice draws two or three figures, not all of them. Only the card in the
// centre animates; the others keep their last frame, and a card that becomes the centre moves
// on from the pose it kept.
export function LiftCanvas({ lift, mode }) {
  const canvas = useRef(null);
  useEffect(() => {
    const el = canvas.current, rail = el.closest('.rail');
    if (!rail || typeof IntersectionObserver === 'undefined') return createLiftScene(el, lift, mode);
    let scene = null, centred = false;
    const near = new IntersectionObserver(entries => {
      if (scene || !entries[entries.length - 1].isIntersecting) return;
      scene = createLiftScene(el, lift, mode, { paused: true });
      scene.setRunning(centred);
      near.disconnect();
    }, { root: rail, rootMargin: '0px 100%' });
    // A separate observer without margin: a card's share of the view decides the centre.
    const centre = new IntersectionObserver(entries => {
      centred = entries[entries.length - 1].intersectionRatio >= 0.6;
      scene?.setRunning(centred);
    }, { root: rail, threshold: [0, 0.6] });
    near.observe(el); centre.observe(el);
    return () => { near.disconnect(); centre.disconnect(); scene?.(); };
  }, [lift, mode]);
  return <canvas ref={canvas} aria-hidden="true" />;
}

// The dot of the centred card lights, and the stage holds still while the rail moves:
// observers and a passive listener only, so a swipe reads no layout and renders nothing.
function useRail(rail, dots) {
  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    let timer = 0;
    const onScroll = () => { holdStage(true); clearTimeout(timer); timer = setTimeout(() => holdStage(false), 160); };
    const onEnd = () => { clearTimeout(timer); holdStage(false); };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', onEnd);
    // Every card's visible share is kept; the dot goes to the most visible card, the one in the centre.
    const ratios = new Map();
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      for (const e of entries) ratios.set(e.target, e.intersectionRatio);
      let best = -1, top = 0;
      [...el.children].forEach((c, i) => { const r = ratios.get(c) || 0; if (r > top) { top = r; best = i; } });
      if (best >= 0) dots.current?.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === best));
    }, { root: el, threshold: [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    [...el.children].forEach(c => io?.observe(c));
    return () => { el.removeEventListener('scroll', onScroll); el.removeEventListener('scrollend', onEnd); clearTimeout(timer); holdStage(false); io?.disconnect(); };
  });
}

// A lift card is a plain button. No switch input covers it: on iOS Safari a native switch
// takes horizontal drags for its thumb, so a swipe that began on a card never reached the rail.
// iOS gives no haptic tick without that switch; navigator.vibrate ticks where it exists (Android).
function LiftCard({ children, onClick, label, cardRef }) {
  return <button type="button" ref={cardRef} className="altar tactile" aria-label={label}
    onClick={() => { navigator.vibrate?.(10); onClick(); }}>
    {children}
  </button>;
}

export default function Choice({ onChoose, onGuide, onHistory }) {
  const { lang, tExercise } = useT(), fr = lang === 'fr';
  const railRef = useRef(null), dotsRef = useRef(null), cards = useRef([]);
  // The guide's names load after the choice; until then a set of an exercise without a card is not
  // named, so the welcome never shows an internal key (review of 29 September).
  const [nameOf, setNameOf] = useState(null);
  useEffect(() => { import('./exercise-info').then(m => setNameOf(() => m.exerciseName), () => {}); }, []);
  useRail(railRef, dotsRef);
  // The chosen card carries the name the filming screen's frame takes, so it grows into it (View Transitions).
  const choose = (lift, i) => { cards.current.forEach((c, j) => { if (c) c.style.viewTransitionName = j === i ? 'lift-hero' : ''; }); onChoose(lift); };
  // Give storage a moment before showing the choice; late results still expose history.
  const sets = useSets();
  if (sets === undefined) return <div className="wv-experience" aria-busy="true" />;
  if (returning === null && sets) returning = sets.length > 0;
  const last = returning && sets?.[0];
  const n = sets?.length || 0;
  const lastKey = last && (last.exercise || last.exerciseKey);
  const lastRaw = last && (META[lastKey]?.[lang] || nameOf?.(lastKey, lang) || (tExercise(lastKey) !== lastKey ? tExercise(lastKey) : ''));
  const lastName = lastRaw && lastRaw.toLocaleLowerCase(fr ? 'fr-FR' : 'en-GB');
  return <div className="wv-experience">
    <section className={`screen is-active choose-screen${last ? ' has-welcome' : ''}`}>
      <div className="choose-hero">
      <div className="wrap">
        <div className="topbar"><span className="brand-sm">Workout Vision</span><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
        {last && <div className="welcome">
          <p className="welcome-l1">{fr ? 'Bon retour.' : 'Welcome back.'}</p>
          {lastName && <p className="welcome-l2">{fr
            ? `Dernière série\u00A0: ${lastName}, ${last.reps} ${last.reps > 1 ? 'répétitions' : 'répétition'}.`
            : `Last set: ${lastName}, ${last.reps} ${last.reps === 1 ? 'rep' : 'reps'}.`}</p>}
        </div>}
        <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Que travaillez-vous aujourd’hui\u00A0?' : 'What are you training today?'}</h1>
        <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Choisissez le mouvement que vous reconnaissez. Balayez pour les voir tous.' : 'Choose the movement you recognise. Swipe to see them all.'}</p>
      </div>
      <div className="rail" ref={railRef} data-reveal style={{ '--i': 2 }}>
        {LIFTS.map((lift, i) => <LiftCard key={lift} label={META[lift][lang]} cardRef={el => { cards.current[i] = el; }} onClick={() => choose(lift, i)}>
          <LiftCanvas lift={lift} />
          <span className="altar-meta">
            <span className="altar-name">{META[lift][lang]}</span>
            {TIERS[lift] && <span className={`tier tier-${TIERS[lift]}`}>{tierLabel(TIERS[lift], fr)}</span>}
            <span className="altar-alias">{META[lift][fr ? 'aliasFr' : 'aliasEn']}</span>
          </span>
        </LiftCard>)}
      </div>
      <div className="dots" ref={dotsRef} aria-hidden="true" data-reveal style={{ '--i': 3 }}>{LIFTS.map((lift, i) => <i key={lift} className={i === 0 ? 'on' : ''} />)}</div>
      </div>
      <div className="wrap" data-reveal style={{ '--i': 4 }}>
        <button className="row-link press" onClick={onGuide}>
          <span className="row-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.5" r="2" /><path d="M4.5 9.5L12 8l7.5 1.5" /><path d="M12 8v6" /><path d="M12 14l-3.5 7" /><path d="M12 14l3.5 7" /></svg></span>
          <span className="row-txt"><b>{fr ? 'Un autre exercice' : 'Another exercise'}</b><small>{fr ? 'Trouvez-le par la zone du corps' : 'Find it by body area'}</small></span>
          <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </button>
        {/* The fitness tests (fitness-tests.js): a count in 30 seconds, under a published protocol. */}
        {['chair_stand_test', 'arm_curl_test'].map(key => <button key={key} className="row-link press" onClick={() => onChoose(key)} data-testid={`choose-${key}`}>
          <span className="row-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13.5" r="7.5" /><path d="M12 13.5V9.5" /><path d="M10 3h4" /><path d="M12 3v3" /></svg></span>
          <span className="row-txt"><b>{FITNESS_TESTS[key][fr ? 'fr' : 'en']}</b><small>{fr ? 'Test de condition physique' : 'Fitness test'}</small></span>
          <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </button>)}
        {/* Shown with no set too: after Safari erases the sets, or on a new phone, the history holds the restore
            (audit of 2 October). */}
        {Array.isArray(sets) && <button className="row-link press" onClick={onHistory}>
          <span className="row-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 7v10M10 7v10M14 7v10M18 7v10" /></svg></span>
          <span className="row-txt"><b>{fr ? 'Vos séries' : 'Your sets'}</b><small>{n === 0 ? (fr ? 'Restaurer une sauvegarde' : 'Restore a backup') : fr ? `${n} ${n > 1 ? 'séries' : 'série'} sur ce téléphone` : `${n} ${n === 1 ? 'set' : 'sets'} on this phone`}</small></span>
          <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </button>}
        <Suspense fallback={null}><ExerciseList onChoose={onChoose} /></Suspense>
        <p className="foot">{fr ? 'Chaque comptage reste à confirmer\u00A0: ces mouvements sont en bêta ou expérimentaux.' : 'Every count is yours to confirm: these movements are in Beta or Experimental.'}</p>
      </div>
    </section>
  </div>;
}
