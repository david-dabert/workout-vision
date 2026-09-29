// In Chromium. The same tests run in WebKit with the iPhone profile in navigation-race.webkit.spec.js.
import { test, expect } from '@playwright/test';
import navigationRaceTests from './shared/navigation-race.tests.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test.describe('Chromium', () => { navigationRaceTests(test, expect); });
