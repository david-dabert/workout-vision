import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Report only (audit of 6 October, action 14): the user-facing strings of the locale files that carry a medical
// word, listed for David on every run so he can decide on each (R10: no copy changes without him). The app is
// positioned as fitness logging for healthy adults (docs/SPEC-production.md WP2.1, D16); this test never fails on
// what it finds, it only prints it.
const FILES = ['../../locales/fr.json', '../../locales/en.json'];
// French and English forms of the words the audit named: patient, rééducation, rehabilitation, diagnostic,
// traitement, thérapie, injury, blessure.
const MEDICAL = /\bpatients?\b|r[ée][ée]ducation|rehabilitat|diagnos|traitement|th[ée]rap|\binjur|\bbless/i;

export function medicalStrings() {
  const found = [];
  for (const rel of FILES) {
    const name = rel.replace('../../', 'src/');
    readFileSync(new URL(rel, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
      if (MEDICAL.test(line)) found.push(`${name}:${i + 1}: ${line.trim()}`);
    });
  }
  return found;
}

describe('medical words in user-facing strings (report only)', () => {
  it('lists them for David, without failing', () => {
    const found = medicalStrings();
    console.log(`[medical-words] ${found.length} user-facing string(s) with a medical word:\n${found.join('\n') || '(none)'}`);
    expect(Array.isArray(found)).toBe(true);
  });
});
