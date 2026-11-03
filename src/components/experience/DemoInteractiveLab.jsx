import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { loadDemoTelemetry, LAB_CLIPS, LEAD_LAB_CLIP } from './demo-telemetry-data';
import { poseAt, repAt, phaseAt, into, angleAt } from './replay-track';
import { drawSkeleton, litSides, trailPoints } from './replay-draw';
import { steadyFrames, trailAt } from './replay-smooth';
import { liftDefinition } from '../../lib/counting/core';
import { experimentalLabel } from './measures';
import { LAB, JOINT_OF, JOINT_NAME } from './lab-copy';
import { labFacts, decimal } from './lab-facts';
import MovementOptimizationCard from './MovementOptimizationCard';
import './DemoInteractiveLab.css';
import './Replay.css';

const NB = '\u00A0';
const REDUCED = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The landing lab: one real set, played with the skeleton the app tracked, the count the app gave beside the count David
 * made, and three plain facts. Everything drawn or written comes from the set's own telemetry (scripts/make-demo-telemetry.mjs,
 * through the app's counting path): the joint angle is read from the angles at the video's time, not typed, and when the
 * telemetry cannot load the video plays alone (R8). The deeper analysis sits behind one tap, under the experimental label.
 */
export default function DemoInteractiveLab({ clip = LEAD_LAB_CLIP, onClose, onStart, initialTelemetry = null }) {
  const { lang } = useT();
  const fr = lang !== 'en';
  const c = LAB[fr ? 'fr' : 'en'];
  const cfg = LAB_CLIPS[clip] || LAB_CLIPS[LEAD_LAB_CLIP];
  const L = fr ? 'fr' : 'en';

  const [data, setData] = useState(initialTelemetry || null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [now, setNow] = useState(0);
  const [length, setLength] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lineRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (initialTelemetry) {
      setData(initialTelemetry);
      return undefined;
    }
    let active = true;
    loadDemoTelemetry(cfg.id).then(t => {
      if (!active) return;
      if (t) setData(t); else setFailed(true);
    });
    return () => { active = false; };
  }, [cfg.id, initialTelemetry]);

  const videoBase = `${import.meta.env.BASE_URL}demo/${cfg.id}`;
  const duration = length || data?.metadata?.duration || 0;
  const fw = cfg.width, fh = cfg.height;

  const def = useMemo(() => liftDefinition(cfg.lift), [cfg.lift]);
  const sides = useMemo(() => litSides(def, data?.arm), [def, data]);
  const frames = useMemo(() => (data ? steadyFrames(data.imageLandmarks || [], data.timestamps || []) : []), [data]);
  const facts = useMemo(() => labFacts(data?.reps || []), [data]);

  const reps = data?.reps || [];
  const currentRep = repAt(reps, now);
  const begunCount = reps.filter(r => r.startTime <= now).length;

  let phaseWord = '';
  if (currentRep >= 0) {
    const p = phaseAt(reps[currentRep], now, def?.first ?? 'concentric');
    phaseWord = p === 'concentric' ? c.effort : p === 'eccentric' ? c.back_phase : '';
  }
  // The chip's angle is the one the count reads, at the video's time, named by its joint (Replay.jsx does the same).
  const angle = data ? angleAt(data.angles, data.timestamps, now) : null;
  const jointName = JOINT_NAME[def?.joint]?.[L] ?? null;

  // Draw the skeleton over the video, at the frame on screen.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !data) return undefined;

    let raf = 0;
    let vfc = 0;
    let alive = true;

    const draw = t => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cw * dpr);
      const H = Math.round(ch * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const lm = poseAt(frames, data.timestamps, t);
      if (!lm) return;

      const vw = video.videoWidth || fw;
      const vh = video.videoHeight || fh;
      const s = Math.min(cw / vw, ch / vh);
      const trails = trailPoints(def, sides).map(k => trailAt(frames, data.timestamps, t, k, lm[k]));
      drawSkeleton(ctx, lm, { ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2, w: vw * s, h: vh * s }, sides, def, 1, trails);
    };

    const onFrame = (_, m) => {
      if (!alive) return;
      const t = m?.mediaTime ?? video.currentTime;
      setNow(t);
      draw(t);
      vfc = video.requestVideoFrameCallback(onFrame);
    };

    const loop = () => {
      if (!alive) return;
      if (!video.paused) {
        setNow(video.currentTime);
        draw(video.currentTime);
      }
      raf = requestAnimationFrame(loop);
    };

    const still = () => {
      draw(video.currentTime);
      setNow(video.currentTime);
    };

    ['seeked', 'loadeddata', 'pause', 'ended'].forEach(e => video.addEventListener(e, still));

    if ('requestVideoFrameCallback' in video) {
      vfc = video.requestVideoFrameCallback(onFrame);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (vfc && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(vfc);
      ['seeked', 'loadeddata', 'pause', 'ended'].forEach(e => video.removeEventListener(e, still));
    };
  }, [frames, data, def, sides, fw, fh]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1;
  }, [slow]);

  function play() {
    videoRef.current?.play()?.catch(() => {});
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) play();
    else video.pause();
  }

  function seekTo(t) {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(duration || t, t));
    video.currentTime = clamped;
    setNow(clamped);
  }

  const timeAt = x => {
    const r = lineRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * duration;
  };

  function down(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, moved: false, wasPlaying: !videoRef.current?.paused };
  }

  function move(e) {
    const d = dragRef.current;
    if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 6)) return;
    if (!d.moved) {
      d.moved = true;
      videoRef.current?.pause();
    }
    seekTo(timeAt(e.clientX));
  }

  function up(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      if (d.wasPlaying) play();
      return;
    }
    const t = timeAt(e.clientX);
    let hit = -1;
    let gap = Infinity;
    reps.forEach((r, i) => {
      if (t < r.startTime - 0.3 || t > r.endTime + 0.3) return;
      const g = Math.abs(t - (r.startTime + r.endTime) / 2);
      if (g < gap) {
        gap = g;
        hit = i;
      }
    });
    seekTo(hit >= 0 ? into(reps[hit]) : t);
  }

  // The keyboard moves the line a second at a time, as a slider does.
  function keys(e) {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    seekTo((videoRef.current?.currentTime ?? 0) + step);
  }

  const showFacts = data && facts.reps > 0;

  return (
    <div className="wv-experience demo-lab-experience" data-testid="demo-interactive-lab">
      <section className="screen is-active demo-lab-screen" aria-label={c.title}>
        <div className="wrap demo-lab-wrap">
          <div className="topbar demo-lab-topbar">
            <button type="button" className="icon-btn press" onClick={onClose} aria-label={c.back}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span className="pill demo-lab-badge">{c.badge(cfg.name[L])}</span>
          </div>

          <p className="eyebrow demo-lab-eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h2 className="demo-lab-title" data-reveal style={{ '--i': 1 }}>{c.title}</h2>
          <p className="demo-lab-sub" data-reveal style={{ '--i': 2 }}>{c.sub(cfg.name[L], cfg.place[L], JOINT_OF[def?.joint]?.[L] ?? '')}</p>

          <div className="demo-lab-stage" data-reveal style={{ '--i': 3 }}>
            <div className="demo-lab-frame" style={{ '--ar': fw / fh }}>
              <video
                ref={videoRef}
                className="rp-video"
                src={`${videoBase}.mp4`}
                poster={`${videoBase}.jpg`}
                playsInline
                muted
                loop
                autoPlay={!REDUCED()}
                preload="auto"
                aria-label={c.videoLabel}
                onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLength(d); }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onClick={toggle}
              />
              <canvas ref={canvasRef} className="rp-canvas" aria-hidden="true" />

              {data && (
                <div className={`rp-chip${phaseWord ? '' : ' is-idle'}`} aria-hidden="true">
                  <span className="rp-count">
                    <span className="rp-n">{begunCount}</span>
                    <span className="rp-of">/{NB}{data.count}</span>
                  </span>
                  {phaseWord && <span className="rp-phase">{phaseWord}</span>}
                  {angle !== null && jointName && <span className="rp-angle" data-testid="lab-angle">{jointName}{NB}{Math.round(angle)}°</span>}
                </div>
              )}
            </div>
          </div>

          {data && <p className="demo-lab-verdict" data-testid="lab-verdict">{c.verdict(data.count, data.label)}</p>}
          {failed && <p className="demo-lab-hint" role="status">{c.plain}</p>}

          {data && (
            <div
              ref={lineRef}
              className="rp-line demo-lab-line"
              role="slider"
              tabIndex={0}
              aria-label={c.timeline}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration * 10) / 10}
              aria-valuenow={Math.round(now * 10) / 10}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => { dragRef.current = null; }}
              onKeyDown={keys}
            >
              {reps.map((r, i) => {
                const from = duration ? Math.min(100, (r.startTime / duration) * 100) : 0;
                const to = duration ? Math.min(100, (r.endTime / duration) * 100) : 0;
                return (
                  <span
                    key={r.index ?? i}
                    className={`rp-rep${i === currentRep ? ' is-on' : ''}`}
                    style={{ left: `${Math.min(from, 99.2)}%`, width: `${Math.max(0.8, to - from)}%` }}
                  />
                );
              })}
              <i className="rp-now" style={{ left: `${duration ? Math.min(100, (now / duration) * 100) : 0}%` }} />
            </div>
          )}
          {data && <p className="demo-lab-hint">{c.hint}</p>}

          <div className="rp-controls demo-lab-controls" data-reveal style={{ '--i': 4 }}>
            <button type="button" className="btn-primary press rp-play" onClick={toggle}>
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" />
                </svg>
              )}
              <span>{playing ? c.pause : c.play}</span>
            </button>
            <button type="button" className={`btn-ghost press rp-slow${slow ? ' is-on' : ''}`} aria-pressed={slow} onClick={() => setSlow(s => !s)}>
              {c.slow}
            </button>
          </div>

          {showFacts && (
            <section className="demo-lab-facts" aria-label={c.factsLabel} data-reveal style={{ '--i': 5 }}>
              <h3 className="section-head">{c.factsLabel}</h3>
              <dl className="demo-lab-fact-row">
                <div className="demo-lab-fact">
                  <dd data-testid="lab-fact-reps">{facts.reps}</dd>
                  <dt>{c.reps}</dt>
                </div>
                {facts.romDeg !== null && (
                  <div className="demo-lab-fact">
                    <dd data-testid="lab-fact-rom">{facts.romDeg}°</dd>
                    <dt>{c.rom}</dt>
                  </div>
                )}
                {facts.repSec !== null && (
                  <div className="demo-lab-fact">
                    <dd data-testid="lab-fact-pace">{decimal(facts.repSec, fr)}{NB}{c.seconds}</dd>
                    <dt>{c.pace}</dt>
                  </div>
                )}
              </dl>
              <p className="demo-lab-caveat">{c.caveat}</p>
              <p className="demo-lab-experimental">{experimentalLabel(fr)}</p>
            </section>
          )}

          {data && (
            <details className="demo-lab-coach" data-reveal style={{ '--i': 6 }}>
              <summary className="press">
                <span>{c.coach}</span>
                <small>{c.coachSub}</small>
              </summary>
              <div className="demo-lab-analysis">
                <MovementOptimizationCard reps={reps} lift={cfg.lift} fr={fr} result={{ angles: data.angles, timestamps: data.timestamps }} />
              </div>
            </details>
          )}

          <div className="actions demo-lab-actions" data-reveal style={{ '--i': 7 }}>
            <button type="button" className="btn-primary press demo-lab-start-btn" onClick={onStart}>
              {c.start}
            </button>
            <button type="button" className="btn-ghost press" onClick={() => { seekTo(0); play(); }}>
              {c.again}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
