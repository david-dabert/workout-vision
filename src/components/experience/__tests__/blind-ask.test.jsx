import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The blind question on the analysis screen (BlindAsk.jsx; blind.js). It shows no number of the app's and starts from
// no number at all ("–"), with "Je ne sais pas" always offered and "Valider" waiting for a number.
vi.mock('../entry-scene', () => ({ Body: class { draw() {} }, mapPose: () => null, SPR: [], DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, setDust: () => {}, stageReduced: () => true, presence: () => 0 }));
vi.mock('../lift-scenes', () => ({ restPose: () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang, blind) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Watch } = await import('../Watch');
  return renderToStaticMarkup(<LanguageProvider><Watch lift="bicep_curl" progress={100} phase="extracting" landmarks={null} frameSize={null} onSkip={() => {}} blind={blind} /></LanguageProvider>);
}

describe('the analysis screen', () => {
  it('asks the count with no number in place, nothing of the app\'s count', async () => {
    const html = await render('fr', { onAnswer: () => {} });
    expect(html).toContain('data-testid="blind-ask"');
    expect(html).toContain('Combien en avez-vous fait\u00a0?');
    expect(html).toContain('data-testid="blind-empty"');
    expect(html).not.toContain('data-testid="blind-n"');
    expect(html).toMatch(/<button type="button" class="res-key is-primary press" disabled="" data-testid="blind-ok">Valider<\/button>/);
    expect(html).toContain('data-testid="blind-unsure">Je ne sais pas</button>');
    expect(html).toContain('L’appli affiche son compte après votre réponse.');
    for (const id of ['res-numeral', 'res-yes', 'res-proposal', 'res-typed']) expect(html).not.toContain(`data-testid="${id}"`);
  });
  it('says it in English too', async () => {
    const html = await render('en', { onAnswer: () => {} });
    expect(html).toContain('How many did you do?');
    expect(html).toContain('>I don’t know</button>');
  });
  it('asks nothing when the set is not asked', async () => {
    expect(await render('fr', null)).not.toContain('blind-ask');
  });
});

// Review of 9 October 2026: deleting every digit leaves no number, so Valider cannot send the one before.
describe('the field', () => {
  it('reads the blind field with parseBlind: emptied is no number', async () => {
    const { parseBlind } = await import('../../../lib/blind');
    expect(parseBlind('') ?? 0).toBe(0);
  });
});
