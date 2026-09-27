import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META } from './lift-scenes';
import { LIFTS, JOINT_POINTS } from '../../lib/counting/core';
import { decimal } from './report-sheet';
import { SEEN, poseAt, repAt, phaseAt } from './replay-track';
import './Replay.css';

// The set replayed with the skeleton the pose model tracked on it: what the app saw,
// frame by frame, with the joint whose angle counts the reps in the lamp's colour.
// The video is read from the phone and sent nowhere.

const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BONE = 'rgba(239, 232, 220, 0.85)', SHADE = 'rgba(8, 7, 6, 0.4)', LAMP = '#F7DCAE';

export default function Replay({ file, result, lift, leaving, onBack }) {
  const { lang, tExercise } = useT(), fr = lang === 'fr';
  const videoRef = useRef(null), canvasRef = useRef(null), backRef = useRef(null), lineRef = useRef(null);
  const drag = useRef(null);
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [now, setNow] = useState(0);
  const [broken, setBroken] = useState(false);

  // A refused set shows no reps here either: the result said it could not count them.
  const frames = result.imageLandmarks || [], times = result.timestamps || [], reps = (!result.refused && result.reps) || [];
  const def = LIFTS[lift];
  const sides = !def ? [] : result.arm === 'both' ? ['left', 'right'] : [result.arm === 'right' ? 'right' : 'left'];
  const meta = result.metadata || {};
  const fw = meta.width || meta.extractedWidth || 9, fh = meta.height || meta.extractedHeight || 16;
  const [length, setLength] = useState(meta.duration || times[times.length - 1] || 1);
  const liftName = META[lift]?.[lang] || tExercise(lift);

  // The file is read where it lies on the phone; its address lives as long as the screen.
  useEffect(() => {
    const address = URL.createObjectURL(file);
    setUrl(address);
    return () => URL.revokeObjectURL(address);
  }, [file]);
  useEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);
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
      const s = Math.min(cw / vw, ch / vh), ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
      const at = k => [ox + lm[k].x * vw * s, oy + lm[k].y * vh * s];
      const seen = k => lm[k] && lm[k].visibility >= SEEN;
      const line = (pts, width, colour) => {
        ctx.lineWidth = width; ctx.strokeStyle = colour;
        ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const bones = BONES.filter(([a, b]) => seen(a) && seen(b)).map(([a, b]) => [at(a), at(b)]);
      for (const b of bones) line(b, 4, SHADE);
      for (const b of bones) line(b, 2, BONE);
      ctx.fillStyle = BONE;
      for (const k of DOTS) if (seen(k)) { const [x, y] = at(k); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
      // The measured joint, lit. Its angle is not written on the picture: the core measures it
      // in 3D, and at the top of a curl filmed from the side the two can differ by tens of degrees.
      for (const side of sides) {
        const [a, v, b] = JOINT_POINTS[def.joint][side];
        if (!seen(a) || !seen(v) || !seen(b)) continue;
        const pts = [at(a), at(v), at(b)];
        line(pts, 6, SHADE);
        ctx.shadowColor = 'rgba(247, 220, 174, 0.75)'; ctx.shadowBlur = 10;
        line(pts, 3.5, LAMP);
        ctx.shadowBlur = 0;
        ctx.fillStyle = LAMP;
        ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 4.5, 0, Math.PI * 2); ctx.fill();
      }
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

  function play() {
    const video = videoRef.current;
    if (!video || broken) return;
    video.playbackRate = slow ? 0.5 : 1;
    video.play()?.catch(e => { if (e?.name === 'NotSupportedError') setBroken(true); });
  }
  function toggle() {
    const video = videoRef.current;
    if (!video) return;
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
    seekTo(hit >= 0 ? reps[hit].startTime : t);
  }
  function keys(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      const next = step > 0 ? reps.findIndex(r => r.startTime > now + 0.05) : reps.map(r => r.startTime < now - 0.05).lastIndexOf(true);
      seekTo(next >= 0 ? reps[next].startTime : step > 0 ? length : 0);
    } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); seekTo(e.key === 'Home' ? 0 : length); }
  }

  const NB = ' ', sec = x => `${decimal(x, fr)}${NB}s`;
  const current = repAt(reps, now);
  const begun = reps.filter(r => r.startTime <= now).length;
  const phase = current >= 0 ? phaseAt(reps[current], now, def?.first) : null;
  let head = '', detail;
  if (current >= 0) {
    const r = reps[current];
    head = `${fr ? 'Rép.' : 'Rep'} ${current + 1} · `;
    detail = r.clipped
      ? `${Math.round(r.romDegrees)}°${NB}· ${fr ? 'filmée en partie' : 'partly filmed'}`
      : `${sec(r.endTime - r.startTime)}${NB}· ${Math.round(r.romDegrees)}°${NB}· conc.${NB}${sec(r.concentricSec)}${NB}· ${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}`;
  } else {
    detail = reps.length
      ? (fr ? 'Touchez une répétition sur la ligne pour la revoir.' : 'Touch a rep on the line to see it again.')
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
      <div className="rp-stage">
        <div className="rp-frame" style={{ '--ar': fw / fh }}>
          <video ref={videoRef} className="rp-video" src={url || undefined} playsInline muted preload="auto"
            aria-label={fr ? 'Votre série, avec le squelette suivi par l’app' : 'Your set, with the skeleton the app tracked'}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setBroken(true)}
            onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLength(d); seekTo(reps[0]?.startTime ?? 0); }}
            onClick={toggle} />
          <canvas ref={canvasRef} className="rp-canvas" aria-hidden="true" />
          {reps.length > 0 && <div className="rp-chip" aria-hidden="true">
            <span className="rp-count"><span className="rp-n">{begun}</span><span className="rp-of">/{NB}{reps.length}</span></span>
            <span className="rp-phase">{phaseWord}</span>
          </div>}
          {broken && <p className="rp-broken" role="alert">{fr ? 'Cette vidéo ne se lit pas dans ce navigateur.' : 'This video does not play in this browser.'}</p>}
        </div>
      </div>
      <div ref={lineRef} className="rp-line" role="slider" tabIndex={0}
        aria-label={fr ? 'Position dans la vidéo' : 'Position in the video'}
        aria-valuemin={0} aria-valuemax={Math.round(length * 10) / 10} aria-valuenow={Math.round(now * 10) / 10}
        aria-valuetext={current >= 0 ? (fr ? `Répétition ${current + 1} sur ${reps.length}` : `Rep ${current + 1} of ${reps.length}`) : sec(now)}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} onKeyDown={keys}>
        {reps.map((r, i) => {
          const from = Math.min(100, (r.startTime / length) * 100), to = Math.min(100, (r.endTime / length) * 100);
          return <span key={r.index ?? i} className={`rp-rep${i === current ? ' is-on' : ''}`} style={{ left: `${Math.min(from, 99.2)}%`, width: `${Math.max(0.8, to - from)}%` }} />;
        })}
        <i className="rp-now" style={{ left: `${Math.min(100, (now / length) * 100)}%` }} />
      </div>
      <p className="rp-detail" aria-live={playing ? 'off' : 'polite'}>{head && <span className="sr">{head}</span>}{detail}</p>
      <div className="rp-controls">
        <button className="btn-primary press rp-play" onClick={toggle} disabled={broken}>
          {playing
            ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>}
          <span>{playing ? 'Pause' : (fr ? 'Lire' : 'Play')}</span>
        </button>
        <button className={`btn-ghost press rp-slow${slow ? ' is-on' : ''}`} aria-pressed={slow} disabled={broken} onClick={() => setSlow(s => !s)}>{fr ? 'Ralenti' : 'Slow motion'}</button>
      </div>
      <p className="rp-note">{fr
        ? 'En doré, l’articulation dont l’angle compte les répétitions. La vidéo ne quitte pas votre téléphone.'
        : 'In gold, the joint whose angle counts the reps. The video does not leave your phone.'}</p>
    </div></section>
  </div>;
}
