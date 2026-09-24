# WorkoutVision Standing Rules

Source: DIRECTIVES.md Part 2, Version 1, 24 September 2026.
Every session starts by reading CLAUDE.md, DIRECTIVES.md and STATE.md.

**R1. Ground truth is sacred.**
Never modify a label. Never delete a test clip. Never set or adjust a label from the app's output, a video title, a thumbnail or a guess. Labels come only from David, or from human-annotated public datasets (Countix). If a label looks wrong, report it to David and wait.

**R2. Measure every counting change.**
Any change that can affect a rep count is run through npm run scoreboard before and after, and the per-clip diff is shown in the report. A change ships only if the real-phone exact count does not decrease and no clip becomes a catastrophic error (off by 3 or more).

**R3. Prove before you claim.**
Never write "fixed", "passing", "working" or "deployed" without pasting the command output that proves it. "Build passes" proves the code compiles, nothing more. Any change visible to users is confirmed by David on his iPhone before it is called done.

**R4. One agent, one branch, one task per session.**
No parallel agents writing to the working tree. Every task starts on a new branch named after it.

**R5. Destructive commands need David's explicit approval.**
git checkout -- ., git reset --hard, git clean, rm -rf, force push, deleting files under test/ or benchmark/. Before any of them, commit work in progress to a branch.

**R6. Main is production.**
Merge to main only when CI is green, including the real-phone gate, and David has confirmed on his iPhone.

**R7. Scope freeze.**
New ideas go into BACKLOG.md with a date. They are not built until the current phase is complete.

**R8. Honest interface.**
Never display a number the app cannot measure reliably. When confidence is low, the app asks the user to confirm and shows no grade.

**R9. Science.**
Every threshold, form check and coaching statement carries, in a code comment: its source, and a status among validated (measured on our real clips), literature (published, not yet measured by us), convention (accepted coaching practice without a specific source), experimental. Never invent a citation; write UNSOURCED when unsure.

**R10. Language.**
French is written as a French coach speaks in a gym, never translated word for word. Use the glossary in DIRECTIVES.md Part 7 and one register throughout (tu or vous, decided by David). David approves French copy before release.

**R11. Session hygiene.**
Keep sessions short and focused on one step. After any context compaction, re-read STATE.md before acting. End every session with the report format in DIRECTIVES.md Part 5.

**R12. Stop conditions.**
Stop and report to David if: a task would break a rule; a gate fails twice; a label seems wrong; the work drifts outside the current phase; a fix requires deleting data.

**R13. Public claims.**
Numbers in the README, the site and any external document come only from the latest scoreboard output, with its date.
