import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, Verdict, GroupHead, Metric } from '../experience/Showcase';
import { buildReference, compareAttempt, curves, SAMPLE_HZ, TOLERANCE_DEG } from '../../lib/reference/compare';
import { EDGES, ghostPoints, nearestIndex, pathMaps, refTimeFor } from '../../lib/reference/overlay';
import { readPose } from '../../lib/reference/readPose';
import { COPY, JOINT_NAMES, clock, deg, pct } from './reference-copy';
import './ReferenceCompare.css';

// Reference exercises (Olivier, physiotherapist, 15 October 2026): the physiotherapist's video is the model, the
// patient's is read by the app's own pose pipeline and compared with it (src/lib/reference/compare.js). The screen
// shows the patient's video with the patient's skeleton drawn on it, each compared joint in the lamp when it is out
// of tolerance at that moment, the reference's skeleton laid on the patient's body as a ghost, and the reference's
// video in a corner, kept at the matching moment. Both videos come from the phone and stay on it.
// R8: no verdict when a joint is not seen well enough; the tolerance is said to be provisional.

const JOINT_POINTS = { leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14 };

function useObjectUrl(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function cssVar(el, name, fallback) {
  const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : '';
  return v || fallback;
}

function drawSkeleton(ctx, pts, { color, width, dash = null, alpha = 1, colorOf }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  for (const [a, b] of EDGES) {
    if (!pts[a] || !pts[b]) continue;
    ctx.strokeStyle = colorOf?.(a, b) ?? color;
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }
  ctx.restore();
}

function FilePick({ label, hint, file, onFile, c, testId }) {
  const input = useRef(null);
  return <div className="rc-pick">
    <div className="rc-pick-txt">
      <b>{label}</b>
      <small>{file ? file.name : hint}</small>
    </div>
    <button type="button" className={`rc-btn press ${file ? '' : 'is-primary'}`} onClick={() => input.current?.click()} data-testid={testId}>{file ? c.change : c.choose}</button>
    <input ref={input} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { hapticLight(); onFile(f); } }} data-testid={`${testId}-input`} />
  </div>;
}

function Timeline({ result, names, c, refNow, onSeekRef }) {
  const W = 320, H = 96, pad = 4;
  const n = result.reference[0]?.length ?? 0;
  if (!n) return null;
  const x = i => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
  return <div className="rc-timeline">
    {result.joints.map((j, k) => {
      const ref = result.reference[k], att = result.matched[k];
      const lo = Math.min(...ref, ...att) - 5, hi = Math.max(...ref, ...att) + 5;
      const y = v => pad + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 2 * pad);
      const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      const band = `${ref.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v + TOLERANCE_DEG).toFixed(1)}`).join('')}${ref.map((v, i) => [i, v]).reverse().map(([i, v]) => `L${x(i).toFixed(1)},${y(v - TOLERANCE_DEG).toFixed(1)}`).join('')}Z`;
      // Stretches out of tolerance, each one band.
      const runs = [];
      att.forEach((v, i) => {
        if (Math.abs(v - ref[i]) <= TOLERANCE_DEG) return;
        const last = runs.at(-1);
        if (last && last[1] === i - 1) last[1] = i; else runs.push([i, i]);
      });
      const seek = e => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
        onSeekRef(Math.max(0, Math.min(n - 1, i)));
      };
      return <figure key={j.name} className="rc-chart">
        <figcaption>{names[j.name]}</figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={seek} role="img" aria-label={`${names[j.name]}: ${c.legendRef}, ${c.legendAtt}`} data-testid={`rc-chart-${j.name}`}>
          <path d={band} className="rc-band" />
          {runs.map(([a, b]) => <rect key={a} x={x(a) - 0.8} y={0} width={x(b) - x(a) + 1.6} height={H} className="rc-off" />)}
          <path d={line(ref)} className="rc-line-ref" />
          <path d={line(att)} className="rc-line-att" />
          <line x1={x(refNow)} x2={x(refNow)} y1={0} y2={H} className="rc-playhead" />
        </svg>
      </figure>;
    })}
    <p className="rc-legend"><span className="rc-key is-ref" />{c.legendRef}<span className="rc-key is-att" />{c.legendAtt}<span className="rc-hint">{c.timelineHint}</span></p>
  </div>;
}

export default function ReferenceCompare({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  const [refFile, setRefFile] = useState(null);
  const [attFile, setAttFile] = useState(null);
  const [refPose, setRefPose] = useState(null);
  const [attPose, setAttPose] = useState(null);
  const [phase, setPhase] = useState('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const refUrl = useObjectUrl(refFile);
  const attUrl = useObjectUrl(attFile);

  const pickRef = f => { setRefFile(f); setRefPose(null); setAttPose(null); setPhase('pick'); };
  const pickAtt = f => { setAttFile(f); setAttPose(null); setPhase('pick'); };

  const run = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    try {
      let r = refPose;
      if (!r) {
        setPhase('reading-ref'); setProgress(0);
        r = await readPose(refFile, { signal: ctrl.signal, onProgress: p => setProgress(p) });
        setRefPose(r);
      }
      setPhase('reading-att'); setProgress(0);
      const a = await readPose(attFile, { signal: ctrl.signal, onProgress: p => setProgress(p) });
      setAttPose(a);
      setPhase('done');
    } catch (err) {
      if (err?.name === 'AbortError') { setPhase('pick'); return; }
      setError(err?.message || String(err));
      setPhase('error');
    }
  };
  useEffect(() => () => abortRef.current?.abort(), []);

  const reference = useMemo(() => (refPose ? buildReference(refPose.imageLandmarks, refPose.timestamps, { aspect: refPose.aspect }) : null), [refPose]);
  const result = useMemo(() => (reference && attPose ? compareAttempt(reference, attPose.imageLandmarks, attPose.timestamps, { aspect: attPose.aspect }) : null), [reference, attPose]);
  const maps = useMemo(() => {
    if (!result?.path || !attPose) return null;
    const attLength = curves(attPose.imageLandmarks, attPose.timestamps, { aspect: attPose.aspect })[result.joints[0].name].length;
    return { ...pathMaps(result.path, attLength), attT0: attPose.timestamps[0], refT0: refPose.timestamps[0] };
  }, [result, attPose, refPose]);

  // Player: the patient's video drives; the reference's video is kept at the matching moment.
  const attVideo = useRef(null), refVideo = useRef(null), attCanvas = useRef(null), refCanvas = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [ghost, setGhost] = useState(true);
  const [refNow, setRefNow] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (phase !== 'done' || !result || result.verdict === 'refused' || !maps) return undefined;
    let raf = 0;
    const lamp = cssVar(screenRef.current, '--lamp', '#E8BD7E');
    const bone = cssVar(screenRef.current, '--bone', '#EFE8DC');
    const ash = cssVar(screenRef.current, '--ash', '#A49B8D');
    const frame = () => {
      const v = attVideo.current, cv = attCanvas.current;
      if (v && cv) {
        const t = v.currentTime;
        const tr = refTimeFor(t, maps);
        const ri = Math.max(0, Math.min(result.reference[0].length - 1, Math.round((tr - maps.refT0) * SAMPLE_HZ)));
        setNow(Math.round(t * 10) / 10); setRefNow(ri);
        const rv = refVideo.current;
        if (rv && !rv.seeking && Math.abs(rv.currentTime - tr) > 0.12) rv.currentTime = tr;
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const ai = nearestIndex(attPose.timestamps, t);
        const lm = attPose.imageLandmarks[ai];
        const rlm = refPose.imageLandmarks[nearestIndex(refPose.timestamps, tr)];
        // Gap of each compared joint at this moment of the reference.
        const off = {};
        result.joints.forEach((j, k) => { off[JOINT_POINTS[j.name]] = Math.abs(result.matched[k][ri] - result.reference[k][ri]) > TOLERANCE_DEG; });
        if (ghost && lm && rlm) {
          const g = ghostPoints(rlm, { w: 1, h: refPose.height / refPose.width }, lm, { w, h: w * (attPose.height / attPose.width) });
          if (g) drawSkeleton(ctx, g, { color: ash, width: 6, dash: [2, 8], alpha: 0.75 });
        }
        if (lm) {
          const pts = lm.map(p => ((p.visibility ?? 0) >= 0.5 ? { x: p.x * w, y: p.y * h } : null));
          drawSkeleton(ctx, pts, { color: bone, width: 4, alpha: 0.95, colorOf: (a, b) => (off[a] || off[b] ? lamp : bone) });
          ctx.font = '600 13px system-ui, sans-serif';
          result.joints.forEach((j, k) => {
            const p = pts[JOINT_POINTS[j.name]];
            if (!p) return;
            const bad = off[JOINT_POINTS[j.name]];
            ctx.fillStyle = bad ? lamp : bone;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
            const label = `${deg(result.matched[k][ri])}  ${c.refShort} ${deg(result.reference[k][ri])}`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(10,10,10,0.72)';
            ctx.fillRect(p.x + 9, p.y - 21, tw + 10, 20);
            ctx.fillStyle = bad ? lamp : bone;
            ctx.fillText(label, p.x + 14, p.y - 6);
          });
        }
      }
      const rcv = refCanvas.current, rvid = refVideo.current;
      if (rcv && rvid) {
        const dpr = window.devicePixelRatio || 1;
        const w = rcv.clientWidth, h = rcv.clientHeight;
        if (rcv.width !== Math.round(w * dpr)) { rcv.width = Math.round(w * dpr); rcv.height = Math.round(h * dpr); }
        const ctx = rcv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const rlm = refPose.imageLandmarks[nearestIndex(refPose.timestamps, rvid.currentTime)];
        if (rlm) drawSkeleton(ctx, rlm.map(p => ((p.visibility ?? 0) >= 0.5 ? { x: p.x * w, y: p.y * h } : null)), { color: ash, width: 2, alpha: 0.9 });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, result, maps, ghost, attPose, refPose, c.refShort]);

  const toggle = () => {
    const v = attVideo.current;
    if (!v) return;
    hapticLight();
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const seekAtt = t => { const v = attVideo.current; if (v) v.currentTime = t; };
  const seekRefIndex = ri => {
    if (!maps) return;
    const ai = maps.attOfRef[ri] ?? 0;
    seekAtt(maps.attT0 + ai / SAMPLE_HZ);
  };

  const reading = phase === 'reading-ref' || phase === 'reading-att';
  const reasons = result ? result.reasons.map(r => {
    const [kind, name] = r.split(':');
    const j = result.joints.find(x => x.name === name);
    if (kind === 'off' && j) return c.off(names[name], j.within, j.worst);
    if (kind === 'range' && j) return c.range(names[name], j.rangeShare);
    return null;
  }).filter(Boolean) : [];
  const unseen = result?.verdict === 'refused' ? result.reasons.filter(r => r.startsWith('unseen:')).map(r => names[r.split(':')[1]]).join(', ') : '';

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen rc-screen" data-testid="reference-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="reference-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />
          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <div className="sc-section rc-picks" data-reveal style={{ '--i': 2 }}>
            <FilePick label={c.refLabel} hint={c.refHint} file={refFile} onFile={pickRef} c={c} testId="rc-ref" />
            <FilePick label={c.attLabel} hint={c.attHint} file={attFile} onFile={pickAtt} c={c} testId="rc-att" />
            {!reading && phase !== 'done' && <button type="button" className="rc-btn is-primary is-wide press" disabled={!refFile || !attFile} onClick={run} data-testid="rc-compare">{c.compare}</button>}
            {reading && <div className="rc-progress" role="status" data-testid="rc-progress">
              <span>{phase === 'reading-ref' ? c.readingRef : c.readingAtt}</span>
              <div className="rc-bar"><i style={{ width: `${Math.round(progress)}%` }} /></div>
              <button type="button" className="rc-link press" onClick={() => abortRef.current?.abort()}>{c.cancel}</button>
            </div>}
            {phase === 'error' && <p className="rc-error" role="alert" data-testid="rc-error">{c.failed} <small>{error}</small> <button type="button" className="rc-link press" onClick={run}>{c.retry}</button></p>}
          </div>

          {phase === 'done' && result && <>
            <section className="sc-section" data-testid="rc-result">
              <GroupHead title={c.verdict} />
              <p className={`rc-verdict is-${result.verdict}`} data-testid="rc-verdict">{result.verdict === 'match' ? c.match : result.verdict === 'revise' ? c.revise : c.refused}</p>
              {result.verdict === 'refused' && <p className="sc-frame-note" data-testid="rc-refused">{result.reasons.includes('reference-unseen') ? c.refUnseen : c.refusedWhy(unseen)}</p>}
              {reasons.length > 0 && <ul className="rc-reasons">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            </section>

            {result.verdict !== 'refused' && <>
              <section className="sc-section">
                <GroupHead title={c.player} />
                <div className="rc-stage" style={{ aspectRatio: `${attPose.width} / ${attPose.height}` }}>
                  <video ref={attVideo} src={attUrl} playsInline muted preload="auto" onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onEnded={() => setPlaying(false)} data-testid="rc-att-video" />
                  <canvas ref={attCanvas} className="rc-canvas" />
                  <div className="rc-inset" style={{ aspectRatio: `${refPose.width} / ${refPose.height}` }}>
                    <video ref={refVideo} src={refUrl} playsInline muted preload="auto" data-testid="rc-ref-video" />
                    <canvas ref={refCanvas} className="rc-canvas" />
                    <span className="rc-inset-tag">{c.refLabel}</span>
                  </div>
                </div>
                <div className="rc-controls">
                  <button type="button" className="rc-play press" onClick={toggle} aria-label={playing ? c.pause : c.play} data-testid="rc-play">
                    {playing ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>}
                  </button>
                  <input type="range" className="rc-scrub" min="0" max={Number.isFinite(duration) ? duration : 0} step="0.05" value={now} onChange={e => seekAtt(Number(e.target.value))} aria-label={c.player} />
                  <span className="rc-time">{clock(now)}</span>
                </div>
                <label className="rc-toggle"><input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} /> {c.ghost}</label>
              </section>

              <section className="sc-section">
                <GroupHead title={c.tempo} />
                <div className="sc-metrics">
                  <Metric label={c.duration} value={c.tempoValue(result.end - result.start, result.reference[0].length / SAMPLE_HZ)} text sub={c.tempoSub(result.tempo)} testId="rc-tempo" />
                </div>
              </section>

              <section className="sc-section">
                <GroupHead title={c.joints} />
                <ul className="rc-joints">
                  {result.joints.map(j => <li key={j.name} data-testid={`rc-joint-${j.name}`}>
                    <b>{names[j.name]}</b>
                    <span><small>{c.within}</small>{pct(j.within, fr)}</span>
                    <span><small>{c.gap}</small>{deg(j.gapP90)}</span>
                    {j.rangeShare != null && <span><small>{c.reached}</small>{pct(Math.min(j.rangeShare, 9.99), fr)}</span>}
                    <span className="rc-go"><small>{c.worstAt}</small><button type="button" className="rc-link press" onClick={() => seekRefIndex(Math.round(j.worst.atSec * SAMPLE_HZ))}>{clock(j.worst.atSec)}</button></span>
                  </li>)}
                </ul>
              </section>

              {result.holds.length > 0 && <section className="sc-section">
                <GroupHead title={c.holds} />
                <ul className="rc-holds">
                  {result.holds.map((h, i) => <li key={i} data-testid={`rc-hold-${i}`}>
                    <button type="button" className="rc-hold press" onClick={() => seekRefIndex(Math.round(h.startSec * SAMPLE_HZ))}>
                      <span className="rc-hold-name">{c.holdRow(i)} <small>{clock(h.startSec)}</small></span>
                      <span className="rc-hold-vals"><small>{c.holdRef(h.refAngle, h.refSec)}</small><small>{c.holdAtt(h.attAngle, h.attSec)}</small></span>
                      <Verdict ok={h.status === 'held'}>{h.status === 'held' ? c.holdOk : h.status === 'short' ? c.holdShort : c.holdOff}</Verdict>
                    </button>
                  </li>)}
                </ul>
              </section>}

              <section className="sc-section">
                <GroupHead title={c.timeline} />
                <Timeline result={result} names={names} c={c} refNow={refNow} onSeekRef={seekRefIndex} />
              </section>
            </>}

            <p className="sc-caption">{c.note(TOLERANCE_DEG)}</p>
            <button type="button" className="rc-btn is-wide press" onClick={() => { setAttFile(null); setAttPose(null); setPhase('pick'); }} data-testid="rc-new">{c.newAttempt}</button>
          </>}
        </div>
      </section>
    </div>
  );
}
