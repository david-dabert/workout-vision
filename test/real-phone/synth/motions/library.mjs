#!/usr/bin/env node
// node test/real-phone/synth/motions/library.mjs [--per N] [--shard k/n] [key or spec file ...] > matrix.json
// The motion library's render matrix (README.md) for run.mjs: for every spec with reps (motions/<key>.json without
// noReps), N sets (default 6) that vary as filmed sets do, each drawn from its own id, so a shard renders the same sets
// on any machine. Per set: the body (michelle and soldier in turn; run.mjs SYNTH_MODELS), the reps (3 to 16: the count,
// exact), the tempo (way out 0.5-1.8 s, way back 0.6-2.2 s, or the spec's own "tempo": { "out": [min, max], "back":
// [min, max] } in seconds, with synth.js's per-rep jitter on top), each rep's reach (within 12 % of the working end), the
// still time before and after (0.4-2.5 s), the view (the spec's within 30 degrees; one set in six from the other side),
// the framing (fill 1.0-1.6, camera 0.3 m below to 0.5 m above the body's centre, or within 0.2 m of the spec's own
// camLift) and, one set in four, a degradation: a bystander beside the lifter, or a dim light with pixel noise.
// Every range is UNSOURCED (R9), chosen to span what David's real videos show; status experimental.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const FAMILIES = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/counting/guide-families.json'), 'utf8'));
const argv = process.argv.slice(2), opt = (k, d) => (argv.includes(k) ? argv.splice(argv.indexOf(k), 2)[1] : d);
const PER = Number(opt('--per', 6)), [SK, SN] = opt('--shard', '0/1').split('/').map(Number);
const keys = argv.length ? argv : readdirSync(HERE).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const hash = s => parseInt(createHash('sha256').update(s).digest('hex').slice(0, 8), 16);
const sets = [];
for (const arg of keys) {
  // An argument ending in .json is a spec file read from its path, keyed by its name (a draft outside motions/).
  const key = basename(arg, '.json'), spec = JSON.parse(readFileSync(arg.endsWith('.json') ? resolve(arg) : resolve(HERE, `${arg}.json`), 'utf8'));
  if (spec.noReps) continue;
  const own = spec.view ?? (FAMILIES[key]?.view === 'front' ? 0 : 90);
  for (let v = 0; v < PER; v++) {
    const id = `lib-${key}-v${v}`;
    if (hash(id) % SN !== SK) continue;
    let s = hash(`draw:${id}`) || 1;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    const between = (a, b) => a + (b - a) * r();
    const view = Math.round((r() < 1 / 6 ? (own === 0 ? 90 : 0) : own) + between(-30, 30));
    const d = r();
    const [o0, o1] = spec.tempo?.out ?? [0.5, 1.8], [b0, b1] = spec.tempo?.back ?? [0.6, 2.2];
    sets.push({
      id, spec, model: v % 2 ? 'soldier' : 'michelle', seed: hash(`seed:${id}`), reps: Math.floor(between(3, 17)),
      outSec: +between(o0, o1).toFixed(2), backSec: +between(b0, b1).toFixed(2), ampJit: 0.12,
      startRest: +between(0.4, 2.5).toFixed(2), endRest: +between(0.4, 2.5).toFixed(2),
      view, fill: +between(1.0, 1.6).toFixed(2), camLift: +(spec.camLift != null ? spec.camLift + between(-0.2, 0.2) : between(-0.3, 0.5)).toFixed(2),
      ...(d < 0.125 ? { occlude: { person: { side: +between(0.6, 1.0).toFixed(2), depth: +between(0.2, 1.0).toFixed(2) } } }
        : d < 0.25 ? { occlude: { light: +between(0.3, 0.6).toFixed(2), noise: Math.round(between(4, 12)) } } : {}),
    });
  }
}
process.stdout.write(JSON.stringify(sets));
console.error(`${sets.length} sets from ${keys.length} specs (shard ${SK}/${SN}, ${PER} per spec)`);
