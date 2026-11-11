# Cards

The queue of METHOD.md. One file per task, taken in number order among those whose status is `ready`.

## Template

```
# NNN. Title, as a claim
Status: ready | blocked (on what) | done | failed
Executor: fast | careful
Claim: what a named user can do afterwards, in one sentence.
Reference: what counts as truth.
Eval: the command, the data, the threshold. Fixed before any code.
Baseline: the eval's result today, or "never run".
Scope: what may change. What may not.
Stop: when to give up and record the failure.
Needs from David: nothing, or the exact thing.
```

## Prompt of a run

Read CLAUDE.md, STATE.md, METHOD.md and the latest comments of issue #190.
Take the first card of `cards/` whose status is `ready` and follow the loop of METHOD.md on it, and on it alone.
If no card is `ready`, report that on issue #190 and stop.
