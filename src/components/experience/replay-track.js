// What the replay shows at a moment of the video: the tracked body, the rep on screen
// and its phase. Kept apart from the screen so the tests can run it without a browser.

export const SEEN = 0.5;   // a point is drawn when the model's visibility reaches this, as on the Watch screen
export const HOLE = 0.25;  // no line is drawn across a gap in the samples longer than this, in seconds
export const EDGE = 0.1;   // nor further than this before the first sample or after the last

// The last sample at or before t, or −1.
function before(times, t) {
  let lo = 0, hi = times.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m + 1; else hi = m; }
  return lo - 1;
}

export function nearest(times, t) {
  const i = before(times, t);
  if (i < 0) return 0;
  if (i >= times.length - 1) return times.length - 1;
  return t - times[i] <= times[i + 1] - t ? i : i + 1;
}

// The tracked body at time t. Between two samples each point moves in a straight line
// from one to the next; a point shows only where both samples saw it.
export function poseAt(frames, times, t) {
  const n = times.length, i = before(times, t);
  if (!n) return null;
  if (i < 0) return times[0] - t <= EDGE ? frames[0] : null;
  if (i === n - 1) return t - times[i] <= EDGE ? frames[i] : null;
  const a = frames[i], b = frames[i + 1], span = times[i + 1] - times[i];
  if (!a || !b || span > HOLE) return frames[nearest(times, t)];
  const u = (t - times[i]) / span;
  return a.map((p, k) => {
    const q = b[k];
    return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, visibility: Math.min(p.visibility ?? 0, q.visibility ?? 0) };
  });
}

// The rep on screen at t (the latest begun, when two overlap), or −1.
export function repAt(reps, t) {
  let at = -1;
  reps.forEach((r, i) => { if (r.startTime <= t && t <= r.endTime) at = i; });
  return at;
}

// Which phase of rep r is on screen at t: the first phase runs from the rep's start,
// the second ends at its end; between them the joint holds near its working angle.
// A rep the recording cut has no phases.
export function phaseAt(r, t, first) {
  if (!r || r.clipped || !first) return null;
  const second = first === 'concentric' ? 'eccentric' : 'concentric';
  const len = { concentric: r.concentricSec, eccentric: r.eccentricSec };
  if (t <= r.startTime + len[first]) return first;
  if (t >= r.endTime - len[second]) return second;
  return null;
}

// A rep is reached a frame inside its start: a seek to the start itself may land on the frame before it,
// where the screen would name no rep (1 October 2026, check.mjs). 0.04 s is one frame at 25 fps.
export const into = r => Math.min(r.startTime + 0.04, (r.startTime + r.endTime) / 2);

// The keys of the replay's line (role="slider"): the arrows, either pair, and Page Up / Page Down go to the
// next or previous rep, as a slider's keys move it by one step (audit of 6 October: Up and Down did nothing);
// Home and End to the video's ends. The moment to seek to, or null for a key the line leaves alone.
const STEP = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 };
export function keyedTime(key, reps, now, length) {
  const step = STEP[key];
  if (step) {
    const next = step > 0 ? reps.findIndex(r => r.startTime > now + 0.05) : reps.map(r => r.startTime < now - 0.05).lastIndexOf(true);
    return next >= 0 ? into(reps[next]) : step > 0 ? length : 0;
  }
  if (key === 'Home') return 0;
  if (key === 'End') return length;
  return null;
}

/** The tracked 3D joint angle at time t, or null if unmeasured / dropout. */
export function angleAt(angles, times, t) {
  if (!angles?.length || !times?.length) return null;
  const i = nearest(times, t);
  const a = angles[i];
  return (a !== null && a !== undefined && Number.isFinite(a)) ? a : null;
}

/** The landmark index or pair of indices representing the load / bar path for a lift. */
export function barLandmarks(lift, def) {
  const l = String(lift || '').toLowerCase();
  if (l.includes('squat')) return [11, 12]; // barbell across shoulders
  if (l.includes('thrust')) return [23, 24]; // barbell across hips
  if (def?.joint === 'knee') return [27, 28]; // ankles/feet for leg extensions/curls
  return [15, 16]; // wrists/hands for presses, curls, pulls, deadlifts
}

/** The load coordinate in image space at time t, or null if unseen. */
export function loadPointAt(lm, lift, def, arm) {
  if (!lm) return null;
  const indices = barLandmarks(lift, def);
  const seen = k => lm[k] && lm[k].visibility >= SEEN;
  if (indices.length === 2) {
    const [l, r] = indices;
    if (arm === 'left') return seen(l) ? { x: lm[l].x, y: lm[l].y } : null;
    if (arm === 'right') return seen(r) ? { x: lm[r].x, y: lm[r].y } : null;
    if (seen(l) && seen(r)) return { x: (lm[l].x + lm[r].x) / 2, y: (lm[l].y + lm[r].y) / 2 };
    if (seen(l)) return { x: lm[l].x, y: lm[l].y };
    if (seen(r)) return { x: lm[r].x, y: lm[r].y };
    return null;
  }
  const idx = indices[0];
  return seen(idx) ? { x: lm[idx].x, y: lm[idx].y } : null;
}

/**
 * Returns the trajectory points to draw for the active rep or recent trail.
 * Returns array of { x, y, alpha, t } in 0..1 normalized image coordinates.
 */
export function trajectoryAt(frames, times, t, rep, lift, def, arm) {
  if (!frames?.length || !times?.length) return [];
  const points = [];
  if (rep && !rep.clipped) {
    const startIdx = Math.max(0, before(times, rep.startTime));
    const endIdx = Math.min(frames.length - 1, before(times, rep.endTime) + 1);
    for (let i = startIdx; i <= endIdx; i++) {
      const pt = loadPointAt(frames[i], lift, def, arm);
      if (pt) {
        const isPast = times[i] <= t;
        points.push({ x: pt.x, y: pt.y, alpha: isPast ? 0.9 : 0.3, t: times[i] });
      }
    }
  } else {
    const windowStart = Math.max(0, t - 1.2);
    const startIdx = Math.max(0, before(times, windowStart));
    const endIdx = Math.min(frames.length - 1, before(times, t));
    for (let i = startIdx; i <= endIdx; i++) {
      const pt = loadPointAt(frames[i], lift, def, arm);
      if (pt) {
        const age = t - times[i];
        const alpha = Math.max(0.1, 1 - age / 1.2) * 0.75;
        points.push({ x: pt.x, y: pt.y, alpha, t: times[i] });
      }
    }
  }
  return points;
}
