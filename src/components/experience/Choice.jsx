import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { LIFTS, META, createLiftScene, liftView } from './lift-scenes';
import './Choice.css';

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

export default function Choice({ onChoose, onGuide }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [active, setActive] = useState(0);
  return <div className="wv-experience">
    <section className="screen is-active choose-screen">
      <div className="wrap">
        <div className="topbar"><span className="brand-sm">Workout Vision</span><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
        <h1 className="title">{fr ? 'Que travaillez-vous aujourd’hui ?' : 'What are you training today?'}</h1>
        <p className="sub">{fr ? 'Choisissez le mouvement que vous reconnaissez. Balayez pour voir les trois.' : 'Choose the movement you recognise. Swipe to see all three.'}</p>
      </div>
      <div className="rail" onScroll={event => {
        const rail = event.currentTarget, width = rail.firstElementChild.getBoundingClientRect().width + 12;
        setActive(Math.round(rail.scrollLeft / width));
      }}>
        {LIFTS.map((lift, i) => <HapticButton key={lift} className="altar" label={META[lift][lang]} onClick={() => onChoose(lift)}>
          <LiftCanvas lift={lift} />
          <span className="altar-meta">
            <span className="altar-idx">{String(i + 1).padStart(2, '0')} / {String(LIFTS.length).padStart(2, '0')}</span>
            <span className="altar-name">{META[lift][lang]}</span>
            <span className="altar-alias">{META[lift][fr ? 'aliasFr' : 'aliasEn']}</span>
            <span className="altar-view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7.5h3.2l2-2.5h7.6l2 2.5H21v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>{liftView(lift) === 'front' ? (fr ? 'Filmé de face' : 'Filmed from the front') : (fr ? 'Filmé de profil' : 'Filmed from the side')}</span>
          </span>
        </HapticButton>)}
      </div>
      <div className="dots" aria-hidden="true">{LIFTS.map((lift, i) => <i key={lift} className={active === i ? 'on' : ''} />)}</div>
      <div className="wrap">
        <button className="row-link press" onClick={onGuide}>
          <span className="row-ico" aria-hidden="true">↗</span>
          <span className="row-txt"><b>{fr ? 'Un autre exercice' : 'Another exercise'}</b><small>{fr ? 'Trouvez-le par la zone du corps' : 'Find it by body area'}</small></span><span aria-hidden="true">→</span>
        </button>
        <p className="foot">{fr ? 'Trois mouvements sont comptés pour l’instant.' : 'Three movements are counted for now.'}</p>
      </div>
    </section>
  </div>;
}
