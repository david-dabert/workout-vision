import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register service worker for offline support and PWA install prompt
if ('serviceWorker' in navigator) {
  // Auto-reload when a new SW takes control (after skipWaiting + clients.claim)
  let refreshing = false;
  const wasControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
        { updateViaCache: 'none' }
      );
      // Check for SW updates every 60s
      setInterval(() => reg.update(), 60_000);
      // Also check when user returns to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    } catch (_) { /* SW registration failed — app works fine without it */ }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
