// The guide's drawings on the exercise sheet's PDF (programme-pdf.js, 14 October 2026): the first and last poses of
// each exercise, ready before the coach's tap, since the PDF is built within it (Safari shares only from the tap).
// Imported by programme-pdf.js only, so it loads with the PDF's code, never with the first screen.
//
// The drawings are 320 × 320 lossless WebP with near-white strokes on full transparency (scripts/copy-guide.js; measured
// on the plank, the squat and the glute bridge, 14 October 2026). jsPDF would turn a WebP into a JPEG without its
// alpha (white strokes on black), and on the cream paper the strokes would barely show. So each frame is drawn on a
// canvas, its strokes painted in the sheet's ink with their alpha kept, laid on the sheet's paper, and kept as a JPEG,
// which jsPDF embeds as it is, with nothing to decode within the tap.
import { guideExercise } from './exercise-info';
import { PAPER } from './palette';

// A frame's side in pixels: about 270 dpi for a drawing 64 pt wide on the A5 sheet. Status: convention, UNSOURCED.
export const DRAWING_PX = 240;
// The JPEG's quality: about 7.6 kB a frame, measured on 20 frames at 240 px (14 October 2026), clean lines.
// Status: convention, UNSOURCED.
export const JPEG_QUALITY = 0.88;
// A frame not ready in this time is left out: the PDF button is never left waiting. Status: convention, UNSOURCED.
export const LOAD_TIMEOUT_MS = 6000;
// Frames kept for the visit: more than the two frames of each of a programme's 24 exercises (LIMITS.items), so the
// programme being warmed never loses its own. Status: convention, UNSOURCED.
export const MAX_KEPT = 96;

/**
 * The frames the sheet prints for an exercise: { urls: [first pose, last pose], slug, similar }, slug the drawing's
 * own (a borrowed drawing's, for an exercise drawn with a similar movement, which `similar` says), or null for an
 * exercise with no drawing (the machine seated back extension) or unknown to the guide.
 */
export function sheetFrames(key) {
  const e = guideExercise(key);
  if (!e?.frames?.length) return null;
  return { urls: [e.frames[0], e.frames.at(-1)], slug: e.drawing ?? e.slug, similar: !!e.similar };
}

/**
 * A frame made ready for paper, in the browser: decoded, drawn contain-fit on a DRAWING_PX canvas, its strokes painted
 * in ink with their alpha ('source-in'), the paper laid under them ('destination-over'), then kept as a JPEG data URL.
 * The canvas is emptied at once, which frees its memory on iOS. Same origin: the canvas is never tainted.
 */
export async function loadForPaper(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = DRAWING_PX;
  const ctx = canvas.getContext('2d'), w = img.naturalWidth, h = img.naturalHeight;
  if (!ctx || !w || !h) return null;
  const k = Math.min(DRAWING_PX / w, DRAWING_PX / h), dw = w * k, dh = h * k;
  ctx.drawImage(img, (DRAWING_PX - dw) / 2, (DRAWING_PX - dh) / 2, dw, dh);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(0, 0, DRAWING_PX, DRAWING_PX);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = PAPER.paper;
  ctx.fillRect(0, 0, DRAWING_PX, DRAWING_PX);
  const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  canvas.width = canvas.height = 0;
  return { data, format: 'JPEG' };
}

/**
 * The frames made ready for the visit. load(url) gives { data, format } (loadForPaper; the tests give their own).
 * warm(keys): loads each frame of those exercises once, however often it is asked; a frame that fails, comes back
 * empty, or takes longer than `timeout` is kept as null for the visit (left out of the sheet). ready(keys): whether
 * every frame of those exercises has settled, at once. of(programme): at once, a Map from each exercise of the
 * programme to { start, end, similar }, each frame { data, format, alias } or null, or to null when it has no frame.
 * The alias (g-<drawing>-<frame>) lets jsPDF embed a frame once, for an exercise twice in the programme or a drawing
 * two exercises borrow.
 */
export function drawingCache({ load = loadForPaper, timeout = LOAD_TIMEOUT_MS, max = MAX_KEPT } = {}) {
  const done = new Map(), pending = new Map();
  const keep = (url, value) => {
    done.delete(url);
    done.set(url, value);
    // The longest unused go first; the frames just asked for are the newest.
    while (done.size > max) done.delete(done.keys().next().value);
  };
  const settle = url => {
    if (done.has(url)) { keep(url, done.get(url)); return Promise.resolve(); }
    if (pending.has(url)) return pending.get(url);
    let timer;
    const late = new Promise(resolve => { timer = setTimeout(() => resolve(null), timeout); });
    const loaded = Promise.resolve().then(() => load(url)).then(
      v => (v && typeof v.data === 'string' && typeof v.format === 'string' ? { data: v.data, format: v.format } : null),
      () => null,
    );
    const p = Promise.race([loaded, late]).then(value => {
      clearTimeout(timer);
      pending.delete(url);
      keep(url, value);
    });
    pending.set(url, p);
    return p;
  };
  const framesOf = keys => [...new Set(keys)].map(key => [key, sheetFrames(key)]);
  const urlsOf = keys => framesOf(keys).flatMap(([, f]) => f?.urls ?? []);
  return {
    warm: keys => Promise.all(urlsOf(keys).map(settle)).then(() => undefined),
    ready: keys => urlsOf(keys).every(url => done.has(url)),
    of: programme => new Map(framesOf((programme?.items || []).map(i => i.key)).map(([key, f]) => {
      if (!f) return [key, null];
      const [start, end] = f.urls.map((url, i) => {
        const v = done.get(url), frame = /frame-(\d+)\.webp$/.exec(url)?.[1] ?? String(i + 1);
        return v ? { ...v, alias: `g-${f.slug}-${frame}` } : null;
      });
      return [key, start || end ? { start, end, similar: f.similar } : null];
    })),
  };
}

/** The app's own frames, kept for the visit (Pro.jsx, through programme-pdf.js). */
export const drawings = drawingCache();
