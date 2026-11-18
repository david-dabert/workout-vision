/**
 * The exercise details the filming drawer, the result, the report sheet and the coaching read, from the guide's one
 * catalogue (src/lib/guide-catalog.json; David, 18 November 2026: "we need just one exercises list not two").
 *
 * Until 18 November 2026 this module held its own list (exercises.json, #267): 144 movements, each repeated with 9
 * training techniques (pause, tempo, slow eccentric, 1.5 reps, cluster, drop set, constant tension, lengthened partials,
 * standard), 1,296 rows shown as "1,200+ variations". A technique is how a set is done, not an exercise: every row now
 * names the catalogue exercise of its movement (legacy-ids.json, scripts/make-variants.mjs), so a set saved under an old
 * id still reads. exercises.json keeps the movements' archetypes and coaching cues (convention, UNSOURCED, R9), attached
 * to the catalogue exercises they were written for.
 */

import catalogue from '../guide-catalog.json';
import exerciseData from './exercises.json';
import legacyIds from './legacy-ids.json';
import { baseKey } from '../variant-key';
import { searchMatch, searchWords } from '../../components/experience/search-text';

export type KinematicArchetype = 'squat' | 'hinge' | 'push' | 'pull' | 'isolation';

export interface ExerciseDetails {
  id: string;
  name: string;
  name_fr: string;
  archetype: KinematicArchetype;
  counting_key: string;
  equipment: string;
  modifier: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  setup_en: string;
  setup_fr: string;
  execution_cues_en: string[];
  execution_cues_fr: string[];
  hypertrophy_tips_en: string[];
  hypertrophy_tips_fr: string[];
}

interface RawArchetype {
  baseId: string;
  archetype: KinematicArchetype;
  countingKey: string;
  primary: string[];
  secondary: string[];
  setupEn: string;
  setupFr: string;
  cuesEn: string[];
  cuesFr: string[];
  hypertrophyEn: string[];
  hypertrophyFr: string[];
}

interface RawModifier { id: string; nameEn: string; nameFr: string; cueEn: string; cueFr: string }
interface RawEntry { id: string; base: string; mod: string }
interface CatalogueEntry { key: string; name: string; fr: string; category: string; equipment: string; muscles: string[]; aliases: string[] }

const db = exerciseData as unknown as { archetypes: Record<string, RawArchetype>; modifiers: Record<string, RawModifier>; entries: RawEntry[] };
const LEGACY = legacyIds as Record<string, string>;
const CATALOGUE = catalogue as CatalogueEntry[];
const byKey = new Map(CATALOGUE.map(e => [e.key, e]));

// The coaching archetype each catalogue exercise was written for (the registry's movement that names it).
const archetypeOfKey = new Map<string, RawArchetype>();
for (const r of db.entries) {
  const key = LEGACY[r.id];
  if (key && r.mod === 'standard' && !archetypeOfKey.has(key) && db.archetypes[r.base]) archetypeOfKey.set(key, db.archetypes[r.base]);
}
const archetypeOf = (key: string) => archetypeOfKey.get(key) ?? archetypeOfKey.get(baseKey(key)) ?? null;

// An exercise the registry did not cover: its pattern from its category and name. Status: convention (gym usage).
function derivedArchetype(e: CatalogueEntry): KinematicArchetype {
  const n = `${e.key} ${e.name}`.toLowerCase();
  if (/deadlift|good_morning|hip_thrust|glute_bridge|swing|back_extension|hyperextension|pull_through|clean|snatch/.test(n)) return 'hinge';
  if (/squat|lunge|leg_press|step_up|step_down|split/.test(n)) return 'squat';
  if (/press|push_up|dip|jerk|thruster/.test(n)) return 'push';
  if (/row|pull_up|chin_up|pulldown|pull/.test(n)) return 'pull';
  return 'isolation';
}

function details(key: string, mod = 'standard'): ExerciseDetails | null {
  const e = byKey.get(key);
  if (!e) return null;
  const a = archetypeOf(key);
  const m = db.modifiers[mod];
  const cue = (list: string[] | undefined, extra?: string) => [...(list ?? []), ...(extra ? [extra] : [])];
  return {
    id: key,
    name: e.name,
    name_fr: e.fr,
    archetype: a?.archetype ?? derivedArchetype(e),
    counting_key: baseKey(key),
    equipment: e.equipment,
    modifier: mod,
    primary_muscles: a?.primary ?? e.muscles.map(x => x.toLowerCase().replace(/ /g, '_')),
    secondary_muscles: a?.secondary ?? [],
    setup_en: a?.setupEn ?? '',
    setup_fr: a?.setupFr ?? '',
    execution_cues_en: cue(a?.cuesEn, m?.cueEn),
    execution_cues_fr: cue(a?.cuesFr, m?.cueFr),
    hypertrophy_tips_en: a?.hypertrophyEn ?? [],
    hypertrophy_tips_fr: a?.hypertrophyFr ?? [],
  };
}

/** The details of a catalogue exercise (a variant's included), or of a former registry id (its movement's exercise). */
export function getExercise(idOrSlug: string): ExerciseDetails | null {
  if (!idOrSlug) return null;
  if (byKey.has(idOrSlug)) return details(idOrSlug);
  const id = idOrSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  if (byKey.has(id)) return details(id);
  const key = LEGACY[id];
  if (!key) return null;
  return details(key, db.entries.find(r => r.id === id)?.mod ?? 'standard');
}

/** The catalogue exercise a counting key names (a base key is its own exercise). */
export function getExerciseByCountingKey(countingKey: string): ExerciseDetails | null {
  return countingKey ? details(countingKey) ?? details(baseKey(countingKey)) : null;
}

/** The movement pattern of an exercise or lift key. */
export function getKinematicArchetype(keyOrSlug: string): KinematicArchetype {
  const ex = getExercise(keyOrSlug) || getExerciseByCountingKey(keyOrSlug);
  if (ex) return ex.archetype;
  const lower = (keyOrSlug || '').toLowerCase();
  if (lower.includes('squat') || (lower.includes('press') && lower.includes('leg')) || lower.includes('lunge')) return 'squat';
  if (lower.includes('deadlift') || lower.includes('hinge') || lower.includes('thrust') || lower.includes('good_morning')) return 'hinge';
  if (lower.includes('press') || lower.includes('push') || lower.includes('dip')) return 'push';
  if (lower.includes('pull') || lower.includes('row') || lower.includes('chin')) return 'pull';
  return 'isolation';
}

const WORDS = new Map(CATALOGUE.map(e => [e.key, searchWords([e.fr, e.name, ...e.aliases, e.equipment].join(' '))]));

/** The catalogue's exercises whose names, aliases or equipment match every word of the query (search-text.js). */
export function searchExercises(query: string, _lang: 'en' | 'fr' = 'en', limit = 20): ExerciseDetails[] {
  if (!query || !query.trim()) return [];
  const out: ExerciseDetails[] = [];
  for (const e of CATALOGUE) {
    if (searchMatch(WORDS.get(e.key), query)) { out.push(details(e.key)!); if (out.length >= limit) break; }
  }
  return out;
}

/** Every exercise of the catalogue, its variants included, in the catalogue's order. */
export function getAllExercises(): ExerciseDetails[] {
  return CATALOGUE.map(e => details(e.key)!);
}

/** How many exercises the catalogue holds, its variants included. */
export function getExerciseCount(): number {
  return CATALOGUE.length;
}
