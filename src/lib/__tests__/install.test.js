// Installing the app (install.js): what each phone and browser is offered, and the suggestion shown once only.
import { describe, expect, it, vi } from 'vitest';
import { installKind, inAppBrowser, iosVersion, shouldSuggestInstall, markInstall, HINT_KEY, holdInstallPrompt, promptInstall, onInstallChange } from '../install';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
  iphoneChromeOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1',
  iphoneGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/330.0.661049778 Mobile/15E148 Safari/604.1',
  instagramIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; fr_FR; fr; scale=3.00; 1179x2556)',
  facebookIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBSS/3;FBLC/fr_FR]',
  tiktokIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.0.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR',
  linkedinIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1',
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.13.80',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
};
const kind = (ua, extra = {}) => installKind({ nav: { userAgent: ua, platform: '', maxTouchPoints: 0, ...extra.nav }, installed: false, prompt: false, ...extra });

describe('what each browser is offered', () => {
  it('shows the three taps in Safari on an iPhone and on an iPad that asks for the desktop site', () => {
    expect(kind(UA.iphoneSafari)).toBe('ios');
    expect(kind(UA.ipadDesktop, { nav: { platform: 'MacIntel', maxTouchPoints: 5 } })).toBe('ios');
  });
  it('shows the three taps in Chrome on iOS 16.4 or later, and asks for Safari before it or in the Google app', () => {
    expect(kind(UA.iphoneChrome)).toBe('ios');
    expect(kind(UA.iphoneChromeOld)).toBe('ios-other');
    expect(kind(UA.iphoneGoogleApp)).toBe('ios-other');
  });
  it('asks to open the link elsewhere from the browser of Instagram, Facebook, TikTok, LinkedIn or WhatsApp', () => {
    for (const ua of [UA.instagramIOS, UA.facebookIOS, UA.tiktokIOS, UA.linkedinIOS, UA.whatsappAndroid]) {
      expect(inAppBrowser(ua)).toBe(true);
      expect(kind(ua)).toBe('in-app');
    }
    // Even if the app's browser hands over an install prompt, the person is asked to open a real browser.
    expect(kind(UA.whatsappAndroid, { prompt: true })).toBe('in-app');
    expect(inAppBrowser(UA.iphoneSafari)).toBe(false);
    expect(inAppBrowser(UA.androidChrome)).toBe(false);
  });
  it('uses the install prompt where Chromium hands it over, and offers nothing without it', () => {
    expect(kind(UA.androidChrome, { prompt: true })).toBe('prompt');
    expect(kind(UA.androidChrome)).toBe('none');
    expect(kind(UA.macSafari)).toBe('none');
  });
  it('offers nothing once the app runs from the home screen, whatever the browser', () => {
    for (const ua of Object.values(UA)) expect(kind(ua, { installed: true, prompt: true })).toBe('none');
  });
  it('reads the iOS version, and none from a desktop user agent', () => {
    expect(iosVersion(UA.iphoneChrome)).toEqual([17, 4]);
    expect(iosVersion(UA.ipadDesktop)).toBeNull();
  });
});

const store = (init = {}, broken = false) => {
  const m = { ...init };
  return {
    getItem: k => { if (broken) throw new Error('blocked'); return m[k] ?? null; },
    setItem: (k, v) => { if (broken) throw new Error('blocked'); m[k] = String(v); },
    m,
  };
};

describe('the suggestion after the first saved set', () => {
  it('is shown once: never again once shown, dismissed or installed', () => {
    const s = store();
    expect(shouldSuggestInstall({ kind: 'ios', store: s })).toBe(true);
    expect(markInstall('shown', s)).toBe(true);
    expect(s.m[HINT_KEY]).toBe('shown');
    expect(shouldSuggestInstall({ kind: 'ios', store: s })).toBe(false);
    for (const state of ['dismissed', 'installed']) expect(shouldSuggestInstall({ kind: 'prompt', store: store({ [HINT_KEY]: state }) })).toBe(false);
  });
  it('is never shown where nothing can be offered (installed, or no way to install)', () => {
    expect(shouldSuggestInstall({ kind: 'none', store: store() })).toBe(false);
  });
  it('is not shown when the phone refuses the storage, so it cannot come back at every set', () => {
    const s = store({}, true);
    expect(shouldSuggestInstall({ kind: 'ios', store: s })).toBe(false);
    expect(markInstall('dismissed', s)).toBe(false);
  });
});

describe('the install prompt held from the first script', () => {
  it('keeps the event, shows it once on the key, and lets it go once the app is installed', async () => {
    const handlers = {};
    const win = { addEventListener: (t, f) => { handlers[t] = f; } };
    holdInstallPrompt(win);
    const changed = vi.fn();
    const off = onInstallChange(changed);
    const event = { preventDefault: vi.fn(), prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    handlers.beforeinstallprompt(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(installKind({ nav: { userAgent: UA.androidChrome }, installed: false })).toBe('prompt');
    expect(await promptInstall()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(await promptInstall()).toBe('unavailable');
    vi.stubGlobal('localStorage', store());
    handlers.appinstalled();
    expect(localStorage.getItem(HINT_KEY)).toBe('installed');
    expect(installKind({ nav: { userAgent: UA.androidChrome } })).toBe('none');
    expect(changed).toHaveBeenCalled();
    off();
    vi.unstubAllGlobals();
  });
});

describe('the words', () => {
  it('keep French typography: no plain space before ; : ? ! and curly apostrophes only', async () => {
    const { INSTALL } = await import('../../components/experience/install-copy');
    const all = JSON.stringify(INSTALL.fr);
    expect(all).not.toMatch(/ [;:?!]/);
    expect(all).not.toMatch(/'/);
    // The history says the same as the sheet (KeepSets.jsx reads keepWhy).
    expect(INSTALL.fr.keepWhy).toContain('sept jours d’utilisation sans ouvrir l’app');
    expect(INSTALL.fr.why).toContain('sept jours d’utilisation sans ouvrir l’app');
  });
});
