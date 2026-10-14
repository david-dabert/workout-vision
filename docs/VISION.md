# WorkoutVision: the vision

Written 14 October 2026. Every number below is read from the code named beside it or from the scoreboard
(test/real-phone/accuracy/scoreboard.txt). Where this file and PLAN.md on counter-core disagree, PLAN.md prevails.

## The vision

WorkoutVision becomes the general tool for human movement: any sport or activity, from the beginner to the expert,
and a coach's office around it. It grows one activity at a time, and each activity enters only with a way to check
its numbers against known truth.

The positioning sentence:

> WorkoutVision counts and times your movement from a phone video, on the phone, and shows a number only when it can
> stand behind it.

Three consequences run through everything below.

- On the phone: the video is read on the device. Nothing in the engine needs a server.
- Counts and times: what a phone video can measure is when things happen (a contact, a turn, a rep) and how often.
  Distances and heights come from those times through a published formula, or from the body's own proportions.
- Only when it can stand behind it: every measure carries its margin and every count how it was checked, or the
  reason it is withheld (R8).

## The three faces

**The athlete app.** What the person films and reads: the lift chooser, filming, the result, the replay, the report,
the history. Today it counts reps of strength exercises with the counting core (src/lib/counting/core.ts), the part
measured by the scoreboard. It also opens the activity screens, starting with volleyball.

**The coach's office.** What a coach needs around the athlete: programmes sent by link and results sent back
(src/components/experience/Programme.jsx, Results.jsx), the coach's tools inside Pro (CoachSuite.jsx). The ideas for
later (accounting, nutrition, client records) wait in BACKLOG.md, 14 October 2026 (R7).

**The labs as specifications.** Each sport is a specification, not a screen: a data file that names the body signals
it reads, the events it finds in them and the measures it reports, each measure with its formula, unit, source, R9
status and error model (src/lib/activity/types.ts). The first is volleyball (src/lib/activity/specs/volleyball.ts).
A specification holds no function, so it can be stored, sent and checked as JSON; the test
"the specification is data" checks that every number in it carries a source and a status.

## The engine

src/lib/activity/engine.ts reads any specification on a pose read and returns its events and measures. It knows no
sport. Three layers, in this order.

### 1. Perception

- Input: the pose of every sample (MediaPipe's 33 landmarks, normalised to the frame), its time in seconds and the
  frame's size (PoseRead, types.ts): the shape of the app's pose read (coreAnalysis.js, analyzeCoreVideo, its
  imageLandmarks and timestamps). The engine is not yet wired to a filmed video; today it reads synthetic jumps.
- A landmark under visibility 0.5 is unseen: the counting core's own floor (VIS).
- The body's ruler: heights are measured up from the ground line and expressed in leg lengths (hips to ankles, median
  over the samples that see it), so no specification needs the person's height or the phone's distance.
- The camera view: front when the shoulders are at least 0.35 of the torso's length wide, side at most 0.2.
- A read that sees the feet and legs in fewer than half its samples is refused whole, with its reason.

### 2. The grammar of events

The specification declares its events by kind, in order; each reads only the ones declared before it.

- airborne: a flight starts when a signal rises above the ground band and ends when it falls back under half of it
  (two levels, so noise around one level does not split a flight). The band is the larger of a floor (0.03 leg
  lengths for volleyball's feet) and 4 standard deviations of the foot's own noise on the ground.
- jump: a cycle of hip height that carries a flight (the hip rises at least 0.2 leg lengths, the flight lasts at
  least 0.2 s). Flights inside one cycle are one jump, so a foot point lost at the top does not make two; its takeoff
  and landing come from flights of at least 2 samples. Each jump also carries the top of its hip's flight, from a
  least-squares parabola through the hip's samples in the air.
- stride: a flight that belongs to no jump, of at least 2 samples (the steps of a run-up).
- landing: the lowest point of the smoothed hip within 0.8 s after a jump's touchdown.

A contact lies between the last sample on one side of its level and the first on the other: the band at a takeoff,
half the band at a touchdown. Its time is their midpoint, moved by the time the foot takes between the ground and that
level ℓ, read with the foot's speed v there:

- a touchdown: the foot arrives at speed, so ℓ/v;
- a takeoff: the toes leave the ground at zero vertical speed and accelerate. If their speed rises no slower than
  uniformly to the body's within 40 ms (an assumption, not measured on a filmed foot), the time lies between ℓ/v and
  √(2ℓ·0.04 s/v); the middle is taken and half the range goes into the margin.

The speed is a least-squares slope of the samples within 1/30 s of the crossing. It never reads the top of the flight
(a sample the next one shows to be the top is dropped), and it is never taken under the chord from the top to the
crossing: when the slope is missing or lower, the chord bounds the speed from below and the correction lies between 0
and ℓ over the chord's speed. Without either, the contact is left undefined rather than guessed.

### 3. Measures with their error

Each measure turns events into a value with a formula, and states its margin.

| Measure (volleyball) | Formula | R9 status | Error model |
|---|---|---|---|
| Jumps | count of jump events | experimental | none: exact on the synthetic jumps of 15 cm and more, not yet on a filmed person |
| Best jump | h = v₀²/2g, v₀ = (g·t²/2 − Δ)/t: the flight-time method (Bosco et al. 1983) corrected for a landing Δ lower than the takeoff | experimental (the correction is ours) | sampling |
| Last contact time (mean) | takeoff minus the touchdown of the last stride, averaged over the jumps measured | experimental | sampling |
| Knees on landing | knee gap over ankle gap at the landing's lowest point, from the front | experimental | none |

The flight-time method assumes the body lands as it took off; a landing with the hip lower lengthens the flight and
overstates h (on the synthetic jumps, 5 to 8 cm lower read 4.8 to 5.3 cm high). The engine reads Δ on the parabola of
the hip's flight. On that parabola v₀ = (g·t²/2 − Δ)/t reduces to g times the time from the takeoff to the hip's top,
so the touchdown's own error cancels: the height's margin is the takeoff's plus the top's (three standard errors of the
fit). A body leaves the ground fully extended on its toes and cannot land more extended, so the interval is capped by
g·t²/8 from above. The hip is taken for the body's centre of mass in the air: on a filmed person the arms and legs
move it, which level 1 does not measure.

The sampling margin of a contact is half the spacing of its two samples, plus the correction's own uncertainty: half
the takeoff's range (above), or a quarter of ℓ/v at a touchdown; two standard errors of the speed read; and one noise
standard deviation over the speed (at a takeoff, over the slowest speed the toe can have at the crossing). The noise
term does not shrink with the frame rate. A run-up's margin is the sum of the takeoff's and the last touchdown's.

A measure is refused, with its reason, when:

- its events are not in the video (no jump, no whole jump from takeoff to the top, no run-up);
- its view is wrong (the knee check reads from the front only);
- its margin would exceed a quarter of the value (a height or a run-up timing at a low frame rate);
- the best jump would be named while a jump is not measured;
- the frame rate is under 20 a second for a run-up (a stride's flight spans fewer than 2 samples);
- the foot rises too briefly before the takeoff to tell a step from noise, or the last stride's touchdown cannot be
  timed;
- the foot's noise, not the floor, sets the ground band (strides of a few centimetres cannot be read);
- it has no margin model yet: the knee ratio is computed, and the screen withholds it.

Nothing in the engine changes a rep count. It reads the counting core only for its Savitzky-Golay kernel.

## The truth lab

A number enters a screen only after it has been measured against known truth. The lab has three levels.

1. **Synthetic landmarks** (src/lib/activity/synthetic.ts). A 1.75 m body whose hip follows a ballistic arc and whose
   toes leave and touch the ground at instants known exactly, sampled at any rate and phase, with seeded Gaussian
   noise on every point. It models a countermovement, heels rising before the toes leave, a toe-off whose speed rises
   from zero (0 to 40 ms), a touchdown with the hip lower than at takeoff (0 to 8 cm), a run-up of short strides with
   a last contact of any length, landings absorbed by hips and knees, and knees coming in on landing. It does not
   model the pose model's errors, the arms, a hip that is not the centre of mass, perspective or a moving camera.
   This level measures the engine alone.
2. **Rendered bodies** (test/real-phone/synth/). Two rigged bodies (three.js examples' Michelle and Soldier) posed
   frame by frame, rendered at the app's analysis size (360x640, 15 frames a second), and read by the app's own pose
   detection. 96 sets today, counted by core.ts against the skeleton's truth (npm run synth). This level adds the
   pose model's errors; it does not replace filmed people.
3. **Filmed people** (test/real-phone/). Sets filmed on a phone and labelled by David (R1), scored by
   npm run scoreboard in CI on every push and pull request to main and counter-core. Scoreboard of 12 October 2026: 11 of the 15 stored sets that decide are exact;
   on the real videos read by the built app, 6 of 14 are exact, 1 is a known catastrophic error and 3 are refused.

Volleyball is at level 1. Measured on 14 October 2026 by src/lib/activity/__tests__/volleyball-heldout.test.ts
(npx vitest run, verbose reporter). The engine's constants were set on tuning runs (seeds 1 to 300 per rate, noise 0.5
to 1.5 px, flights 0.40 to 0.80 s, drop 0 to 5 cm, toe-offs 0 to 30 ms, last contact 0.30 s). The tables below are
held-out runs, first run after the constants were frozen: seeds 200001 to 200300 per rate, each a standing jump and a
jump after a three-stride run-up (600 jumps per rate), noise 0 to 2 px, flights 0.25 to 1.00 s, drop 0 to 8 cm,
toe-offs 0 to 40 ms, last contacts 0.20 to 0.50 s, on a 360x640 frame.

| Rate | Count exact | Heights shown | Inside the margin | Bias | Mean stated margin |
|---|---|---|---|---|---|
| 15/s | 558 of 600 (502 of 502 at 15 cm and up) | 237 | 237 of 237 | +3.30 cm | ±17.17 cm |
| 30/s | 559 of 600 (502 of 502) | 370 | 370 of 370 | +1.04 cm | ±10.40 cm |
| 60/s | 565 of 600 (498 of 498) | 430 | 430 of 430 | +0.53 cm | ±7.66 cm |
| 120/s | 569 of 600 (504 of 504) | 501 | 501 of 501 | +0.83 cm | ±5.70 cm |
| 240/s | 561 of 600 (494 of 494) | 521 | 521 of 521 | +0.74 cm | ±4.77 cm |

| Rate | Run-ups timed | Inside the margin | Mean stated margin |
|---|---|---|---|
| 15/s | 0 of 300 (refused for the rate) | | |
| 30/s | 190 of 300 | 190 of 190 | ±61.8 ms |
| 60/s | 213 of 300 | 213 of 213 | ±42.2 ms |
| 120/s | 222 of 300 | 222 of 222 | ±31.1 ms |
| 240/s | 233 of 300 | 233 of 233 | ±26.3 ms |

The count misses jumps whose hip barely rises (minRise): every jump of 15 cm and more was counted. A height not shown
was refused with its reason (a margin over a quarter of the value) or belongs to a jump not counted; a run-up not
timed was refused with its reason (the rate, the feet too noisy to read strides, a margin over a quarter).

The bias is one-sided and known. The takeoff's correction is the middle of the range a toe-off of 0 to 40 ms allows:
at 1 px, a toe that leaves at full speed reads +1.19 to +1.85 cm high, one that takes 40 ms −1.10 to −1.55 cm low
(30 to 240 a second). Across noise levels of 0 to 2 px the mean bias stays between +0.58 and +1.52 cm, under half the
stated margin in every case. The margin covers it; it is not removed, since the toe-off is not known.

These margins are not a hard bound: the test requires at least 99 values in 100 inside. The demo on the screen runs
the same engine on one fixed seed (src/lib/activity/demo.ts): four jumps, two of them after a three-stride run-up,
noise 1 px. Its test checks, at every rate the screen offers, that each value shown on that seed holds its truth
inside its margin, and that the count is exact.

What level 1 cannot say: how far the pose model moves a foot point at a contact on a real video. That error comes on
top of these margins. Volleyball's numbers become claims only at level 2 and, for real use, at level 3.

## Honesty rules for demos

- Every demo carries the Démo badge (DemoTag, src/components/experience/Showcase.jsx).
- A demo says what its movement is: the volleyball screen says the jumps are synthetic, what that means, and what the
  demo does not show yet.
- No unmeasured number: a measure is on screen only with its margin, a count only with how it was checked; in a
  demo each sits beside its truth with a verdict (inside or outside the margin, a count exact or wrong). A value
  without a margin model is withheld, with the reason ("Pas de chiffre").
- Every refusal says why, in the engine's words, and the reason changes with the cause (rate, view, noise, a missed
  step).
- A margin is rounded up at the precision shown, never down to zero.
- R13, as CLAUDE.md states it: "Numbers in the README, the site and any external document come only from the latest
  scoreboard output, with its date." Proposed to David, not a rule: allow a committed test's output, with its date,
  for numbers measured outside the scoreboard (the error tables of the truth lab above).

## The screens

src/screens does not exist; every screen lives under src/components. The router (src/lib/useHashRouter.js) maps the
address's hash to a page; App.jsx renders it and loads it lazily (src/lib/lazyScreen.jsx): a tap downloads the
screen's code first, then shows it (App.jsx, go).

| Page (hash) | Component | What it is |
|---|---|---|
| first visit | experience/Entry.jsx | the opening screen |
| (default) | experience/Choice.jsx | the lift chooser and the doors to everything else |
| film | experience/Film.jsx | filming one set |
| live | LiveSession.jsx | live counting (builds with VITE_LIVE only) |
| analyze | CoreUpload.jsx | the analysis, then the result, replay and report (experience/Result, Replay, Report) |
| exercises | experience/Guide.jsx | the exercise guide |
| history | experience/History.jsx | the person's sets |
| pro | experience/Pro.jsx | the coach's side: programme builder, coaches/CoachSuite.jsx |
| programme | experience/Programme.jsx | a programme received by link |
| resultats | experience/Results.jsx | a client's results received by link |
| manifesto, science | experience/Manifesto.jsx | the method and its formulas |
| about | experience/About.jsx | about the app |
| sports (and golf, tennis, padel, cycling, baseball, rowing, skiing, swimming) | sports/SportsBiomechanics.jsx | the precision sports demos |
| volleyball | activity/ActivityScreen.jsx | the activity engine on synthetic volleyball jumps |
| equine, veterinary | equine/Equine.jsx | the equine demo |
| coaches, coach, physio | coaches/CoachFinder.jsx | finding a coach |
| buddies, buddy | buddies/GymBuddy.jsx | the gym buddy demo |
| ergonomics, workplace | ergonomics/Ergonomics.jsx | the workplace lifting demo |
| chat | chat/Chat.jsx | the chat demo |

The showcase screens (sports, volleyball, equine, coaches, buddies, ergonomics, chat) share their parts:
experience/Showcase.jsx, Showcase.css and showcase-text.js. The other files at the top of src/components (Dashboard,
Profile, Validate, WeeklyReport and their kind) are kept but not rendered (App.jsx, "Hidden, not deleted"). Separate
pages outside the app: collect.html, collect-batch.html, check.html and pack.html (vite.config.js).

The activity screen is generic: ActivityView takes any specification and the engine's result and shows, for each
measure, its value with its margin (a count without one, with how it was checked), its formula and R9 status, its
error note, or the reason it is withheld; then each event's values, one column per measure with its truth and verdict
in the same cell. The volleyball entry sits in the sports rail, beside the link to the equine demo.

## Roadmap

These phases are the vision's; they are not the build phases of DIRECTIVES.md Part 3.

**Phase 1: the engine and volleyball.** The engine's three layers, the specification format, synthetic jumps with
known truth, the volleyball specification and its tests, and the generic activity screen with its demo. Done when
every value the demo shows is inside its stated margin at every rate it offers (demo.test.ts), the held-out runs keep
at least 99 values in 100 inside their margin (volleyball-heldout.test.ts), and David has confirmed the screen and its
French on his iPhone.

**Phase 2: four sports on rendered bodies.** Golf, baseball, tennis and volleyball, each on rendered bodies (truth lab
level 2) read by the app's own pose detection, each measure measured against the skeleton's truth before it is shown.
The fixed values of today's sports demos are replaced by measured ones, or withheld. A sport enters a screen only with
its error table.

**Later.** The coach's office (accounting, nutrition, client records) is not a phase of this roadmap: its ideas wait
in BACKLOG.md, 14 October 2026, until David opens them as a step (R7).

Every phase keeps the rules above: no measure without its margin, no count without its check, no claim without the
output that proves it, French approved by David before release.
