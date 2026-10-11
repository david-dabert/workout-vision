import { test, expect, devices, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';
import tactilityTests from './shared/tactility.tests.js';

// In WebKit, the iPhone's engine, with the iPhone profile, as e2e/history.spec.js runs. Where
// Playwright's WebKit is not installed these tests skip and say why, except in CI, which installs it.
const hasWebKit = (() => { try { return existsSync(webkit.executablePath()); } catch { return false; } })();
test.skip(!hasWebKit && !process.env.CI, 'WebKit is not installed here (npx playwright install webkit)');
// launchOptions are reset: a PW_CHROMIUM path from the environment names a Chromium binary.
test.use({ ...devices['iPhone 14'], browserName: 'webkit', launchOptions: {}, serviceWorkers: 'block' });

test.describe('WebKit, iPhone profile', () => { tactilityTests(test, expect, { cdp: false }); });
