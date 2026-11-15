# 040. One-page French tester guide for collector mode (#guide-collecte)
Status: done
Executor: quick
Claim: Add a standalone, shareable French tester guide at `#guide-collecte` explaining `#collecte`, `« Choisir une vidéo »`, blind counting before the app's count, `« Vos séries »`, and `« Envoyer les séries collectées »`, with one-tap activation (`#collecte`) and link copying for coaches.
Reference: David's 15 November 2026 queue (renumbered from 039 to 040 to avoid colliding with Claude's Card 039); `src/lib/phoneCollect.js`, `src/components/experience/collect-copy.js`, R10, privacy invariant.
Eval:
1. Unit test (`src/components/experience/__tests__/collect-guide.test.jsx`) verifies French copy, exact labels (`#collecte`, `Choisir une vidéo`, `Vos séries`, `Envoyer les séries collectées`), and `#collecte` activation state.
2. Playwright E2E test (`e2e/collector-guide.spec.js` at `390x844` FR) verifies opening `#guide-collecte`, all 4 steps, zero `layoutFaults`, and clicking activate navigates to `#collecte` enabling `wv_collecte === '1'`.
3. Full lint, typecheck, `audit:swarm`, unit suite, production build, and `check:entry-budget` (`< 150 kB`) pass.
Scope: `cards/040-collector-guide-fr.md`, `src/components/experience/CollectGuide.jsx`, `src/components/experience/CollectGuide.css`, `src/components/experience/Entry.jsx`, `src/lib/useHashRouter.js`, `src/App.jsx`, `src/components/experience/__tests__/collect-guide.test.jsx`, `e2e/collector-guide.spec.js`.
