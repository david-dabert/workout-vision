// Learned phase counter, bench only: the motion spec (test/real-phone/synth/motions/<key>.json) a set's progress input
// is read with (sgc.js specProgress, data.js progressOnGrid). One lookup for the export (export.test.ts) and the bench
// (learned-phase.test.ts), so a set gets the same spec in training and in inference.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COUNT_AS } from '../../../src/lib/counting/core';

const MOTIONS = resolve(__dirname, '../synth/motions');
const cache = new Map<string, any>();

/** The motion spec of a catalogue key, or of its COUNT_AS parent; null when neither has one. */
export function specFor(key: string | null | undefined): any | null {
  if (!key) return null;
  for (const k of [key, (COUNT_AS as Record<string, string>)[key]]) {
    if (!k) continue;
    if (!cache.has(k)) cache.set(k, existsSync(resolve(MOTIONS, `${k}.json`)) ? JSON.parse(readFileSync(resolve(MOTIONS, `${k}.json`), 'utf8')) : null);
    if (cache.get(k)) return cache.get(k);
  }
  return null;
}

// RepCount-A classes to catalogue keys, where one fits (in order of preference: the catalogue's sit-up has no motion
// spec on 8 October, the crunch has). battle_rope, pommelhorse and others: none. Convention (the class names' meaning).
export const REPCOUNT_KEYS: Record<string, string[]> = {
  squat: ['squat'], push_up: ['push_up'], pull_up: ['pull_up'], bench_pressing: ['bench_press'], front_raise: ['front_raise'],
  jump_jack: ['jumping_jack'], situp: ['sit_up', 'crunch'],
};

/** A set's spec: its lift's; for a RepCount-A set (train split or build half) whose lift has none, its class's. */
export function specOfSet(suite: string, lift: string | null | undefined, cls?: string | null): any | null {
  const s = specFor(lift);
  if (s || !(suite === 'repcount' || suite === 'repcount-train') || !cls) return s;
  for (const k of REPCOUNT_KEYS[cls] ?? []) { const t = specFor(k); if (t) return t; }
  return null;
}
