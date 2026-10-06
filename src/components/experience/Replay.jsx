import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { liftDefinition } from '../../lib/counting/core';
import { decimal } from './report-sheet';
import { partialIn } from './tempo';
import { poseAt, repAt, phaseAt, into, keyedTime } from './replay-track';
import { drawSkeleton, litSides, trailPoints } from './replay-draw';
import { steadyFrames, trailAt } from './replay-smooth';
import { canExport, exportSetVideo, shareFailed } from './video-export';
import './Replay.css';
import { track } from '../../lib/events';
import { MEASURES_SHOWN, experimentalLabel } from './measures';
import { isCorrected, markLabel, provenance } from './replay-labels';
import { replayClock } from './replay-clock';

// The set replayed with the skeleton the pose model tracked on it: what the app saw,
// frame by frame, with the joint whose angle counts the reps in the lamp's colour.
// The video is read from the phone and sent nowhere. A set counted live has no video (file is null): the skeleton
// is replayed alone, on a clock that stands in for the video (replay-clock.js), and nothing offers a video to share.

export default function Replay({ file, result, lift, saved = null, leaving, onBack }) {
  const { lang } = useT(), fr = lang === 'fr';
  const videoRef = useRef(null), canvasRef = useRef(null), backRef = useRef(null), lineRef = useRef(null);
  const drag = useRef(null);
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [now, setNow] = useState(0);
  const [broken, setBroken] = useState(false);

  // A refused set shows no reps here either: the result said it could not count them.
  const times = result.timestamps || [], reps = (!result.refused && result.reps) || [];
  // The skeleton drawn is the model's, steadied for the eye once per set (replay-smooth.js); the count never reads it.
  const frames = useMemo(() => steadyFrames(result.imageLandmarks || [], times), [result]); // eslint-disable-line react-hooks/exhaustive-deps
  const def = liftDefinition(lift);
  const sides = litSides(def, result.arm);
  const meta = result.metadata || {};
  const fw = meta.width || meta.extractedWidth || 9, fh = meta.height || meta.extractedHeight || 16;
  const [length, setLength] = useState(meta.duration || times[times.length - 1] || 1);
  const liftName = exerciseName(lift, lang);
  // After a correction the marks are the app's detections, beside the count the user saved (replay-labels.js).
  const corrected = isCorrected(saved, result.count), note = provenance({ detected: result.count, saved, fr });
  // Without a video, the clock stands in for it from the first render, so the effects below find it in videoRef.
  const clock = useRef(null);
  if (!file && !clock.current) clock.current = replayClock(length, { width: fw, height: fh });
  if (!file) videoRef.current = clock.current;

  // Step 4: the video with its overlay, prepared on a first tap and shared on a second, since the share
  // sheet opens only inside a tap and the recording takes as long as the set.
  const [made, setMade] = useState({ state: 'idle', progress: 0, file: null, link: null });
  const abort = useRef(null);
  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (made.link) URL.revokeObjectURL(made.link); }, [made.link]);
  const exportable = !!file && !broken && !result.refused && canExport();
  function prepare() {
    videoRef.current?.pause();
    abort.current = new AbortController();
    setMade({ state: 'making', progress: 0, file: null, link: null });
    // Made from the video on screen, played from its start: the person watches the set as it is prepared.
    setSlow(false);
    exportSetVideo({ file, result, lift, fr, saved, screen: videoRef.current, signal: abort.current.signal, onProgress: p => setMade(m => (m.state === 'making' ? { ...m, progress: p } : m)) })
      .then(out => setMade({ state: 'ready', progress: 1, file: out, link: URL.createObjectURL(out) }))
      .catch(e => { if (e?.name !== 'AbortError') setMade({ state: 'failed', why: e?.message, progress: 0, file: null, link: null }); });
  }
  // A share that fails offers the video to save instead, and says so; one sheet at a time.
  const [shareBroke, setShareBroke] = useState(false);
  const sharing = useRef(false);
  const sharable = !shareBroke && made.file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [made.file] });
  function share() {
    if (sharing.current) return;
    sharing.current = true;
    track('share', { lift });
    navigator.share({ files: [made.file] })
      .catch(e => { if (shareFailed(e)) setShareBroke(true); })
      .finally(() => { sharing.current = false; });
  }

  // The file is read where it lies on the phone; its address lives as long as the screen.
  useEffect(() => {
    if (!file) return undefined;
    const address = URL.createObjectURL(file);
    setUrl(address);
    return () => URL.revokeObjectURL(address);
  }, [file]);
  // Focus goes to Back for the keyboard and screen readers, without painting the ring on a touch (#25).
  useEffect(() => { backRef.current?.focus({ preventScroll: true, focusVisible: false }); }, []);
  useEffect(() => { if (leaving) videoRef.current?.pause(); }, [leaving]);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1; }, [slow]);

  // The skeleton follows the frame on screen: redrawn with every video frame while the
  // video plays, and after every seek.
  useEffect(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return undefined;
    // The time of the frame on screen, as the browser reports it with each frame it shows;
    // fresh once a frame has been shown since the last seek began.
    let raf = 0, vfc = 0, alive = true, told = 0, shown = null, fresh = false;
    const draw = t => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1), W = Math.round(cw * dpr), H = Math.round(ch * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const lm = poseAt(frames, times, t);
      if (!lm) return;
      // The picture sits in its box as object-fit: contain places it.
      const vw = video.videoWidth || fw, vh = video.videoHeight || fh;
      const s = Math.min(cw / vw, ch / vh);
      const trails = trailPoints(def, sides).map(k => trailAt(frames, times, t, k, lm[k]));
      drawSkeleton(ctx, lm, { ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2, w: vw * s, h: vh * s }, sides, def, 1, trails);
    };
    // The screen's words follow the video about ten times a second, and at once when it stops.
    const tell = (t, force) => {
      const at = performance.now();
      if (force || at - told > 90) { told = at; setNow(t); }
    };
    const onFrame = (_, m) => {
      if (!alive) return;
      const t = m?.mediaTime ?? video.currentTime;
      shown = t; fresh = true;
      draw(t); tell(t);
      vfc = video.requestVideoFrameCallback(onFrame);
    };
    const loop = () => {
      if (!alive) return;
      if (!video.paused) { draw(video.currentTime); tell(video.currentTime); }
      raf = requestAnimationFrame(loop);
    };
    // After a seek or a pause, the body is drawn for the frame on screen, which can stand up to a
    // frame before the time asked for; until the browser reports that frame, the time asked for.
    const still = () => { const t = fresh && shown !== null ? shown : video.currentTime; draw(t); tell(t, true); };
    const seeking = () => { fresh = false; };
    const events = ['seeked', 'loadeddata', 'pause', 'ended'];
    events.forEach(e => video.addEventListener(e, still));
    video.addEventListener('seeking', seeking);
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(still) : null;
    if (resize) resize.observe(canvas); else window.addEventListener('resize', still);
    if ('requestVideoFrameCallback' in video) vfc = video.requestVideoFrameCallback(onFrame);
    else raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (vfc && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(vfc);
      events.forEach(e => video.removeEventListener(e, still));
      video.removeEventListener('seeking', seeking);
      if (resize) resize.disconnect(); else window.removeEventListener('resize', still);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock's events, as the <video> element's props would take them; declared after the drawing above, so its
  // listeners are in place when the clock says it is ready and goes to the first rep.
  useEffect(() => {
    const c = clock.current;
    if (file || !c) return undefined;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    c.addEventListener('play', on); c.addEventListener('pause', off); c.addEventListener('ended', off);
    c.loaded();
    seekTo(reps[0] ? into(reps[0]) : 0);
    return () => { c.removeEventListener('play', on); c.removeEventListener('pause', off); c.removeEventListener('ended', off); c.dispose(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (leaving) clock.current?.pause(); }, [leaving]);

  function play() {
    const video = videoRef.current;
    if (!video || broken) return;
    video.playbackRate = slow ? 0.5 : 1;
    video.play()?.catch(e => { if (e?.name === 'NotSupportedError') setBroken(true); });
  }
  function toggle() {
    const video = videoRef.current;
    // While the video is being prepared it plays for the recording: a tap would stop it.
    if (!video || made.state === 'making') return;
    if (video.paused || video.ended) play(); else video.pause();
  }
  function seekTo(t) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(length, t));
    setNow(video.currentTime);
  }

  // The line: a touch goes to the rep under the finger (or to that moment, between reps);
  // a drag moves through the video.
  const timeAt = x => { const r = lineRef.current.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * length; };
  function down(e) {
    if (broken) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, moved: false, wasPlaying: !videoRef.current.paused };
  }
  function move(e) {
    const d = drag.current;
    if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 6)) return;
    if (!d.moved) { d.moved = true; videoRef.current.pause(); }
    seekTo(timeAt(e.clientX));
  }
  function up(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) { if (d.wasPlaying) play(); return; }
    const t = timeAt(e.clientX);
    let hit = -1, gap = Infinity;
    reps.forEach((r, i) => {
      if (t < r.startTime - 0.3 || t > r.endTime + 0.3) return;
      const g = Math.abs(t - (r.startTime + r.endTime) / 2);
      if (g < gap) { gap = g; hit = i; }
    });
    seekTo(hit >= 0 ? into(reps[hit]) : t);
  }
  // The line's keys: a rep at a time, either arrow pair or Page Up / Down; Home and End (replay-track.js, keyedTime).
  function keys(e) {
    const t = keyedTime(e.key, reps, now, length);
    if (t === null) return;
    e.preventDefault();
    seekTo(t);
  }

  const NB = ' ', sec = x => `${decimal(x, fr)}${NB}s`;
  const current = repAt(reps, now);
  const begun = reps.filter(r => r.startTime <= now).length;
  // The phase word follows the unvalidated phase boundaries: hidden with the measures (measures.js).
  const phase = MEASURES_SHOWN && current >= 0 ? phaseAt(reps[current], now, def?.first) : null;
  let head = '', detail;
  if (current >= 0) {
    const r = reps[current];
    const word = corrected ? markLabel({ index: current + 1, total: reps.length, fr, corrected }) : `${fr ? 'Rép.' : 'Rep'} ${current + 1}`;
    const filmed = fr ? (corrected ? 'filmé en partie' : 'filmée en partie') : 'partly filmed';
    head = `${word} · `;
    // Without validated measures (measures.js), the rep's number alone.
    if (!MEASURES_SHOWN) { head = ''; detail = `${word}${r.clipped ? `${NB}· ${filmed}` : ''}`; }
    else detail = r.clipped
      ? `${Math.round(r.romDegrees)}°${NB}· ${filmed}`
      : partialIn(reps)(r)
      ? `${Math.round(r.romDegrees)}°${NB}· ${fr ? (corrected ? 'partiel, non chronométré' : 'partielle, non chronométrée') : 'partial, not timed'}`
      : `${sec(r.endTime - r.startTime)}${NB}· ${Math.round(r.romDegrees)}°${NB}· conc.${NB}${sec(r.concentricSec)}${NB}· ${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}`;
  } else {
    detail = reps.length
      ? (corrected
        ? (fr ? 'Touchez un repère sur la ligne pour le revoir.' : 'Touch a mark on the line to see it again.')
        : (fr ? 'Touchez une répétition sur la ligne pour la revoir.' : 'Touch a rep on the line to see it again.'))
      : result.refused
        ? (fr ? 'Cette série n’a pas pu être comptée.' : 'This set could not be counted.')
        : (fr ? 'Aucune répétition comptée dans cette vidéo.' : 'No rep counted in this video.');
  }
  const phaseWord = { concentric: fr ? 'Concentrique' : 'Concentric', eccentric: fr ? 'Excentrique' : 'Eccentric' }[phase] || NB;

  return <div className={`wv-experience${leaving ? ' is-leaving' : ''}`}>
    <section className="screen is-active replay-screen" aria-label={`${fr ? 'Revoir la série' : 'Replay of the set'} · ${liftName}`}><div className="wrap">
      <div className="topbar">
        <button ref={backRef} className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <div className="rp-stage" data-reveal style={{ '--i': 0 }}>
        <div className="rp-frame" style={{ '--ar': fw / fh }}>
          {file ? <video ref={videoRef} className="rp-video" src={url || undefined} playsInline muted preload="auto"
            aria-label={fr ? 'Votre série, avec le squelette suivi par l’app' : 'Your set, with the skeleton the app tracked'}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setBroken(true)}
            onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLength(d); seekTo(reps[0] ? into(reps[0]) : 0); }}
            onClick={toggle} />
            : <div className="rp-video rp-still" role="img" data-testid="rp-still" onClick={toggle}
              aria-label={fr ? 'Votre série comptée en direct, rejouée avec le squelette suivi par l’app' : 'Your set counted live, replayed with the skeleton the app tracked'} />}
          <canvas ref={canvasRef} className="rp-canvas" aria-hidden="true" />
          {reps.length > 0 && <div className={`rp-chip${phaseWord === NB ? ' is-idle' : ''}`} aria-hidden="true">
            <span className="rp-count"><span className="rp-n">{begun}</span><span className="rp-of">/{NB}{reps.length}</span></span>
            <span className="rp-phase">{phaseWord}</span>
          </div>}
          {broken && <p className="rp-broken" role="alert">{fr ? 'Cette vidéo ne se lit pas dans ce navigateur.' : 'This video does not play in this browser.'}</p>}
        </div>
      </div>
      <div ref={lineRef} className="rp-line" role="slider" tabIndex={0}
        aria-label={fr ? 'Position dans la vidéo' : 'Position in the video'}
        aria-valuemin={0} aria-valuemax={Math.round(length * 10) / 10} aria-valuenow={Math.round(now * 10) / 10}
        aria-valuetext={current >= 0 ? markLabel({ index: current + 1, total: reps.length, fr, corrected }) : sec(now)}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} onKeyDown={keys}>
        {reps.map((r, i) => {
          const from = Math.min(100, (r.startTime / length) * 100), to = Math.min(100, (r.endTime / length) * 100);
          return <span key={r.index ?? i} className={`rp-rep${i === current ? ' is-on' : ''}`} style={{ left: `${Math.min(from, 99.2)}%`, width: `${Math.max(0.8, to - from)}%` }} />;
        })}
        <i className="rp-now" style={{ left: `${Math.min(100, (now / length) * 100)}%` }} />
      </div>
      {note && <p className="rp-prov" data-testid="rp-prov">{note}</p>}
      <p className="rp-detail" aria-live={playing ? 'off' : 'polite'}>{head && <span className="sr">{head}</span>}{detail}</p>
      {MEASURES_SHOWN && reps.length > 0 && <p className="rp-prov" data-testid="rp-exp">{experimentalLabel(fr)}</p>}
      <div className="rp-controls" data-reveal style={{ '--i': 2 }}>
        <button className="btn-primary press rp-play" onClick={toggle} disabled={broken || made.state === 'making'}>
          {playing
            ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>}
          <span>{playing ? 'Pause' : (fr ? 'Lire' : 'Play')}</span>
        </button>
        <button className={`btn-ghost press rp-slow${slow ? ' is-on' : ''}`} aria-pressed={slow} disabled={broken || made.state === 'making'} onClick={() => setSlow(s => !s)}>{fr ? 'Ralenti' : 'Slow motion'}</button>
      </div>
      {exportable && <div className="rp-export">
        {(made.state === 'idle' || made.state === 'failed') && <button className="btn-line press" onClick={prepare}>{fr ? 'Préparer la vidéo à partager' : 'Prepare the video to share'}</button>}
        {made.state === 'making' && <button className="btn-line" disabled>{fr ? `Préparation de la vidéo… ${Math.round(made.progress * 100)} %` : `Preparing the video… ${Math.round(made.progress * 100)}%`}</button>}
        {made.state === 'ready' && (sharable
          ? <button className="btn-line press" onClick={share}>{fr ? 'Partager la vidéo' : 'Share the video'}</button>
          : <a className="btn-line press" href={made.link} download={made.file.name}>{fr ? 'Enregistrer la vidéo' : 'Save the video'}</a>)}
        {made.state === 'ready' && shareBroke && <p className="rp-export-note" role="status">{fr ? 'Le partage n’a pas abouti. Enregistrez la vidéo, puis partagez-la depuis vos fichiers.' : 'The share did not go through. Save the video, then share it from your files.'}</p>}
        {made.state === 'failed' && <p className="rp-export-note" role="alert">{made.why === 'interrupted' || made.why === 'stalled' || made.why === 'incomplete'
          ? (fr ? 'La préparation s’est arrêtée. Gardez l’écran allumé et l’app ouverte, puis réessayez.' : 'The preparation stopped. Keep the screen on and the app open, then try again.')
          : (fr ? 'La vidéo n’a pas pu être préparée sur ce téléphone.' : 'The video could not be prepared on this phone.')}</p>}
      </div>}
      <p className="rp-note" data-reveal style={{ '--i': 3 }}>{file
        ? (fr
          ? 'En doré, l’articulation dont l’angle compte les répétitions. La vidéo ne quitte votre téléphone que si vous la partagez.'
          : 'In gold, the joint whose angle counts the reps. The video leaves your phone only if you share it.')
        : (fr
          ? 'En doré, l’articulation dont l’angle compte les répétitions. Série comptée en direct\u00A0: aucune vidéo n’a été enregistrée, seul le squelette est rejoué.'
          : 'In gold, the joint whose angle counts the reps. Counted live: no video was recorded, only the skeleton is replayed.')}</p>
    </div></section>
  </div>;
}
