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

// Wait for stale service worker cleanup (set in index.html) before rendering.
// This guarantees no old SW serves cached JS for this page load.
const swReady = window.__swReady || Promise.resolve();
swReady.then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
