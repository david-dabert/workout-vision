// Cache-bust: detect stale HTML pointing to deleted assets.
// GitHub Pages serves HTML with max-age=600. If a deploy replaces
// assets while the old HTML is cached, the module script 404s and
// React never mounts. This HEAD-checks the script src and reloads
// with a cache-busting query if the asset is gone.
(function() {
  if (sessionStorage.getItem('_cb')) return;
  var s = document.querySelector('script[type="module"][src]');
  if (!s) return;
  fetch(s.src, { method: 'HEAD' }).then(function(r) {
    if (!r.ok) {
      sessionStorage.setItem('_cb', '1');
      var params = new URLSearchParams(location.search);
      params.set('_', Date.now());
      location.replace(location.pathname + '?' + params.toString());
    }
  }).catch(function() {});
})();
