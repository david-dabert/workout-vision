import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The result in the final direction (C4 of the design review, 7 October 2026; screens 05, 05b, 05c):
//   - the count is confirmed before anything is saved or offered next (no saved card, no next set, no celebration);
//   - a planned value is never styled as a measure (the word "planned", caption size, never the measured colour);
//   - on low confidence (refused, counted none, live count not the final one) no number shows until the person
//     gives one: "–", quick keys centred on the plan with none chosen, Save inactive, no measure.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
let SETS = null;
vi.mock('../sets', () => ({ knownSets: () => SETS, loadSets: () => Promise.resolve(SETS || []), refreshSets: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); SETS = null; });

const rep = (index, t) => ({ index, startTime: t, endTime: t + 2, concentricSec: 1, eccentricSec: 1, romDegrees: 100 });
const nine = { count: 9, refused: false, arm: 'right', reps: Array.from({ length: 9 }, (_, i) => rep(i + 1, i * 2)), confidence: 0.9, metadata: { duration: 32 } };
const plan = { programme: 'p1', item: 0, sets: 4, reps: 10, rest: 90 };
async function render(lang, result, props = {}, level = 'intermediate') {
  const store = { wv_lang: lang, wv_level: level };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Result } = await import('../Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift="bicep_curl" result={result} onClose={() => {}} onReplay={() => {}} {...props} /></LanguageProvider>);
}

describe('the count is confirmed before it is saved', () => {
  it('asks "C’est bien N ?" with the measured count, and offers nothing that follows a save', async () => {
    const fr = await render('fr', nine);
    expect(fr).toContain('C’est bien 9 ?');
    expect(fr).toContain('À confirmer');
    expect(fr).toContain('Compté par l’appli sur votre vidéo de 32 s.');
    expect(fr).toMatch(/data-testid="res-yes">Oui, 9 répétitions<\/button>/);
    expect(fr).toContain('Revoir la vidéo');
    // The measured count, in the measured colour (not typed), between − and +.
    expect(fr).toMatch(/<span class="numeral tick" aria-hidden="true" data-testid="res-numeral">9<\/span>/);
    expect(fr).toContain('aria-label="Une de moins"');
    expect(fr).toContain('aria-label="Une de plus"');
    // Nothing of the saved state before the answer: no saved card, no next set, no rest, no earned line, no "Saved".
    for (const id of ['saved-card', 'new-set', 'change-lift', 'moment', 'level-ask']) expect(fr).not.toContain(`data-testid="${id}"`);
    expect(fr).not.toContain('rest-clock');
    expect(fr).not.toContain('Enregistré');
    expect(fr).not.toContain('is-sq');
  });
  it('says it in English too', async () => {
    const en = await render('en', nine);
    expect(en).toContain('Was it 9?');
    expect(en).toMatch(/data-testid="res-yes">Yes, 9 reps<\/button>/);
    expect(en).toContain('Counted by the app on your 32 s video.');
  });
});

describe('a planned value is never styled as a measure', () => {
  const today = Date.now() - 60_000;
  const first = { id: 'a', exercise: 'bicep_curl', reps: 10, source: 'counter-core', machineResult: { reps: 10 }, createdAt: today, planned: plan };
  it('shows the day: the set confirmed, the set on screen to confirm, the sets to come "prévu"', async () => {
    SETS = [first];
    const fr = await render('fr', nine, { planned: plan });
    expect(fr).toContain('Curl biceps · Série 2 / 4');
    expect(fr).toContain('Prévu : 4 séries de 10');
    const rows = [...fr.matchAll(/<li class="res-row is-([a-z]+)[^"]*" data-kind="\1">(.*?)<\/li>/g)].map(m => [m[1], m[2].replace(/<[^>]+>/g, '|').replace(/\|+/g, '|')]);
    expect(rows).toEqual([
      ['confirmed', '|Série 1|10|confirmée|'],
      ['pending', '|Série 2|9|à confirmer|'],
      ['planned', '|Série 3|prévu 10|'],
      ['planned', '|Série 4|prévu 10|'],
    ]);
    // Every planned value carries the word, and none is the numeral.
    expect(fr.match(/data-testid="res-planned">([^<]*)</g)).toEqual(['data-testid="res-planned">prévu 10<', 'data-testid="res-planned">prévu 10<']);
    expect(fr).toMatch(/data-testid="res-numeral">9</);
    // One dashed cell per planned rep beyond the nine counted, never lit.
    const planned = fr.match(/data-testid="res-planned-cells"[^>]*>(.*?)<\/div><\/div>/)[1];
    expect(planned.match(/class="bar is-planned"/g)).toHaveLength(1);
    expect(planned).not.toContain('lit');
  });
  it('draws no planned mark in the measured colour, at numeral size or at weight 700 (Result.css)', () => {
    const css = readFileSync(resolve(__dirname, '../Result.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /is-planned|res-planned/.test(m[1]));
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const [, sel, body] of rules) {
      expect(body, sel).not.toMatch(/--numeral-colour|--c-accent|--lamp|font-weight:\s*700|--fs-display/);
    }
    expect(css).toMatch(/\.res-row\.is-planned \.res-row-n \{[^}]*font-size: 15px;[^}]*color: var\(--c-fg-muted\)/);
  });
  it('names no set number before the sets are read', async () => {
    const fr = await render('fr', nine, { planned: plan });
    expect(fr).not.toContain('Série 1 / 4');
    expect(fr).not.toContain('data-testid="res-plan"');
  });
});

describe('low confidence shows no number until the person gives one', () => {
  const cases = {
    'counted none': [{ ...nine, count: 0, reps: [] }, {}],
    refused: [{ ...nine, count: 0, reps: [], refused: true, worldLandmarks: [], timestamps: [] }, {}],
    'live count not the final one': [{ ...nine, metadata: { duration: 32, live: true } }, { liveShown: 7 }],
  };
  for (const [name, [result, props]] of Object.entries(cases)) {
    it(`starts at "–", with Save inactive and no measure (${name})`, async () => {
      const en = await render('en', result, props);
      expect(en).toContain('data-testid="res-empty"');
      expect(en).toContain('How many did you do?');
      expect(en).toContain('Your count');
      for (const id of ['res-numeral', 'res-typed', 'ask-card', 'res-exp', 'set-account', 'level-table', 'res-plan']) expect(en).not.toContain(`data-testid="${id}"`);
      expect(en).not.toMatch(/class="(bars|res-wave)[" ]/);
      expect(en).toMatch(/data-testid="res-save" disabled="">Save<\/button>/);
      expect(en).toContain('Record the set again');
      // No count of the app as a number on the screen: neither the final 9 nor the 0.
      expect(en).not.toMatch(/>9</);
      expect(en).not.toMatch(/>0</);
    });
  }
  it('says what the live screen showed, without the final count', async () => {
    const fr = await render('fr', { ...nine, metadata: { duration: 32, live: true } }, { liveShown: 7 });
    expect(fr).toContain('L’appli n’a pas pu compter cette série avec certitude.');
    expect(fr).toContain('En direct, l’appli affichait 7. En relisant toute la série, elle ne trouve pas le même nombre.');
  });
  it('centres the quick keys on the plan, none chosen', async () => {
    const fr = await render('fr', { ...nine, count: 0, reps: [] }, { planned: plan });
    expect([...fr.matchAll(/<button type="button" class="res-qk press" aria-pressed="false">(\d+)<\/button>/g)].map(m => m[1])).toEqual(['8', '9', '10', '11', '12']);
    expect(fr).not.toContain('aria-pressed="true"');
    expect(fr).toContain('Votre programme prévoit 10.');
    expect(fr).toContain('Touchez un nombre, ou corrigez avec –\u00A0et\u00A0+.');
  });
  it('offers no quick key without a plan or a previous set (never the app’s count)', async () => {
    const en = await render('en', { ...nine, metadata: { duration: 32, live: true } }, { liveShown: 7 });
    expect(en).not.toContain('res-qk');
  });
});

describe('the keys’ outlines', () => {
  // WCAG 2.2 SC 1.4.11: a component's boundary holds 3:1 against what is next to it. --c-edge over --void.
  const lum = ([r, g, b]) => [r, g, b].map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  it('hold at least 3:1 against the ground', () => {
    const tokens = readFileSync(resolve(__dirname, '../../../styles/_tokens.css'), 'utf8');
    const entry = readFileSync(resolve(__dirname, '../Entry.css'), 'utf8');
    const [, r, g, b, a] = tokens.match(/--c-edge:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/).map(Number);
    const hex = entry.match(/--void:\s*#([0-9A-Fa-f]{6})/)[1];
    const ground = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    const edge = [r, g, b].map((v, i) => v * a + ground[i] * (1 - a));
    const ratio = (lum(edge) + 0.05) / (lum(ground) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(3);
    const css = readFileSync(resolve(__dirname, '../Result.css'), 'utf8');
    for (const k of ['res-step', 'res-key', 'res-qk']) expect(css).toMatch(new RegExp(`\\.${k} \\{[^}]*border: 1\\.5px solid var\\(--c-edge\\)`));
    // 44 pt at least for every key (Apple HIG); the steppers 64.
    expect(css).toMatch(/\.res-step \{[^}]*width: 64px; height: 64px/);
  });
});
