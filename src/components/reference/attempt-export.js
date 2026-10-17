// What the patient keeps of an attempt (David, 17 October 2026: "the client should be able to see and download their
// reports and overlay video ... show it to their coach or share it online or save it themselves"): the attempt's video
// with the comparison drawn on it, recorded on the phone (experience/video-export.js recordVideo), and still frames of
// it for the report (lib/kine/pdf.js attemptPdf). Nothing is sent anywhere: the files go to the share sheet or the
// phone's files when the patient taps there.
//
// The physiotherapist's own video is never in these files, only his movement as the dashed ghost skeleton: a file the
// patient may post online must not carry a third party's picture, and the physiotherapist was not asked to have his
// videos shared beyond the app.
import { recordVideo } from '../experience/video-export';
import { SAMPLE_HZ } from '../../lib/reference/compare';
import { drawComparison } from './overlay-draw';

// The comparison's colours on screen (ReferenceCompare.css --lamp, --bone, --ash).
export const COLORS = Object.freeze({ lamp: '#E8BD7E', bone: '#EFE8DC', ash: '#A49B8D' });

/** A file name's part from free text: letters and digits, dashes between, lower case. */
export const slug = text => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40);

/**
 * The moments the report shows: the reference's end of the movement for the main measure (the one that moves most)
 * and the largest gap of each measure; each at a moment both videos show (R8), at least a second apart, at most three.
 * Each moment carries the attempt sample shown in its still: among the samples the alignment matched to it (or within
 * half a second), one the attempt shows, nearest the matched value; and that sample's own value (`att`), so the
 * picture and its caption say the same thing. { ri, ai, k, kind, att, ref }.
 */
export function reportMoments(result) {
  if (!result || result.verdict === 'refused' || !result.path) return [];
  const out = [];
  const add = (ri, kind, k) => {
    if (ri == null || ri < 0 || !result.seen[k]?.[ri]) return;
    if (out.some(m => Math.abs(m.ri - ri) < SAMPLE_HZ)) return;
    const near = result.path.filter(([r]) => Math.abs(r - ri) <= SAMPLE_HZ / 2).map(([, a]) => a).filter(a => result.attSeen?.[k]?.[a]);
    if (!near.length) return;
    const want = result.matched[k][ri];
    const ai = near.reduce((a, b) => (Math.abs(result.attempt[k][b] - want) < Math.abs(result.attempt[k][a] - want) ? b : a));
    out.push({ ri, ai, kind, k, att: result.attempt[k][ai], ref: result.reference[k][ri] });
  };
  const moving = result.joints.map((j, k) => [j, k]).filter(([j]) => j.kind === 'moving');
  const main = moving.length ? moving.reduce((a, b) => ((b[0].rangeShare ?? 0) > (a[0].rangeShare ?? 0) ? b : a))[1] : 0;
  // End of the movement: the reference's furthest point from where it starts, among the moments both videos show
  // (the top of a raise; the horizontal of an arm lowered from the vertical).
  const ref = result.reference[main], seen = result.seen[main];
  const shown = ref.map((v, i) => [v, i]).filter(([, i]) => seen[i]);
  if (shown.length) {
    const start = ref.find(v => v != null);
    const [, far] = shown.reduce((a, b) => (Math.abs(b[0] - start) > Math.abs(a[0] - start) ? b : a));
    add(far, 'end', main);
  }
  result.joints.forEach((_, k) => add(sustainedWorst(result, k), 'worst', k));
  return out.slice(0, 3);
}

/**
 * The moment of a measure's largest gap held for about a second: the median gap over a second around each moment both
 * videos show, at its largest. A single sample the pose model misread (a wrist taken for the other one) is not shown
 * as the attempt's largest gap. Status: convention (presentation only; the verdict's figures are compare.js's).
 */
export function sustainedWorst(result, k) {
  const ref = result.reference[k], att = result.matched[k], seen = result.seen[k], half = SAMPLE_HZ / 2;
  let best = null, bestGap = -1;
  for (let i = 0; i < ref.length; i++) {
    if (!seen[i]) continue;
    const w = [];
    for (let x = Math.max(0, i - half); x <= Math.min(ref.length - 1, i + half); x++) if (seen[x]) w.push(Math.abs(att[x] - ref[x]));
    w.sort((a, b) => a - b);
    const g = w[Math.floor(w.length / 2)];
    if (g > bestGap) { bestGap = g; best = i; }
  }
  return best;
}

/** The attempt's time (on its video's clock) of one of its samples at SAMPLE_HZ. */
export const attemptTimeAt = (ai, maps) => maps.attT0 + ai / SAMPLE_HZ;

/**
 * Records the attempt's video with the comparison drawn on it, a band at the top (the exercise and the verdict) and
 * the legend at the foot, so the file explains itself away from the app. Call it inside the tap (recordVideo).
 * screen: the comparison's video on screen. text: { title, verdict, legend }.
 */
export function exportAttemptVideo({ screen, result, attPose, refPose, maps, measures, names, refShort, text, fileStem, onProgress, signal }) {
  const draw = (ctx, t, W, H, u) => {
    drawComparison(ctx, { t, w: W, h: H, u, result, attPose, refPose, maps, measures, names, refShort, colors: COLORS, ghost: true });
    band(ctx, W, H, u, text);
  };
  return recordVideo({ screen, draw, onProgress, signal, name: mime => `${fileStem}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}` });
}

// The band at the top (exercise, verdict) and the legend at the foot, on a dark ground so they read on any picture.
function band(ctx, W, H, u, { title, verdict, legend }) {
  const pad = 14 * u;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = `500 ${Math.round(14 * u)}px system-ui, sans-serif`;
  const tw = Math.min(ctx.measureText(title).width, W - 2 * pad);
  ctx.font = `${Math.round(26 * u)}px Georgia, serif`;
  const vw = Math.min(ctx.measureText(verdict).width, W - 2 * pad);
  ctx.fillStyle = 'rgba(10,10,10,0.6)';
  ctx.fillRect(pad - 8 * u, pad - 8 * u, Math.max(tw, vw) + 16 * u, 58 * u);
  ctx.fillStyle = COLORS.bone;
  ctx.font = `500 ${Math.round(14 * u)}px system-ui, sans-serif`;
  ctx.fillText(title, pad, pad, W - 2 * pad);
  ctx.fillStyle = COLORS.lamp;
  ctx.font = `${Math.round(26 * u)}px Georgia, serif`;
  ctx.fillText(verdict, pad, pad + 18 * u, W - 2 * pad);
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.round(12 * u)}px system-ui, sans-serif`;
  const lines = wrap(ctx, legend, W - 2 * pad), lh = 16 * u;
  const lw = Math.max(...lines.map(l => ctx.measureText(l).width));
  ctx.fillStyle = 'rgba(10,10,10,0.6)';
  ctx.fillRect(pad - 8 * u, H - pad - lines.length * lh - 6 * u, lw + 16 * u, lines.length * lh + 12 * u);
  ctx.fillStyle = COLORS.bone;
  lines.forEach((l, i) => ctx.fillText(l, pad, H - pad - (lines.length - 1 - i) * lh));
  ctx.restore();
}

function wrap(ctx, text, max) {
  const out = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/**
 * A still of the attempt at time t, the comparison drawn on it, as a JPEG data URL ({ data, w, h }), at most maxW
 * wide. Taken from the video on screen (Safari draws a video it shows): seeked to t, drawn once it has the frame,
 * left where it was. Rejects after 4 s without the frame.
 */
export function attemptStill(video, t, draw, { maxW = 720 } = {}) {
  return new Promise((resolve, reject) => {
    const back = video.currentTime, wasPaused = video.paused;
    video.pause();
    let timer = 0;
    const done = (err, out) => {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      try { video.currentTime = back; } catch { /* left where it is */ }
      if (!wasPaused) video.play()?.catch(() => {});
      if (err) reject(err); else resolve(out);
    };
    const onSeeked = () => {
      try {
        const vw = video.videoWidth || 720, vh = video.videoHeight || 1280, k = Math.min(1, maxW / vw);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vw * k); canvas.height = Math.round(vh * k);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        draw(ctx, t, canvas.width, canvas.height, canvas.width / 390);
        const data = canvas.toDataURL('image/jpeg', 0.85);
        const out = { data, w: canvas.width, h: canvas.height };
        canvas.width = 0; canvas.height = 0;
        done(null, out);
      } catch (e) { done(e); }
    };
    video.addEventListener('seeked', onSeeked);
    timer = setTimeout(() => done(new Error('still-timeout')), 4000);
    video.currentTime = Math.max(0, Math.min(t, (video.duration || t) - 0.05));
  });
}
