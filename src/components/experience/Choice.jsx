import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { LIFTS, META, createLiftScene, liftView } from './lift-scenes';
import { useSets } from './sets';
import { TIERS, tierLabel } from '../../lib/liftTiers';
import './Choice.css';

// A visit that opens on saved sets is a return: the choice greets it, as in the prototype.
let returning = null;

export function LiftCanvas({ lift, mode }) {
  const canvas = useRef(null);
  useEffect(() => createLiftScene(canvas.current, lift, mode), [lift, mode]);
  return <canvas ref={canvas} aria-hidden="true" />;
}

export function HapticButton({ children, onClick, className, label }) {
  const fired = useRef(false);
  function fire() {
    if (fired.current) return;
    fired.current = true;
    navigator.vibrate?.(10);
    onClick();
    requestAnimationFrame(() => { fired.current = false; });
  }
  return <label className={`${className} tactile`} role="button" tabIndex={0} aria-label={label}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fire(); } }}>
    <input type="checkbox" {...{ switch: '' }} className="hx" tabIndex={-1} aria-hidden="true" onChange={fire} />
    {children}
  </label>;
}

export default function Choice({ onChoose, onGuide, onHistory }) {
  const { lang, tExercise } = useT(), fr = lang === 'fr';
  const [active, setActive] = useState(0);
  // Give storage a moment before showing the choice; late results still expose history.
  const sets = useSets();
  if (sets === undefined) return <div className="wv-experience" aria-busy="true" />;
  if (returning === null && sets) returning = sets.length > 0;
  const last = returning && sets?.[0];
  const n = sets?.length || 0;
  const lastName = last && (META[last.exercise]?.[lang] || tExercise(last.exercise || last.exerciseKey)).toLocaleLowerCase(fr ? 'fr-FR' : 'en-GB');
  return <div className="wv-experience">
    <section className={`screen is-active choose-screen${last ? ' has-welcome' : ''}`}>
      <div className="wrap">
        <div className="topbar"><span className="brand-sm">Workout Vision</span><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
        {last && <div className="welcome">
          <p className="welcome-l1">{fr ? 'Bon retour.' : 'Welcome back.'}</p>
          <p className="welcome-l2">{fr
            ? `Dernière série\u00A0: ${lastName}, ${last.reps} ${last.reps > 1 ? 'répétitions' : 'répétition'}.`
            : `Last set: ${lastName}, ${last.reps} ${last.reps === 1 ? 'rep' : 'reps'}.`}</p>
        </div>}
        <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Que travaillez-vous aujourd’hui\u00A0?' : 'What are you training today?'}</h1>
        <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Choisissez le mouvement que vous reconnaissez. Balayez pour les voir tous.' : 'Choose the movement you recognise. Swipe to see them all.'}</p>
      </div>
      <div className="rail" data-reveal style={{ '--i': 2 }} onScroll={event => {
        // The dot follows the card nearest the centre, as in the prototype.
        const rail = event.currentTarget, mid = rail.scrollLeft + rail.clientWidth / 2;
        let best = 0, bd = Infinity;
        [...rail.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
        setActive(best);
      }}>
        {LIFTS.map((lift, i) => <HapticButton key={lift} className="altar" label={META[lift][lang]} onClick={() => onChoose(lift)}>
          <LiftCanvas lift={lift} />
          <span className="altar-meta">
            <span className="altar-idx">{String(i + 1).padStart(2, '0')} / {String(LIFTS.length).padStart(2, '0')}</span>
            <span className="altar-name">{META[lift][lang]}</span>
            {TIERS[lift] && <span className={`tier tier-${TIERS[lift]}`}>{tierLabel(TIERS[lift], fr)}</span>}
            <span className="altar-alias">{META[lift][fr ? 'aliasFr' : 'aliasEn']}</span>
            <span className="altar-view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5h3.2l2-2.5h7.6l2 2.5H21v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>{liftView(lift) === 'front' ? (fr ? 'Filmé de face' : 'Filmed from the front') : (fr ? 'Filmé de profil' : 'Filmed from the side')}</span>
          </span>
        </HapticButton>)}
      </div>
      <div className="dots" aria-hidden="true" data-reveal style={{ '--i': 3 }}>{LIFTS.map((lift, i) => <i key={lift} className={active === i ? 'on' : ''} />)}</div>
      <div className="wrap" data-reveal style={{ '--i': 4 }}>
        <button className="row-link press" onClick={onGuide}>
          <span className="row-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.5" r="2" /><path d="M4.5 9.5L12 8l7.5 1.5" /><path d="M12 8v6" /><path d="M12 14l-3.5 7" /><path d="M12 14l3.5 7" /></svg></span>
          <span className="row-txt"><b>{fr ? 'Un autre exercice' : 'Another exercise'}</b><small>{fr ? 'Trouvez-le par la zone du corps' : 'Find it by body area'}</small></span>
          <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </button>
        {n > 0 && <button className="row-link press" onClick={onHistory}>
          <span className="row-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 7v10M10 7v10M14 7v10M18 7v10" /></svg></span>
          <span className="row-txt"><b>{fr ? 'Vos séries' : 'Your sets'}</b><small>{fr ? `${n} ${n > 1 ? 'séries' : 'série'} sur ce téléphone` : `${n} ${n === 1 ? 'set' : 'sets'} on this phone`}</small></span>
          <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </button>}
        <p className="foot">{fr ? 'Chaque comptage reste à confirmer : ces mouvements sont en bêta ou expérimentaux.' : 'Every count is yours to confirm: these movements are in Beta or Experimental.'}</p>
      </div>
    </section>
  </div>;
}
