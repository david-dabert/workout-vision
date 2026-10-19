// node scripts/make-guide-svgs.mjs
// A still SVG of every guide exercise (David, 19 October 2026: SVG figures), from the same poses as its animated figure
// (src/components/experience/guide-poses.json, scripts/make-guide-figures.mjs): the rest pose faint, the working end
// (the figure's `still` frame) drawn over it. A drawing from the exercise's motion spec, never a measurement.
// Writes public/guide-svg/<key>.svg. Status: convention (presentation only).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
// The bones the replay draws (replay-draw.js BONES), and the head as a circle round the nose.
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const decode = s => Array.from({ length: 33 }, (_, i) => {
  const a = s.charAt(i * 4), b = s.charAt(i * 4 + 1);
  if (a === 'z' && b === 'z') return null;
  return [DIG.indexOf(a) * 36 + DIG.indexOf(b), DIG.indexOf(s.charAt(i * 4 + 2)) * 36 + DIG.indexOf(s.charAt(i * 4 + 3))];
});
const r1 = v => Math.round(v * 10) / 10;

function pose(p, { stroke, width, opacity }) {
  const lines = BONES.filter(([a, b]) => p[a] && p[b]).map(([a, b]) => `M${r1(p[a][0])} ${r1(p[a][1])}L${r1(p[b][0])} ${r1(p[b][1])}`).join('');
  const head = p[0] && p[11] && p[12] ? (() => {
    const sw = Math.hypot(p[11][0] - p[12][0], p[11][1] - p[12][1]);
    return `<circle cx="${r1(p[0][0])}" cy="${r1(p[0][1])}" r="${r1(Math.max(28, sw * 0.32))}" fill="none"/>`;
  })() : '';
  return `<g stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}"><path d="${lines}"/>${head}</g>`;
}

const data = JSON.parse(readFileSync('src/components/experience/guide-poses.json', 'utf8'));
mkdirSync('public/guide-svg', { recursive: true });
let n = 0;
for (const [key, d] of Object.entries(data)) {
  const [w, h] = d.loop.vb, frames = d.loop.f;
  const rest = decode(frames[0]), work = decode(frames[Math.round(d.still ?? frames.length * 0.55) % frames.length]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${key}">`
    + pose(rest, { stroke: 'currentColor', width: 14, opacity: 0.28 })
    + pose(work, { stroke: 'currentColor', width: 18, opacity: 1 })
    + '</svg>\n';
  writeFileSync(`public/guide-svg/${key}.svg`, svg);
  n++;
}
console.log(`${n} figures written to public/guide-svg/`);
