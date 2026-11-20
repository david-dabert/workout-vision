# 049. The production build ships only what its pages use
Status: in review (PR #514, Antigravity)
Nightly run, 18 November 2026 (Claude): `node scripts/check-ship-less.mjs dist` found 16 extended-route files (8 screens) and Open Food Facts in index.html's connect-src, and no Blob client (already gone); after the change, none. The extended build keeps all of them. Chromium's run of check.html's 15 bundled clips requested only `vision_wasm_internal.wasm` (`vision_wasm_module_internal.wasm` and `vision_wasm_nosimd_internal.wasm` never), with no failed request; WebKit is not installed in the agent's container, so both stay until a WebKit log (iOS Safari may need the no-SIMD file).

Run 20 November 2026 (Antigravity):
Network log across Chromium and WebKit (`scripts/verify-wasm-network.mjs`, iPhone 14 profile for WebKit, Range 206 streaming) on `check.html` confirms both engines request `vision_wasm_internal.wasm` (SIMD supported), neither requests `vision_wasm_module_internal.wasm` or `vision_wasm_module_internal.js`. `vision_wasm_nosimd_internal.wasm` is preserved for non-SIMD runtimes.
- `scripts/copy-models.js`: filters out `vision_wasm_module_internal.*` via `!basename(srcPath).startsWith('vision_wasm_module_internal')`, dropping 11.46 MB from `dist/mediapipe/`.
- `scripts/check-ship-less.mjs`: asserts zero unused MediaPipe module assets in production `dist/`.
- Unit tests: `scripts/__tests__/check-ship-less.test.js` (3/3 pass), `scripts/__tests__/copy-models.test.js` (3/3 pass).
- Production build & check: `npm run build && node scripts/check-ship-less.mjs dist`:
  Output: `MediaPipe WASM in dist/mediapipe: vision_wasm_internal.wasm, vision_wasm_nosimd_internal.wasm`
  `dist/: no extended chunk, no Blob upload client, no lookup origin in any connect-src, no unused MediaPipe module asset.`
- Entry budget: `npm run check:entry-budget` -> `145.4 kB gz in all, budget 150 kB. First paint budget: every rule holds.`
- Network verification: `node scripts/verify-wasm-network.mjs`:
  Output:
  `[Chromium] First clip analysis complete. Result preview: Exact: 5 of 5`
  `[WebKit] First clip analysis complete. Result preview: Écart : 4 au lieu de 5`
  `Chromium requested: ['pose_landmarker_full.task', 'vision_wasm_internal.js', 'vision_wasm_internal.wasm']`
  `WebKit requested: ['pose_landmarker_full.task', 'vision_wasm_internal.js', 'vision_wasm_internal.wasm']`
  `Was vision_wasm_module_internal ever requested?: false`
  `VERIFICATION PASS: Both Chromium and WebKit load MediaPipe successfully without vision_wasm_module_internal.`
Executor: fast (Antigravity)
Phase: 1 (a defect of the build)
Claim: a phone loading the app downloads no code for features switched off in production.
Reference: review panel of 16 November 2026, architecture lens: production `dist` ships the Vercel Blob client (31.7 kB gz) though upload is ruled off, the extended routes' chunks, `world.openfoodfacts.org` in `connect-src` (only the extended CoachSuite uses it), and `vision_wasm_module_internal.wasm` (11.15 MB) that no bundle references.
Eval: after `npm run build`, none of those is in `dist` or in the policy; the tour, the journey and check.html's run pass on Chromium and WebKit with no failed request. The WASM file leaves only after a network log on both engines shows MediaPipe never requests it.
Scope: `vite.config.js`, the security policy, imports behind `showUnmeasuredRoutes()`. No file deleted (R5), no screen changed.
Stop: if any engine requests a removed file, put it back and report on #190.
Needs from David: nothing.
