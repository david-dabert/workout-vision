// In Chromium. tactility.webkit.spec.js runs the same file in WebKit with the iPhone profile, where the
// tests that drive touch through Chrome's DevTools protocol are replaced by weaker stand-ins or left open.
import { test, expect } from '@playwright/test';
import tactilityTests from './shared/tactility.tests.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test.describe('Chromium', () => { tactilityTests(test, expect); });
