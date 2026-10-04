// The build flags (src/lib/buildFlags.js; WP0.3, WP0.4 of docs/SPEC-production.md): only the value '1' switches a
// feature on, as Vite replaces import.meta.env at build time; the history's section on helping, paused, offers the
// stop and erase only. The browser tests of both builds are e2e/build-flags.spec.js.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { contributeBuild, liveBuild } from '../buildFlags';
import ContributeHistory from '../../components/experience/ContributeHistory';
import { CONTRIBUTE } from '../../components/experience/contribute-copy';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('the flags', () => {
  it('are on for "1" only', () => {
    for (const [v, on] of [[undefined, false], ['', false], ['0', false], ['true', false], ['1', true]]) {
      vi.stubEnv('VITE_LIVE', v); vi.stubEnv('VITE_CONTRIBUTE', v);
      expect([liveBuild(), contributeBuild()]).toEqual([on, on]);
    }
  });
});

describe('the history\'s section on helping', () => {
  const render = choice => {
    vi.stubGlobal('localStorage', { getItem: k => (k === 'wv_contribute' ? choice : null), setItem() {}, removeItem() {} });
    return renderToStaticMarkup(<ContributeHistory fr />);
  };
  it('paused, offers no "Aider" and says nothing is sent; a stored yes can be stopped and erased', () => {
    vi.stubEnv('VITE_CONTRIBUTE', '');
    const yes = render('yes');
    expect(yes).toContain('data-testid="contribute-paused"');
    expect(yes).toContain(CONTRIBUTE.fr.stop);
    expect(yes).not.toContain(`>${CONTRIBUTE.fr.start}<`);
    expect(yes).not.toContain(`>${CONTRIBUTE.fr.send}<`);
    expect(yes).not.toContain('pour que vous l’envoyiez');
    const none = render(null);
    expect(none).not.toContain(`>${CONTRIBUTE.fr.start}<`);
    expect(none).not.toContain(CONTRIBUTE.fr.stop);
  });
  it('on, offers "Aider" as before', () => {
    vi.stubEnv('VITE_CONTRIBUTE', '1');
    const none = render(null);
    expect(none).toContain(`>${CONTRIBUTE.fr.start}<`);
    expect(none).not.toContain('data-testid="contribute-paused"');
  });
});
