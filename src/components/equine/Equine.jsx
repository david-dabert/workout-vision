import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useT } from '../../lib/LanguageContext';
import { analyzeEquineGait, calculateCircleLean, simulateTrot } from '../../lib/equine';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { RGB, HEX, rgba } from '../experience/palette';
import { Topbar, DemoTag, GroupHead, Metric, Range } from '../experience/Showcase';
import { num, reducedMotion, NBSP } from '../experience/showcase-text';
import { EQUINE_COPY } from './equine-copy';
import './Equine.css';

// EquiVision, after the honesty pass of 14 October 2026 (audit EQ-01 to EQ-24). Three bands, each marked for what it
// is (R8):
// 1. A horse video: the demonstration clip, played as it is (Démo, nothing read on it), or the visitor's own video,
//    shown with the plain statement that the app cannot read a horse yet. No number, curve, limb or verdict is ever
//    drawn from a video: the app has no horse model. (The darkness centroid that stood for "withers" and "sacrum", the
//    2 s timer, the error and short-read fallbacks that showed a simulated horse as the visitor's, the painted
//    "analysed" files and their download are gone; the files stay on disk, R5.)
// 2. A simulated horse (Démo): what a gait assessment looks at, drawn from src/lib/equine/simulation.ts and read back
//    by src/lib/equine/kinematics.ts, each value beside the value the simulation was written with.
// 3. A calculator for the lean on the circle, from the radius and speed typed in, and what a real reading would need.

const RIDDEN_RAW_URL = `${import.meta.env.BASE_URL || '/'}demo/workoutvision-ridden-dressage-raw.mp4`;
// The frame rates the simulation can be read at. Status: convention (common phone video rates; display only).
const RATES = [25, 30, 60];
const SCENARIOS = ['sound', 'fore', 'hind'];

const SvgVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
// The muted attribute itself, not only React's property: iOS lets a clip play on its own only when it is muted, and
// React writes muted as a property (status convention: WebKit's autoplay policy; to confirm on David's iPhone).
const muteVideo = el => { if (el) { el.muted = true; el.setAttribute('muted', ''); } };
const SvgUpload = () => <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;

/** A length in mm with one decimal; a duration in s with two. Status: convention (display only). */
const mm = (v, fr) => `${num(Math.abs(v).toFixed(1), fr)}${NBSP}mm`;
const sec = (ms, fr) => num((ms / 1000).toFixed(2), fr);

/**
 * The video band: the demonstration clip with its Démo badge and the note that nothing is read on it, or the
 * visitor's own video with the statement that the app cannot read a horse. Exported for its test.
 */
export function EquineVideoBand({ lang, own, reduced, onOpen, onClose }) {
  const c = EQUINE_COPY[lang] ?? EQUINE_COPY.en, fr = lang === 'fr';
  return (
    <section className="sc-section equine-hero" data-testid="equine-player" data-reveal style={{ '--i': 2 }}>
      <GroupHead title={c.videoHead}>{own ? null : <DemoTag fr={fr} />}</GroupHead>
      {own ? (
        <div className="sc-file">
          <span className="sc-file-name"><SvgVideo /><span>{own.name}</span></span>
          <button type="button" className="btn-ghost is-s press" onClick={onClose} data-testid="equine-close-video">{c.close}</button>
        </div>
      ) : <h2 className="sc-name">{c.demoName}</h2>}
      <div className="sc-frame">
        {own
          // #t=0.1 shows a clip's first frame on iOS before it plays (the visitor's video, or the demo under Reduce Motion).
          ? <video key={own.url} src={`${own.url}#t=0.1`} controls playsInline preload="metadata" data-testid="equine-own-video" />
          : <video ref={muteVideo} src={`${RIDDEN_RAW_URL}#t=0.1`} controls playsInline muted loop autoPlay={!reduced} preload="metadata" data-testid="equine-demo-video" />}
      </div>
      {own ? (
        <div className="sc-card equine-own" role="status" data-testid="equine-own-statement">
          <h3 className="equine-own-title">{c.ownHead}</h3>
          <p className="sc-text">{c.ownText}</p>
          <p className="sc-caption">{c.stays}</p>
        </div>
      ) : (
        <>
          <p className="sc-frame-note is-quiet">{c.demoNote}</p>
          <button type="button" className="sc-card equine-upload press" onClick={onOpen} data-testid="equine-upload-card">
            <SvgUpload />
            <span className="equine-upload-title">{c.open}</span>
            <span className="sc-caption">{c.stays}</span>
          </button>
        </>
      )}
    </section>
  );
}

// The scale bar of the chart, in mm of the simulation. Status: convention (display only).
const SCALE_MM = 20;

/**
 * The simulated curves, one lane each for the head and the pelvis on one millimetre scale, with the engine's dips and
 * a 20 mm scale bar at the right of the head's lane.
 */
function drawTrace(canvas, frames, report, c) {
  const ctx = canvas.getContext('2d');
  if (!ctx || frames.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 360, H = canvas.clientHeight || 225;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // The frame's well shows through (Showcase.css .sc-frame); the lines take the app's palette (palette.js).
  ctx.clearRect(0, 0, W, H);
  const t0 = frames[0].timestamp, t1 = frames[frames.length - 1].timestamp;
  const left = 16, right = 30, top = 26, bottom = 24, gap = 26;
  const laneH = (H - top - bottom - gap) / 2;
  const lanes = [
    { key: 'poll', label: c.head, colour: HEX.lamp, y0: top },
    { key: 'sacrum', label: c.pelvis, colour: rgba(RGB.bone, 0.85), y0: top + laneH + gap },
  ];
  let lo = 0, hi = 0;
  for (const f of frames) for (const l of lanes) {
    const v = f.landmarks?.[l.key]?.y;
    if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const span = hi - lo || 1;
  const xOf = t => left + ((t - t0) / (t1 - t0 || 1)) * (W - left - right);
  ctx.font = '10px "Geist Mono", ui-monospace, monospace';
  for (const l of lanes) {
    const yOf = v => l.y0 + ((hi - v) / span) * laneH;
    const ch = report.channels[l.key];
    ctx.fillStyle = rgba(RGB.bone, 0.55);
    ctx.fillText(l.label.toUpperCase(), left, l.y0 - 10);
    ctx.strokeStyle = rgba(RGB.bone, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, yOf(0)); ctx.lineTo(W - right, yOf(0)); ctx.stroke();
    if (ch && !ch.refused) {
      // Each stride starts at a dip A: a dashed hairline, so the strides read as the repeating unit.
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(RGB.bone, 0.16);
      for (const s of ch.strides) { const x = xOf(s.startTime); ctx.beginPath(); ctx.moveTo(x, l.y0 - 2); ctx.lineTo(x, l.y0 + laneH + 2); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = l.colour;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (const f of frames) {
      const v = f.landmarks?.[l.key]?.y;
      if (!Number.isFinite(v)) { started = false; continue; }
      const x = xOf(f.timestamp), y = yOf(v);
      if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
    }
    ctx.stroke();
    if (ch && !ch.refused) {
      // Dip A filled, dip B hollow, each at the time and height the engine found it (on the curve).
      ch.dips.forEach((d, k) => {
        ctx.beginPath();
        ctx.arc(xOf(d.time), yOf(d.value), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = k % 2 === 0 ? l.colour : rgba(RGB.void, 1);
        ctx.fill();
        if (k % 2) { ctx.strokeStyle = l.colour; ctx.lineWidth = 1.5; ctx.stroke(); }
      });
    }
  }
  // The scale: a bar 20 mm tall at the right edge of the head's lane, its length written above it.
  const barH = (SCALE_MM / span) * laneH, barX = W - 12;
  ctx.strokeStyle = rgba(RGB.bone, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(barX - 3, top); ctx.lineTo(barX + 3, top);
  ctx.moveTo(barX, top); ctx.lineTo(barX, top + barH);
  ctx.moveTo(barX - 3, top + barH); ctx.lineTo(barX + 3, top + barH);
  ctx.stroke();
  ctx.fillStyle = rgba(RGB.bone, 0.55);
  ctx.textAlign = 'right';
  ctx.fillText(`${SCALE_MM}${NBSP}mm`, W - 6, top - 10);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(RGB.bone, 0.45);
  for (let s = 0; t0 + s * 1000 <= t1 + 1; s++) {
    const x = xOf(t0 + s * 1000);
    ctx.fillText(`${s}${NBSP}s`, Math.min(Math.max(left, x - 6), W - right - 22), H - 7);
  }
}

export default function Equine({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = EQUINE_COPY[lang] ?? EQUINE_COPY.en;
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const [reduced] = useState(reducedMotion);

  const [scenario, setScenario] = useState('sound');
  const [rate, setRate] = useState(30);
  const [circleRadius, setCircleRadius] = useState(12); // m
  const [trotSpeed, setTrotSpeed] = useState(3.5); // m/s
  const fileInputRef = useRef(null);
  const [own, setOwn] = useState(null); // { url, name } of the visitor's video, played as it is

  const sim = useMemo(() => simulateTrot(scenario, { fps: rate }), [scenario, rate]);
  const report = useMemo(() => analyzeEquineGait(sim.frames), [sim]);
  const lean = useMemo(() => calculateCircleLean(circleRadius, trotSpeed), [circleRadius, trotSpeed]);

  // The visitor's video: an object URL, released when another replaces it, when it is closed and when the screen goes.
  const ownUrl = useRef(null);
  useEffect(() => () => { if (ownUrl.current) URL.revokeObjectURL(ownUrl.current); }, []);
  const handleOpen = e => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be chosen again
    if (!file) return;
    hapticLight();
    if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
    ownUrl.current = URL.createObjectURL(file);
    setOwn({ url: ownUrl.current, name: file.name });
  };
  const handleClose = () => {
    hapticLight();
    if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
    ownUrl.current = null;
    setOwn(null);
  };

  // The chart is drawn at the canvas's size, and again whenever that size changes (a rotation, a resized window), so
  // its bitmap never stretches.
  const canvasRef = useRef(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const draw = () => drawTrace(el, sim.frames, report, c);
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    let size = `${el.clientWidth}x${el.clientHeight}`;
    const ro = new ResizeObserver(() => {
      const now = `${el.clientWidth}x${el.clientHeight}`;
      if (now !== size) { size = now; draw(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sim, report, c]);
  const rateId = useId();

  const head = report.channels.poll, pelvis = report.channels.sacrum;
  const diffValue = ch => (ch && !ch.refused ? mm(ch.meanMinDiff, fr) : c.noNumber);

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen equine-screen" data-testid="equine-screen">
        <div className="wrap">
          <input type="file" ref={fileInputRef} accept="video/*" style={{ display: 'none' }} onChange={handleOpen} data-testid="equine-file-input" />

          <Topbar
            fr={fr}
            backTestId="equine-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          />

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <EquineVideoBand lang={lang} own={own} reduced={reduced} onOpen={() => { hapticLight(); fileInputRef.current?.click(); }} onClose={handleClose} />

          {/* The simulated horse: every value here is the engine's reading of a horse written in the code. */}
          <section className="sc-section equine-sim" data-testid="equine-simulation" data-reveal style={{ '--i': 3 }}>
            <GroupHead title={c.simHead}><DemoTag fr={fr} /></GroupHead>
            <p className="sc-text">{c.simIntro}</p>
            {/* Three chips that wrap, so none is ever cut at the screen's edge. */}
            <div className="sc-chips" role="group" aria-label={c.scenariosGroup}>
              {SCENARIOS.map(s => (
                <button key={s} type="button" className="sc-chip press" aria-pressed={scenario === s} onClick={() => { hapticLight(); setScenario(s); }} data-testid={`scenario-${s}`}>
                  {c.scenarios[s]}
                </button>
              ))}
            </div>
            <p className="sc-caption" data-testid="equine-scenario-text">{c.scenarioText[scenario]}</p>
            <div className="equine-rate">
              <span className="equine-rate-head" id={rateId}>{c.rateHead}</span>
              <div className="sc-seg" role="group" aria-labelledby={rateId}>
                {RATES.map(r => (
                  <button key={r} type="button" className="press" aria-pressed={rate === r} onClick={() => { hapticLight(); setRate(r); }} data-testid={`equine-rate-${r}`}>
                    {c.rate(r)}
                  </button>
                ))}
              </div>
            </div>

            <GroupHead as="h3" title={c.chartHead}><DemoTag fr={fr} /></GroupHead>
            <div className="equine-legend" aria-hidden="true">
              <span className="legend-item"><span className="legend-color legend-head" />{c.head}</span>
              <span className="legend-item"><span className="legend-color legend-pelvis" />{c.pelvis}</span>
              <span className="legend-item"><span className="legend-dot" />{c.dipA}</span>
              <span className="legend-item"><span className="legend-dot is-hollow" />{c.dipB}</span>
            </div>
            <div className="sc-frame is-chart">
              <canvas ref={canvasRef} className="equine-chart-canvas" role="img" aria-label={c.chartLabel} data-testid="equine-chart" />
            </div>

            <GroupHead as="h3" title={c.figuresHead}><DemoTag fr={fr} /></GroupHead>
            {report.refused ? <p className="sc-text" data-testid="equine-refused">{c.refused}</p> : null}
            <div className="sc-metrics" data-testid="equine-metrics">
              <Metric
                wide
                label={c.stride}
                value={report.refused ? c.noNumber : sec(report.strideDurationMs, fr)}
                unit={report.refused ? null : 's'}
                text={!!report.refused}
                sub={report.refused ? null : c.strideSub(num(report.strideFrequencyHz.toFixed(2), fr))}
                testId="equine-stride"
              >
                <span className="sc-metric-sub">{c.programmed(`${sec(sim.truth.strideMs, fr)}${NBSP}s`)}</span>
              </Metric>
              <Metric label={c.headDiff} value={diffValue(head)} text={!head || !!head.refused} sub={c.programmed(mm(sim.truth.headMinDiffMm, fr))} testId="equine-head-diff" />
              <Metric label={c.pelvisDiff} value={diffValue(pelvis)} text={!pelvis || !!pelvis.refused} sub={c.programmed(mm(sim.truth.pelvisMinDiffMm, fr))} testId="equine-pelvis-diff" />
            </div>
            {scenario !== 'sound' ? <p className="sc-caption">{c.rateNote}</p> : null}
            <p className="sc-caption">{c.noLimb}</p>
            <p className="sc-caption">{c.thresholds}</p>
          </section>

          {/* The circle: a calculation from the two values typed in, never applied to any curve. */}
          <section className="sc-section equine-circle" data-testid="equine-circle">
            <GroupHead title={c.circleHead}><span className="sc-tag">{c.calcTag}</span></GroupHead>
            <div className="sc-metrics">
              <Metric wide label={c.lean} value={num(lean.toFixed(1), fr)} unit="°" sub={c.leanSub} testId="equine-lean" />
            </div>
            <div className="sc-ranges">
              <Range label={c.radius} display={`${num(circleRadius, fr)}${NBSP}m`} min="6" max="20" step="0.5" value={circleRadius} onChange={e => setCircleRadius(parseFloat(e.target.value))} testId="equine-radius" />
              <Range label={c.speed} display={`${num(trotSpeed.toFixed(1), fr)}${NBSP}m/s`} min="2.5" max="5.0" step="0.1" value={trotSpeed} onChange={e => setTrotSpeed(parseFloat(e.target.value))} testId="equine-speed" />
            </div>
            <p className="sc-caption">{c.circleText}</p>
          </section>

          {/* What reading a real horse would take. */}
          <section className="sc-section equine-road" data-testid="equine-road">
            <GroupHead title={c.roadHead} />
            <div className="equine-points">
              {c.road.map(r => (
                <div className="sc-card" key={r.title}>
                  <h3 className="sc-head-title">{r.title}</h3>
                  <p className="sc-caption">{r.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
