import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ABOUT, DEMOS } from '../about-copy';

// "À propos" (6 October 2026): David's words, approved as written, every sentence on its own line, in both languages.
vi.mock('../About.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: About } = await import('../About');
  return renderToStaticMarkup(<LanguageProvider><About onClose={() => {}} /></LanguageProvider>);
}
const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('the About page', () => {
  for (const lang of ['fr', 'en']) {
    it(`renders every line, the title, the signature and the three photos (${lang})`, async () => {
      const html = await render(lang), c = ABOUT[lang];
      const lines = [...html.matchAll(/<span class="about-line">([^<]*)<\/span>/g)].map(m => decode(m[1]));
      expect(lines).toEqual(c.paragraphs.flat());
      expect(lines).toHaveLength(22);
      expect(html).toContain(`<h1 class="title" data-reveal="true" style="--i:1">${c.title}</h1>`);
      expect(html).toContain(`<p class="about-signature">${c.signature}</p>`);
      expect(html).toContain(`<p class="about-lead">${c.lead}</p>`);
      expect(c.lead).toBe(lang === 'fr' ? 'Votre corps est un\u00A0temple.' : 'Your body is a\u00A0temple.');
      const imgs = [...html.matchAll(/<img [^>]*>/g)].map(m => m[0]);
      expect(imgs).toHaveLength(3);
      expect(imgs.map(i => i.match(/alt="([^"]*)"/)[1])).toEqual([c.photos.portrait.alt, c.photos.sanSiro.alt, c.photos.dordogne.alt]);
      expect(imgs.map(i => /loading="lazy"/.test(i))).toEqual([false, true, true]);
      expect(imgs.every(i => /width="\d+"/.test(i) && /height="\d+"/.test(i))).toBe(true);
      expect([...html.matchAll(/<figcaption>([^<]*)<\/figcaption>/g)].map(m => m[1])).toEqual([c.photos.sanSiro.caption, c.photos.dordogne.caption, ...DEMOS.map(d => (lang === 'fr' ? d.fr : d.en).replace(/ /g, ' '))]);
      // The demonstration sets: muted, looping, inline, with a poster.
      expect([...html.matchAll(/<video [^>]*>/g)].map(m => m[0]).every(v => /muted/.test(v) && /playsInline|playsinline/.test(v) && /poster=/.test(v))).toBe(true);
    });
  }
  it('keeps the photos in their order in the text: portrait, title, P1, San Siro, P2, Dordogne, P3 to P5', async () => {
    const html = await render('fr');
    const at = s => html.indexOf(s);
    expect(at('portrait.jpg')).toBeLessThan(at('<h1'));
    expect(at('<h1')).toBeLessThan(at('Ce fut un réveil brutal.'));
    // The story opens on "Votre corps est un temple." (moved from the entry, design review of 7 October 2026).
    expect(at('<h1')).toBeLessThan(at('<p class="about-lead">Votre corps est un\u00A0temple.</p>'));
    expect(at('<p class="about-lead">')).toBeLessThan(at('Il y a trois ans, je pesais'));
    expect(at('Ce fut un réveil brutal.')).toBeLessThan(at('san-siro-2023.jpg'));
    expect(at('san-siro-2023.jpg')).toBeLessThan(at('Depuis, j’ai fait'));
    expect(at('pesais 105')).toBeLessThan(at('dordogne-2026.jpg'));
    expect(at('dordogne-2026.jpg')).toBeLessThan(at('Je ne suis pas un champion.'));
  });
  it('writes French with typographic apostrophes and a non-breaking space between a number and its unit', () => {
    const all = [ABOUT.fr.title, ...ABOUT.fr.paragraphs.flat(), ...ABOUT.en.paragraphs.flat()].join('\n');
    expect(all).not.toContain('\'');
    expect(all).not.toMatch(/\d (kilo|séances|semaines|gym|weeks)/);
  });
});
