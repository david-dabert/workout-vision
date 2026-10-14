import { describe, expect, it, vi } from 'vitest';

vi.mock('../experience/exercise-info', () => ({ exerciseName: (key, lang) => (key === 'squat' ? (lang === 'fr' ? 'Squat' : 'Squat') : key) }));
const { lastSetLine } = await import('./last-set');

// FND-3, CHT-3: the set's own fields under their own names; no stand-in, no "form", no "[object Object] %".
describe('the last set line', () => {
  const at = new Date(2026, 9, 14, 18).getTime();
  it('names the exercise, the count kept, the app’s count when it differs, and the day', () => {
    const line = lastSetLine([{ exercise: 'squat', reps: 9, corrected: true, correctedResult: { reps: 9 }, machineResult: { reps: 8 }, createdAt: at, symmetry: { symmetryScore: 95 }, confidence: 0.98 }], 'fr');
    expect(line).toBe('Squat, 9 répétitions (l’appli en avait compté 8), le 14 octobre');
    expect(line).not.toMatch(/%|forme|sym|object/);
  });
  it('says nothing more when the counts agree, and is null without a set', () => {
    expect(lastSetLine([{ exercise: 'squat', reps: 1, createdAt: at }], 'en')).toBe('Squat, 1 rep, on 14 October');
    expect(lastSetLine([], 'fr')).toBeNull();
    expect(lastSetLine(null, 'fr')).toBeNull();
  });
});
