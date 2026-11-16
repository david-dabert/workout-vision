# 049. The production build ships only what its pages use
Status: ready
Executor: fast (Antigravity)
Phase: 1 (a defect of the build)
Claim: a phone loading the app downloads no code for features switched off in production.
Reference: review panel of 16 November 2026, architecture lens: production `dist` ships the Vercel Blob client (31.7 kB gz) though upload is ruled off, the extended routes' chunks, `world.openfoodfacts.org` in `connect-src` (only the extended CoachSuite uses it), and `vision_wasm_module_internal.wasm` (11.15 MB) that no bundle references.
Eval: after `npm run build`, none of those is in `dist` or in the policy; the tour, the journey and check.html's run pass on Chromium and WebKit with no failed request. The WASM file leaves only after a network log on both engines shows MediaPipe never requests it.
Scope: `vite.config.js`, the security policy, imports behind `showUnmeasuredRoutes()`. No file deleted (R5), no screen changed.
Stop: if any engine requests a removed file, put it back and report on #190.
Needs from David: nothing.
