// Card 022 (cards/022-security-policy-without-unsafe-eval.md; docs/FLAWS-2026-11.md #29), failed: without 'unsafe-eval'
// in the pages' policy, the WebCodecs path is refused ("Evaluating a string as JavaScript violates the following Content
// Security Policy directive") and decoding falls back to playback, on 13 November 2026 as on 3 October. What stays is
// this guard: a video filmed and saved under the policy that ships raises no policy refusal and no WebCodecs failure,
// so a change of policy or of decoder that silently pushes reading onto the playback path fails here.
import { test, expect } from '@playwright/test';
import { start, saveSet } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';

test('a video filmed and saved under the policy that ships: no policy refusal, read by WebCodecs', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The drawn video is recorded with Chromium\'s MediaRecorder.');
  test.setTimeout(180_000);
  const refused = [], failed = [];
  page.on('console', m => { const t = m.text(); if (/WebCodecs failed|Refused to evaluate|unsafe-eval/i.test(t)) failed.push(t); });
  await start(page, { init: () => { window.__wvRefused = []; document.addEventListener('securitypolicyviolation', e => window.__wvRefused.push(`${e.violatedDirective} ${e.blockedURI}`)); } });
  await saveSet(page, PROD);
  expect(await page.evaluate(() => typeof VideoDecoder)).toBe('function');
  refused.push(...(await page.evaluate(() => window.__wvRefused || [])));
  expect(refused, refused.join('\n')).toEqual([]);
  expect(failed, failed.join('\n')).toEqual([]);
});
