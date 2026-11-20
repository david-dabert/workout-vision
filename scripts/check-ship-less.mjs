// Card 049 (16 November 2026, review panel, architecture lens): the production build ships only what its pages use.
// Usage: node scripts/check-ship-less.mjs [dist]. Fails when dist/ holds a chunk of a route switched off in production
// (showUnmeasuredRoutes, buildFlags.js), the Vercel Blob upload client (upload is off in production, attemptStorage.js),
// or Open Food Facts in a page's connect-src (only the extended CoachSuite looks foods up, openFoodFacts.js).
// Prints what it found, one line each. The MediaPipe WASM files are listed, not judged: one leaves only after a network
// log on Chromium and WebKit shows it is never requested (the card's condition).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The screens App.jsx offers only in the extended build (VITE_EXTENDED_ROUTES=1): their chunks' names.
export const EXTENDED_CHUNKS = ['Equine', 'SportsBiomechanics', 'CoachFinder', 'GymBuddy', 'Ergonomics', 'Chat', 'InvestorShowcaseModal', 'CoachSuite', 'ActivityScreen'];
const BLOB_MARKERS = ['handleUploadUrl', 'x-vercel-blob', 'vercel-blob'];
const LOOKUP = 'world.openfoodfacts.org';

/** What dist/ ships that production switched off: [{ kind, what }]. */
export async function shippedOff(dir) {
  const out = [];
  const assets = await readdir(join(dir, 'assets'));
  for (const f of assets) {
    const name = f.replace(/-[\w-]{8}\.(js|css)$/, '');
    if (EXTENDED_CHUNKS.includes(name)) out.push({ kind: 'extended chunk', what: `assets/${f}` });
    if (f.endsWith('.js')) {
      const text = await readFile(join(dir, 'assets', f), 'utf8');
      if (BLOB_MARKERS.some(m => text.includes(m))) out.push({ kind: 'Blob upload client', what: `assets/${f}` });
    }
  }
  for (const f of (await readdir(dir)).filter(x => x.endsWith('.html'))) {
    const html = await readFile(join(dir, f), 'utf8');
    for (const m of html.matchAll(/connect-src [^;"]*/g)) if (m[0].includes(LOOKUP)) out.push({ kind: 'connect-src lookup', what: `${f}: ${LOOKUP}` });
  }
  try {
    const mediapipe = await readdir(join(dir, 'mediapipe'));
    for (const dead of ['vision_wasm_module_internal.wasm', 'vision_wasm_module_internal.js']) {
      if (mediapipe.includes(dead)) out.push({ kind: 'unused MediaPipe module asset', what: `mediapipe/${dead}` });
    }
  } catch { /* none */ }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist';
  const found = await shippedOff(dir);
  let wasm = [];
  try { wasm = (await readdir(join(dir, 'mediapipe'))).filter(f => f.endsWith('.wasm')); } catch { /* none */ }
  console.log(`MediaPipe WASM in ${dir}/mediapipe: ${wasm.join(', ') || 'none'}`);
  if (found.length) {
    console.log(`${dir}/ ships what production switched off:\n${found.map(x => `  ${x.kind}: ${x.what}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`${dir}/: no extended chunk, no Blob upload client, no lookup origin in any connect-src, no unused MediaPipe module asset.`);
}
