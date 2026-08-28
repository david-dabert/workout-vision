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

// Service worker registration removed. Browser HTTP caching handles
// static assets via Cache-Control headers from GitHub Pages.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
