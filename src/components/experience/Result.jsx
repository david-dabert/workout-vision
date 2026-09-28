import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, topPose } from './lift-scenes';
import { Body, mapPose, DPR, LITE } from './entry-scene';
import { addLayer, presence } from './stage-loop';
import { saveWorkout } from '../../lib/storage';
import { warmReportPdf } from './Report';
import { refreshSets } from './sets';
import { decimal } from './report-sheet';
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

function Topbar({ fr, onClose, onReplay, replayRef }) {
  return <div className="topbar">
    <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
    {onReplay && <button ref={replayRef} className="rp-open press" onClick={onReplay} aria-label={fr ? 'Revoir la série avec le squelette' : 'Replay the set with the skeleton'}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>
      <span>{fr ? 'Revoir' : 'Replay'}</span>
    </button>}
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

// Shown when the page was hidden during the analysis (screen locked, app left).
// The run was stopped and nothing it measured is shown.
export function AnalysisInterrupted({ lift, onClose, onRestart, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow">{META[lift]?.[lang] || lift}</p>
      <h2 className="title refused-title">{fr ? 'L’analyse a été interrompue.' : 'The analysis was interrupted.'}</h2>
      <p className="body-text">{fr
        ? 'L’écran s’est éteint ou vous avez quitté l’app. Gardez l’écran allumé pendant l’analyse, puis recommencez.'
        : 'The screen turned off or you left the app. Keep the screen on during the analysis, then start again.'}</p>
      <div className="actions result-actions">
        <button className="btn-primary press" onClick={onRestart}>{fr ? 'Recommencer l’analyse' : 'Start the analysis again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
    </div></section>
  </div>;
}

/**
 * covered: the screen open over the result ('report' or 'replay'), or nothing.
 * onReplay: opens the replay; absent when the video is not at hand.
 */
export default function Result({ result, lift, covered, onClose, onReport, onReplay, onNewSet, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const reduced = useRef(REDUCED()).current;
  const [step, setStep] = useState('ask'); // ask | fix | saved
  const [trueN, setTrueN] = useState(result.count);
  const [shown, setShown] = useState(reduced ? result.count : 0);
  const [asked, setAsked] = useState(reduced);
  const [saveError, setSaveError] = useState('');
  const [sel, setSel] = useState(-1); // the rep whose details are shown, or none
  const saving = useRef(false);
  const rootRef = useRef(null);
  const reportRef = useRef(null);
  const replayRef = useRef(null);
  const coveredRef = useRef(covered);
  coveredRef.current = covered;

  // Back from the report or the replay, the keyboard and screen readers return to the button that opened it.
  const wasCovered = useRef(covered);
  useEffect(() => {
    if (wasCovered.current && !covered) (wasCovered.current === 'replay' ? replayRef : reportRef).current?.focus({ preventScroll: true });
    wasCovered.current = covered;
  }, [covered]);

  const liftName = META[lift]?.[lang] || lift;
  const side = result.arm === 'left' ? (fr ? 'gauche' : 'left') : (fr ? 'droit' : 'right');
  const armLabel = fr ? `bras ${side}` : `${side} arm`;
  const seconds = Math.round(result.metadata?.duration || 0);
  const count = result.count;

  // Each rep's mark is as tall as its range, as in the prototype; touching the marks
  // shows the nearest rep's details. A rep the recording cut shows its range only.
  const reps = result.reps || [];
  const maxRom = Math.max(1, ...reps.map(r => r.romDegrees || 0));
  const NB = '\u00A0', sec = x => `${decimal(x, fr)}${NB}s`;
  const whole = reps.filter(r => !r.clipped);
  // The chosen rep's number is its lit mark; it is spoken, not printed, so the line stays on one row.
  // Where a line must break, it breaks after a separator, never inside a measure.
  let detail = '', detailHead = '';
  if (sel >= 0 && reps[sel]) {
    const r = reps[sel];
    detailHead = `${fr ? 'Rép.' : 'Rep'} ${sel + 1} · `;
    detail = r.clipped
      ? `${Math.round(r.romDegrees)}°${NB}· ${fr ? 'filmée en partie' : 'partly filmed'}`
      : `${sec(r.endTime - r.startTime)}${NB}· ${Math.round(r.romDegrees)}°${NB}· conc.${NB}${sec(r.concentricSec)}${NB}· ${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}`;
  } else if ((asked || step !== 'ask') && whole.length) {
    const rom = whole.reduce((a, r) => a + r.romDegrees, 0) / whole.length;
    const dur = whole.reduce((a, r) => a + (r.endTime - r.startTime), 0) / whole.length;
    detail = fr ? `Amplitude moyenne ${Math.round(rom)}°${NB}· durée moyenne ${sec(dur)}` : `Average range ${Math.round(rom)}°${NB}· average duration ${sec(dur)}`;
  }
  const marksRef = useRef(null);
  function pick(e) {
    const marks = [...(marksRef.current?.children || [])];
    let best = -1, gap = Infinity;
    marks.forEach((m, i) => { const r = m.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - e.clientX); if (d < gap) { gap = d; best = i; } });
    if (best >= 0) setSel(s => (s === best ? -1 : best));
  }
  function keys(e) {
    const n = reps.length, go = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (go) { e.preventDefault(); setSel(s => (s < 0 ? (go > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, s + go)))); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setSel(e.key === 'Home' ? 0 : n - 1); }
    else if (e.key === 'Escape') setSel(-1);
  }

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
        // What the app counted stays apart from what the visitor kept.
        machineResult: { reps: count, confidence: result.confidence ?? null },
        correctedResult: n !== count ? { reps: n } : null,
        // Rep details measured with step 3c's boundaries; older sets' details are not shown.
        repDetailsVersion: 2,
      });
      refreshSets();
      setStep('saved');
      warmReportPdf().catch(() => {}); // the report screen says so if it could not load
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
    // The replay shows where the tracking lost the body; under it, this screen is out of reach.
    return <div className="wv-experience" inert={covered ? true : undefined}>
      <section className="screen is-active result-screen"><div className="wrap">
        <Topbar fr={fr} onClose={onClose} onReplay={onReplay} replayRef={replayRef} />
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
  // Under the report, the result is out of reach of taps, the keyboard and screen readers.
  return <div className="wv-experience" ref={rootRef} inert={covered ? true : undefined}>
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} onReplay={onReplay} replayRef={replayRef} />
      <div className="res-head">
        <p className="eyebrow">{liftName}</p>
        <p className="res-meta">{seconds ? `${seconds} s · ${armLabel}` : armLabel}</p>
      </div>
      <span key={shown} className="numeral tick" aria-hidden="true">{shown}</span>
      <p className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (shown === 1 ? 'Rep' : 'Reps')}</p>
      <p className="sr" role="status">{asked ? (fr ? `${count} ${count > 1 ? 'répétitions comptées' : 'répétition comptée'}.` : `${count} ${count === 1 ? 'rep' : 'reps'} counted.`) : ''}</p>
      {count > 0 && <div ref={marksRef} className={`bars${sel >= 0 ? ' has-sel' : ''}`}
        {...(asked ? { role: 'group', tabIndex: 0, 'aria-label': fr ? 'Répétitions, une par marque' : 'Reps, one per mark', onClick: pick, onKeyDown: keys } : { 'aria-hidden': true })}>
        {reps.map((rep, i) => <div key={rep.index} className={`bar${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`} style={{ '--r': Math.max(0, rep.romDegrees || 0) / maxRom }}><i /></div>)}
      </div>}
      {count > 0 && <p className="res-detail" aria-live="polite">{detailHead && <span className="sr">{detailHead}</span>}{detail}</p>}

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
          <button ref={reportRef} className="btn-line press" onClick={() => onReport(trueN)}>
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
