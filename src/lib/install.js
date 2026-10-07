// Installing the app on the home screen (David's request, 7 October 2026). What the phone can do decides what the
// app offers, and nothing is offered once the app runs from the home screen (keep-sets.js, onHomeScreen):
//   - 'prompt': a Chromium browser (Android Chrome, Edge, Samsung Internet, desktop Chrome) handed the app its
//     install prompt (the beforeinstallprompt event, held here from the first script, main.jsx); the key calls it.
//     Source: W3C Web App Manifest and WICG "beforeinstallprompt" (Chromium only). Status: literature.
//   - 'ios': Safari on iPhone or iPad, which has no install prompt a page can call: the app shows the three taps
//     of Share, "Sur l'écran d'accueil", "Ajouter". Since iOS 16.4, Chrome, Edge and Firefox on iOS can add a
//     page to the home screen from their own Share menu (WebKit, "Web Push for Web Apps on iOS and iPadOS",
//     16 February 2023), so they get the same steps. Status: literature, not checked on a phone by us.
//   - 'in-app': the browser inside Instagram, Facebook, Messenger, WhatsApp, TikTok, LinkedIn or Snapchat, which
//     cannot install a page: the app asks to open the link in Safari (iOS) or Chrome (Android), with a copy key.
//     The names come from the apps' user-agent strings. Status: convention (UNSOURCED list; checked by David).
//   - 'ios-other': another browser on iOS before 16.4, or the Google app, where Add to Home Screen is missing.
//     Status: convention (UNSOURCED for the Google app; checked by David).
//   - 'none': nothing the app can offer (the app is installed, or a browser with no prompt to call: Firefox on
//     Android or a desktop, Safari on a Mac, Chromium before it hands the prompt over).
import { onHomeScreen, onIOS } from './keep-sets';

// The apps' own browsers, by the token each adds to its user agent. Status: convention (UNSOURCED).
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|WhatsApp|musical_ly|Bytedance|TikTok|trill_|LinkedInApp|Snapchat/i;
// The browsers on iOS other than Safari: Chrome, Firefox, Edge, Opera, DuckDuckGo, Yandex, the Google app.
const IOS_OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Ddg\/|YaBrowser|GSA\//;
// Those of them with Add to Home Screen in their Share menu from iOS 16.4 (WebKit, 16 February 2023).
const IOS_SHARE_ADD = /CriOS|FxiOS|EdgiOS/;

/** Whether the user agent is an app's own browser (Instagram, Facebook, WhatsApp, TikTok, LinkedIn...). */
export function inAppBrowser(ua = '') {
  return IN_APP.test(ua);
}

/** The iOS version the user agent states ("OS 17_4 like Mac OS X"), as [major, minor], or null (an iPad that
 * asks for the desktop site states none). */
export function iosVersion(ua = '') {
  const m = /OS (\d+)[_.](\d+)/.exec(ua);
  return m && /like Mac OS X/.test(ua) ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * What the app can offer to install it: 'prompt', 'ios', 'in-app', 'ios-other' or 'none' (above).
 * nav: the navigator; installed: whether the app runs from the home screen; prompt: whether an install prompt is held.
 */
export function installKind({ nav = globalThis.navigator, installed = onHomeScreen() || installedNow, prompt = !!held } = {}) {
  if (installed) return 'none';
  const ua = nav?.userAgent || '';
  if (inAppBrowser(ua)) return 'in-app';
  if (prompt) return 'prompt';
  if (!onIOS(nav || {})) return 'none';
  if (!IOS_OTHER.test(ua)) return 'ios';
  const v = iosVersion(ua);
  const shareAdd = IOS_SHARE_ADD.test(ua) && (!v || v[0] > 16 || (v[0] === 16 && v[1] >= 4));
  return shareAdd ? 'ios' : 'ios-other';
}

// ── The install prompt, held from the first script (main.jsx) ──
let held = null, installedNow = false;
const listeners = new Set();
const tell = () => listeners.forEach(f => f());

/** Called once, before the app renders: keeps Chromium's install prompt, and lets it go once the app is installed. */
export function holdInstallPrompt(win = globalThis.window) {
  if (!win?.addEventListener) return;
  win.addEventListener('beforeinstallprompt', e => {
    // Kept for the app's own key: Chromium's mini bar would otherwise offer it at a moment the app did not choose.
    e.preventDefault?.();
    held = e;
    tell();
  });
  win.addEventListener('appinstalled', () => { held = null; installedNow = true; markInstall('installed'); tell(); });
}
/** Whether the app was installed during this visit (it still runs in the browser tab it was installed from). */
export const installedThisVisit = () => installedNow;

/** Calls for a change of what can be offered (a prompt held, the app installed); returns the unsubscribe. */
export function onInstallChange(f) { listeners.add(f); return () => listeners.delete(f); }

/** Shows Chromium's install prompt; resolves to 'accepted', 'dismissed' or 'unavailable'. A prompt is shown once:
 * after it, Chromium hands a new one only if the person did not install. */
export async function promptInstall() {
  const e = held;
  if (!e?.prompt) return 'unavailable';
  held = null;
  tell();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch { return 'unavailable'; }
}

// ── The suggestion after the first saved set ──
// Offered once: on the saved card of the first set saved where something can be offered, never before the count is
// confirmed. Once shown, dismissed or the app installed, it never comes back. A phone whose storage cannot be read
// or written never sees it, so it never comes back at every set. Status: convention (UNSOURCED, David's request).
export const HINT_KEY = 'wv_install_hint';

function readHint(store) {
  try { return store.getItem(HINT_KEY); } catch { return undefined; }
}

/** Records the suggestion's state: 'shown', 'dismissed' or 'installed'; false if the phone refused it. */
export function markInstall(state, store = globalThis.localStorage) {
  try { store.setItem(HINT_KEY, state); return true; } catch { return false; }
}

/** Whether to suggest installing on this saved card: something to offer, and the suggestion never recorded. */
export function shouldSuggestInstall({ kind, store = globalThis.localStorage }) {
  if (kind === 'none') return false;
  const hint = readHint(store);
  return hint === null; // undefined: storage unreadable, so the suggestion could not be remembered
}
