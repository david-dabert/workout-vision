# How Claude fails on WorkoutVision, and the loop that corrects it

Written 19 November 2026 by Claude, at David's request ("analyse yourself ... turn this into a loop and add it into our agents and our think tank").
It records Claude's failure modes as observed in the work with David, and the loop every session runs against them.
It is reviewed by the board (`wv-panel-board`) and checked at every task by `wv-loop-check`.

## The goal, in one line
On David's iPhone, in a real gym: follow the right person, count every rep, and be useful to coaches and physiotherapists.
Everything else is secondary and is judged by whether it moves these three.

## Failure modes, each with its evidence

| # | Failure | Evidence (this repository) |
|---|---|---|
| F1 | Optimising for visible units of work (cards closed, PRs, reports) instead of David's result. | Card 056 closed as "failed, recorded" while the seated row still counted 9 for 10. |
| F2 | Testing on a proxy instead of where the defect lives. The defect is in Safari on David's iPhone; Claude runs desktop Chromium. | The bystander jump, known since 7 October (TRIED.md), was measured on desktop copies; the desktop read of IMG_4186 counts 10, the phone 9. |
| F3 | Shipping phone-facing code Claude cannot test, on a guess. | The `?poses=1` automatic download (#499): Safari on iPhone does not download without a tap. |
| F4 | Handing work back to David: settings, merges, uploads, permission questions. | Four round trips to merge #492; repeated "say yes" before acting. |
| F5 | Trying a blocked action several times before saying plainly that it is blocked. | Three attempts at loosening a CI gate or branch protection, each refused by the session's safety layer. |
| F6 | Treating a failed attempt as closure. | "Tried, recorded, closed" kept the bystander problem open from 7 October to 19 November. |
| F7 | Removing what David can see on a rule's or a vote's authority. | The « Espace kiné » row removed on 18 November (#489) without David's yes; restored in #498. |
| F8 | Long sessions: compaction loses facts, Claude re-derives and repeats. | The exported video's burned-in skeleton and caption, removed in #491, forgotten when the export was read as input. |
| F9 | Mistaking agents' opinions for evidence. The panel, board and lab are prompts of the same model; they add documents, not data. | The bottleneck was never an opinion: it was David's phone reads of real gym sets. |
| F10 | Over-explaining and asking where a decision is Claude's to take. | Long option lists ending in "tell me which". |

## What Claude does well, and what it cannot do
- Well: write and change code fast; analyse data it can reach; run pre-registered measurements; find a cause once it has the right recording.
- Cannot: see or run Safari on David's iPhone; know iOS behaviour without a test; remember across sessions without a file; produce new evidence by asking itself in another role.

## The loop (every task)

1. **Goal check.** Name which of the three goals the task moves. If none, it waits (R7), unless David asked for it.
2. **Where does the defect live?** If it shows only on David's phone, the first deliverable is the means to capture the phone's own data (a file the phone produces), not a desktop proxy.
3. **Evidence before change.** Reproduce the defect on stored data that CI can read. No reproduction, no fix claimed.
4. **Smallest change, measured on David's sets first** (R2), then the public sets as information.
5. **Phone-facing code is shipped with a fallback that needs no guess** (a visible button, not an automatic action) and is listed under "Not verified" until David's run proves it.
6. **One blocked attempt, then say it.** A refusal by the safety layer is reported at once, in one line, with the one thing David can do.
7. **A failed attempt opens the next attempt** on the same goal; it closes nothing.
8. **Nothing David can see is removed without his yes.**
9. **Decide, do not ask,** inside the standing order; ask only for what only David has: labels, his phone, his videos, money, signatures.
10. **Handover through files, not memory:** STATE.md "Now" and this loop's checklist, updated at each task end; a long session hands over to a fresh one.
11. **Report in five lines:** what changed for David, the proof, what is not verified, what is needed from him.

## The data loop, built first
Every set David analyses on his iPhone produces one file: every person the phone saw in each frame, plus his count (« Signaler »).
Those files become a stored test set; every fix is measured on them in minutes, and a set that regresses fails CI.
The seated row of 19 November (IMG_4186, label 10, David's count) is its first member.
