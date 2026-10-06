// The exercise search (search-text.js), as the guide (Guide.jsx) and the list under the cards (ExerciseList.jsx)
// use it: by words, in any order, a plural finding a singular and the reverse (audit of 6 October: "fentes",
// "pompes", "développé haltères" and "curl pupitre" found nothing).
import { describe, expect, it, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads (as in exercise-list.test.js).
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { searchMatch, searchWords } from '../search-text';
import { getAllGuideExercises } from '../../../lib/exerciseGuide';
import { OFFERED } from '../../../lib/offer';
import { isTest } from '../../../lib/fitness-tests';
import { guideExercise } from '../exercise-info';

const CATALOGUE = getAllGuideExercises();
const LISTED = OFFERED.filter(k => !isTest(k)).map(guideExercise).filter(Boolean);
const find = (entries, query) => entries.filter(e => searchMatch([e.fr, e.name, ...e.aliases, e.equipment].join(' '), query)).map(e => e.key);

describe('the exercise search', () => {
  it.each([
    ['fentes', 'forward_lunge'],
    ['pompes', 'push_up'],
    ['développé haltères', 'dumbbell_bench_press'],
    ['curl pupitre', 'preacher_curl'],
  ])('"%s" finds %s in the guide, and in the list when it is counted', (query, key) => {
    expect(find(CATALOGUE, query)).toContain(key);
    if (LISTED.some(e => e.key === key)) expect(find(LISTED, query)).toContain(key);
  });

  it('finds what the whole-text search found: names, abbreviations, words in any order, without accents', () => {
    expect(find(CATALOGUE, 'dc')).toContain('bench_press');
    expect(find(CATALOGUE, 'marteau')).toContain('hammer_curl');
    expect(find(CATALOGUE, 'hammer')).toContain('hammer_curl');
    expect(find(CATALOGUE, 'Forward Lunge')).toContain('forward_lunge');
    expect(find(CATALOGUE, 'haltères développé')).toContain('dumbbell_bench_press');
    expect(find(CATALOGUE, 'developpe couche')).toContain('bench_press');
    expect(find(CATALOGUE, 'push-up')).toContain('push_up');
    expect(find(CATALOGUE, 'pompe')).toContain('weighted_push_up'); // "Pompes lestées"
  });

  it('finds nothing for a word no exercise holds, nor when one word of the query is missing', () => {
    expect(find(CATALOGUE, 'zzzz')).toEqual([]);
    expect(find(CATALOGUE, 'qwxkjv')).toEqual([]);
    expect(find(CATALOGUE, 'curl zzzz')).toEqual([]);
  });

  it('finds everything for an empty query', () => {
    expect(searchMatch('Curl au pupitre', '')).toBe(true);
    expect(searchMatch('Curl au pupitre', '   ')).toBe(true);
  });

  it('cuts words at anything but a letter or a digit, drops a final plural s or x, and keeps short words whole', () => {
    expect(searchWords('Pompes avec toucher d’épaule')).toEqual(['pompe', 'avec', 'toucher', 'd', 'epaule']);
    expect(searchWords('Abdominaux, abs')).toEqual(['abdominau', 'abs']);
    expect(searchMatch(searchWords('Curl au pupitre'), 'pupitres curl')).toBe(true);
  });
});
