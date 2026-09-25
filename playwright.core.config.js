import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'core-app.spec.js', timeout: 300000, retries: 0, workers: 1,
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  projects: [
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'npm run preview -- --host localhost --port 4173', port: 4173, reuseExistingServer: true },
});
