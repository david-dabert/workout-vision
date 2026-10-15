// Every strengthening card goes into the exercise sheet (assessment of 14 October 2026: the reverse lunge, keyed
// 'lunge', and the plank were added to a draft and silently dropped by programmeOf; the exercise sheet of the same day
// takes any exercise of the guide, so the plank's button came back, done as a hold without filming).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PHYSIO_CATALOG } from '../physioCatalog';
import { filmable, knownExercise, programmable } from '../../components/experience/programme';
import { newItem } from '../../components/experience/programme-store';

describe('the physio cards and the exercise sheet', () => {
  it('name an exercise the sheet keeps on every card; the app films all but the plank', () => {
    expect(PHYSIO_CATALOG.filter(x => !knownExercise(x.key)).map(x => x.key)).toEqual([]);
    expect(PHYSIO_CATALOG.filter(x => !programmable(x.key)).map(x => x.key)).toEqual(['plank']);
    // Added from its card, the plank starts as a hold, done without filming.
    expect(newItem('plank').holdSec).toBe(30);
    expect(filmable(newItem('plank'))).toBe(false);
  });

  it('offers the add button for every exercise the sheet keeps', () => {
    const source = readFileSync(resolve(__dirname, '../../components/coaches/CoachSuite.jsx'), 'utf8');
    expect(source).toMatch(/onAddToProgramme && knownExercise\(item\.key\) &&/);
    expect(source).not.toMatch(/programmable\(item\.key\)/);
  });
});
