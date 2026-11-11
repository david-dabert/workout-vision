# METHOD

Written 11 November 2026 by Claude on David's order of that day ("design the methodology ... some element of all of this need to be automated").
PLAN.md and CLAUDE.md prevail over this file. Status: proposed; it binds once David says so on issue #190.

## Why this file exists

Between 9 and 11 November 2026, 23 features were merged in about 40 hours. Every one passed CI. Most were hidden or corrected on 11 November (STATE.md), because CI proved that the code ran, not that what the screen said was true.
The method below puts the proof before the code, and gives the repeated work to machines.

## Who does what

- **David** owns three things no agent can supply: the question, the ground truth (labels, his videos, a physiotherapist's judgment), and the verdict on his iPhone.
- **Agents** execute one card at a time and report. They do not choose what to build.
- **The review board** is five questions, each answered pass or fail in the report (below).
- **Machines** run the queue, the gates and the report (Automation, below).

## The unit of work: a card

One file in `cards/`, numbered, written before any code (`cards/README.md` holds the template).
A card states the claim, the reference, the eval with its threshold, the baseline, the scope and the stop condition.
No card, no work. A card whose eval cannot be written is a question for David, not a task.

## The loop

1. Take the first card of `cards/` whose status is `ready`.
2. Build its eval and run it. It must fail, or the card is already done: record that and stop.
3. Build the smallest change that could pass it.
4. Run the eval, and the six gates of CLAUDE.md. Show before and after.
5. Answer the five questions of the review board.
6. Open the pull request. Merge only if the eval passes and CI is green.
7. Write the result in TRIED.md and STATE.md, pass or fail, and set the card's status to `done`, `failed` or `blocked`.
8. Report on issue #190 (R15), with screenshots at 390x844 when a screen changed.

A card that fails twice, or needs something only David has, becomes `blocked` with the exact thing needed. The loop moves to the next card.

## The review board

| Lens | The question, answered pass or fail |
|---|---|
| Karpathy | Was it measured on data the change was not tuned on? |
| Black | Does the screen say only what the eval supports? |
| McGill, Contreras, Hewett | Is there a named reference, and does the reading separate good from bad on labelled sets? |
| Carmack | Is it the smallest change, with nothing unreachable left behind? |
| Rams, Ive | Does each element appear once, and could it be removed? |

## Gate 7

No reading reaches a screen until its card's eval has run on David's labelled sets and shown that the reading separates what it claims to separate.
A reading that fires on nearly every set, or on none, fails. Until it passes it stays behind its switch (`measures.js`).

## Two lanes (speed and proof)

David, 11 November 2026: "the rules cannot forbid us from trying". They do not; they decide where a trial lives.

- **Lab lane.** Anything may be tried, at Antigravity's speed, with no card and no eval, provided it is behind a switch that is off in production (`measures.js`, or `VITE_EXTENDED_ROUTES`) and CI is green. It may be merged the same hour. It changes nothing a user sees.
- **Product lane.** What a user sees changes only through a card: eval first, gate 7 for a reading, screenshots, David's yes. Turning a lab switch on is a product change and needs its card.

A trial that works in the lab earns a card. A trial that does not is written in TRIED.md and left off. Nothing is deleted for having failed.

## Data before David

Public data comes first: the 949 public sets already on disk, and any public dataset or video a session can reach and whose licence allows it. A card asks David for a recording only when no public data can answer its eval, and says why.

## Handover between agents

Claude and Antigravity share one memory, the repository. A session that ends without these four lines written has not ended:
1. The card's status and, under it, one line: what was done, the pull request, what is left.
2. STATE.md, section "Now": the commit on main, what is live, what is in progress and on which branch.
3. TRIED.md, when something was tried and closed.
4. The REPORT on issue #190 (R15).

Who takes what: a card carries `Executor: fast` when its eval is a command that passes or fails (Antigravity can take it), and `Executor: careful` when it changes counting, a gate or a rule (Claude takes it, or reviews it before merge). The agent that did not write a product-lane change reviews it against its card, not against its author's summary.

## Automation

What a machine does, so David does not carry it:

| Step | Machine | State on 11 November 2026 |
|---|---|---|
| Tests, scoreboards, entry budget, deploy | GitHub Actions (`ci.yml`, `deploy.yml`) | Running |
| The queue | `cards/`, in order | This file |
| One card per run, from a fresh session | A scheduled task, "WorkoutVision nightly card", every night at 03:17 Paris time | Created 11 November 2026 on David's order of that day; its first run, on 12 November, is the test of it |
| The report David reads | Issue #190, then one notification on his phone with the result | Running with the scheduled task |
| Gate 7 as a check CI enforces | Card 002 | Not built |

What stays with David, about ten minutes a day:
- read one report and look at its screenshots, or the screen on his iPhone, and answer yes or no;
- supply ground truth when a card is `blocked` on it;
- order the queue.

## Rules that the last week taught

- A title is not a result. A pull request states its eval and its figures, or it is not merged.
- One card, one session, one branch (R4, R11). A fresh session reads CLAUDE.md, STATE.md, this file and the card, and nothing else until it needs it.
- Merges to main wait for the previous deploy, or they cancel it (11 November: the fix of the replay waited two hours for this reason).
- A picture test that fails after a wanted change needs CI's own picture as the new baseline (#373).
- Negative results are kept (TRIED.md). An idea already closed there is not built again.
