import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'decode-clips.spec.js',
  timeout: 300_000,
  retries: 0,
  workers: 1, // sequential: model loading is heavy
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
