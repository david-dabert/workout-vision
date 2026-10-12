/**
 * A programme the phone could not keep (11 October 2026): Safari with every cookie blocked refuses localStorage, so a
 * programme opened from the coach's link is not kept. The app holds it for the visit (App.jsx) and gives it back to the
 * programme screen on the return from filming, which opens with no link: the screen shows it, and says it is not kept,
 * never "Aucun programme".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRO } from '../pro-copy';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ useSets: () => [] }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const programme = { title: 'Haut du corps', who: 'Camille', note: '', items: [{ key: 'squat', sets: 3, reps: 10, rest: 90, note: '' }] };

async function render(lang, held) {
  // The language is read; every write is refused, as the phone refuses storage.
  const refused = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  vi.stubGlobal('localStorage', { getItem: k => (k === 'wv_lang' ? lang : refused()), setItem: refused, removeItem: refused });
  vi.stubGlobal('location', { href: 'https://david-dabert.github.io/workout-vision/#programme' });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Programme } = await import('../Programme.jsx');
  return renderToStaticMarkup(<LanguageProvider><Programme payload={null} held={held} onHold={() => {}} onClose={() => {}} onStart={() => {}} /></LanguageProvider>);
}

describe('the programme held for the visit', () => {
  for (const lang of ['fr', 'en']) {
    it(`shows it on the return from filming, and says the phone does not keep it (${lang})`, async () => {
      const html = await render(lang, programme);
      expect(html).toContain('Haut du corps');
      expect(html).toContain('data-testid="programme-item"');
      expect(html).toContain(`data-testid="programme-not-kept">${PRO[lang].notKept}</p>`);
      expect(html).not.toContain(PRO[lang].none);
      expect(html).not.toContain(PRO[lang].clientPrivacy);
    });
  }
  it('shows none when nothing is held and nothing kept', async () => {
    expect(await render('fr', null)).toContain(PRO.fr.none);
  });
});
