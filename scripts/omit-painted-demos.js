/**
 * The pre-rendered "analysed" demo videos and the posters cut from them carry figures, verdicts and names burned into
 * the picture that no code ever measured (TOUR, GOLD, SAFE, ELITE, 97.6 % SOUND, 58 Nm, 116.4 mph, 4.6 G, real people;
 * audit of 14 October 2026, EQ and SP findings). No screen shows them since the honesty pass; this keeps them out of the
 * built site too, so they cannot be fetched by their old address. The files stay in public/ (CLAUDE.md R5): removing
 * them from the repository is David's call.
 * Status: convention (build hygiene; no measurement involved).
 */
import { rmSync, existsSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';

// Paths under the built site's demo/ folder, as public/ holds them.
const PAINTED = [
  /^demo\/sports\/[a-z]+-demo-analyzed\.mp4$/,
  /^demo\/sports\/[a-z]+-demo-poster\.jpg$/,
  /^demo\/workoutvision-[a-z-]*analyzed[a-z-]*\.mp4$/,
];

/** True for a path (relative to the site's root, either separator) of a painted demo file. */
export function isPaintedDemo(path) {
  const p = String(path).split(sep).join('/').replace(/^\/+/, '');
  return PAINTED.some(re => re.test(p));
}

/** Every file under dir, as paths relative to root. */
function walk(dir, root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full, root) : [relative(root, full)];
  });
}

/** Vite plugin: after the build has copied public/ into the output, take the painted demo files back out of it. */
export function omitPaintedDemosPlugin() {
  let outDir = 'dist';
  return {
    name: 'omit-painted-demos',
    apply: 'build',
    configResolved(config) { outDir = join(config.root, config.build.outDir); },
    closeBundle() {
      const demo = join(outDir, 'demo');
      if (!existsSync(demo)) return;
      for (const rel of walk(demo, outDir)) if (isPaintedDemo(rel)) rmSync(join(outDir, rel));
    },
  };
}
