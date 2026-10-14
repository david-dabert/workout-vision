import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runActivity } from '../../lib/activity/engine';
import { volleyball } from '../../lib/activity/specs/volleyball';
import { syntheticJumps } from '../../lib/activity/synthetic';
import { volleyballDemo } from '../../lib/activity/demo';

vi.mock('./ActivityScreen.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function withLang(lang, render) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const mod = await import('./ActivityScreen');
  return renderToStaticMarkup(<LanguageProvider>{render(mod)}</LanguageProvider>);
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** One measure's tile: from its test id to the end of its box (a Metric holds spans only, so its first closing div). */
const tile = (html, key) => { const from = html.indexOf(`data-testid="activity-measure-${key}"`); return from < 0 ? '' : html.slice(from, html.indexOf('</div>', from)); };

describe('the activity screen', () => {
  for (const lang of ['fr', 'en']) {
    it(`shows the volleyball demo in ${lang}: synthetic, badged, each measure with its margin, each count checked, beside its truth`, async () => {
      const html = decode(await withLang(lang, ({ default: ActivityScreen }) => <ActivityScreen activity="volleyball" onClose={() => {}} />));
      expect(html).toContain('data-testid="activity-screen"');
      expect(html).toContain('data-testid="demo-badge"');
      expect(html).toContain(lang === 'fr' ? 'Des sauts de synthèse' : 'Synthetic jumps');
      for (const r of [15, 30, 60, 240]) expect(html).toContain(`data-testid="activity-rate-${r}"`);
      // At 60 a second, the height and the run-up timing are shown with a margin and beside their truth.
      for (const key of ['height', 'approach']) {
        expect(tile(html, key)).toContain('±');
        expect(tile(html, key)).toContain(`data-testid="activity-truth-${key}"`);
      }
      // The count has no margin: it is shown with its truth and an exact or wrong verdict.
      expect(tile(html, 'jumps')).toContain('data-testid="activity-verdict-jumps"');
      expect(tile(html, 'jumps')).toContain(lang === 'fr' ? 'compte exact' : 'count right');
      // The caption no longer says every number has a margin.
      expect(html).toContain(lang === 'fr' ? 'un compte avec sa vérification' : 'a count with its check');
      // The table is three columns wide: the jump, then each measure with its truth and verdict in the same cell.
      const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
      expect(head.match(/<th /g)?.length).toBe(3);
      // A number and its noun never part (R10 typography): "Saut 1", "60 images".
      if (lang === 'fr') {
        expect(html).toContain('Saut\u00A01');
        expect(html).toContain('60\u00A0images par seconde');
        expect(html).toContain('60\u00A0i/s');
      }
      // The knee check has no margin model yet: no number, and the reason.
      expect(tile(html, 'landing')).toContain(lang === 'fr' ? 'Pas de chiffre' : 'No number');
      expect(tile(html, 'landing')).not.toMatch(/\d,\d|\d\.\d\d/);
      expect(html).toContain('data-testid="activity-events"');
      // R10: no em dash in the copy. The status keeps to its dot (never alone on the formula's last line).
      expect(html).not.toContain('—');
      expect(html).toContain(lang === 'fr' ? '·\u00A0Expérimental' : '·\u00A0Experimental');
      // What the count's note and the demo's noise say is what was measured.
      expect(tile(html, 'jumps')).toContain(lang === 'fr' ? 'les plus petits peuvent être manqués' : 'smaller ones may be missed');
      expect(html).not.toContain(lang === 'fr' ? 'comme sur une vraie vidéo' : 'as on a real video');
      // The run-up's mean says what it was taken over.
      expect(tile(html, 'approach')).toContain(lang === 'fr' ? 'Moyenne sur 2\u00A0élans.' : 'Mean of 2 run-ups.');
    });
  }

  it('keeps each jump\'s height in the table when the best jump cannot be named, and never leaves a card holding its title alone', async () => {
    for (const rate of [15, 20, 30, 60, 240]) {
      const { result, truth } = volleyballDemo.run(rate);
      const html = decode(await withLang('fr', ({ ActivityView }) => <ActivityView spec={volleyball} result={result} truth={truth} demo />));
      const rows = html.includes('<tbody>') ? html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>')).split('<tr').slice(1) : [];
      // A row is a card at phone width: either it holds a cell that is not "does not apply", or it says none applies.
      for (const row of rows) expect(row.includes('class="act-none"') || /<td(?! class="act-na")[^>]*data-label/.test(row), `rate ${rate}: ${row}`).toBe(true);
      if (rate === 20) {
        expect(tile(html, 'height')).toContain('Hauteur mesurée sur 2\u00A0sauts sur 4');
        const table = html.slice(html.indexOf('data-testid="activity-events"'));
        expect(table).toContain('<th scope="col">Hauteur</th>');
        expect(table.match(/±/g)?.length).toBe(2);
      }
    }
  });

  it('shows no number at all, and the reason, when the engine refuses the read', async () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.6 }], rate: 30 });
    for (const frame of read.landmarks) for (const i of [27, 28, 29, 30, 31, 32]) frame[i] = { ...frame[i], visibility: 0.1 };
    const result = runActivity(volleyball, read);
    const html = decode(await withLang('fr', ({ ActivityView }) => <ActivityView spec={volleyball} result={result} />));
    expect(html).toContain('data-testid="activity-refused"');
    expect(html).toContain('filmez le corps entier, pieds compris');
    for (const m of volleyball.measures) expect(tile(html, m.key)).toContain('Pas de chiffre');
    expect(html).not.toContain('±');
    expect(html).not.toContain('data-testid="demo-badge"');
    expect(html).not.toContain('data-testid="activity-events"');
  });
});
