// Writes the variants into the guide's one catalogue (src/lib/guide-catalog.json; David, 18 November 2026: "we need just
// one exercises list not two"). A variant ("bicep_curl--cable", src/lib/variant-key.js) is the base's movement with other
// equipment, grip or stance: its own names and equipment, its base's category, muscles, counting, filming view and figure.
// Every variant entry is rebuilt from the sources below on each run, placed after its base, so the file and the sources
// never drift. Also writes src/lib/exercises/legacy-ids.json: each id of the filming drawer's former registry (144
// movements x 9 training techniques, #267) to the catalogue key it now names, so a set saved under an old id still reads.
// Then run: node scripts/guide-keys.mjs (the first screen's key list leaves variants out).
//   node scripts/make-variants.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { FOLD, VARIANTS as REGISTRY_VARIANTS, UNALIAS, ALIAS } from './variants/registry-fold.mjs';
import { SOURCES } from './variants/index.mjs';

const at = p => new URL(`../${p}`, import.meta.url);
const CATALOGUE = at('src/lib/guide-catalog.json');
const LEGACY = at('src/lib/exercises/legacy-ids.json');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function makeVariants(catalogue, registry) {
  const errors = [];
  const bases = catalogue.filter(e => !e.key.includes('--')).map(e => ({ ...e, aliases: [...e.aliases] }));
  const byKey = new Map(bases.map(e => [e.key, e]));
  // Aliases moved off a base that wore another exercise's name, then the registry's names for exercises held under another.
  for (const [key, list] of Object.entries(UNALIAS)) {
    const e = byKey.get(key); if (!e) { errors.push(`UNALIAS names ${key}, not in the catalogue`); continue; }
    const drop = new Set(list.map(norm));
    e.aliases = e.aliases.filter(a => !drop.has(norm(a)));
  }
  for (const [key, list] of Object.entries(ALIAS)) {
    const e = byKey.get(key); if (!e) { errors.push(`ALIAS names ${key}, not in the catalogue`); continue; }
    for (const a of list) if (!e.aliases.some(x => norm(x) === norm(a))) e.aliases.push(a);
  }
  // The variants, each after its base (and the base's earlier variants), in source order.
  const all = [...REGISTRY_VARIANTS, ...SOURCES.flatMap(s => s.VARIANTS)];
  const after = new Map();
  const seen = new Set();
  const names = new Map(); // normalized name or alias -> key
  for (const e of bases) for (const n of [e.name, e.fr, ...e.aliases]) names.set(norm(n), e.key);
  for (const [key, name, fr, equipment, aliases = [], extra = {}] of all) {
    const i = key.indexOf('--'), base = byKey.get(key.slice(0, i));
    if (i < 1 || !base) { errors.push(`${key}: its base ${key.slice(0, i)} is not a catalogue exercise`); continue; }
    if (seen.has(key)) { errors.push(`${key}: defined twice`); continue; }
    if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(key.slice(i + 2))) { errors.push(`${key}: the suffix is not lower snake case`); continue; }
    seen.add(key);
    const own = [...new Set([name, fr, ...aliases].map(s => s.toLowerCase()))];
    for (const n of own) {
      const holder = names.get(norm(n));
      if (holder && holder !== key) errors.push(`${key}: "${n}" already names ${holder}`);
      names.set(norm(n), key);
    }
    const entry = { key, name, slug: key.replace(/--/g, '-').replace(/_/g, '-'), category: extra.category ?? base.category, equipment, muscles: extra.muscles ?? base.muscles, fr, aliases: own, base: base.key, figureOnly: true };
    if (!after.has(base.key)) after.set(base.key, []);
    after.get(base.key).push(entry);
  }
  const out = bases.flatMap(e => [e, ...(after.get(e.key) ?? [])]);
  // The registry's ids: each movement's id, and the id of each of its techniques, to the movement's catalogue key.
  const target = new Map(FOLD);
  const legacy = {};
  for (const r of registry.entries) {
    // A technique's id is its movement's id and the technique's own ("barbell_back_squat_drop_set").
    const movement = r.mod === 'standard' ? r.id : r.id.endsWith(`_${r.mod}`) ? r.id.slice(0, -(r.mod.length + 1)) : null;
    const key = movement && target.get(movement);
    if (!key) { errors.push(`registry id ${r.id}: no catalogue key`); continue; }
    if (!out.some(e => e.key === key)) { errors.push(`registry id ${r.id} -> ${key}: not in the catalogue`); continue; }
    legacy[r.id] = key;
  }
  return { catalogue: out, legacy, errors };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const catalogue = JSON.parse(readFileSync(CATALOGUE, 'utf8'));
  const registry = JSON.parse(readFileSync(at('src/lib/exercises/exercises.json'), 'utf8'));
  const { catalogue: out, legacy, errors } = makeVariants(catalogue, registry);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const text = `${JSON.stringify(out, null, 2)}\n`, legacyText = `${JSON.stringify(legacy, null, 1)}\n`;
  if (process.argv.includes('--check')) {
    const same = readFileSync(CATALOGUE, 'utf8') === text && readFileSync(LEGACY, 'utf8') === legacyText;
    console.log(same ? 'variants: in step' : 'variants: out of step, run node scripts/make-variants.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(CATALOGUE, text);
  writeFileSync(LEGACY, legacyText);
  const v = out.filter(e => e.key.includes('--')).length;
  console.log(JSON.stringify({ exercises: out.length, bases: out.length - v, variants: v, legacyIds: Object.keys(legacy).length }));
}
