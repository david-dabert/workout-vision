# Learned phase counter (bench only, 8 October 2026)

A class-agnostic, phone-sized rep counter learned on pose sequences. Nothing in the app imports it. Status: experimental;
every constant UNSOURCED unless named (R9). Results: `lphase.txt`; decision: TRIED.md, 8 October.

## Formulation

Per 15 Hz frame, from the world landmarks of 13 joints (nose, shoulders, elbows, wrists, hips, knees, ankles; a joint
under visibility 0.5 is unseen), 110 features (`data.js` `features()`, mirrored in `train.py`): the joints relative to
the mid-hip in torso lengths and nine joint angles, each centred on the set's median, again divided by its set spread,
plus a seen mask per joint and a missing-frame flag. A non-causal temporal convolution (an input layer and seven residual
blocks of a 3-tap convolution dilated 1 to 64, 32 channels; receptive field 255 frames, 17 s) outputs per frame:

- a rep rate z (reps per second, softplus); its sum over the set divided by 15 is the count (the **density** readout,
  the one chosen, on the cross-validation folds only);
- the phase within a rep as (sin, cos) of 2 pi phi and an inside-a-rep probability; the **phase** readout counts the
  reps whose middle (phi = 0.5) is passed inside a rep. Measured, not chosen.

Why this formulation: the count must come from a quantity every labelled set can supervise. Every set has a count (sum
of the rate), and the sets that carry rep bounds (RepCount-A, CF-Rep, synthetic) also supervise the rate per frame, the
phase and the inside-a-rep flag; so the count-only sets (Countix, MM-Fit) are used, and the bounded sets teach where the
reps are. The phase head is the class-agnostic version of PoseRAC's salient poses (Yao et al. 2023: two pose classes per
action and a transition count), without a pose class per exercise. A period/self-similarity head (RepNet) was not built:
PSC already measures the period route on the same data (TRIED.md, 7 October).

## Progress input (optional; off by default)

The counter above never knows the exercise. The progress mode gives it one more signal per frame: the progress p(t) of
the set's motion spec (`../template/sgc.js` `specProgress`: the signals the spec says move, signed and weighted, in
physical units so a full rep of the spec moves p by about 1; one-limb specs the more periodic side, alternating specs
the side-wise maximum). Two input channels: p minus its median over the set, clipped to [-2, 2], 0 where absent, and a
mask (1 where p is finite); a set without a spec has the mask 0 throughout (`data.js` `progressFeatures`, mirrored in
`train.py`). The spec of a set (`spec-of.ts`, the same in the export and the bench): its lift's motion spec or its
COUNT_AS parent's; RepCount-A's class mapped to a catalogue key where one fits (squat, push_up, pull_up,
bench_pressing to bench_press, front_raise, jump_jack to jumping_jack, situp to sit_up or else crunch); the synthetic
and occlusion sets' `params.exercise`; the motion library's own `params.spec`. Export with `LPHASE_PROGRESS=1`
(`progress.f32`), train with `--progress`; the model JSON says `"input": "progress"` and `model.js` `learnedCount`
computes p from its `spec` option. Hypothesis under test: the counter learns exercise-aware counting from it. Status:
experimental.

## Data and discipline

`export.test.ts` writes the training data; it never reads David's sets, the real videos or any held-out half.

- train: 111 sets of the RepCount-A train split (fetched for this study, `scripts/public/fetch-repcount-train.sh`, landmarks only through the app's pose path, videos deleted; `repcount-train/`, 22 MB; 8 failed, 638 not
  fetched);
- eval: the RepCount-A test and validation build half: never trained on;
- cv: Countix, MM-Fit, CF-Rep build halves, the synthetic and occlusion sets, in two folds by group (video, MM-Fit
  workout, CF-Rep participant, synthetic lift; `data.js` `foldOf`): model-0 is trained on fold 1 and reads fold 0, and the
  other way; model-all is trained on both and reads RepCount-A eval and David's sets (exams).

Augmentation, counts known by construction (R1: no label changes): one labelled rep repeated 2-30 times with per-copy
time warp 0.6-1.5, amplitude 0.8-1.15 around its first frame, pauses and the set's own lead-in and tail (RepNet's
synthetic repetition, Dwibedi et al. 2020); a natural set cut at rep boundaries; count-only clips held still up to 3 s at
each end; rotation about the vertical axis within 90 degrees, mirror, time stretch 0.6-1.5, jitter, dropouts.

## Files

- `data.js`: resampling, features, folds. `model.js`: plain-JS inference (float16 weights, no dependency).
- `train.py`: numpy only (no framework); gradient checked against finite differences.
- `models/model-{0,1,all}.json`: the weights. `fixture.json` + `learned-phase-unit.test.ts`: JS = Python parity;
  `fixture-progress.json` the same for a progress-input model (the model is inside the fixture).
- `spec-of.ts`: the motion spec of a set, for the progress input.
- `learned-phase.test.ts` (`LPHASE=1`): the bench against core, PSC and the motion rhythm; writes `lphase.txt`.

## Reproduce

    LPHASE_EXPORT=<dir> npx vitest run --no-cache test/real-phone/learned-phase/export.test.ts
    python3 -I test/real-phone/learned-phase/train.py <dir> <out> --epochs 60 --folds 0,1,all
    python3 -I test/real-phone/learned-phase/train.py --fixture <dir> <out>/model-all.json test/real-phone/learned-phase/fixture.json
    # progress input: LPHASE_PROGRESS=1 on the export, --progress on train.py, and its parity fixture
    python3 -I test/real-phone/learned-phase/train.py --fixture <dir> <out>/model-all.json test/real-phone/learned-phase/fixture-progress.json
    LPHASE=1 LPHASE_MODELS=<out> npx vitest run --no-cache test/real-phone/learned-phase/learned-phase.test.ts

## Results (8 October; `lphase.txt`, seed 2 in `lphase-seed2.txt`)

Exact / off by 3 or more, held out as above. Countix 204 / 27 (core 181 / 72, PSC 106 / 170); MM-Fit 74 / 7 (core 127 / 4);
RepCount-A build 23 / 54 (PSC 28 / 57; core 29 of its 79 mapped sets, learned 21); synthetic 43 / 17 (core 74 / 13,
PSC 91 / 3); occlusion 31 / 8 (core 27 / 36, PSC 46 / 18). Exams: real videos 4 / 2 of 13 (core 6 / 4), stored sets
12 / 0 of 20 (core 12 / 1). Design check on a fifth of the RepCount-A train split held out (`train.py --val`, fold 0):
4 of 22 exact. Not shipped; the selector's apparent gain is PSC filling the core's refusals (controls in `lphase.txt`).
Decision and next step: TRIED.md, 8 October.
