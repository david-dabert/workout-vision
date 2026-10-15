// The sports lab held to honesty properties (audit of 14 October 2026, SP-01 to SP-30): for every sport, the clip is
// the raw one under a Démo badge; no pre-rendered "analysed" file, poster with a burned-in HUD, typed figure, verdict,
// athlete or tour name, licence tag, price, torque, speed or G load is rendered; a visitor's own video gets the
// statement and no number.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./SportsBiomechanics.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const SPORTS = ['golf', 'tennis', 'padel', 'baseball', 'cycling', 'rowing', 'skiing', 'swimming'];

async function load(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  return { LanguageProvider, mod: await import('./SportsBiomechanics') };
}

async function render(lang, sport) {
  const { LanguageProvider, mod } = await load(lang);
  const Sports = mod.default;
  return renderToStaticMarkup(
    <LanguageProvider>
      <Sports sport={sport} onClose={() => {}} onOpenEquine={() => {}} onOpenVolleyball={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

// What the screen showed before the honesty pass and no code measured (EN and FR), and every real person or tour.
const FALSE_CLAIMS = [
  'Tour AI', 'On-Device', 'Sur l’Appareil', 'Neural', 'HUD', '0ms', 'CLOUD', '33-LM', 'Biométrie', 'Biometrics', 'HD',
  'X-Factor Stretch', 'Tour Model', 'PGA', 'ATP', 'MLB', 'Tour level', 'Niveau Tour', 'Coupe du Monde', 'World Cup',
  'Olympi', 'Roddick', 'Navarro', 'Tiger', 'Woods', 'Els', 'ASMI', 'UCL', 'Nm', 'mph', 'G-Force', 'Force G', 'Propulsion Score',
  'Score Propulsion', 'Suppression', 'CC-BY', 'TrackMan', 'GCQuad', '€', '$', 'Holmes', 'Optimal', 'Optimale', 'GOLD', 'SAFE',
  'ELITE', 'Élite', 'Sécuritaire', 'Copy Report', 'Copier', 'Télécharger', 'Download', 'Analyze Video', 'Analyser',
];

// French that reads as translated, or claims too much (review of 14 October 2026): "lire" for analyse ("lire une
// vidéo" is to play it), a heading about what phone video in general cannot do, a first-person button.
const CALQUES_FR = ['ne lit ', 'lire ', ' lu ', 'Hors de portée', 'ma vidéo', 'Usage de coach', 'home trainer', 'ni l’un'];

describe('the sports lab', () => {
  for (const lang of ['en', 'fr']) {
    for (const sport of SPORTS) {
      // Since 14 October 2026 (David) the analysed clip opens first as a preview of where the app is going, under an
      // « Aperçu » badge and a note that its figures are not measured; the plain clip is one tap away.
      it(`${sport} (${lang}): the preview under an Aperçu badge and its note, the plain clip offered, no false claim in text`, async () => {
        const html = decode(await render(lang, sport));
        const t = text(html);
        expect(html).toContain(`aria-pressed="true" data-testid="tab-${sport}"`);
        expect(html).toContain(`demo/sports/${sport}-demo-analyzed.mp4#t=0.1`);
        expect(html).toContain('data-testid="preview-badge"');
        expect(html).toContain('data-testid="sports-view-raw"');
        expect(t).toContain(lang === 'fr' ? 'Ils ne sont pas encore mesurés.' : 'They are not measured yet.');
        // The analysed posters (HUD burned in) stay off; the putt's plain poster is checked below.
        expect(html).not.toContain(`${sport}-demo-poster.jpg`);
        expect(html).not.toContain('download=');
        expect(html).toContain('data-testid="sports-reach"');
        for (const w of FALSE_CLAIMS) expect(t, `${sport} ${lang}: ${w}`).not.toContain(w);
        if (lang === 'fr') for (const w of CALQUES_FR) expect(t, `${sport}: ${w}`).not.toContain(w);
        expect(t).not.toContain(lang === 'fr' ? 'vidéo de téléphone' : 'Beyond a phone video');
      });
    }

    it(`opens the calculators only where a reference has a source, in ${lang}`, async () => {
      for (const sport of SPORTS) {
        const html = await render(lang, sport);
        expect(html.includes('data-testid="sports-calc-'), sport).toBe(sport === 'golf' || sport === 'rowing');
      }
    });

    // The putt (15 October 2026, David): golf only, as filmed, under a Démo badge, with its note and its CC BY-SA credit.
    it(`shows the putt as filmed on golf only, with its poster, note and credit, in ${lang}`, async () => {
      for (const sport of SPORTS) {
        const html = decode(await render(lang, sport));
        expect(html.includes('data-testid="sports-putt-card"'), sport).toBe(sport === 'golf');
        expect(html.includes('golf-putt-demo-raw.mp4'), sport).toBe(sport === 'golf');
      }
      const html = decode(await render(lang, 'golf'));
      const card = html.slice(html.indexOf('data-testid="sports-putt-card"'), html.indexOf('data-testid="sports-reach"'));
      const t = text(card);
      expect(card).toContain('src="/demo/sports/golf-putt-demo-raw.mp4#t=0.1"');
      expect(card).toContain('poster="/demo/sports/golf-putt-demo-poster.jpg"');
      expect(card).toMatch(/<video[^>]*controls=""[^>]*playsinline=""[^>]*muted=""/i);
      expect(card).not.toMatch(/autoplay/i);
      expect(card).not.toContain('analyzed');
      expect(card).toContain('data-testid="demo-badge"');
      expect(t).toContain(lang === 'fr' ? 'Un putt, filmé tel quel' : 'A putt, as filmed');
      expect(t).toContain(lang === 'fr' ? 'l’appli n’analyse rien sur cette vidéo' : 'the app analyses nothing on this video');
      expect(t).toContain('Grillo');
      expect(t).toContain('CC BY-SA 3.0');
      expect(card).toContain('href="https://creativecommons.org/licenses/by-sa/3.0/"');
      expect(card).toMatch(/href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Golfputt\.ogv"[^>]*data-testid="sports-putt-credit-link"/);
      expect(card).toContain('rel="noreferrer"');
      expect(t).not.toMatch(/\d+\s*(ms|%|°)/);
    });

    it(`keeps the links to volleyball and equitation, in ${lang}`, async () => {
      const html = await render(lang);
      expect(html).toContain('data-testid="tab-volleyball-link"');
      expect(html).toContain('data-testid="tab-equine-link"');
      expect(html).toContain('aria-pressed="true" data-testid="tab-golf"');
      // Volleyball last: it leaves this screen, so every chip that stays, and equitation, come before it (David, 15 October 2026).
      const rail = html.slice(html.indexOf('class="sc-rail"'), html.indexOf('data-testid="tab-volleyball-link"'));
      for (const k of ['golf', 'tennis', 'padel', 'baseball', 'cycling', 'rowing', 'skiing', 'swimming']) expect(rail).toContain(`data-testid="tab-${k}"`);
      expect(rail).toContain('data-testid="tab-equine-link"');
    });
  }

  it('gives the visitor’s own video no number, only the statement, the file and the way back', async () => {
    for (const lang of ['en', 'fr']) {
      const { mod } = await load(lang);
      const { SPORTS_COPY } = await import('./sports-copy');
      const html = decode(renderToStaticMarkup(<mod.SportsOwnVideo c={SPORTS_COPY[lang]} video={{ url: 'blob:y', name: 'swing.mov' }} onClose={() => {}} />));
      const t = text(html);
      expect(html).toContain('data-testid="sports-own-statement"');
      expect(html).toContain('src="blob:y#t=0.1"');
      expect(t).toContain('swing.mov');
      expect(t).not.toMatch(/\d/);
      expect(t).toContain(lang === 'fr' ? 'Pas de mesure sur votre vidéo' : 'No measurement on your video');
    }
  });
});
