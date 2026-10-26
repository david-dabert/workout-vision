/**
 * WorkoutVision Exercise Registry & Biomechanical Aliasing Engine
 *
 * Provides instant access to 1,000+ movement variations across all gym equipment,
 * mapping every exercise to core kinematic archetypes (squat, hinge, push, pull, isolation)
 * and counting lift keys with bilingual French/English hypertrophy cues and execution tips.
 */

import exerciseData from './exercises.json';

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

interface RawModifier {
  id: string;
  nameEn: string;
  nameFr: string;
  cueEn: string;
  cueFr: string;
}

interface RawEntry {
  id: string;
  name: string;
  name_fr: string;
  base: string;
  eq: string;
  mod: string;
}

interface RawDatabase {
  version: string;
  count: number;
  archetypes: Record<string, RawArchetype>;
  modifiers: Record<string, RawModifier>;
  entries: RawEntry[];
}

const db = exerciseData as unknown as RawDatabase;

// In-memory lookup tables
const byId = new Map<string, RawEntry>();
const byCountingKey = new Map<string, RawEntry>();

for (const entry of db.entries) {
  byId.set(entry.id, entry);
  const base = db.archetypes[entry.base];
  if (base && !byCountingKey.has(base.countingKey)) {
    byCountingKey.set(base.countingKey, entry);
  }
}

/**
 * Rehydrates a compact entry with its archetype biomechanics and modifier cues.
 */
function rehydrate(entry: RawEntry): ExerciseDetails {
  const base = db.archetypes[entry.base] || {
    baseId: entry.base,
    archetype: 'isolation' as KinematicArchetype,
    countingKey: entry.base,
    primary: [],
    secondary: [],
    setupEn: '',
    setupFr: '',
    cuesEn: [],
    cuesFr: [],
    hypertrophyEn: [],
    hypertrophyFr: [],
  };

  const mod = db.modifiers[entry.mod] || { id: entry.mod, nameEn: '', nameFr: '', cueEn: '', cueFr: '' };

  const cuesEn = [...base.cuesEn];
  const cuesFr = [...base.cuesFr];
  if (mod.cueEn) cuesEn.push(mod.cueEn);
  if (mod.cueFr) cuesFr.push(mod.cueFr);

  return {
    id: entry.id,
    name: entry.name,
    name_fr: entry.name_fr,
    archetype: base.archetype,
    counting_key: base.countingKey,
    equipment: entry.eq,
    modifier: entry.mod,
    primary_muscles: base.primary,
    secondary_muscles: base.secondary,
    setup_en: base.setupEn,
    setup_fr: base.setupFr,
    execution_cues_en: cuesEn,
    execution_cues_fr: cuesFr,
    hypertrophy_tips_en: base.hypertrophyEn,
    hypertrophy_tips_fr: base.hypertrophyFr,
  };
}

/**
 * Retrieves full exercise details by ID or slug.
 */
export function getExercise(idOrSlug: string): ExerciseDetails | null {
  if (!idOrSlug) return null;
  const normalized = idOrSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const entry = byId.get(normalized) || byId.get(idOrSlug);
  if (entry) return rehydrate(entry);
  return null;
}

/**
 * Retrieves exercise details matching a specific counting key.
 */
export function getExerciseByCountingKey(countingKey: string): ExerciseDetails | null {
  if (!countingKey) return null;
  const entry = byCountingKey.get(countingKey);
  if (entry) return rehydrate(entry);
  return null;
}

/**
 * Determines the core kinematic archetype for an exercise or lift key.
 */
export function getKinematicArchetype(keyOrSlug: string): KinematicArchetype {
  const ex = getExercise(keyOrSlug) || getExerciseByCountingKey(keyOrSlug);
  if (ex) return ex.archetype;
  
  // Safe biomechanical defaults for unknown keys
  const lower = (keyOrSlug || '').toLowerCase();
  if (lower.includes('squat') || lower.includes('press') && lower.includes('leg') || lower.includes('lunge')) return 'squat';
  if (lower.includes('deadlift') || lower.includes('hinge') || lower.includes('thrust') || lower.includes('good_morning')) return 'hinge';
  if (lower.includes('press') || lower.includes('push') || lower.includes('dip')) return 'push';
  if (lower.includes('pull') || lower.includes('row') || lower.includes('chin')) return 'pull';
  return 'isolation';
}

/**
 * Searches the 1,000+ catalog using fast multi-token fuzzy matching.
 */
export function searchExercises(query: string, lang: 'en' | 'fr' = 'en', limit = 20): ExerciseDetails[] {
  if (!query || !query.trim()) return [];
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results: ExerciseDetails[] = [];

  for (const entry of db.entries) {
    const haystack = `${entry.id} ${entry.name} ${entry.name_fr} ${entry.base} ${entry.eq}`.toLowerCase();
    const matchesAll = tokens.every(token => haystack.includes(token));
    if (matchesAll) {
      results.push(rehydrate(entry));
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Returns all exercises in the catalog.
 */
export function getAllExercises(): ExerciseDetails[] {
  return db.entries.map(rehydrate);
}

/**
 * Returns total count of registered exercise variations.
 */
export function getExerciseCount(): number {
  return db.count || db.entries.length;
}
