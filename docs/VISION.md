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
- Only when it can stand behind it: every value carries its margin, or the reason it is withheld (R8).

## The three faces

**The athlete app.** What the person films and reads: the lift chooser, filming, the result, the replay, the report,
the history. Today it counts reps of strength exercises with the counting core (src/lib/counting/core.ts), the part
measured by the scoreboard. It also opens the activity screens, starting with volleyball.

**The coach's office.** What a coach needs around the athlete: programmes sent by link and results sent back
(src/components/experience/Programme.jsx, Results.jsx), the coach's tools inside Pro (CoachSuite.jsx), and later the
accounting, nutrition and client records of phase 3 below.

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

- airborne: runs of samples where a signal is above the ground band. The band is the larger of a floor (0.03 leg
  lengths for volleyball's feet) and 4 standard deviations of the foot's own noise on the ground.
- jump: a cycle of hip height that carries a flight (the hip rises at least 0.2 leg lengths, the flight lasts at
  least 0.2 s). Flights inside one cycle are one jump, so a foot point lost at the top does not make two.
- stride: a flight that belongs to no jump, of at least 2 samples (the steps of a run-up).
- landing: the lowest point of the smoothed hip within 0.8 s after a jump's touchdown.

A contact (takeoff or touchdown) lies between the last sample on one side of the band and the first on the other.
Its time is their midpoint, moved by the time the foot takes to cross the band: the band over the foot's speed. The
speed is read within 1/30 s of the crossing, never across the top of the flight, and the correction never goes past
the first sample that reads on the ground (under 3 noise standard deviations, or a tenth of the band). Without a
speed the contact is left undefined rather than guessed.

### 3. Measures with their error

Each measure turns events into a value with a formula, and states its margin.

| Measure (volleyball) | Formula | R9 status | Error model |
|---|---|---|---|
| Jumps | count of jump events | experimental | none: exact on the synthetic jumps, not yet on a filmed person |
| Best jump | h = g·t²/8, t the flight time (Bosco et al. 1983) | literature | sampling |
| Last contact of the run-up | takeoff minus the touchdown of the last stride | experimental | sampling |
| Knees on landing | knee gap over ankle gap at the landing's lowest point, from the front | experimental | none |

The sampling margin of a contact is half the spacing of its two samples, plus the band correction's own uncertainty:
a quarter of the correction (the foot's speed is not constant), two standard errors of the speed read, and one noise
standard deviation over the speed. The last term does not shrink with the frame rate. A flight's margin is the sum of
its two contacts'; a height's margin follows from it through h = g·t²/8. At 15 samples a second, a contact known to
one sample gives about ±10 cm on a 0.60 s flight (test "the flight-time formula").

A measure is refused, with its reason, when:

- its events are not in the video (no jump, no whole flight, no run-up);
- its view is wrong (the knee check reads from the front only);
- its margin would exceed a quarter of the value (the run-up timing at a low frame rate);
- a flight too brief to be a stride lies between the last stride and the takeoff (a step was missed);
- the foot's noise, not the floor, sets the ground band (strides of a few centimetres cannot be read);
- it has no margin model yet: the knee ratio is computed, and the screen withholds it.

Nothing in the engine changes a rep count. It reads the counting core only for its Savitzky-Golay kernel.

## The truth lab

A number enters a screen only after it has been measured against known truth. The lab has three levels.

1. **Synthetic landmarks** (src/lib/activity/synthetic.ts). A 1.75 m body whose hip follows a ballistic arc and whose
   toes leave and touch the ground at instants known exactly, sampled at any rate and phase, with seeded Gaussian
   noise on every point. It models a countermovement, heels rising before the toes leave, a run-up of short strides,
   landings absorbed by hips and knees, and knees coming in on landing. It does not model the pose model's errors,
   the arms, perspective or a moving camera. This level measures the engine alone.
2. **Rendered bodies** (test/real-phone/synth/). Two rigged bodies (three.js examples' Michelle and Soldier) posed
   frame by frame, rendered at the app's analysis size (360x640, 15 frames a second), and read by the app's own pose
   detection. 96 sets today, counted by core.ts against the skeleton's truth (npm run synth). This level adds the
   pose model's errors; it does not replace filmed people.
3. **Filmed people** (test/real-phone/). Sets filmed on a phone and labelled by David (R1), scored by
   npm run scoreboard in CI on every push and pull request to main and counter-core. Scoreboard of 12 October 2026: 11 of the 15 stored sets that decide are exact;
   on the real videos read by the built app, 6 of 14 are exact, 1 is a known catastrophic error and 3 are refused.

Volleyball is at level 1. Measured on 14 October 2026 (src/lib/activity/__tests__/volleyball.test.ts, 200 synthetic
jumps of 0.40 to 0.80 s per rate, noise 1.5 px on a 360x640 frame):

| Rate | Mean error | Bias | Largest error | Mean stated margin | Inside the margin |
|---|---|---|---|---|---|
| 15/s | 3.50 cm | +0.67 cm | 11.33 cm | ±12.36 cm | 200 of 200 |
| 30/s | 1.64 cm | +0.23 cm | 5.96 cm | ±6.76 cm | 200 of 200 |
| 60/s | 1.00 cm | +0.39 cm | 3.40 cm | ±4.73 cm | 200 of 200 |
| 240/s | 0.43 cm | +0.16 cm | 1.34 cm | ±2.13 cm | 200 of 200 |

The last contact of a run-up (200 synthetic run-ups of three strides per rate, noise 1 px): shown at 30/s for 57,
at 60/s for 178 and at 240/s for 186 of them, every value shown inside its margin (mean stated margin ±58.5 ms,
±46.0 ms, ±23.4 ms). At 15/s it is never shown.

The demo on the screen runs the same engine on the same kind of jumps (src/lib/activity/demo.ts): four jumps, two of
them after a three-stride run-up, noise 1 px, a fixed seed. Its test checks, at every rate the screen offers, that
each value shown holds its truth inside its margin.

What level 1 cannot say: how far the pose model moves a foot point at a contact on a real video. That error comes on
top of these margins. Volleyball's numbers become claims only at level 2 and, for real use, at level 3.

## Honesty rules for demos

- Every demo carries the Démo badge (DemoTag, src/components/experience/Showcase.jsx).
- A demo says what its movement is: the volleyball screen says the jumps are synthetic, what that means, and what the
  demo does not show yet.
- No unmeasured number: a value is on screen only with its margin and, in a demo, beside its truth. A value without a
  margin model is withheld, with the reason ("Pas de chiffre").
- Every refusal says why, in the engine's words, and the reason changes with the cause (rate, view, noise, a missed
  step).
- A margin is rounded up at the precision shown, never down to zero.
- A number shown in the README, the site or any document outside the app comes from the latest scoreboard or test
  output, with its date (R13).

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
measure, its value with its margin, its formula and R9 status, its error note, or the reason it is withheld; then each
event's values. The volleyball entry sits in the sports rail, beside the link to the equine demo.

## Roadmap

These phases are the vision's; they are not the build phases of DIRECTIVES.md Part 3.

**Phase 1: the engine and volleyball.** The engine's three layers, the specification format, synthetic jumps with
known truth, the volleyball specification and its tests, and the generic activity screen with its demo. Done when
every value the demo shows is inside its stated margin at every rate it offers (demo.test.ts), and David has confirmed
the screen and its French on his iPhone.

**Phase 2: four sports on rendered bodies.** Golf, baseball, tennis and volleyball, each on rendered bodies (truth lab
level 2) read by the app's own pose detection, each measure measured against the skeleton's truth before it is shown.
The fixed values of today's sports demos are replaced by measured ones, or withheld. A sport enters a screen only with
its error table.

**Phase 3: the coach's office.**

- Accounting from sourced rates: URSSAF contribution rates, each with its source and date, nothing computed from an
  unsourced rate.
- Nutrition by barcode through Open Food Facts.
- Nutrition by photo: the app proposes foods, the user confirms each one, and calories are shown as a range from
  CIQUAL, never as a single number.
- Client records and progress: each client's sets, programmes and results over time.

Every phase keeps the rules above: no number without its margin, no claim without the output that proves it, French
approved by David before release.
