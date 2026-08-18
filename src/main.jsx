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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker disabled — was serving stale cached bundles.
// MediaPipe WASM/model files are cached by the browser's HTTP cache anyway.
// Re-enable once the core engine is stable.
