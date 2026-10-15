import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { Verdict, GroupHead, Metric } from '../experience/Showcase';
import { buildReference, compareAttempt, curves, SAMPLE_HZ, TOLERANCE_DEG } from '../../lib/reference/compare';
import { EDGES, ghostPoints, nearestIndex, pathMaps, refTimeFor } from '../../lib/reference/overlay';
import { COPY, JOINT_NAMES, clock, deg, pct } from './reference-copy';
import './ReferenceCompare.css';

// The comparison of a patient's attempt with a reference (src/lib/reference/compare.js), as every screen shows it
// (ReferenceCompare.jsx, KinePatient.jsx): the verdict and its reasons; the patient's video with the patient's skeleton
// drawn on it, each compared joint in the lamp when out of tolerance at that moment, its angle beside the reference's;
// the reference's skeleton laid on the patient's trunk as a ghost; the reference's video in the corner, kept at the
// matching moment; tempo, joints, the positions held, and a timeline. onResult(result) hands the result to the screen.
// R8: no verdict when a joint is not seen well enough; the tolerance is said to be provisional.

const JOINT_POINTS = { leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14 };

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

export default function ComparisonView({ refPose, attPose, refUrl, attUrl, onResult }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const rootRef = useRef(null);
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
    if (!result || result.verdict === 'refused' || !maps) return undefined;
    let raf = 0;
    const lamp = cssVar(rootRef.current, '--lamp', '#E8BD7E');
    const bone = cssVar(rootRef.current, '--bone', '#EFE8DC');
    const ash = cssVar(rootRef.current, '--ash', '#A49B8D');
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
          // Each joint's label, named, beside its point; a label that would cover one already set moves down.
          const placed = [];
          result.joints.forEach((j, k) => {
            const p = pts[JOINT_POINTS[j.name]];
            if (!p) return;
            const bad = off[JOINT_POINTS[j.name]];
            ctx.fillStyle = bad ? lamp : bone;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
            const label = `${names[j.name].split(' ')[0]} ${deg(result.matched[k][ri])} · ${c.refShort} ${deg(result.reference[k][ri])}`;
            const bw = ctx.measureText(label).width + 10, bh = 20;
            let bx = Math.min(p.x + 9, w - bw - 4), by = Math.max(4, p.y - 21);
            while (placed.some(r => bx < r.x + r.w && r.x < bx + bw && by < r.y + r.h && r.y < by + bh)) by += bh + 3;
            placed.push({ x: bx, y: by, w: bw, h: bh });
            ctx.fillStyle = 'rgba(10,10,10,0.72)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = bad ? lamp : bone;
            ctx.fillText(label, bx + 5, by + 15);
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
  }, [result, maps, ghost, attPose, refPose, c.refShort, names]);

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

  useEffect(() => { if (result) onResult?.(result); }, [result, onResult]);
  const reasons = result ? result.reasons.map(r => {
    const [kind, name] = r.split(':');
    const j = result.joints.find(x => x.name === name);
    if (kind === 'off' && j) return c.off(names[name], j.within, j.worst);
    if (kind === 'range' && j) return c.range(names[name], j.rangeShare);
    return null;
  }).filter(Boolean) : [];
  const unseen = result?.verdict === 'refused' ? result.reasons.filter(r => r.startsWith('unseen:')).map(r => names[r.split(':')[1]]).join(', ') : '';

  if (!result) return null;
  return <div ref={rootRef}>
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
  </div>;
}
