// The crash screen (ErrorBoundary.jsx) reads its words with tModule(). Audit of the live screens, 11 October 2026:
// tModule read only the language saved by the Guide's switch, while the app follows the phone's language, so a French
// iPhone that never touched the switch saw the crash screen in English.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); });

describe('the words read outside React (tModule)', () => {
  it('follow the phone’s language when none was chosen in the app', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    const { loadLocale, tModule } = await import('../LanguageContext');
    await loadLocale('fr');
    expect([tModule('err_title'), tModule('err_try_again'), tModule('err_go_home')]).toEqual(['Une erreur est survenue', 'Réessayer', 'Accueil']);
  });

  it('keep the language chosen in the app', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    vi.stubGlobal('localStorage', { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} });
    const { tModule } = await import('../LanguageContext');
    expect(tModule('err_title')).toBe('Something went wrong');
  });
});
