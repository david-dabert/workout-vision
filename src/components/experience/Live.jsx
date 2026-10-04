import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { liftDefinition } from '../../lib/counting/core';
import { createLiveEngine, SLOW_MS } from '../../lib/liveEngine';
import { openCamera, closeCamera, cameraProblem, canOpenCamera } from '../../lib/liveCamera';
import { voiceWanted, setVoiceWanted, canSpeak, unlockSpeech, say, buzz, hush } from '../../lib/liveVoice';
import { holdScreenAwake } from '../../lib/interruption';
import { drawSkeleton, litSides } from './replay-draw';
import './Live.css';

/** The countdown before a live set, in seconds: time to step back from the phone. Status: convention (UNSOURCED). */
export const COUNTDOWN_SEC = 3;
// Samples of the preview before its speed is judged (liveEngine.js, SLOW_MS). Status: convention.
const SPEED_SAMPLES = 8;
const REDUCED = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The words of a camera that did not open, by cause (liveEngine.js, cameraProblem).
function problemWords(cause, fr) {
  switch (cause) {
    case 'denied': return [fr ? 'Accès à la caméra refusé.' : 'Camera access denied.',
      fr ? 'Autorisez la caméra pour ce site dans les réglages de Safari, ou filmez votre série.' : 'Allow the camera for this site in Safari’s settings, or record your set.'];
    case 'nocamera': return [fr ? 'Aucune caméra trouvée.' : 'No camera found.',
      fr ? 'Filmez votre série ou choisissez une vidéo.' : 'Record your set or choose a video.'];
    case 'unsupported': return [fr ? 'Ce navigateur ne donne pas accès à la caméra en direct.' : 'This browser does not give live access to the camera.',
      fr ? 'Filmez votre série : l’analyse se fera juste après.' : 'Record your set: it is analysed right after.'];
    case 'slow': return [fr ? 'Ce téléphone ne suit pas le direct.' : 'This phone cannot keep up live.',
      fr ? 'Nous n’affichons pas un compte avec des trous. Filmez votre série : l’analyse se fera juste après.' : 'We do not show a count with gaps in it. Record your set: it is analysed right after.'];
    case 'failed': return [fr ? 'Le comptage en direct n’a pas pu démarrer.' : 'Live counting could not start.',
      fr ? 'Rechargez la page, ou filmez votre série.' : 'Reload the page, or record your set.'];
    default: return [fr ? 'La caméra n’a pas pu s’ouvrir.' : 'The camera could not open.',
      fr ? 'Elle sert peut-être à une autre app. Fermez-la, puis réessayez.' : 'Another app may be using it. Close it, then try again.'];
  }
}

/**
 * The live set: the camera's picture with the framing guide, a countdown, the count as it grows, and the set's end.
 * onDone(result, shown): the set counted as the recorded path counts a video, and the last count shown live.
 * onRecord: back to the Film screen to record instead. onStart: a set started (for the usage counts).
 */
export default function Live({ lift, onBack, onDone, onRecord, onStart = () => {} }) {
  const { lang } = useT(), fr = lang === 'fr';
  const videoRef = useRef(null), canvasRef = useRef(null), stopRef = useRef(null);
  const engine = useRef(null), stream = useRef(null), wake = useRef(null), timers = useRef([]);
  const [facing, setFacing] = useState('environment');
  const [cameraOn, setCameraOn] = useState(0); // bumped to open the camera again
  const [state, setState] = useState('opening'); // opening | loading | ready | countdown | running | paused | finishing | problem
  const [problem, setProblem] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [body, setBody] = useState(false);
  const [slow, setSlow] = useState(false);
  const [left, setLeft] = useState(COUNTDOWN_SEC);
  const [live, setLive] = useState({ count: null, inView: true });
  const [pulse, setPulse] = useState(0);
  const [voice, setVoice] = useState(voiceWanted);
  const [speaks, setSpeaks] = useState(() => canSpeak(lang));
  const stateRef = useRef(state); stateRef.current = state;
  const shown = useRef(null), previews = useRef(0);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const startRef = useRef(onStart); startRef.current = onStart;
  const voiceRef = useRef(voice); voiceRef.current = voice;
  const def = liftDefinition(lift);
  const wholeBody = ['knee', 'hip'].includes(def?.joint);
  // The framing step of the Film screen, word for word: the hint whenever the person is not in view.
  const framing = wholeBody ? (fr ? 'Le corps entier dans le cadre, pieds compris.' : 'Your whole body in the frame, feet included.') : (fr ? 'Au moins de la tête aux hanches dans le cadre, mains comprises.' : 'At least head to hips in the frame, hands included.');

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const release = () => { wake.current?.(); wake.current = null; };
  // The camera off, as leaving the screen turns it off: once a set is over or live counting has given up.
  const stopCamera = () => { closeCamera(stream.current); stream.current = null; };
  // Live counting given up (a phone too slow, a model or worker that failed, a frozen picture): the camera and the
  // screen's wake lock are let go at once, not when the screen is left. The first cause is the one shown: a worker
  // that times out after the phone was found too slow does not change the words.
  const giveUp = cause => { release(); stopCamera(); setProblem(p => p ?? cause); setState('problem'); };

  // The phone's voices may arrive after the first render.
  useEffect(() => {
    const synth = globalThis.speechSynthesis;
    const update = () => setSpeaks(canSpeak(lang));
    update();
    synth?.addEventListener?.('voiceschanged', update);
    return () => synth?.removeEventListener?.('voiceschanged', update);
  }, [lang]);

  // The engine and the pose model, once for the screen.
  useEffect(() => {
    // The side a one-arm set is counted on is known only once it is counted (core.ts): both are lit live.
    const sides = litSides(def, 'both');
    const draw = (lm, w, h) => {
      const canvas = canvasRef.current, video = videoRef.current;
      if (!canvas || !video) return;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(cw * dpr), H = Math.round(ch * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (!lm) return;
      // The picture fills its box as object-fit: cover places it.
      const s = Math.max(cw / w, ch / h);
      drawSkeleton(ctx, lm, { ox: (cw - w * s) / 2, oy: (ch - h * s) / 2, w: w * s, h: h * s }, sides, def);
    };
    const e = createLiveEngine({
      lift, video: videoRef.current,
      onPose: draw,
      onPreview: ({ body: b, ms }) => { setBody(b); previews.current += 1; if (previews.current >= SPEED_SAMPLES) setSlow(ms > SLOW_MS); },
      onCount: c => { setLive(c); if (c.count !== null) shown.current = c.count; },
      onRep: n => {
        buzz();
        if (voiceRef.current) say(n, lang);
        if (!REDUCED()) setPulse(p => p + 1);
      },
      onSlow: () => giveUp('slow'),
      onFull: () => finish(),
      onError: err => { console.error('[live]', err); giveUp('failed'); },
    });
    engine.current = e;
    // false: the screen was left while the model loaded, our own close; nothing to say (liveEngine.js, load).
    e.load().then(ok => { if (ok) setModelReady(true); }, err => { console.error('[live] model', err); giveUp('failed'); });
    return () => { e.dispose(); engine.current = null; clearTimers(); release(); hush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The camera: opened on arrival, on a switch of camera and on coming back to the page; closed on leaving.
  useEffect(() => {
    if (!canOpenCamera()) { setProblem('unsupported'); setState('problem'); return undefined; }
    let gone = false;
    const video = videoRef.current;
    if (['opening', 'loading', 'ready'].includes(stateRef.current)) setState('opening');
    openCamera(facing).then(s => {
      if (gone) { closeCamera(s); return; }
      // Live counting gave up while the camera was opening (the model failed to load): it is not left on.
      if (stateRef.current === 'problem') { closeCamera(s); return; }
      stream.current = s;
      if (video) { video.srcObject = s; video.play()?.catch(() => {}); }
      setState(st => (st === 'opening' ? 'loading' : st));
    }, err => {
      if (gone) return;
      setProblem(cameraProblem(err)); setState('problem');
    });
    return () => { gone = true; closeCamera(stream.current); stream.current = null; if (video) video.srcObject = null; };
  }, [facing, cameraOn]);

  // Camera and model both ready: the preview runs.
  useEffect(() => {
    if (state === 'loading' && modelReady) { engine.current?.preview(); setState('ready'); }
  }, [state, modelReady]);

  // The page hidden (screen locked, app left): the camera closes; a set in progress pauses, a countdown stops.
  useEffect(() => {
    const hidden = () => {
      const st = stateRef.current;
      if (st === 'running') { engine.current?.pause(); setState('paused'); }
      else if (st === 'countdown') { clearTimers(); engine.current?.preview(); setState('ready'); }
      release();
      closeCamera(stream.current); stream.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hidden();
      else if (['ready', 'paused', 'loading', 'opening'].includes(stateRef.current)) setCameraOn(n => n + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hidden);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', hidden); };
  }, []);

  function start() {
    if (voiceRef.current) unlockSpeech(lang);
    shown.current = null;
    setLive({ count: null, inView: true });
    wake.current = holdScreenAwake();
    setState('countdown');
    setLeft(COUNTDOWN_SEC);
    for (let k = 1; k <= COUNTDOWN_SEC; k++) {
      later(() => {
        const rest = COUNTDOWN_SEC - k;
        setLeft(rest);
        buzz();
        if (rest === 0) {
          if (voiceRef.current) say(fr ? 'C’est parti !' : 'Go!', lang);
          engine.current?.startSet();
          startRef.current();
          setState('running');
          // Focus follows to the button that ends the set, for the keyboard and VoiceOver.
          later(() => stopRef.current?.focus({ preventScroll: true, focusVisible: false }), 0);
        }
      }, k * 1000);
    }
  }

  async function finish() {
    if (!['running', 'paused'].includes(stateRef.current) && engine.current?.mode !== 'draining') return;
    setState('finishing');
    release();
    let result;
    try {
      result = await engine.current?.stopSet();
    } catch (err) {
      // A camera picture that stood still (liveCounter.js, finish): no count, as a video read frozen gets none. The
      // words of a phone that cannot keep up live hold for it (the set was sampled at under half the 15 Hz), so no
      // new copy. Anything else is a failure of live counting.
      console.error('[live] final count', err);
      hush();
      giveUp(err?.name === 'FrozenSkeletonsError' ? 'slow' : 'failed');
      return;
    }
    hush();
    if (!result) { engine.current?.preview(); setState('ready'); return; }
    stopCamera();
    doneRef.current(result, shown.current);
  }

  function again() {
    engine.current?.preview();
    setState('ready');
  }

  function toggleVoice() {
    const on = !voice;
    setVoice(on); setVoiceWanted(on);
    if (on) unlockSpeech(lang); else hush();
  }

  const name = exerciseName(lift, lang);
  const settingUp = ['opening', 'loading', 'ready'].includes(state);
  const counting = state === 'running';
  const [problemTitle, problemText] = state === 'problem' ? problemWords(problem, fr) : [];
  // No number before the first rep: a 0 on screen would claim the app measured none (R8, as Result.jsx, unsure).
  const showNumber = counting && live.count !== null && live.count > 0;
  const one = live.count === 1;

  return <div className="wv-experience">
    <section className={`screen is-active live-screen${facing === 'user' ? ' is-mirrored' : ''}`} aria-label={`${fr ? 'Compter en direct' : 'Count live'} · ${name}`}><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={() => { if (counting) engine.current?.pause(); onBack(counting); }} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill live-pill"><i className="live-dot" aria-hidden="true" />{fr ? 'En direct' : 'Live'}</span>
        <div className="live-tools">
          {speaks && <button className={`icon-btn press live-voice${voice ? ' is-on' : ''}`} aria-pressed={voice} onClick={toggleVoice}
            aria-label={fr ? 'Annoncer les répétitions à voix haute' : 'Say each rep out loud'} data-testid="live-voice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" />{voice ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
          </button>}
          <button className="icon-btn press" onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))} disabled={!settingUp}
            aria-label={facing === 'environment' ? (fr ? 'Passer à la caméra avant' : 'Switch to the front camera') : (fr ? 'Passer à la caméra arrière' : 'Switch to the rear camera')} data-testid="live-flip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7h-3l-2-2H9L7 7H4v12h16z" /><path d="M9.5 12.5a3 3 0 0 1 5-1.5M14.5 14.5a3 3 0 0 1-5 1.5" /><path d="M14.5 9.5V11H13M9.5 17.5V16H11" /></svg>
          </button>
        </div>
      </div>
      <p className="eyebrow live-name">{name}</p>

      <div className="live-stage">
        <div className="live-frame">
          <video ref={videoRef} className="live-video" playsInline muted autoPlay aria-hidden="true" />
          <canvas ref={canvasRef} className="live-canvas" aria-hidden="true" />
          <svg className="corners" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 9V0h9M91 0h9v9M100 91v9h-9M9 100H0v-9" fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="live-over">
            {state === 'opening' && <p className="live-hint" role="status">{fr ? 'Ouverture de la caméra…' : 'Opening the camera…'}</p>}
            {state === 'loading' && <p className="live-hint" role="status">{fr ? 'Préparation…' : 'Getting ready…'}</p>}
            {state === 'ready' && <p className="live-hint" role="status" data-testid="live-hint">{body
              ? (fr ? 'On vous voit. Touchez Démarrer, puis mettez-vous en place.' : 'You are in view. Tap Start, then get into position.')
              : framing}</p>}
            {state === 'countdown' && <div className="live-countdown" role="timer" aria-live="assertive">
              <span className="live-cd numeral" key={left}>{left}</span>
              <span className="live-sub">{fr ? 'Mettez-vous en place' : 'Get into position'}</span>
            </div>}
            {counting && (showNumber
              ? <div className="live-count" data-testid="live-count">
                <span className={`numeral live-n${pulse ? ' is-pulse' : ''}`} key={pulse}>{live.count}</span>
                <span className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (one ? 'Rep' : 'Reps')}</span>
                <span className="live-sub">{fr ? 'Compte provisoire' : 'Provisional count'}</span>
              </div>
              : <div className="live-away" data-testid="live-hint">
                <p className="live-hint-title">{live.inView ? (fr ? 'C’est parti' : 'Go') : (fr ? 'Revenez dans le cadre' : 'Step back into the frame')}</p>
                <p className="live-hint">{live.inView ? (fr ? 'Le compte s’affiche à la première répétition.' : 'The count appears at the first rep.') : framing}</p>
              </div>)}
            {state === 'paused' && <div className="live-away" role="status">
              <p className="live-hint-title">{fr ? 'Série en pause' : 'Set paused'}</p>
              <p className="live-hint">{fr ? 'Vous avez quitté l’écran : rien n’a été compté pendant ce temps.' : 'You left the screen: nothing was counted meanwhile.'}</p>
            </div>}
            {state === 'finishing' && <p className="live-hint" role="status">{fr ? 'Compte final…' : 'Final count…'}</p>}
          </div>
          {/* The count for VoiceOver, once per change, without the visual pulse. */}
          <p className="sr" aria-live="polite">{showNumber ? `${live.count}` : ''}</p>
        </div>
      </div>

      {state === 'problem'
        ? <div className="live-problem" role="alert" data-testid="live-problem">
          <h2 className="title refused-title">{problemTitle}</h2>
          <p className="body-text">{problemText}</p>
          <div className="actions">
            <button className="btn-primary press" onClick={onRecord}>{fr ? 'Filmer ma série' : 'Record my set'}</button>
            {(problem === 'denied' || problem === 'busy') && <button className="btn-ghost press" onClick={() => { setProblem(null); setState('opening'); setCameraOn(n => n + 1); }}>{fr ? 'Réessayer' : 'Try again'}</button>}
            {problem === 'failed' && <button className="btn-ghost press" onClick={() => window.location.reload()}>{fr ? 'Recharger la page' : 'Reload the page'}</button>}
          </div>
        </div>
        : <div className="actions live-actions">
          {settingUp && <button className="btn-primary press tactile" onClick={start} disabled={state !== 'ready'} data-testid="live-start">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>
            <span>{fr ? 'Démarrer' : 'Start'}</span>
          </button>}
          {state === 'countdown' && <button className="btn-ghost press" onClick={() => { clearTimers(); release(); engine.current?.preview(); setState('ready'); }}>{fr ? 'Annuler' : 'Cancel'}</button>}
          {counting && <button ref={stopRef} className="btn-primary press live-stop" onClick={finish} data-testid="live-stop">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            <span>{fr ? 'Terminer la série' : 'End the set'}</span>
          </button>}
          {state === 'paused' && <>
            <button className="btn-primary press" onClick={finish} data-testid="live-finish">{fr ? 'Voir le compte' : 'See the count'}</button>
            <button className="btn-ghost press" onClick={again}>{fr ? 'Recommencer la série' : 'Start the set again'}</button>
          </>}
          {state === 'ready' && slow && <p className="live-note" data-testid="live-slow">{fr
            ? 'Ce téléphone analyse lentement : le direct risque de s’arrêter. Filmer la série reste plus sûr.'
            : 'This phone analyses slowly: live counting may stop. Recording the set is safer.'}</p>}
        </div>}
      <p className="privacy live-privacy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        {/* The Film screen's live line, word for word (Film.jsx): only the camera's picture is said to stay. */}
        <span>{fr ? 'L’image de la caméra reste sur votre téléphone\u00A0: elle n’est ni enregistrée ni envoyée.' : 'The camera’s picture stays on your phone: it is neither recorded nor sent.'}</span>
      </p>
    </div></section>
  </div>;
}
