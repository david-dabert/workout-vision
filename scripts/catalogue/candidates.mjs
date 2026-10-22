#!/usr/bin/env node
/**
 * scripts/catalogue/candidates.mjs
 * 
 * 1. Reads src/lib/guide-catalog.json (309 entries) and downloaded ~/wv-tools/catalogue/exercises.json (876 entries).
 * 2. Normalises every name (lowercase, strip punctuation, strip explicit equipment words).
 * 3. Identifies exercises that match no guide name or alias.
 * 4. Writes data/catalogue/candidates.json with fields:
 *    id, name, category, equipment, primaryMuscles, level, mechanic, force, closestGuideKey, jaccardScore.
 * 5. Writes data/catalogue/top-missing.json with 100 candidates selected by an explicit, deterministic rule.
 * 6. Prints the rule and summary metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const GUIDE_PATH = path.join(REPO_ROOT, 'src/lib/guide-catalog.json');
const DOWNLOADED_PATH = path.join(os.homedir(), 'wv-tools/catalogue/exercises.json');
const CANDIDATES_OUT = path.join(REPO_ROOT, 'data/catalogue/candidates.json');
const TOP_MISSING_OUT = path.join(REPO_ROOT, 'data/catalogue/top-missing.json');

// Explicit equipment phrases (multi-word, removed first)
const EQUIPMENT_PHRASES = [
  'smith machine',
  'e z curl bar',
  'ez curl bar',
  'e z bar',
  'ez bar',
  'medicine ball',
  'exercise ball',
  'stability ball',
  'resistance band',
  'resistance bands',
  'foam roller',
  'foam roll',
  'body only',
  'pull up bar',
];

// Explicit equipment words (single-word, removed second)
const EQUIPMENT_WORDS = new Set([
  'barbell',
  'dumbbell',
  'dumbbells',
  'kettlebell',
  'kettlebells',
  'cable',
  'machine',
  'smith',
  'band',
  'bands',
  'bodyweight',
  'plate',
  'plates',
  'sandbag',
]);

export function normalizeName(str) {
  if (!str) return '';
  let s = str.toLowerCase();
  // Strip punctuation
  s = s.replace(/[^a-z0-9]/g, ' ');
  for (const phrase of EQUIPMENT_PHRASES) {
    s = s.replaceAll(phrase, ' ');
  }
  const tokens = s.trim().split(/\s+/).filter(t => t && !EQUIPMENT_WORDS.has(t));
  return tokens.join(' ');
}

export function computeJaccard(s1, s2) {
  const set1 = new Set(s1.split(' ').filter(Boolean));
  const set2 = new Set(s2.split(' ').filter(Boolean));
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

export const TOP_100_RULE = `Selection Rule for data/catalogue/top-missing.json:
1. Filter candidates to core strength training suitable for movement rep-counting:
   - category === 'strength'
   - mechanic in ['compound', 'isolation'] (structured cyclical repetitions)
   - equipment in ['barbell', 'dumbbell', 'body only', 'cable', 'machine', 'kettlebells', 'e-z curl bar']
2. Deterministic multi-tier sort:
   - Primary: level precedence ('beginner' = 0, 'intermediate' = 1, 'expert' = 2)
   - Secondary: mechanic precedence ('compound' = 0, 'isolation' = 1)
   - Tertiary: lowest Jaccard similarity score with existing guide catalog (prioritizing completely unrepresented movement patterns)
   - Tie-breaker: alphabetical order by name
3. Select the first 100 items.`;

async function main() {
  if (!fs.existsSync(DOWNLOADED_PATH)) {
    throw new Error(`Downloaded exercises not found at ${DOWNLOADED_PATH}. Download it first.`);
  }

  const guide = JSON.parse(fs.readFileSync(GUIDE_PATH, 'utf8'));
  const downloaded = JSON.parse(fs.readFileSync(DOWNLOADED_PATH, 'utf8'));

  // Pre-normalize guide catalogue names and aliases
  const guideEntries = guide.map(g => {
    const allNames = [g.name, ...(g.aliases || [])];
    const normalized = Array.from(new Set(allNames.map(normalizeName).filter(Boolean)));
    return {
      key: g.key,
      name: g.name,
      normalized,
    };
  });

  const allGuideNormalizedSet = new Set();
  for (const ge of guideEntries) {
    for (const n of ge.normalized) {
      allGuideNormalizedSet.add(n);
    }
  }

  const candidates = [];
  let exactMatchCount = 0;

  for (const d of downloaded) {
    const dNorm = normalizeName(d.name);
    if (!dNorm) continue;

    // Check if matches any guide name or alias
    if (allGuideNormalizedSet.has(dNorm)) {
      exactMatchCount++;
      continue;
    }

    // Find closest guide key by Jaccard score
    let bestKey = null;
    let bestScore = -1;

    for (const ge of guideEntries) {
      for (const gn of ge.normalized) {
        const score = computeJaccard(dNorm, gn);
        if (score > bestScore) {
          bestScore = score;
          bestKey = ge.key;
        }
      }
    }

    candidates.push({
      id: d.id,
      name: d.name,
      category: d.category,
      equipment: d.equipment,
      primaryMuscles: d.primaryMuscles || [],
      level: d.level,
      mechanic: d.mechanic,
      force: d.force,
      closestGuideKey: bestKey,
      jaccardScore: parseFloat(bestScore.toFixed(4)),
    });
  }

  fs.mkdirSync(path.dirname(CANDIDATES_OUT), { recursive: true });
  fs.writeFileSync(CANDIDATES_OUT, JSON.stringify(candidates, null, 2), 'utf8');

  // Select top 100 according to TOP_100_RULE
  const ALLOWED_EQUIPMENT = new Set([
    'barbell',
    'dumbbell',
    'body only',
    'cable',
    'machine',
    'kettlebells',
    'e-z curl bar',
  ]);
  const LEVEL_ORDER = { 'beginner': 0, 'intermediate': 1, 'expert': 2 };
  const MECHANIC_ORDER = { 'compound': 0, 'isolation': 1 };

  const eligible = candidates.filter(c =>
    c.category === 'strength' &&
    (c.mechanic === 'compound' || c.mechanic === 'isolation') &&
    ALLOWED_EQUIPMENT.has(c.equipment)
  );

  eligible.sort((a, b) => {
    const levA = LEVEL_ORDER[a.level] ?? 9;
    const levB = LEVEL_ORDER[b.level] ?? 9;
    if (levA !== levB) return levA - levB;

    const mechA = MECHANIC_ORDER[a.mechanic] ?? 9;
    const mechB = MECHANIC_ORDER[b.mechanic] ?? 9;
    if (mechA !== mechB) return mechA - mechB;

    if (a.jaccardScore !== b.jaccardScore) return a.jaccardScore - b.jaccardScore;

    return a.name.localeCompare(b.name);
  });

  const top100 = eligible.slice(0, 100);
  fs.writeFileSync(TOP_MISSING_OUT, JSON.stringify(top100, null, 2), 'utf8');

  console.log('=== Exercise Catalogue Candidates Summary ===');
  console.log(`Guide catalogue entries: ${guide.length}`);
  console.log(`Downloaded external exercises: ${downloaded.length}`);
  console.log(`Exact matches with guide catalogue: ${exactMatchCount}`);
  console.log(`Candidate missing exercises: ${candidates.length} (saved to ${CANDIDATES_OUT})`);
  console.log(`Eligible strength candidates: ${eligible.length}`);
  console.log(`Top missing exercises selected: ${top100.length} (saved to ${TOP_MISSING_OUT})`);
  console.log('\n' + TOP_100_RULE);
}

main().catch(err => {
  console.error('Fatal error in candidates.mjs:', err);
  process.exit(1);
});
