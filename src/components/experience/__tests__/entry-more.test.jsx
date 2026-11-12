import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../EntryMore.css', () => ({}));

import EntryMore from '../EntryMore';
import { OFFERED, tierOf } from '../../../lib/offer';
import { FITNESS_TESTS } from '../../../lib/fitness-tests';

// What lies under the first screen (EntryMore.jsx, 12 November 2026): its claims are read from the code, never typed.
describe('under the first screen', () => {
  const html = renderToStaticMarkup(<EntryMore lang="fr" onStart={() => {}} />);

  it('names every Beta exercise of offer.js, and counts the others', () => {
    const beta = OFFERED.filter(k => tierOf(k) === 'beta');
    expect(beta.length).toBeGreaterThan(0);
    for (const name of ['Curl biceps', 'Squat', 'Extension lombaire assise à la machine']) expect(html).toContain(name);
    expect(html.match(/<dd>([^<]*)<\/dd>/)[1].split(', ')).toHaveLength(beta.length);
    // The exercises, without the fitness tests: the home's own count (183 on 12 November 2026) less the Beta ones.
    expect(html).toContain(`${OFFERED.filter(k => !Object.hasOwn(FITNESS_TESTS, k)).length - beta.length} autres exercices`);
  });

  it('states the scoreboard figure with its date (R13), and no reading of form', () => {
    expect(html).toContain('13 de nos 15 séries de référence');
    expect(html).toContain('11 novembre 2026');
    for (const word of ['valgus', 'scapul', 'butt wink', 'kcal', 'watts']) expect(html.toLowerCase()).not.toContain(word.toLowerCase());
  });

  it('says what is not ready, offers one action, and gives a way to write', () => {
    expect(html).toContain('Pas encore');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('data-testid="entry-start-again"');
    expect(html).toContain('mailto:');
  });
});
