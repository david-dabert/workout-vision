# 043. The physiotherapist's screens claim nothing the app cannot defend
Status: done (16 November 2026, branch `claude/043-kine-screens`; awaiting David on his iPhone, R3)
Executor: careful (Claude)
Phase: 1 (claims withdrawn; PLAN.md, THE FREEZE)
Claim: no screen in production prints a dossier under a clinic's name, shows a target angle without a source, or invites patients from the home before a written regulatory opinion exists; patients and physiotherapists already using links keep them.
Reference: review panel of 16 November 2026 (physiotherapist, red team, market lenses), each checked in the code:
- `FollowUp.jsx` imports `exportPessacDossier` with no switch; the printed page is headed « Clinique de Kinésithérapie de Pessac, Service de Rééducation Fonctionnelle & Analyse Cinématique Haute Précision » (`pessacDossierExport.ts:231`), though `KineWorkspace.jsx:27-29` says that dossier is extended-build only.
- `ExerciseCard.jsx:34` shows « Cible : x° à y° » with no source or status (R9), on a range the app reads 19 degrees low (card 019).
- `App.jsx:333` passes `onReference` unconditionally, so the home row « Espace kiné … le geste du patient comparé au vôtre » is live; `docs/SPEC-production.md:40` bars that positioning until a regulatory opinion exists (EU MDR, Rule 11). Decided by the board, 16 November 2026 (David: "Bring in the agents and think tank to answer to your questions damn it and execute accordingly"): the row is hidden until that opinion is on file.
Eval: a guard test on the production build: no « Pessac », no « Cible », no « Espace kiné » row on the home; `#kine`, `#kine-p=`, `#kine-r=` still open. Fails on main today.
Scope: `FollowUp.jsx`, `ExerciseCard.jsx`, `App.jsx` (the home's row only), their tests. Everything moves behind `showUnmeasuredRoutes()`; nothing deleted.
Stop: if a patient link breaks, stop.
Needs from David: a written regulatory opinion, to bring the row back.
