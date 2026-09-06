// Boot scripts — moved out of inline <script> tags to comply with CSP
// (script-src does not include 'unsafe-inline')

// 1. Crash reporter: show JS errors on screen instead of black void
window.onerror = function(msg, src, line, col, err) {
  var d = document.getElementById('root');
  if (d) d.innerHTML = '<div style="padding:40px 20px;text-align:center">'
    + '<h2 style="color:#fff;margin-bottom:12px;font-family:system-ui">Something went wrong</h2>'
    + '<p style="color:#888;font-family:system-ui;margin-bottom:20px">WorkoutVision encountered an error. Please reload to try again.</p>'
    + '<button onclick="location.reload()" style="padding:12px 24px;background:#00f5d4;color:#000;border:none;border-radius:8px;font-weight:bold;font-size:1rem;cursor:pointer">Reload App</button>'
    + '</div>';
};
window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown promise rejection';
  window.onerror(msg, '', 0, 0, e.reason);
});

// 2. Watchdog: if React hasn't mounted after 8s, show diagnostic
setTimeout(function() {
  var r = document.getElementById('root');
  if (r && r.children.length === 0) {
    r.innerHTML = '<div style="color:#ffb836;padding:20px;font:14px monospace">'
      + '<h2 style="color:#fff;margin-bottom:12px">WorkoutVision</h2>'
      + '<p>App did not load within 8 seconds.</p>'
      + '<p style="color:#888;margin-top:8px">This may be a network issue or JavaScript error.</p>'
      + '<button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;background:#00f5d4;color:#000;border:none;border-radius:8px;font-weight:bold">Retry</button>'
      + '</div>';
  }
}, 8000);

// 3. Kill any service worker and clear all caches.
(function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(r) {
      r.forEach(function(reg) { reg.unregister(); });
    });
  }
  if ('caches' in window) {
    caches.keys().then(function(k) {
      k.forEach(function(n) { caches.delete(n); });
    });
  }
})();

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
