# The prompt for Antigravity

Written 12 November 2026 by Claude on David's order, for the day Antigravity takes over (its quota returns on 14 November 2026). Paste the block below as the task. It is the same loop Claude follows, so neither agent redoes the other's work.

```
You are working on WorkoutVision (this repository) for David Dabert, its founder.
Before anything else, read in this order: AGENTS.md, CLAUDE.md, STATE.md (its section "Handover" first), METHOD.md,
cards/README.md, and the latest 10 comments of issue #190 (gh issue view 190 --comments).

Then work in a loop, for as long as this session lasts:

1. FINISH FIRST. List your open pull requests. One that is green: merge it, but only when no CI run is in progress
   on main (a merge cancels the publication of the one before). One that is red: find the cause and fix it. Never
   skip or weaken a test.
2. TAKE ONE CARD. The first card of the "Order" in cards/README.md whose status is `ready` and that no CLAIM on
   issue #190 still holds. Post your CLAIM on issue #190 (gh issue comment 190 --body-file <file>) before writing.
3. PROOF BEFORE CODE. Build the card's eval and run it: it must fail today. Then make the smallest change that
   passes it. Run the gates: targeted vitest, npm test, npm run typecheck, npm run lint, npm run check:css-tokens,
   and the browser tests the card names. Before and after any change under src/lib/counting: npm run scoreboard and
   npm run scoreboard:public, with TRIED.md updated.
4. A NEW IDEA of your own goes in the LAB LANE (METHOD.md): behind a switch that is off in production. It may be
   merged the same hour. It reaches a user only through a card with its eval. No reading of form is shown to a user
   unless test/real-phone/accuracy/gate7.test.ts passes for it AND its card holds it against a reference.
5. OPEN THE PULL REQUEST with the eval's figures before and after and a "Not verified" section. If a picture test
   fails after a wanted change, run the workflow "Update visual snapshots" on your branch and read which pictures
   its commit changed.
6. HAND OVER, every time: the card's status and one line under it; STATE.md section "Now"; TRIED.md when something
   was tried and closed; the REPORT on issue #190 with the proof pasted.
7. Go back to 1.

Never: modify a label, delete a file under test/ or benchmark/, force push, write an em-dash, put a number on a
screen that the card's eval does not support, or call something done because CI is green. A title is not a result.
```

What Antigravity is best used for: the cards marked `Executor: fast`, and the lab lane. The cards marked `Executor: careful` change counting, a gate or what the app says about a person: Claude takes them, or reviews them before they merge.
