// Boot scripts — moved out of inline <script> tags to comply with CSP
// (script-src does not include 'unsafe-inline')

// 1 and 2. The two screens shown when the app cannot start, in the app's colours and language.
// The page's CSP has no 'unsafe-inline', which blocks onclick attributes, so the button's click
// is bound here; with onclick="location.reload()" it did nothing.
function wvBootScreen(kind) {
  var root = document.getElementById('root');
  if (!root || root.children.length !== 0) return;
  var fr = false;
  try { var saved = localStorage.getItem('wv_lang'); fr = saved ? saved === 'fr' : /^fr/i.test(navigator.language || ''); } catch (e) { fr = /^fr/i.test(navigator.language || ''); }
  // The page declares the language of the words it shows, so VoiceOver reads them in the right voice (audit of 3 October).
  try { document.documentElement.lang = fr ? 'fr' : 'en'; } catch (e) { /* no document */ }
  var t = kind === 'crash'
    ? (fr ? ['Un problème est survenu.', 'Rechargez l’application pour réessayer.', 'Recharger'] : ['Something went wrong.', 'Reload the app to try again.', 'Reload'])
    : (fr ? ['L’application ne s’est pas chargée.', 'Vérifiez votre connexion, puis rechargez.', 'Recharger'] : ['The app did not load.', 'Check your connection, then reload.', 'Reload']);
  root.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px 24px;text-align:center;background:#080706;color:#EFE8DC">'
    + '<h2 style="margin:0;font:400 32px/1.1 \'Instrument Serif\',\'Iowan Old Style\',Georgia,serif;color:#EFE8DC">' + t[0] + '</h2>'
    + '<p style="margin:0;max-width:30ch;font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#A49B8D">' + t[1] + '</p>'
    + '<button type="button" style="margin-top:12px;height:52px;min-width:180px;padding:0 28px;border:0;border-radius:18px;background:linear-gradient(180deg,#F6DAAA 0%,#E3B170 55%,#C98F48 100%);color:#150F08;font:600 16px system-ui,-apple-system,sans-serif;cursor:pointer">' + t[2] + '</button>'
    + '</div>';
  root.querySelector('button').addEventListener('click', function () { location.reload(); });
}

// 1. Crash reporter: an error before React mounts (the root is still empty). Once React is
// running, its own error boundary handles display, so a stray error cannot replace the app.
window.onerror = function () { wvBootScreen('crash'); };

// 2. Watchdog: if React has not mounted after 8 s.
setTimeout(function () { wvBootScreen('watchdog'); }, 8000);

// Fonts are bundled locally by src/main.jsx.

// 4. Glass effect heuristic: disable backdrop-filter on weak devices
(function() {
  var ua = navigator.userAgent;
  var disableGlass = false;
  if (/Android/.test(ua)) {
    var cores = navigator.hardwareConcurrency || 4;
    var memory = navigator.deviceMemory || 4;
    disableGlass = cores <= 4 && memory <= 3;
  }
  var iosMatch = ua.match(/OS (\d+)_/);
  if (iosMatch) {
    disableGlass = parseInt(iosMatch[1], 10) < 15;
  }
  if (disableGlass) {
    document.documentElement.classList.add('no-glass');
  }
})();
