# Agents of this repository

Project agents, loaded by Claude Code at the start of a session. All are read-only unless the task given to them says otherwise.

## The panel (David, 16 and 18 November 2026: "same nine lenses ... as agents")
Called together on a question, each answers separately; where they split, `wv-panel-board` decides (PLAN.md, 16 November).
- `wv-panel-accuracy`, `wv-panel-architecture`, `wv-panel-navigation`, `wv-panel-market`, `wv-panel-coach`,
  `wv-panel-physio`, `wv-panel-athlete`, `wv-panel-biomechanics`, `wv-panel-regulatory` (the ninth seat, added 18 November
  for the EU MDR and GDPR questions the physiotherapist path raises).
- `wv-panel-board`: Karpathy, red team, evidence skeptic.

## The lab (adapted from The Agency, MIT, `THE-AGENCY-LICENSE.txt`)
Each keeps its source agent's method under a WorkoutVision preamble that puts R1 to R16, the regulatory line and "never invent" first.
- `wv-lab-clinical-evidence`: evidence behind each rehabilitation protocol.
- `wv-lab-ux-research`, `wv-lab-persona-walkthrough`: research with and walkthroughs as R16's five users.
- `wv-lab-reality-checker`, `wv-lab-evidence-collector`: proof before "done" (R3).
- `wv-lab-discovery`: interviews with coaches and physiotherapists, for David to run.
- `wv-lab-store`: listing and search words, from proven facts only (R13).
- `wv-lab-synthesist`: one decision brief from many answers.

## Control
`wv-control`, `wv-reviewer`, `wv-verifier`: checks before a message, a commit and a report.

The full Agency roster (marketing, sales, design: 56 agents) was also installed in the session's own `~/.claude/agents` on
18 November with `./scripts/install.sh --tool claude-code --division marketing,sales,design`; that folder lives in the
session's container and is not kept. Only the agents above are in the repository.
