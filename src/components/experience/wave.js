// The wave: the joint angle the counter measured over the whole set, drawn as one line, with each counted rep
// over it (David, 2 October 2026: a report that holds the eye, from what was measured). The line is the core's
// own smoothed angle (core.ts), nothing computed for the picture: where the pose was lost, the line breaks.
// Effort points up: for a lift that rests high (a curl rests with the elbow open), the angle is drawn inverted.

/**
 * The angle the wave draws. For an exercise counted on both sides (core.ts, countBothSides), the result's own
 * angle is one side's: during each rep the line follows the side that made it, so the other side's reps are not
 * drawn over a line that does not move (second audit, 3 October). Every value is a measured, smoothed angle.
 */
export function waveAngles(result) {
  const base = result?.smoothedAngles || [];
  if (!result?.sides) return base;
  const ts = result.timestamps || [], out = [...base];
  for (const r of result.reps || []) {
    const side = r.side === 'left' || r.side === 'right' ? result.sides[r.side] : null;
    if (!side?.smoothedAngles) continue;
    for (let i = 0; i < out.length; i++) if (ts[i] >= r.startTime && ts[i] <= r.endTime) out[i] = side.smoothedAngles[i] ?? null;
  }
  return out;
}

/** Geometry of the wave in a width x height box (viewBox units). null without two measured samples. */
export function waveGeometry({ angles, timestamps, rest = 'low', width = 320, height = 72, pad = 4 }) {
  const n = Math.min(angles?.length || 0, timestamps?.length || 0);
  const vals = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(angles[i])) vals.push(angles[i]);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const t0 = timestamps[0], t1 = timestamps[n - 1], dur = t1 - t0 || 1;
  const x = t => pad + ((t - t0) / dur) * (width - 2 * pad);
  // Work up: a lift resting low rises with the angle; one resting high rises as the angle closes.
  const y = a => { const u = (a - lo) / span; return pad + (rest === 'high' ? u : 1 - u) * (height - 2 * pad); };
  const f = v => Math.round(v * 10) / 10;
  // One path for samples i..j inclusive, a new stroke after every lost sample.
  const path = (i = 0, j = n - 1) => {
    let d = '', pen = false;
    for (let k = Math.max(0, i); k <= Math.min(n - 1, j); k++) {
      if (!Number.isFinite(angles[k])) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${f(x(timestamps[k]))} ${f(y(angles[k]))}`;
      pen = true;
    }
    return d;
  };
  // The same strokes as point lists, for a drawing that is not SVG (the PDF, report-pdf.js).
  const strokes = (i = 0, j = n - 1) => {
    const out = []; let cur = null;
    for (let k = Math.max(0, i); k <= Math.min(n - 1, j); k++) {
      if (!Number.isFinite(angles[k])) { cur = null; continue; }
      if (!cur) { cur = []; out.push(cur); }
      cur.push([x(timestamps[k]), y(angles[k])]);
    }
    return out.filter(s => s.length > 1);
  };
  const index = t => { let k = 0; while (k < n - 1 && timestamps[k] < t) k++; return k; };
  return { width, height, x, y, path, strokes, index, t0, t1 };
}

/**
 * Each rep's strokes on the wave: its leaving phase (from rest to the turn) and its returning phase, by its own
 * boundaries; a cut or partial rep as one stroke, `whole: false`.
 */
export function repStrokes(geo, reps, { first = 'concentric', isPartial = () => false } = {}) {
  if (!geo) return [];
  return (reps || []).map((r, i) => {
    const a = geo.index(r.startTime), b = geo.index(r.endTime);
    const whole = !r.clipped && !isPartial(r);
    const leave = first === 'concentric' ? r.concentricSec : r.eccentricSec;
    const turn = whole && Number.isFinite(leave) ? geo.index(r.startTime + leave) : null;
    return {
      i, whole,
      band: { x: geo.x(r.startTime), w: Math.max(1, geo.x(r.endTime) - geo.x(r.startTime)) },
      out: turn === null ? geo.path(a, b) : geo.path(a, turn),
      back: turn === null ? '' : geo.path(turn, b),
    };
  });
}

/** The rep nearest a point of the wave, by time: its index, or -1. */
export function repAt(geo, reps, xView) {
  if (!geo || !reps?.length) return -1;
  let best = -1, gap = Infinity;
  reps.forEach((r, i) => {
    const a = geo.x(r.startTime), b = geo.x(r.endTime);
    const d = xView < a ? a - xView : xView > b ? xView - b : 0;
    if (d < gap) { gap = d; best = i; }
  });
  return best;
}

/**
 * The wave as a set keeps it (storage.js): at most `max` samples evenly spread (twice that where the pose was lost), the last always, times to the hundredth of a second
 * and angles to the tenth of a degree, a lost sample kept as null. About 2 KB for a set; no landmark, no image.
 */
export function compactWave(angles, timestamps, max = 200) {
  const n = Math.min(angles?.length || 0, timestamps?.length || 0);
  if (n < 2) return null;
  const step = Math.max(1, Math.ceil(n / max)), t = [], a = [];
  const put = k => { t.push(Math.round(timestamps[k] * 100) / 100); a.push(Number.isFinite(angles[k]) ? Math.round(angles[k] * 10) / 10 : null); };
  for (let k = 0; k < n; k += step) {
    put(k);
    // A sample lost inside the stride still breaks the line: its own null follows the kept one (audit FINDING-027).
    if (Number.isFinite(angles[k])) for (let j = k + 1; j < Math.min(n, k + step); j++) if (!Number.isFinite(angles[j])) { put(j); break; }
  }
  if ((n - 1) % step) put(n - 1);  // the last sample, always
  return { t, a };
}
