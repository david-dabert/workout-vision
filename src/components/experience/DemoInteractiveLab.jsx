import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { loadDemoTelemetry, FALLBACK_DEMO_TELEMETRY } from './demo-telemetry-data';
import { poseAt, repAt, phaseAt, into } from './replay-track';
import { drawSkeleton, litSides, trailPoints } from './replay-draw';
import { steadyFrames, trailAt } from './replay-smooth';
import { liftDefinition } from '../../lib/counting/core';
import MovementOptimizationCard from './MovementOptimizationCard';
import './DemoInteractiveLab.css';
import './Replay.css';

const COPY = {
  fr: {
    back: 'Retour',
    tag: 'Laboratoire Biomécanique',
    badge: 'Démo Interactive · Squat Olympique',
    title: 'Analyse biomécanique complète',
    sub: 'Série réelle filmée chez Basic-Fit. Suivi articulaire 3D, puissance concentrique en Watts, points critiques de blocage et dynamique de trajectoire axiale.',
    play: 'Lire',
    pause: 'Pause',
    slow: 'Ralenti',
    revoir: 'Revoir depuis le début',
    start: 'Commencer ma propre série',
    sticking: 'Point critique de blocage',
    concentric: 'Propulsion',
    eccentric: 'Descente contrôlée',
    knee: 'Genou',
    rep: 'Rép.',
    scrubHint: 'Glissez sur la ligne temporelle pour inspecter les points de blocage.',
  },
  en: {
    back: 'Back',
    tag: 'Biomechanics Laboratory',
    badge: 'Interactive Demo · Olympic Squat',
    title: 'Full Biomechanical Analysis',
    sub: 'Real set filmed at Basic-Fit. 3D joint tracking, concentric power in Watts, critical sticking points, and axial trajectory dynamics.',
    play: 'Play',
    pause: 'Pause',
    slow: 'Slow motion',
    revoir: 'Watch from start',
    start: 'Start my own set',
    sticking: 'Critical sticking point',
    concentric: 'Concentric drive',
    eccentric: 'Controlled descent',
    knee: 'Knee',
    rep: 'Rep',
    scrubHint: 'Drag across the timeline to inspect sticking points.',
  },
};

export default function DemoInteractiveLab({ onClose, onStart }) {
  const { lang } = useT();
  const fr = lang !== 'en';
  const c = COPY[fr ? 'fr' : 'en'];

  const [data, setData] = useState(FALLBACK_DEMO_TELEMETRY);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [now, setNow] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lineRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadDemoTelemetry().then(t => {
      if (active && t) setData(t);
    });
    return () => { active = false; };
  }, []);

  const videoBase = `${import.meta.env.BASE_URL}demo/bodyweight-squat-9`;
  const duration = data.metadata?.duration || 26.92;
  const fw = data.metadata?.width || 360;
  const fh = data.metadata?.height || 640;

  const def = liftDefinition('squat');
  const sides = litSides(def, null);
  const frames = steadyFrames ? steadyFrames(data.imageLandmarks || [], data.timestamps || []) : (data.imageLandmarks || []);

  const stickingPoints = data.biomechanicsFr?.stickingPoints || [];
  const activeSticking = stickingPoints.find(sp => Math.abs(sp.timestamp - now) <= 0.45);

  const currentRep = repAt(data.reps || [], now);
  const begunCount = (data.reps || []).filter(r => r.startTime <= now).length;

  let phaseWord = '';
  if (activeSticking) {
    phaseWord = c.sticking;
  } else if (currentRep >= 0) {
    const p = phaseAt(data.reps[currentRep], now, 'eccentric');
    phaseWord = p === 'concentric' ? c.concentric : p === 'eccentric' ? c.eccentric : '';
  }

  // Draw overlay skeleton
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

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
  }, [frames, data.timestamps, def, sides, fw, fh]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = slow ? 0.5 : 1;
    }
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
    const clamped = Math.max(0, Math.min(duration, t));
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
    const t = timeAt(e.clientX);
    seekTo(t);
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
    (data.reps || []).forEach((r, i) => {
      if (t < r.startTime - 0.3 || t > r.endTime + 0.3) return;
      const g = Math.abs(t - (r.startTime + r.endTime) / 2);
      if (g < gap) {
        gap = g;
        hit = i;
      }
    });
    seekTo(hit >= 0 ? into(data.reps[hit]) : t);
  }

  return (
    <div className="wv-experience demo-lab-experience" data-testid="demo-interactive-lab">
      <section className="screen is-active demo-lab-screen" aria-label={c.title}>
        <div className="wrap demo-lab-wrap">
          {/* Top navigation */}
          <div className="topbar demo-lab-topbar">
            <button type="button" className="icon-btn press" onClick={onClose} aria-label={c.back}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span className="pill demo-lab-badge">{c.badge}</span>
          </div>

          <p className="eyebrow demo-lab-eyebrow" data-reveal style={{ '--i': 0 }}>{c.tag}</p>
          <h2 className="demo-lab-title" data-reveal style={{ '--i': 1 }}>{c.title}</h2>
          <p className="demo-lab-sub" data-reveal style={{ '--i': 2 }}>{c.sub}</p>

          {/* Interactive Replay Stage */}
          <div className="demo-lab-stage" data-reveal style={{ '--i': 3 }}>
            <div className="demo-lab-frame" style={{ '--ar': fw / fh }}>
              <video
                ref={videoRef}
                className="rp-video"
                src={`${videoBase}.mp4`}
                poster={`${videoBase}.jpg`}
                playsInline
                muted
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onClick={toggle}
              />
              <canvas ref={canvasRef} className="rp-canvas" aria-hidden="true" />

              {/* Real-time HUD telemetry chip */}
              <div className={`rp-chip${phaseWord ? '' : ' is-idle'}${activeSticking ? ' is-sticking' : ''}`} aria-hidden="true">
                <span className="rp-count">
                  <span className="rp-n">{begunCount}</span>
                  <span className="rp-of">/{'\u00A0'}{data.count}</span>
                </span>
                {phaseWord && <span className="rp-phase">{phaseWord}</span>}
                <span className="rp-angle">{c.knee}{'\u00A0'}{activeSticking ? activeSticking.angleDeg : 92}°</span>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Scrubber with Sticking Point Pins */}
          <div
            ref={lineRef}
            className="rp-line demo-lab-line"
            role="slider"
            tabIndex={0}
            aria-label={fr ? 'Position dans la vidéo' : 'Video timeline'}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration * 10) / 10}
            aria-valuenow={Math.round(now * 10) / 10}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            {(data.reps || []).map((r, i) => {
              const from = Math.min(100, (r.startTime / duration) * 100);
              const to = Math.min(100, (r.endTime / duration) * 100);
              return (
                <span
                  key={r.index ?? i}
                  className={`rp-rep${i === currentRep ? ' is-on' : ''}`}
                  style={{ left: `${Math.min(from, 99.2)}%`, width: `${Math.max(0.8, to - from)}%` }}
                />
              );
            })}
            {stickingPoints.map((sp, idx) => {
              const pos = Math.min(100, (sp.timestamp / duration) * 100);
              return (
                <span
                  key={`sp-${idx}`}
                  className={`rp-sticking-pin${activeSticking === sp ? ' is-active' : ''}`}
                  data-testid="demo-sticking-pin"
                  style={{ left: `${pos}%` }}
                  title={`${c.sticking}\u00A0: ${sp.angleDeg}°`}
                />
              );
            })}
            <i className="rp-now" style={{ left: `${Math.min(100, (now / duration) * 100)}%` }} />
          </div>

          <p className="demo-lab-hint">{c.scrubHint}</p>

          {/* Player controls */}
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
            <button
              type="button"
              className={`btn-ghost press rp-slow${slow ? ' is-on' : ''}`}
              aria-pressed={slow}
              onClick={() => setSlow(s => !s)}
            >
              {c.slow}
            </button>
          </div>

          {/* Deep Biomechanics & VBT Telemetry Card */}
          <div className="demo-lab-analysis" data-reveal style={{ '--i': 5 }}>
            <MovementOptimizationCard
              reps={data.reps || []}
              lift="squat"
              fr={fr}
              result={{
                angles: data.angles,
                timestamps: data.timestamps,
              }}
            />
          </div>

          {/* Bottom Primary Actions */}
          <div className="actions demo-lab-actions" data-reveal style={{ '--i': 6 }}>
            <button type="button" className="btn-primary press demo-lab-start-btn" onClick={onStart}>
              {c.start}
            </button>
            <button
              type="button"
              className="btn-ghost press"
              onClick={() => {
                seekTo(0);
                play();
              }}
            >
              {c.revoir}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
