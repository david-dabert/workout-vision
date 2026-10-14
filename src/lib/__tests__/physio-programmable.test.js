// Every strengthening card either goes into a programme or offers no button (assessment of 14 October 2026: the
// reverse lunge, keyed 'lunge', and the plank were added to a draft and silently dropped by programmeOf).
import { describe, expect, it } from 'vitest';
import { PHYSIO_CATALOG } from '../physioCatalog';
import { programmable } from '../../components/experience/programme';

describe('the physio cards and the programme', () => {
  it('names a programmable exercise on every card except the holds, which offer no button', () => {
    const notProgrammable = PHYSIO_CATALOG.filter(x => !programmable(x.key)).map(x => x.key);
    expect(notProgrammable).toEqual(['plank']);
  });
});
