// The guide's animated figures (scripts/make-guide-figures.mjs): every exercise of the guide drawn by the app from its
// motion spec, in the format and style of the nine card figures. A drawing, never a measurement: no count or parameter
// comes from it. The figures load in their own chunk, when a screen first shows one, so the first screens do not
// carry them; the keys that have one are known at once, so a screen keeps its layout while its figure loads.
import keys from './guide-figure-keys.json';

const HAS = new Set(keys);
/** The box every guide figure is drawn in (make-guide-figures.mjs BOX): the frame's proportions before it loads. */
export const GUIDE_BOX = [770, 1000];
export const hasGuideFigure = key => !!key && HAS.has(key);
let all = null;
/** The figure's data (view, fps, still, loop: { vb, f }), or null for an exercise without one. */
export function loadGuideFigure(key) {
  if (!hasGuideFigure(key)) return Promise.resolve(null);
  all ??= import('./guide-poses.json').then(m => m.default);
  return all.then(d => d[key] ?? null, () => null);
}
// Each exercise's own phase and particle seed, from its key, so two figures side by side do not move as one.
export const figureHash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

