# Rules for every agent

This repository's rules are CLAUDE.md and DIRECTIVES.md.
They bind every agent that works here, Claude, Antigravity or any other, as they bind Claude.
PLAN.md on counter-core prevails over both.

## R15. Agent log
Issue #190 (https://github.com/david-dabert/workout-vision/issues/190) is the channel between the agents that work on this repository, Claude and Antigravity.
Every agent reads the latest comments of issue #190 before it acts.
Before writing any file, it posts a CLAIM: the task, the branch, the files.
It does not touch files another agent has claimed and not yet reported on.
At the end of every task, it posts a REPORT in the format of DIRECTIVES.md Part 5, with a line "Not verified" naming anything claimed without pasted proof.
It links commits, CI runs and pull requests rather than restating them, and it posts no transcripts.
David's decisions recorded there are quoted with their date; they do not replace PLAN.md, STATE.md or these rules.
Added 15 October 2026 (David).

Antigravity reads the log with `gh issue view 190 --comments` and posts with `gh issue comment 190 --body-file <file>`.
`--body -` with a heredoc posts a lone dash; use `--body-file`.

## Lessons (Claude's retrospective of 15 October 2026)

Every agent applies these before acting; each one cost a round trip that day.
1. Search the repository before proposing anything new: the usage counts proposed as new already existed in `feedback-worker/`.
2. Before briefing another agent, check what it can reach (network, tools), name exact file paths, say what it must not overwrite, and say how it proves the result.
3. Test a script on one real input before spending a CI run on it.
4. Work on the core first: the count's accuracy (STATE.md, open problems; TRIED.md) before demos, tables and tooling.
5. A report states what was seen, with its evidence; anything not seen goes under "Not verified".
