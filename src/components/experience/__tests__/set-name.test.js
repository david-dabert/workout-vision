// Third audit C25 (3 October): the welcome named a set of an earlier version by its key (bent_over_row), because
// the guide's exerciseName gives the key back when it knows no name. The history names it by the locale's name.
import { describe, expect, it } from 'vitest';
import { setName } from '../set-name';

const nameOf = (key, lang) => (key === 'squat' ? (lang === 'fr' ? 'Squat guidé' : 'Guided squat') : key);
const tExercise = key => ({ bent_over_row: 'Rowing penché', squat: 'Squat' }[key] ?? key);
const meta = { bicep_curl: { fr: 'Curl biceps', en: 'Biceps curl' } };

describe('the welcome line names the last set', () => {
  it('by its card first', () => expect(setName({ key: 'bicep_curl', lang: 'fr', meta, nameOf, tExercise })).toBe('Curl biceps'));
  it('by the guide when it knows the exercise', () => expect(setName({ key: 'squat', lang: 'fr', meta, nameOf, tExercise })).toBe('Squat guidé'));
  it('by the locale when the guide gives the key back, never by the key', () => {
    expect(setName({ key: 'bent_over_row', lang: 'fr', meta, nameOf, tExercise })).toBe('Rowing penché');
  });
  it('by nothing when no source names it', () => expect(setName({ key: 'zzz', lang: 'fr', meta, nameOf, tExercise })).toBe(''));
  it('before the guide has loaded', () => expect(setName({ key: 'bent_over_row', lang: 'fr', meta, nameOf: null, tExercise })).toBe('Rowing penché'));
});
