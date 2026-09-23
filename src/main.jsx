import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initExercises } from './lib/exercises'

// Register service worker for offline support and PWA install prompt
if ('serviceWorker' in navigator) {
  // Auto-reload when a new SW takes control (after skipWaiting + clients.claim)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
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

// Load exercise definitions from JSON before rendering.
// This populates the EXERCISES object that all components reference synchronously.
initExercises().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}).catch(err => {
  console.error('Failed to load exercise definitions:', err);
  // Render anyway — components will see empty EXERCISES and degrade gracefully
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
