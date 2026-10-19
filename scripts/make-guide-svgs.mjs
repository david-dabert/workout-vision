// node scripts/make-guide-svgs.mjs
// A still SVG of every guide exercise (David, 19 October 2026: SVG figures), from the same poses as its animated figure
// (src/components/experience/guide-poses.json, scripts/make-guide-figures.mjs): the rest pose faint, the working end
// (the figure's `still` frame) drawn over it. A drawing from the exercise's motion spec, never a measurement.
// Writes public/guide-svg/<key>.svg and src/components/experience/guide-svg-keys.json. Status: convention (presentation only).
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
  // The head centred between the ears (7, 8) where both are posed, else on the nose (0): in a side view the nose sits
  // forward of the skull, and a circle round it floats off the neck.
  const c = p[7] && p[8] ? [(p[7][0] + p[8][0]) / 2, (p[7][1] + p[8][1]) / 2] : p[0];
  const head = c && p[11] && p[12] ? (() => {
    const sw = Math.hypot(p[11][0] - p[12][0], p[11][1] - p[12][1]);
    return `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(Math.max(28, sw * 0.32))}" fill="none"/>`;
  })() : '';
  return `<g stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}"><path d="${lines}"/>${head}</g>`;
}

// The guide's exercises, and the nine card lifts from their own poses (lift-poses.json, the same format; the working
// end at 0.55 of the loop, as lift-scenes.js stills it), so every exercise of the list has its figure.
const data = { ...JSON.parse(readFileSync('src/components/experience/guide-poses.json', 'utf8')), ...JSON.parse(readFileSync('src/components/experience/lift-poses.json', 'utf8')) };
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
writeFileSync('src/components/experience/guide-svg-keys.json', JSON.stringify(Object.keys(data).sort()) + '\n');
console.log(`${n} figures written to public/guide-svg/`);
