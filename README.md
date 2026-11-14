# Agent ledger

What happened in this repository, and when: one line for each commit pushed, pull request opened, merged or closed, CI run finished, deploy, and comment on issue #190. The lines are written by `.github/workflows/ledger.yml` on this branch from GitHub's own event records. No agent writes here, so a line is a fact, not a claim. One file a month (`2026-11.md`), newest first.

How a line names who did the work, strongest sign first:
1. a line `Agent: Claude` or `Agent: Antigravity` at the end of the commit message;
2. the branch prefix: `claude/` or `antigravity/` (a merge into main takes its pull request's branch);
3. Claude's `Claude-Session:` trailer or its noreply@anthropic.com address;
4. otherwise `unattributed`, shown as such.

A comment on #190 names its agent in its first line, as `CLAIM (Antigravity)`, `REPORT (Claude)`, `PUBLISHED (Antigravity)`. Work done outside GitHub (a page published, a store listing, a setting changed) appears here only through such a comment: `PUBLISHED (Antigravity): what, where, link`.

A force push and a direct push to main are written as events, so a history rewritten or a change that skipped a pull request can be found and undone (David's decision of 14 November 2026: Antigravity pushes freely when the outcome is progress). One warning stays: a comment on #190 by an account other than david-dabert, which every agent ignores (R15).
