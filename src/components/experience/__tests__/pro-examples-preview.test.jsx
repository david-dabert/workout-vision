/**
 * Handoff Task 5: Espace pro starter examples are labelled « Exemples à adapter » (with an honest origin line)
 * instead of « Modèles recommandés », the editor offers a client preview (`pro-preview`), and `<Programme preview={...} />`
 * shows the client view cleanly without reading or mutating `wv_programmes`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { allStrings, PRO } from '../pro-copy';

vi.mock('../Report.css', () => ({}));
vi.mock('../Pro.css', () => ({}));
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ useSets: () => [] }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

function stubs(lang) {
  const m = new Map([['wv_lang', lang]]);
  const store = {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
  vi.stubGlobal('localStorage', store);
  vi.stubGlobal('location', { href: 'https://david-dabert.github.io/workout-vision/#pro' });
  return m;
}

const sampleDraft = {
  id: 'dprev',
  updatedAt: 1,
  title: 'Séance test',
  who: 'Camille',
  note: 'Rester fluide',
  frequency: { times: 2, per: 'week' },
  items: [
    { key: 'squat', sets: 3, reps: 10, rest: 90, note: 'Genoux alignés' },
    { key: 'plank', sets: 3, reps: 10, rest: 45, note: 'Dos plat', holdSec: 30 },
  ],
};

describe('Espace pro ready-to-use templates and client hub (David directive for coaches)', () => {
  for (const lang of ['fr', 'en']) {
    it(`renders ready-to-use templates and compare row in production build (${lang})`, async () => {
      stubs(lang);
      const { LanguageProvider } = await import('../../../lib/LanguageContext');
      const { default: Pro } = await import('../Pro.jsx');
      const html = renderToStaticMarkup(<LanguageProvider><Pro onClose={() => {}} /></LanguageProvider>);
      expect(html).toContain('pro-templates');
      expect(html).toContain(PRO[lang].templatesHead);
      expect(html).toContain('data-testid="pro-templates-note"');
      expect(html).toContain('data-testid="template-posture"');
      expect(html).toContain('data-testid="template-shoulder"');
      expect(html).toContain('data-testid="template-conditioning"');
      expect(html).toContain('data-testid="pro-compare"');
      expect(html).toContain('data-testid="tab-pro-clients"');
      expect(html).toContain('data-testid="pro-new"');
    });

    it(`exposes client preview button in the editor and renders read-only Programme preview in ${lang}`, async () => {
      const store = stubs(lang);
      const { LanguageProvider } = await import('../../../lib/LanguageContext');
      const { default: Pro } = await import('../Pro.jsx');
      const { default: Programme } = await import('../Programme.jsx');

      const editorHtml = renderToStaticMarkup(<LanguageProvider><Pro onClose={() => {}} start={{ draft: sampleDraft, kept: true }} /></LanguageProvider>);
      expect(editorHtml).toContain('data-testid="pro-preview"');

      const previewHtml = renderToStaticMarkup(
        <LanguageProvider>
          <Programme preview={{ title: sampleDraft.title, who: sampleDraft.who, note: sampleDraft.note, frequency: sampleDraft.frequency, items: sampleDraft.items }} onClose={() => {}} />
        </LanguageProvider>,
      );
      expect(previewHtml).toContain('data-testid="programme-preview-note"');
      expect(previewHtml).toContain('Séance test');
      expect(previewHtml).toContain('Genoux alignés');
      expect(previewHtml).not.toContain('data-testid="programme-paste"');
      expect(previewHtml).not.toContain('data-testid="programme-send"');
      expect(store.has('wv_programmes')).toBe(false);
    });

    it(`contains zero em dashes in ${lang}`, () => {
      for (const s of allStrings(lang)) expect(s).not.toContain('\u2014');
    });
  }

  it('returns clean balanced template drafts in production build', async () => {
    const { createFromTemplate } = await import('../programme-store');
    const posture = createFromTemplate('posture');
    expect(posture).not.toBeNull();
    expect(posture.title).toBe('Renforcement & Posture');
    expect(posture.items.length).toBe(3);

    const shoulder = createFromTemplate('shoulder');
    expect(shoulder).not.toBeNull();
    expect(shoulder.title).toBe('Épaule & Mobilité');
    expect(shoulder.items.length).toBe(3);

    const conditioning = createFromTemplate('conditioning');
    expect(conditioning).not.toBeNull();
    expect(conditioning.title).toBe('Conditioning & Renforcement général');
    expect(conditioning.items.length).toBe(3);
  });
});
