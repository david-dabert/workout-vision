import { defineConfig } from '@playwright/test';
// Throwaway branch ci/perf-probe only: the server is started by the workflow.
export default defineConfig({ testDir: './e2e', timeout: 200_000, retries: 0, use: { serviceWorkers: 'allow' } });
