// Writes src/components/experience/guide-sources.json: the guide's frames that adapt another work, by that work's
// creator, as the guide's manifest names them (frames[].attribution.source; @bryllim/workout-guide 1.0.0: 76 first
// poses after Everkinetic, CC BY-SA 4.0, ATTRIBUTION.md). The exercise sheet's PDF prints those frames and credits that
// creator with them (programme-pdf.js, CC BY-SA 4.0, section 3(a)(1)(A)(i)); the manifest itself (550 kB) stays out of
// the PDF's code. Run after any update of the guide: node scripts/guide-sources.mjs.
// src/components/experience/__tests__/guide-sources.test.js fails while the two differ.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const manifestPath = createRequire(import.meta.url).resolve('@bryllim/workout-guide/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const bySource = {};
for (const exercise of manifest) {
  for (const frame of exercise.frames) {
    const name = frame.attribution?.source?.name;
    if (name) (bySource[name] ??= []).push(`${exercise.slug}/frame-${frame.index}`);
  }
}
const out = Object.fromEntries(Object.keys(bySource).sort().map(name => [name, bySource[name].sort()]));
await writeFile(new URL('../src/components/experience/guide-sources.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([name, frames]) => [name, frames.length]))));
