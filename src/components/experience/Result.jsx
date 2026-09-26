import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, topPose } from './lift-scenes';
import { Body, mapPose, DPR, LITE } from './entry-scene';
import { addLayer, presence } from './stage-loop';
import { saveWorkout } from '../../lib/storage';
import './Result.css';

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// The three joints the counting core measures for each lift (core.ts), by arm.
const CORE_JOINTS = { lateral_raise: ['hip', 'shoulder', 'elbow'], bicep_curl: ['shoulder', 'elbow', 'wrist'], lat_pulldown: ['shoulder', 'elbow', 'wrist'] };
const JOINT_INDEX = { left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23 }, right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24 } };

// Why a set was refused, read from the same joints the core uses rather than assumed.
function refusal(result, lift) {
  const frames = result.imageLandmarks || [];
  const posed = frames.filter(Boolean);
  if (!frames.length || posed.length < frames.length / 2) return { cause: 'nobody' };
  const arm = result.arm === 'left' ? 'left' : 'right';
  let joint = null, missing = -1;
  for (const name of CORE_JOINTS[lift] || CORE_JOINTS.bicep_curl) {
    const i = JOINT_INDEX[arm][name], n = posed.filter(f => f[i].visibility < 0.5).length;
    if (n > missing) { missing = n; joint = name; }
  }
  if (missing <= posed.length / 2) return { cause: 'unclear' };
  const i = JOINT_INDEX[arm][joint], hidden = posed.filter(f => f[i].visibility < 0.5);
  const outside = hidden.filter(f => f[i].x < 0 || f[i].x > 1 || f[i].y < 0 || f[i].y > 1).length > hidden.length / 2;
  const xs = posed.map(f => f[i].x).sort((a, b) => a - b);
  return { cause: outside ? 'outside' : 'hidden', hips: joint === 'hip', exitLeft: xs[xs.length >> 1] < 0.5 };
}

// The user's own body at the top of the first rep, faint behind the number.
function ghostSource(result, lift) {
  const rep = result.reps?.[0], frames = result.imageLandmarks, ts = result.timestamps;
  if (rep && frames?.length && ts?.length) {
    const at = rep.startTime + (rep.concentricSec || 0);
    let best = 0;
    for (let i = 1; i < ts.length; i++) if (Math.abs(ts[i] - at) < Math.abs(ts[best] - at)) best = i;
    const lm = frames[best], fw = result.metadata?.width || result.metadata?.extractedWidth || 1, fh = result.metadata?.height || result.metadata?.extractedHeight || 1;
    if (lm) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const p = new Float32Array(66);
      for (let i = 0; i < 33; i++) {
        const q = lm[i], x = q.x * fw, y = q.y * fh;
        p[i * 2] = q.visibility < 0.3 ? NaN : x; p[i * 2 + 1] = q.visibility < 0.3 ? NaN : y;
        if (q.visibility >= 0.5) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      if (Number.isFinite(x0)) {
        const px = (x1 - x0) * 0.1, py = (y1 - y0) * 0.1;
        for (let i = 0; i < 33; i++) { p[i * 2] -= x0 - px; p[i * 2 + 1] -= y0 - py; }
        return { p, vb: [x1 - x0 + 2 * px, y1 - y0 + 2 * py] };
      }
    }
  }
  return topPose(lift);
}

function Topbar({ fr, onClose }) {
  return <div className="topbar">
    <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
    <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
  </div>;
}

// Shown when the analysis itself failed; the technical message stays in the console.
export function AnalysisError({ lift, phase, onClose, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const model = phase === 'model';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow">{META[lift]?.[lang] || lift}</p>
      <h2 className="title refused-title">{model
        ? (fr ? 'L’analyse n’a pas pu démarrer.' : 'The analysis could not start.')
        : (fr ? 'Nous n’avons pas pu lire cette vidéo.' : 'We could not read this video.')}</h2>
      <p className="body-text">{model
        ? (fr ? 'Rechargez la page, puis réessayez.' : 'Reload the page, then try again.')
        : (fr ? 'Essayez une autre vidéo, ou filmez à nouveau avec l’appareil photo.' : 'Try another video, or record again with the camera.')}</p>
      <div className="actions result-actions">
        <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
    </div></section>
  </div>;
}

export default function Result({ result, lift, covered, onClose, onReport, onNewSet, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const reduced = useRef(REDUCED()).current;
  const [step, setStep] = useState('ask'); // ask | fix | saved
  const [trueN, setTrueN] = useState(result.count);
  const [shown, setShown] = useState(reduced ? result.count : 0);
  const [asked, setAsked] = useState(reduced);
  const [saveError, setSaveError] = useState('');
  const saving = useRef(false);
  const rootRef = useRef(null);
  const coveredRef = useRef(covered);
  coveredRef.current = covered;

  const liftName = META[lift]?.[lang] || lift;
  const side = result.arm === 'left' ? (fr ? 'gauche' : 'left') : (fr ? 'droit' : 'right');
  const armLabel = fr ? `bras ${side}` : `${side} arm`;
  const seconds = Math.round(result.metadata?.duration || 0);
  const count = result.count;

  // The count rises one rep at a time, lighting one mark per rep; the question follows.
  useEffect(() => {
    if (reduced || result.refused) return undefined;
    const step = Math.min(150, 1500 / Math.max(count, 1)), t0 = performance.now();
    let raf = 0, t = 0;
    const tick = (now) => {
      const k = Math.max(0, Math.min(count, Math.floor((now - t0 - 450) / step) + 1));
      setShown(k);
      if (k < count) raf = requestAnimationFrame(tick);
      else t = setTimeout(() => setAsked(true), 560);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The ghost of the lift behind the number.
  useEffect(() => {
    if (result.refused) return undefined;
    const body = new Body(LITE ? 1700 : 2600, 7), src = ghostSource(result, lift), out = new Float32Array(66), memo = {};
    return addLayer((ctx, W, H, t, now) => {
      const here = presence(rootRef.current, now, memo);
      if (coveredRef.current || here <= 0) return;
      mapPose(src.p, src.vb, { x: W * 0.04, y: H * 0.04, w: W * 0.92, h: H * 0.66 }, out);
      body.draw(ctx, out, { alpha: 0.2 * here, time: t, dpr: DPR, breathe: reduced ? 0 : Math.sin(t * 0.9) * 0.01 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doSave(n, corrected) {
    if (saving.current) return;
    saving.current = true;
    try {
      await saveWorkout({
        exercise: lift, reps: n, repDetails: result.reps, arm: result.arm, confidence: result.confidence,
        date: new Date().toISOString(), source: 'counter-core', duration: result.metadata?.duration, corrected,
      });
      setStep('saved');
    } catch {
      setSaveError(fr ? 'Résultat affiché, mais non enregistré.' : 'Result shown, but could not save it.');
    } finally { saving.current = false; }
  }

  if (result.refused) {
    const why = refusal(result, lift);
    const text = why.cause === 'nobody'
      ? (fr ? 'Nous ne vous avons pas trouvé dans la vidéo.' : 'We could not find you in the video.')
      : why.cause === 'unclear'
        ? (fr ? `Votre ${armLabel} n\u2019était pas assez visible pour compter les répétitions.` : `Your ${armLabel} was not visible enough to count the reps.`)
        : why.hips
          ? (why.cause === 'outside'
            ? (fr ? 'Vos hanches sont restées hors du cadre pendant la plus grande partie de la série.' : 'Your hips stayed out of the frame for most of the set.')
            : (fr ? 'Vos hanches étaient cachées pendant la plus grande partie de la série.' : 'Your hips were hidden for most of the set.'))
          : (why.cause === 'outside'
            ? (fr ? `Votre ${armLabel} est sorti du cadre pendant la plus grande partie de la série.` : `Your ${armLabel} left the frame for most of the set.`)
            : (fr ? `Votre ${armLabel} était caché pendant la plus grande partie de la série.` : `Your ${armLabel} was hidden for most of the set.`));
    const fix = why.hips
      ? (fr ? 'Reculez pour que vos hanches soient dans l\u2019image, puis refilmez.' : 'Step back so your hips are in the picture, then record again.')
      : why.cause === 'nobody'
        ? (fr ? 'Posez le téléphone face à vous, placez-vous dans l\u2019image, puis refilmez.' : 'Stand the phone facing you, step into the picture, then record again.')
        : (fr ? 'Placez-vous au centre de l\u2019image, bras compris, puis refilmez.' : 'Stand in the middle of the picture, arms included, then record again.');
    return <div className="wv-experience">
      <section className="screen is-active result-screen"><div className="wrap">
        <Topbar fr={fr} onClose={onClose} />
        <p className="eyebrow refused-eyebrow">{liftName}</p>
        <h2 className="title refused-title">{fr ? 'Nous n’avons pas pu compter cette série.' : 'We could not count this set.'}</h2>
        {why.cause === 'outside' && <div className="frame">
          <i className="edge" style={why.exitLeft ? { left: 0 } : { right: 0 }} aria-hidden="true" />
          <span className="edge-label" style={{ textAlign: why.exitLeft ? 'left' : 'right' }}>{fr ? 'Hors cadre' : 'Out of frame'}</span>
        </div>}
        <p className="body-text">{text}</p>
        <div className="fix-note">
          <p className="eyebrow">{fr ? 'La correction' : 'The fix'}</p>
          <p className="fix-text">{fix}</p>
        </div>
        <div className="actions result-actions">
          <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
        </div>
      </div></section>
    </div>;
  }

  const one = shown <= 1;
  return <div className="wv-experience" ref={rootRef}>
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <div className="res-head">
        <p className="eyebrow">{liftName}</p>
        <p className="res-meta">{seconds ? `${seconds} s · ${armLabel}` : armLabel}</p>
      </div>
      <span key={shown} className="numeral tick" aria-hidden="true">{shown}</span>
      <p className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (shown === 1 ? 'Rep' : 'Reps')}</p>
      <p className="sr" role="status">{asked ? (fr ? `${count} ${count > 1 ? 'répétitions comptées' : 'répétition comptée'}.` : `${count} ${count === 1 ? 'rep' : 'reps'} counted.`) : ''}</p>
      {count > 0 && <div className="bars" aria-hidden="true">
        {result.reps.map((rep, i) => <div key={rep.index} className={`bar${i < shown ? ' lit' : ''}`}><i /></div>)}
      </div>}

      {step === 'ask' && asked && (
        <div className="glass appear" data-testid="ask-card">
          <p className="ask-q">{fr ? `Nous avons compté ${count}. Est-ce juste ?` : `We counted ${count}. Is that right?`}</p>
          <div className="ask-row">
            <label className="btn-primary press" role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSave(count, false); } }}>
              <input type="checkbox" {...{ switch: '' }} className="hx" tabIndex={-1} aria-hidden="true" onChange={() => doSave(count, false)} />
              <span>{fr ? 'Oui, c’est juste' : 'Yes, that’s right'}</span>
            </label>
            <button className="btn-ghost press" onClick={() => setStep('fix')}>{fr ? 'Non' : 'No'}</button>
          </div>
        </div>
      )}

      {step === 'fix' && (
        <div className="glass appear" data-testid="fix-card">
          <p className="ask-q">{fr ? 'Combien en avez-vous fait ?' : 'How many did you do?'}</p>
          <div className="stepper">
            <button className="round press" disabled={trueN <= 0} onClick={() => setTrueN(n => Math.max(0, n - 1))} aria-label={fr ? 'Une de moins' : 'One fewer'}>−</button>
            <span className="stepper-n" aria-live="polite">{trueN}</span>
            <button className="round press" disabled={trueN >= 99} onClick={() => setTrueN(n => Math.min(99, n + 1))} aria-label={fr ? 'Une de plus' : 'One more'}>+</button>
          </div>
          <label className="btn-primary press" role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSave(trueN, true); } }}>
            <input type="checkbox" {...{ switch: '' }} className="hx" tabIndex={-1} aria-hidden="true" onChange={() => doSave(trueN, true)} />
            <span>{fr ? 'Enregistrer' : 'Save'}</span>
          </label>
        </div>
      )}

      {step === 'saved' && (
        <div className="saved appear" data-testid="saved-card">
          {trueN !== count && <p className="res-meta saved-corr">{fr ? `Compté par l’app : ${count}. Corrigé : ${trueN}.` : `Counted by the app: ${count}. Corrected: ${trueN}.`}</p>}
          <p className="saved-msg">{trueN !== count
            ? (fr ? 'Merci. Votre correction est notée sur votre téléphone.' : 'Thank you. Your correction is noted on your phone.')
            : (fr ? 'Merci. Série enregistrée sur votre téléphone.' : 'Thank you. Set saved on your phone.')}</p>
          <button className="btn-line press" onClick={() => onReport(trueN)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
            <span>{fr ? 'Rapport pour mon coach' : 'Report for my coach'}</span>
          </button>
          <button className="text-btn press" onClick={onNewSet}>{fr ? 'Nouvelle série' : 'New set'}</button>
        </div>
      )}

      {saveError && <p role="alert" className="save-error">{saveError}</p>}
    </div></section>
  </div>;
}
