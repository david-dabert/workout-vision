import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
    // Where Playwright's own Chromium is absent, PW_CHROMIUM names a Chromium binary to use.
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: [{
    command: 'test -d dist && npm run preview || (npm run build && npm run preview)',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  }, {
    // A build that sends the anonymous usage counts to a server the test intercepts (e2e/events.spec.js), built
    // fresh on every run so it never lags the code. The address is never reached: .invalid cannot resolve.
    command: 'npm run prebuild && VITE_EVENTS_URL=https://events.invalid/event npx vite build --outDir dist-events --emptyOutDir && npx vite preview --outDir dist-events --port 4175 --strictPort',
    port: 4175,
    reuseExistingServer: true,
    timeout: 180_000,
  }],
});
