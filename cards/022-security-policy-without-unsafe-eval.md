# 022. The pages' security policy refuses code built from text
Status: failed (13 November 2026)
Result (Claude): without `'unsafe-eval'` the eval's part (2) fails: "[frameExtractor] WebCodecs failed: Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script", decoding falls back to playback, and `first-word.spec.js` fails with it. A search of web-demuxer 4.0.0 (its embedded worker decoded) and MediaPipe's loaders for `eval`, `new Function` and string timers found none, so the code that builds a string into JavaScript on that path is not located. The policy keeps `'unsafe-eval'`; `index.html` records the second try. Kept: part (2) as a guard (`e2e/csp-no-eval.spec.js`), which passes under the policy that ships. Reopen by finding the evaluating call (a stack trace from Chromium's `securitypolicyviolation` event with `report-sample`).
Executor: careful
Claim: a script injected into a page cannot run code from a string, and the video is still read by WebCodecs.
Reference: `docs/FLAWS-2026-11.md` #29; the pages' Content-Security-Policy (`index.html`, `check.html`, `pack.html`) carry `'unsafe-eval'`, kept on 3 October 2026 because web-demuxer's loader then evaluated code and decoding fell back to playback without it.
Eval: `e2e/csp-no-eval.spec.js` on the production build: (1) none of the three pages' policies holds `'unsafe-eval'`; (2) a drawn video filmed and saved through the app raises no `securitypolicyviolation` event and no "WebCodecs failed" message, with `VideoDecoder` present, so the WebCodecs path read it.
Baseline: part (1) fails today on the three pages.
Scope: the three policies and their comments. No source file.
Stop: if part (2) fails without `'unsafe-eval'`, the policy keeps it and the reason is recorded with the current versions.
Needs from David: nothing.
