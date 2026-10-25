# Selection Rule: Public Gate of Whole Sets of 8 Reps or More (`HANDOFF.md` Task T2)

Written and committed on 25 October 2026 **before** reading the core's counts or sure-set figures on this subset (`HANDOFF.md` Task T2).

## 1. Purpose

Countix clips are short YouTube windows (median 3 reps). To evaluate the counter and `sure.ts` on public sets that resemble a real WorkoutVision session (a whole set of 8 reps or more, filmed roughly as the app asks), this document fixes the selection rule over `test/real-phone/public/repcount/build/` and `test/real-phone/public/mmfit/build/` (plus `cfrep/build/` reported beside them for completeness) before any count is computed.

> **Dataset note on per-rep times (`HANDOFF.md` T2):**
> `HANDOFF.md` T2 notes `(RepCount-A and MM-Fit carry per-rep times)`. In the committed landmark files:
> - **RepCount-A** (`test/real-phone/public/repcount/build/*.json.gz`) carries human per-rep `[startSec, endSec]` boundaries in `reps` (`reps.length === count`).
> - **MM-Fit** (`test/real-phone/public/mmfit/build/*.json.gz`) carries human whole-set `[startFrame, endFrame]` boundaries in `trimFrames` (`scripts/public/mmfit.mjs`: *"It marks no single rep, so its sets carry no rep marks"*), cut by `scripts/public/cut.mjs` from `start - 30` frames (~1 s before the set) to `end + 30` frames (~1 s after the set).
> - **CFRep** (`test/real-phone/public/cfrep/build/*.json.gz`) carries human per-rep `[startSec, endSec]` boundaries in `reps`.
> All three are build-half sets only (`split === 'build'`); held-out sets are never read.

---

## 2. Selection Criteria (Fixed A Priori)

A build set enters the **Whole Sets $\ge 8$ Reps (`S1–S4a`)** gate iff it satisfies all four conditions below, evaluated solely on the file's metadata, human labels, and landmark visibility (never on any counter output):

1. **S1 — Build split & countable exercise**:
   - `split === 'build'`, `admitted !== false`, and `!!lift && !!liftDefinition(lift)` (`src/lib/counting/core.ts`).
   - Following `PLAN.md` and `test/real-phone/accuracy/sets.ts` (`decides(lift)`), non-press exercises decide and form the headline; press exercises (`bench_press`, `overhead_press`) are measured and reported in their own rows marked `(press: measured, decides nothing, PLAN.md)`.

2. **S2 — Set length of 8 reps or more**:
   - Human label `count >= 8`.

3. **S3 — Whole single set**:
   - **MM-Fit**: every build file is a single continuous set cut from 30 frames before the human-marked set start to 30 frames after the human-marked set end (`scripts/public/cut.mjs`) and verified whole by `unreadPublic` (`scripts/public/whole-read.mjs`).
   - **RepCount-A (and CFRep)**: using the human per-rep boundaries `reps = [[t0_start, t0_end], ..., [t_{k-1}_start, t_{k-1}_end]]` and frame `timestamps`:
     - `reps.length === count`,
     - The recording covers the first and last marked reps in full (`reps[0][0] >= timestamps[0]` and `reps[reps.length - 1][1] <= timestamps[timestamps.length - 1]`),
     - Every inter-rep interval inside the set is at most `10.0 s` ($\max_{1 \le i < k} (t_{i,\text{start}} - t_{i-1,\text{end}}) \le 10.0\text{ s}$), excluding multi-set compilations or spliced clips.

4. **S4 — Filmed roughly as the app asks**:
   - **S4a (Whole body in frame, primary gate)**: `visibleShare >= 0.70` (wrists and ankles visible $\ge 0.5$ and inside `[0, 1] x [0, 1]` on at least 70% of frames, matching `MIN_VALID_RATIO = 0.70` in `src/lib/counting/core.ts`).
   - **S4b (Strict guide camera view sub-table)**: in addition to S1–S4a, the body orientation measured by `facing(worldLandmarks)` (`src/lib/counting/symmetry.ts`: median `shoulderDeg` and `hipDeg` to the image plane) matches the exercise's recommended `view` in `src/lib/counting/guide-families.json`:
     - If `guide-families.json[lift].view === 'front'`: `shoulderDeg <= 30 && hipDeg <= 30 && facingShare >= 0.5`.
     - If `guide-families.json[lift].view === 'side'`: `shoulderDeg > 20 || hipDeg > 20`.
   - Both **S1–S3 (all whole sets $\ge 8$ reps)**, **S1–S4a (whole body visible $\ge 70\%$)**, and **S1–S4b (strict guide view match)** are reported side by side so no filtering step is hidden.

---

## 3. Metrics Reported per Exercise and Overall

For each tier (`S1–S3`, `S1–S4a`, `S1–S4b`), by dataset and exercise:
- Subset size (`n`),
- Core counts (`summarizeCount`): exact (`|count - label| === 0`), off by 1, off by 2, off by 3+, refused,
- **Right when sure (`R16`, `sure.ts`)**: using `sureRow(withBodyCheck(...))` exactly as `public-scoreboard.test.ts` runs it:
  - **Sure sets** (not flagged by body check, sensitivity check, or refused head rep): count called sure, exact when sure (and %), off by 1–2 when sure, off by 3+ when sure,
  - **Asked to confirm**: count asked, exact when asked, off by 1–2 when asked, off by 3+ when asked.
