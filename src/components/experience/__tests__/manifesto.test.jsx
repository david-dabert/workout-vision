import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MANIFESTO } from '../manifesto-copy';

vi.mock('../Manifesto.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Manifesto } = await import('../Manifesto');
  return renderToStaticMarkup(<LanguageProvider><Manifesto onClose={() => {}} onChoose={() => {}} /></LanguageProvider>);
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('the WorkoutVision Manifesto reader', () => {
  for (const lang of ['fr', 'en']) {
    it(`renders all chapters, giants, principles, rules and conclusion in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);
      const c = MANIFESTO[lang];

      // Header & metadata
      expect(html).toContain(c.title);
      expect(html).toContain(c.subtitle);
      expect(html).toContain(c.badge);
      expect(html).toContain(c.readTime);

      // Chapter 1: History & Pioneers
      expect(html).toContain(c.chapter1.title);
      expect(html).toContain('Archibald Vivian Hill');
      expect(html).toContain('Per-Olof Åstrand');
      expect(html).toContain('Karlman Wasserman');
      expect(html).toContain('Steven N. Blair');

      // Chapter 2: Modern Hypertrophy & Giants
      expect(html).toContain(c.chapter2.title);
      expect(html).toContain('Dr. Brad Schoenfeld');
      expect(html).toContain('Dr. Stuart Phillips');
      expect(html).toContain('Dr. Layne Norton');
      expect(html).toContain('Dr. Mike Israetel');
      expect(html).toContain('Greg Nuckols');
      expect(html).toContain('Menno Henselmans');

      // Chapter 3: Superiority Principles
      expect(html).toContain(c.chapter3.title);
      expect(html).toContain(c.chapter3.principles[0].title);
      expect(html).toContain(c.chapter3.principles[1].title);
      expect(html).toContain(c.chapter3.principles[2].title);

      // Chapter 4: Execution Rules & CTA Buttons
      expect(html).toContain(c.chapter4.title);
      expect(html).toContain(c.chapter4.rules[0].name);
      expect(html).toContain(c.chapter4.rules[1].name);
      expect(html).toContain(c.chapter4.rules[2].name);

      // Conclusion & Creed
      expect(html).toContain(c.conclusion.title);
      expect(html).toContain(c.conclusion.creed);
    });
  }

  it('includes interactive exercise trial buttons for key biomechanical principles', () => {
    const rulesEn = MANIFESTO.en.chapter4.rules;
    expect(rulesEn.some(r => r.liftKey === 'bicep_curl')).toBe(true);
    expect(rulesEn.some(r => r.liftKey === 'squat')).toBe(true);
    expect(rulesEn.some(r => r.liftKey === 'lat_pulldown')).toBe(true);
  });
});

// Honesty pass of 14 October 2026, wave 2B (MAN-2 to MAN-4; MAN-1 and the asymmetry rule are on the branch
// honesty-pass): a correct credential, association rather than proof, tempo as an option, no drawn SFR law, buttons
// that say they film, no em dash.
describe('the manifesto after the honesty pass', () => {
  it('gives Layne Norton his real degree, Blair an association, tempo as an option, and no em dash', () => {
    expect(MANIFESTO.en.chapter2.subsections[0].leaders[2].affiliation).toBe('PhD, Nutritional Sciences (University of Illinois)');
    for (const l of ['fr', 'en']) {
      const text = JSON.stringify(MANIFESTO[l]);
      expect(text).not.toMatch(/Physician|irréfutable|definitive proof|prouvent|studies prove|doit être contrôlée|should be controlled|Tester |Test (Range|Tempo|Line)|\u2014/);
      expect(text).toContain('Schoenfeld et al. 2015');
    }
  });
  it('expands SFR as the stimulus-to-fatigue ratio (second review)', () => {
    const text = JSON.stringify(MANIFESTO.fr);
    expect(text).toContain('le rapport stimulus/fatigue (SFR)');
    expect(text).not.toContain('fatigue systémique (SFR)');
  });
  it('films rather than "tests" a lift, and draws no SFR equation', async () => {
    expect(MANIFESTO.fr.chapter4.rules.map(r => r.liftLabel)).toEqual(['Filmer un curl biceps', 'Filmer un squat', 'Filmer un tirage vertical']);
    expect(MANIFESTO.en.chapter4.rules.map(r => r.liftLabel)).toEqual(['Film a biceps curl', 'Film a squat', 'Film a lat pulldown']);
    const html = decode(await render('fr'));
    expect(html).not.toContain('Recrutement des Unités Motrices');
    expect(html).toContain('Asym');
  });
});
