import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, liftView } from './lift-scenes';
import { saveWorkout } from '../../lib/storage';
import './Result.css';

export default function Result({ result, lift, onClose, onReport, onNewSet, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [step, setStep] = useState('ask'); // ask | fix | saved
  const [trueN, setTrueN] = useState(result.count);
  const [selBar, setSelBar] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const numeralRef = useRef(null);

  const liftName = META[lift]?.[lang] || lift;
  const armLabel = fr
    ? (result.arm === 'left' ? 'bras gauche' : 'bras droit')
    : (result.arm === 'left' ? 'left arm' : 'right arm');
  const viewLabel = liftView(lift) === 'front'
    ? (fr ? 'face' : 'front')
    : (fr ? 'profil' : 'side');

  // Animate numeral on mount
  useEffect(() => {
    if (numeralRef.current) {
      numeralRef.current.classList.add('tick');
      const t = setTimeout(() => numeralRef.current?.classList.remove('tick'), 400);
      return () => clearTimeout(t);
    }
  }, []);

  async function doSave(count, corrected) {
    try {
      await saveWorkout({
        exercise: lift,
        reps: count,
        repDetails: result.reps,
        arm: result.arm,
        confidence: result.confidence,
        date: new Date().toISOString(),
        source: 'counter-core',
        duration: result.metadata?.duration,
        corrected,
      });
      setSaved(true);
      setStep('saved');
    } catch {
      setSaveError(fr ? 'Résultat affiché, mais non enregistré.' : 'Result shown, but could not save it.');
    }
  }

  function handleYes() {
    doSave(result.count, false);
  }

  function handleNo() {
    setStep('fix');
  }

  function handleSaveFix() {
    doSave(trueN, true);
  }

  // Refused state
  if (result.refused) {
    return <div className="wv-experience">
      <section className="screen is-active result-screen"><div className="wrap">
        <div className="topbar">
          <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
        </div>
        <p className="eyebrow refused-eyebrow">{liftName}</p>
        <h2 className="title refused-title">{fr ? 'Nous n\u2019avons pas pu compter cette série.' : 'We could not count this set.'}</h2>
        <div className="frame" style={{ position: 'relative' }}>
          <i className="edge" style={{ [result.arm === 'left' ? 'left' : 'right']: 0 }} aria-hidden="true" />
          <span className="edge-label">{fr ? 'Hors cadre' : 'Out of frame'}</span>
        </div>
        <p className="body-text">{fr ? `Votre ${armLabel} est sorti du cadre pendant la plus grande partie de la série.` : `Your ${armLabel} left the frame for most of the set.`}</p>
        <div className="fix-note">
          <p className="eyebrow">{fr ? 'La correction' : 'The fix'}</p>
          <p className="fix-text">{fr ? 'Placez-vous au centre de l\u2019image, bras compris, puis refilmez.' : 'Stand in the middle of the picture, arms included, then record again.'}</p>
        </div>
        <div className="actions" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 26 }}>
          <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
        </div>
      </div></section>
    </div>;
  }

  // Counted state
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <div className="res-head">
        <p className="eyebrow">{liftName}</p>
        <p className="res-meta">{armLabel} · {viewLabel}</p>
      </div>
      <span className="numeral" ref={numeralRef} aria-live="polite">{result.count}</span>
      <p className="res-label">{fr ? 'Répétitions' : 'Reps'}</p>
      <div className={`bars${selBar >= 0 ? ' has-sel' : ''}`}>
        {result.reps.map((rep, i) => (
          <button key={rep.index} className={`bar${i < result.count ? ' lit' : ''}${selBar === i ? ' sel' : ''}`}
            style={{ width: Math.max(16, 280 / Math.max(result.reps.length, 1)), padding: '0 2px' }}
            onClick={() => setSelBar(selBar === i ? -1 : i)}
            aria-label={`${fr ? 'Rép.' : 'Rep'} ${rep.index}`}>
            <i style={{ height: `${Math.max(20, Math.min(100, (rep.rom || 50) * 1.2))}%` }} />
          </button>
        ))}
      </div>
      <p className="res-detail">
        {selBar >= 0 && result.reps[selBar] ? `${fr ? 'Rép.' : 'Rep'} ${result.reps[selBar].index} · ${(result.reps[selBar].duration / 1000).toFixed(1)}s` : ''}
      </p>

      {step === 'ask' && (
        <div className="glass" data-testid="ask-card">
          <p className="ask-q">{fr ? `Nous avons compté ${result.count}. Est-ce juste ?` : `We counted ${result.count}. Is that right?`}</p>
          <div className="ask-row">
            <button className="btn-primary press" onClick={handleYes}>{fr ? 'Oui, c\u2019est juste' : 'Yes, that\u2019s right'}</button>
            <button className="btn-ghost press" onClick={handleNo}>{fr ? 'Non' : 'No'}</button>
          </div>
        </div>
      )}

      {step === 'fix' && (
        <div className="glass" data-testid="fix-card">
          <p className="ask-q">{fr ? 'Combien en avez-vous fait ?' : 'How many did you do?'}</p>
          <div className="stepper">
            <button className="round press" onClick={() => setTrueN(Math.max(0, trueN - 1))} aria-label={fr ? 'Une de moins' : 'One fewer'}>−</button>
            <span className="stepper-n" aria-live="polite">{trueN}</span>
            <button className="round press" onClick={() => setTrueN(trueN + 1)} aria-label={fr ? 'Une de plus' : 'One more'}>+</button>
          </div>
          <button className="btn-primary press" onClick={handleSaveFix}>{fr ? 'Enregistrer' : 'Save'}</button>
        </div>
      )}

      {step === 'saved' && (
        <div className="saved" data-testid="saved-card">
          <p className="saved-msg">{trueN !== result.count
            ? (fr ? 'Merci. Votre correction est notée sur votre téléphone.' : 'Thank you. Your correction is noted on your phone.')
            : (fr ? 'Merci. Série enregistrée sur votre téléphone.' : 'Thank you. Set saved on your phone.')
          }</p>
          <button className="btn-line press" onClick={() => onReport(trueN)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
            <span>{fr ? 'Rapport pour mon coach' : 'Report for my coach'}</span>
          </button>
          <button className="text-btn press" onClick={onNewSet}>{fr ? 'Nouvelle série' : 'New set'}</button>
        </div>
      )}

      {saveError && <p role="alert" style={{ color: 'var(--lamp)', textAlign: 'center', marginTop: 12 }}>{saveError}</p>}
    </div></section>
  </div>;
}
