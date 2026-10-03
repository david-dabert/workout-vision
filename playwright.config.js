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
  // The app on port 4173 is dist as built: the tests of live counting and contributions need a build with
  // VITE_LIVE=1 and VITE_CONTRIBUTE=1 (src/lib/buildFlags.js), as ci.yml's e2e job builds it (npm run build:e2e);
  // e2e/build-flags.spec.js fails at once, and says so, on a dist built without them.
  webServer: [{
    command: 'test -d dist && npm run preview || (npm run build:e2e && npm run preview)',
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
  }, {
    // The build production gets (deploy.yml): no usage counts, no live counting, contributions paused, the flags left
    // unset whatever the environment holds (e2e/build-flags.spec.js). Built fresh on every run, as the one above.
    command: 'npm run prebuild && VITE_EVENTS_URL= VITE_LIVE= VITE_CONTRIBUTE= npx vite build --outDir dist-prod --emptyOutDir && npx vite preview --outDir dist-prod --port 4176 --strictPort',
    port: 4176,
    reuseExistingServer: true,
    timeout: 180_000,
  }],
});
