# 048. Espace pro offers only the coach's own programmes, no unsourced templates
Status: in review (Antigravity)
Executor: fast (Antigravity)
Phase: 1 (a claim withdrawn; PLAN.md, THE FREEZE)
Claim: a coach opening Espace pro sees the programmes they made, and no « Modèles recommandés » the app cannot source.
Reference: `pro-copy.js:55` « Modèles recommandés » and `programme-store.js:31-36` (one titled « Posturologie & Mobilité »; 6 of its 9 exercises are not Beta) carry no source (R8, R9). Review panel of 16 November 2026, coach lens.
Eval: a unit test and an e2e on the production build: Espace pro renders no template the coach did not save; a saved programme still opens and sends by link. Fails on main today.
Scope: `pro-copy.js`, `programme-store.js`, the Espace pro screen, their tests. Nothing deleted: the templates move behind `showUnmeasuredRoutes()`.
Stop: if a programme link already sent depends on a template, keep it readable and report on #190.
Needs from David: nothing; iPhone check after merge (R3).

## Verification
- Unit tests (`src/components/experience/__tests__/pro-examples-preview.test.jsx`): 9 passed in 470ms. Production build verifies templates are absent (`.pro-templates` count 0, no « Modèles recommandés »), `createFromTemplate` returns `null`. Extended build (`showUnmeasuredRoutes() === true`) verifies templates remain accessible.
- Production build & ship-less (`npm run build && node scripts/check-ship-less.mjs dist`): exit code 0.
- Playwright E2E (`e2e/pro.spec.js`): 24 passed in 1.6m. Production build offers only the coach's own programmes and "Nouveau programme".
