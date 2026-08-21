import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new Event('installpromptready'));
});
window.getInstallPrompt = () => deferredInstallPrompt;

// NUCLEAR: Unregister ALL service workers and clear ALL caches.
// The SW was causing stale code to persist across deploys on iOS.
// MediaPipe models load fast enough from CDN without SW caching.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}
if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(k => caches.delete(k));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
