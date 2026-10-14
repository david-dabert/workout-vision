/**
 * The exercise sheet on the screens (14 October 2026), rendered as the server renders them (as programme-held.test.jsx):
 * the builder's new controls (reps or a hold, the side, the frequency) and its mark on an exercise the client will not
 * film, with the reason; the client's programme, where a hold or an exercise of the guide only shows its drawing, its
 * target and why it is not filmed, with no film button, and the rest is filmed as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRO } from '../pro-copy';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ useSets: () => [] }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const items = [
  { key: 'squat', sets: 3, reps: 10, rest: 90, note: 'Descendre lentement', side: 'each' },
  { key: 'plank', sets: 3, reps: 10, rest: 45, note: 'Dos plat', holdSec: 45 },
  { key: 'dead_bug', sets: 3, reps: 10, rest: 60, note: '' },
  { key: 'push_up', sets: 2, reps: 12, rest: 60, note: '', holdSec: 20 },
];
const draft = { id: 'dsheet', updatedAt: 1, title: 'Dos et gainage', who: 'Camille', note: '', frequency: { times: 3, per: 'week' }, items };

function stubs(lang, { refuse = false } = {}) {
  const m = new Map([['wv_lang', lang]]);
  const refused = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  vi.stubGlobal('localStorage', refuse
    ? { getItem: k => (k === 'wv_lang' ? lang : refused()), setItem: refused, removeItem: refused }
    : { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  vi.stubGlobal('location', { href: 'https://david-dabert.github.io/workout-vision/#pro' });
}

// The value selected in a <select id="…">, and an <input id="…">'s tag.
const selected = (html, id) => {
  const block = new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`).exec(html)?.[1];
  return block ? /<option value="([^"]*)" selected="">/.exec(block)?.[1] ?? null : undefined;
};
const input = (html, id) => new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? null;
const count = (html, s) => html.split(s).length - 1;

async function builder(lang) {
  stubs(lang);
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Pro } = await import('../Pro.jsx');
  return renderToStaticMarkup(<LanguageProvider><Pro onClose={() => {}} start={{ draft, kept: true }} /></LanguageProvider>);
}

async function client(lang) {
  stubs(lang, { refuse: true });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Programme } = await import('../Programme.jsx');
  const held = { title: draft.title, who: draft.who, note: '', frequency: draft.frequency, items };
  return renderToStaticMarkup(<LanguageProvider><Programme payload={null} held={held} onHold={() => {}} onClose={() => {}} onStart={() => {}} /></LanguageProvider>);
}

describe('the exercise sheet in the builder', () => {
  for (const lang of ['fr', 'en']) {
    it(`sets reps or a hold, the side and the frequency, and marks what the client will not film (${lang})`, async () => {
      const c = PRO[lang], html = await builder(lang);
      expect(html).toContain('data-testid="pro-editor"');
      // Reps or a hold, and the side, for each exercise.
      expect(['p0k', 'p1k', 'p2k', 'p3k'].map(id => selected(html, id))).toEqual(['reps', 'hold', 'reps', 'hold']);
      expect(['p0c', 'p1c', 'p2c', 'p3c'].map(id => selected(html, id))).toEqual(['each', 'both', 'both', 'both']);
      expect(html).toContain(`>${c.kindHold}</option>`);
      expect(html).toContain(`>${c.sideOptions.each}</option>`);
      // A hold's field in place of the reps', the reps' field kept for the others (the e2e ids p{i}s, p{i}r, p{i}t).
      expect(input(html, 'p1h')).toContain('value="45"');
      expect(input(html, 'p1r')).toBeNull();
      expect(input(html, 'p0r')).toContain('value="10"');
      expect(input(html, 'p3h')).toContain('value="20"');
      for (const id of ['p0s', 'p0t', 'p2r']) expect(input(html, id), id).not.toBeNull();
      // How often: 3 a week.
      expect(input(html, 'pFreq')).toContain('value="3"');
      expect(input(html, 'pFreq')).toContain(`aria-label="${c.freqTimesLong}"`);
      expect(selected(html, 'pFreqPer')).toBe('week');
      expect(html).toContain(c.freqLabel);
      // Three exercises the client will not film, each marked, each with its reason; the squat is filmed.
      expect(count(html, 'data-testid="pro-not-filmed"')).toBe(3);
      expect(count(html, `>${c.notCountedTag}</span>`)).toBe(3);
      const reasons = [...html.matchAll(/data-testid="pro-not-counted">([^<]*)</g)].map(m => m[1]);
      expect(reasons).toEqual([c.guideOnlyPro, c.notCountedPro, c.holdPro]);
      // The PDF button says it is preparing until the PDF's code and the drawings are ready.
      expect(html).toContain(c.preparing);
    });
  }

  it('writes no frequency field value and selects a week by default for a draft without one', async () => {
    stubs('fr');
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Pro } = await import('../Pro.jsx');
    const html = renderToStaticMarkup(<LanguageProvider><Pro onClose={() => {}} start={{ draft: { ...draft, frequency: undefined, items: [items[0]] }, kept: true }} /></LanguageProvider>);
    expect(input(html, 'pFreq')).toContain('value=""');
    expect(selected(html, 'pFreqPer')).toBe('week');
    expect(count(html, 'data-testid="pro-not-filmed"')).toBe(0);
  });
});

describe('the exercise sheet in the client’s programme', () => {
  for (const lang of ['fr', 'en']) {
    it(`films only what the app counts in reps, and shows the rest with its target and why (${lang})`, async () => {
      const c = PRO[lang], html = await client(lang);
      expect(count(html, 'data-testid="programme-item"')).toBe(4);
      // One film button, the squat's, its side said.
      expect(count(html, `aria-label="${c.film('')}`)).toBe(1);
      expect(html).toContain(`aria-label="${c.film('Squat')}"`);
      expect(html).toContain(c.targetLine(3, 10, 90, 0, 'each'));
      expect(html).toContain(c.sideText.each);
      // The plank: a hold of 45 s, of the guide only; the dead bug: withdrawn; the push-up: set as a hold.
      expect(html).toContain(c.targetLine(3, 10, 45, 45, 'both'));
      expect(html).toContain(c.targetLine(2, 12, 60, 20, 'both'));
      const reasons = [...html.matchAll(/data-testid="programme-not-counted">([^<]*)</g)].map(m => m[1]);
      expect(reasons).toEqual([c.guideOnly, c.notCounted, c.holdNotCounted]);
      expect(html).toContain('Dos plat');
      // How often, and the day's count over the one exercise filmed.
      expect(html).toContain(`data-testid="programme-frequency">${c.frequency(3, 'week')}</span>`);
      expect(html).toContain(`data-testid="programme-today">${c.today(0, 1)}</span>`);
      expect(html).toContain(c.tapHint);
    });
  }

  it('says nothing of filming for a sheet with nothing to film', async () => {
    stubs('fr', { refuse: true });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Programme } = await import('../Programme.jsx');
    const held = { title: 'Gainage', who: '', note: '', items: [items[1]] };
    const html = renderToStaticMarkup(<LanguageProvider><Programme payload={null} held={held} onHold={() => {}} onClose={() => {}} onStart={() => {}} /></LanguageProvider>);
    expect(html).not.toContain(PRO.fr.tapHint);
    expect(html).not.toContain('data-testid="programme-today"');
    expect(html).not.toContain('data-testid="programme-frequency"');
    expect(html).toContain(PRO.fr.holdTarget(3, 45));
  });
});
