// The paused path of the contributions (buildFlags.js: a build without VITE_CONTRIBUTE): the history says sending is
// paused, offers no "Aider" and no "Envoyer", and keeps "Arrêter et effacer" for a phone that said yes. Moved here from
// e2e/build-flags.spec.js on 13 November 2026, when production switched contributions on (David: "Build both"); the
// browser tests now assert the opt-in on the production build.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../lib/contribute', async () => ({
  ...(await vi.importActual('../../../lib/contribute')),
  contributions: () => Promise.resolve([]),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

async function render(choice) {
  vi.stubEnv('VITE_CONTRIBUTE', '');
  vi.stubGlobal('localStorage', { getItem: k => (k === 'wv_contribute' ? choice : null), setItem() {}, removeItem() {} });
  const { default: ContributeHistory } = await import('../ContributeHistory');
  return renderToStaticMarkup(<ContributeHistory fr />);
}

describe('contributions paused in a build without VITE_CONTRIBUTE', () => {
  it('a phone that said yes reads the pause and can stop and erase, never send', async () => {
    const html = await render('yes');
    expect(html).toContain('data-testid="contribute-paused"');
    expect(html).toContain('Les envois sont en pause');
    expect(html).toContain('Arrêter et effacer');
    expect(html).not.toMatch(/>Envoyer</);
    expect(html).not.toMatch(/>Aider</);
  });

  it('a phone never asked reads the pause and is offered nothing', async () => {
    const html = await render(null);
    expect(html).toContain('data-testid="contribute-paused"');
    expect(html).not.toContain('Arrêter et effacer');
    expect(html).not.toMatch(/>Aider</);
  });
});
