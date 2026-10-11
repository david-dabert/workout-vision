// Package artwork is CC BY-SA 4.0. Preserve source metadata and licence alongside resized WebP adaptations.
import { readFile, mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const source = 'node_modules/@bryllim/workout-guide';
const destination = 'public/guide';

const sourceExists = await access(source).then(() => true, () => false);
if (!sourceExists) {
  console.log('[copy-guide] Workout guide source not present in node_modules, skipping');
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('[copy-guide] sharp module not installed, skipping artwork conversion');
  process.exit(0);
}

const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
await mkdir(destination, { recursive: true });
let frames = 0;
for (const exercise of manifest) {
  await mkdir(join(destination, exercise.slug), { recursive: true });
  for (const frame of exercise.frames) {
    await sharp(join(source, frame.path)).resize(320, 320, { fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toFile(join(destination, exercise.slug, `frame-${frame.index}.webp`));
    frames++;
  }
}
for (const name of ['ATTRIBUTION.md', 'LICENSE-ASSETS', 'manifest.json']) await copyFile(join(source, name), join(destination, name));
await writeFile(join(destination, 'CHANGES.txt'), 'WorkoutVision: PNG frames resized to 320 × 320 and converted to WebP. Adapted images remain CC BY-SA 4.0.\n');
console.log(JSON.stringify({ exercises: manifest.length, webpFrames: frames, size: '320 × 320', licence: 'CC BY-SA 4.0' }));
