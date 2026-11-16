import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function stubEnv(store = { wv_lang: 'fr' }) {
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
      }),
    }),
  });
}

// Card 042 (15 November 2026): the screens give the angle and the framing only. The figures card 041 printed came
// from six rendered bodies per lift (test/real-phone/synth/synth.txt), which validate nothing (measures.js), R8.
const CLAIM = /exactes|Synth[eè]se|synth[eé]tique|Synthetic|synthetic|\b\d\/6\b/;

describe('filmingGuideFor (card 041, card 042)', () => {
  it('front (0°) for lateral_raise and overhead_press, with no figure', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const lr = filmingGuideFor('lateral_raise', true);
    expect(lr.view).toBe('front');
    expect(lr.angleLabel).toBe('De face (0°)');
    expect(lr.framingLabel).toContain('tête aux hanches');
    expect(lr).not.toHaveProperty('evidenceNote');

    const ohp = filmingGuideFor('overhead_press', true);
    expect(ohp.view).toBe('front');
    expect(ohp.angleLabel).toBe('De face (0°)');
    expect(ohp).not.toHaveProperty('evidenceNote');
  });

  it('side (90°) for bicep_curl and squat, with no figure', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const curl = filmingGuideFor('bicep_curl', true);
    expect(curl.view).toBe('side');
    expect(curl.angleLabel).toBe('De profil (90°)');
    expect(curl.framingLabel).toContain('bras qui travaille');

    const squat = filmingGuideFor('squat', true);
    expect(squat.view).toBe('side');
    expect(squat.angleLabel).toBe('De profil (90°)');
    expect(squat.framingLabel).toContain('corps entier');
    expect(squat).not.toHaveProperty('evidenceNote');
  });

  it('an exercise with no rendered-body check gets its angle and framing the same way, in both languages', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const bench = filmingGuideFor('bench_press', true);
    expect(bench.angleLabel).toMatch(/^De (face|profil)/);
    const benchEn = filmingGuideFor('bench_press', false);
    expect(benchEn.angleLabel).toMatch(/^(Front|Side)/);
    expect(JSON.stringify([bench, benchEn])).not.toMatch(CLAIM);
  });
});

describe('a catalogue variant of the « Changer » drawer (review of card 042, 15 November 2026)', () => {
  // The drawer passes catalogue ids (barbell_back_squat), whose counting lift is in the catalogue's counting_key.
  // The framing follows the lift it counts as. The angle stays the exercise's filmView, the view a #collecte set is
  // saved with (Result.jsx); a variant's own angle is open in card 042 until Result.jsx moves with it.
  it('gets the framing of the lift it counts as', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    expect(filmingGuideFor('barbell_back_squat', true, 'squat').framingLabel).toBe('corps entier, pieds compris');
    expect(filmingGuideFor('conventional_deadlift', true, 'deadlift').framingLabel).toBe('corps entier, pieds compris');
  });

  it('the view a #collecte set is saved with is the view Film asks for (second review of card 042)', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const { filmView } = await import('../exercise-info');
    for (const [id, counting] of [['standing_barbell_overhead_press', 'overhead_press'], ['barbell_back_squat', 'squat'], ['bicep_curl', 'bicep_curl']]) {
      expect(filmingGuideFor(id, true, counting).view).toBe(filmView(id));
    }
  });

  it('on Film, the note, the eyebrow and step 2 say the same thing', async () => {
    stubEnv({ wv_lang: 'fr' });
    const [{ LanguageProvider }, { default: Film }] = await Promise.all([
      import('../../../lib/LanguageContext'),
      import('../Film.jsx'),
    ]);
    const film = lift => renderToStaticMarkup(
      <LanguageProvider>
        <Film lift={lift} onBack={() => {}} onFile={() => {}} onLive={() => {}} onChangeLift={() => {}} />
      </LanguageProvider>,
    );
    const note = html => html.match(/data-testid="film-filming-note"[^>]*>([^<]*)</)?.[1] ?? '';

    const squat = film('barbell_back_squat');
    expect(squat).toContain('Le corps entier dans le cadre, pieds compris.');
    expect(note(squat)).toContain('corps entier, pieds compris');

    // The note's angle, the eyebrow and step 1 read one view.
    for (const html of [squat, film('standing_barbell_overhead_press'), film('lateral_raise')]) {
      const front = note(html).startsWith('De face');
      expect(html).toContain(front ? 'Filmé de face' : 'Filmé de profil');
      const step1 = html.match(/<span class="n">1<\/span><span>([^<]*)</)?.[1] ?? '';
      expect(step1).toMatch(front ? /face à vous/ : /sur le côté/);
    }
  });
});

describe('Guide & Film camera placement rendering (card 041, card 042)', () => {
  it('renders the angle and framing in the Guide focus view and on Film, and no figure', async () => {
    stubEnv({ wv_lang: 'fr' });
    const [{ LanguageProvider }, { default: Guide }, { default: Film }] = await Promise.all([
      import('../../../lib/LanguageContext'),
      import('../Guide.jsx'),
      import('../Film.jsx'),
    ]);

    const guideHtml = renderToStaticMarkup(
      <LanguageProvider>
        <Guide lift="bicep_curl" onClose={() => {}} onChoose={() => {}} />
      </LanguageProvider>,
    );
    expect(guideHtml).toContain('data-testid="guide-filming-note"');
    expect(guideHtml).toContain('De profil (90°)');
    expect(guideHtml).not.toMatch(CLAIM);

    const filmHtml = renderToStaticMarkup(
      <LanguageProvider>
        <Film lift="lateral_raise" onBack={() => {}} onFile={() => {}} onLive={() => {}} onChangeLift={() => {}} />
      </LanguageProvider>,
    );
    expect(filmHtml).toContain('data-testid="film-filming-note"');
    expect(filmHtml).toContain('De face (0°)');
    expect(filmHtml).not.toMatch(CLAIM);
  });
});
