// EquiVision held to honesty properties (audit of 14 October 2026, EQ-01 to EQ-24): every simulated value sits under
// a Démo badge beside the value the simulation was written with; no verdict, limb, duty factor or legal claim is
// rendered; the painted "analysed" videos are not served; a visitor's own video gets no number, only the statement.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Equine.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function load(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  return { LanguageProvider, mod: await import('./Equine') };
}

async function render(lang) {
  const { LanguageProvider, mod } = await load(lang);
  const Equine = mod.default;
  return renderToStaticMarkup(<LanguageProvider><Equine onClose={() => {}} /></LanguageProvider>);
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

// Words of the screen before the honesty pass that claimed what nothing measures (EN and FR).
const FALSE_CLAIMS = [
  'Veterinary AI', 'On-Device', 'sur l’appareil', 'Neural', 'GDPR', 'RGPD', 'CNIL', 'Article 9', 'Clinical', 'Clinique',
  'Sound /', 'Sain', 'Suspected', 'Suspicion', 'Duty factor', 'Facteur d’appui', 'BAI', 'Within clinical tolerance',
  'Aucune boiterie significative', 'Compensé', 'compensation', 'CC-BY', 'Public Domain', 'Domaine Public', 'Muybridge',
  'Analyzed', 'Analysée', 'Withers (T6)', 'Savitzky-Golay',
];
// French that reads as translated (review of 14 October 2026): "lire" for analyse ("lire une vidéo" is to play it),
// the engine's jargon, and a frame-rate unit no one writes.
const CALQUES_FR = ['ne lit ', 'lire ', 'Lire ', 'le moteur', 'relit', 'im/s', 'aucun point', 'bilan de locomotion', 'en longe'];

describe('EquiVision', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders every band, each marked for what it is, in ${lang}`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="equine-screen"');
      expect(html).toContain('data-testid="equine-player"');
      expect(html).toContain('data-testid="equine-simulation"');
      expect(html).toContain('data-testid="equine-circle"');
      for (const s of ['sound', 'fore', 'hind']) expect(html).toContain(`data-testid="scenario-${s}"`);
      // Démo on the video band, the simulation band, its chart and its figures.
      expect(html.match(/data-testid="demo-badge"/g)?.length).toBeGreaterThanOrEqual(4);
      expect(html).toContain('data-testid="equine-upload-card"');
    });

    it(`shows no verdict, limb, legal or false on-device claim in ${lang}`, async () => {
      const t = text(await render(lang));
      for (const w of FALSE_CLAIMS) expect(t, w).not.toContain(w);
      for (const w of ['left fore', 'right hind', 'antérieur gauche', 'postérieur droit', '(LF)', '(RH)', '(AG)', '(PD)']) expect(t, w).not.toContain(w);
      if (lang === 'fr') for (const w of CALQUES_FR) expect(t, w).not.toContain(w);
    });

    it(`names the images-a-second control on screen, in ${lang}`, async () => {
      const t = text(await render(lang));
      expect(t).toContain(lang === 'fr' ? 'Images par seconde de la simulation' : 'Frames per second of the simulation');
    });

    it(`serves no painted "analysed" video and offers no download, in ${lang}`, async () => {
      const html = await render(lang);
      expect(html).not.toMatch(/analyzed/i);
      expect(html).not.toContain('download=');
      expect(html).toContain('workoutvision-ridden-dressage-raw.mp4');
    });

    it(`sets each read value beside the value the simulation was written with, in ${lang}`, async () => {
      const t = text(await render(lang));
      const programmed = lang === 'fr' ? 'Programmé dans la simulation' : 'Programmed in the simulation';
      expect(t.split(programmed).length - 1).toBe(3);
    });
  }

  it('gives the visitor’s own video no number, curve or verdict, only the statement, the file and the way back', async () => {
    for (const lang of ['en', 'fr']) {
      const { mod } = await load(lang);
      const html = decode(renderToStaticMarkup(<mod.EquineVideoBand lang={lang} own={{ url: 'blob:x', name: 'trot.mov' }} reduced onOpen={() => {}} onClose={() => {}} />));
      const t = text(html);
      expect(html).toContain('data-testid="equine-own-statement"');
      expect(html).toContain('data-testid="equine-own-video"');
      expect(html).toContain('src="blob:x#t=0.1"');
      expect(t).toContain('trot.mov');
      expect(html).not.toContain('demo-badge');
      expect(html).not.toContain('<canvas');
      expect(t).not.toMatch(/\d/); // not a single figure
      expect(t).toContain(lang === 'fr' ? 'Pas de mesure sur votre vidéo' : 'No measurement on your video');
    }
  });
});
