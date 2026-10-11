import { getAllGuideExercises, getMappedKeys, getExerciseFrames } from '../src/lib/exerciseGuide.js';
import { writeFileSync, mkdirSync } from 'node:fs';
const urls = [...new Set([
  ...getAllGuideExercises().flatMap(ex => ex.frames),
  ...getMappedKeys().flatMap(key => getExerciseFrames(key)?.frames || []),
])].sort();
const results = new Array(urls.length);
let next = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < urls.length) {
    const i = next++, url = urls[i];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      results[i] = { url, status: response.status, png: bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 };
    } catch (error) { results[i] = { url, status: null, error: error.message }; }
  }
}));
const report = {
  checkedAt: new Date().toISOString(), exercises: getAllGuideExercises().length,
  addresses: urls.length, http200: results.filter(r => r.status === 200).length,
  non200: results.filter(r => r.status !== 200).length,
  invalidImages: results.filter(r => r.status === 200 && !r.png).length,
  results,
};
mkdirSync('evidence/step3a', { recursive: true });
writeFileSync(process.env.GUIDE_CHECK_OUTPUT || 'evidence/step3a/frame-addresses.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, results: results.filter(r => r.status !== 200 || !r.png) }, null, 2));
if (report.non200 || report.invalidImages) process.exitCode = 1;
