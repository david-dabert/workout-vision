import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'decode-clips.spec.js',
  timeout: 300_000,
  retries: 0,
  workers: 1, // sequential: model loading is heavy
  use: {
    baseURL: 'http://localhost:5173',
    // Chrome: rVFC support, reliable H.264 decode
    ...devices['Desktop Chrome'],
    // Allow large payloads (landmark arrays)
    launchOptions: {
      args: ['--disable-web-security'],
    },
  },
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
