# Motion library: every catalogue exercise as a rendered body (8 October 2026)

Why: the counter must count 309 exercises that nobody can film one by one. Rendered sets help on real ones: the learned
phase counter (test/real-phone/learned-phase/) trained with the 164 rendered sets of five movements (synthetic and
occlusion suites) against without them, two seeds each, on David's real sets only (never trained on): his 13 videos
3.5 exact of 13 against 2, mean error 1.38 against 1.69 reps on both seeds; his 20 stored sets mean error 0.73 against
0.93; RepCount-A's 124 build sets unchanged (4.33 against 4.28). So each catalogue exercise gets a motion spec here, from
which synth.js renders sets with exact counts through the app's own pose model (synth/README.md).

A spec also checks the catalogue: rendered from the side the catalogue says to film, the joint the core counts
(src/lib/counting/guide-families.json) must swing, and towards the right side of its rest.

Status: experimental. Every spec is posed by hand from the exercise's usual technique (convention), its angles
UNSOURCED (R9). The rendered body has no bench, bar or machine: a body lying, seated or hanging floats where the
equipment would hold it.

## A spec: motions/<catalogue key>.json

    {
      "key": "squat", "source": "convention: ...; angles UNSOURCED", "status": "experimental",
      "support": { "anchor": "feet", "pin": "feet" },
      "start": { ...the pose at rest (u = 0)... },
      "mid":   { ...optional: a pose the rep passes through at u = 0.5... },
      "end":   { ...the pose at the working end (u = 1)... },
      "alternate": false, "side": null, "view": 90, "noReps": false,
      "tempo": { "out": [0.5, 1.8], "back": [0.6, 2.2] }, "camLift": 0.15
    }

Each pose holds angles in degrees; a key left out keeps its neutral value (standing, arms hanging). Left and right are
the person's own: from the front camera (view 0) the person's left is on the image's right.

| Key | Neutral | Meaning |
|---|---|---|
| pitch | 0 | the whole body about its left-right axis: -90 lying on the back (face up), +90 face down; +20 leans forward |
| roll | 0 | the whole body about its front-back axis: +90 lays it on its RIGHT side (left side up, head towards the person's right), -90 on its left side |
| yaw | 0 | the whole body about the vertical: + turns its front towards its left |
| trunk | 0 | trunk on the pelvis: + flexes forward, - extends back |
| trunkSide | 0 | trunk bent sideways on the pelvis: + towards the person's left (the shoulders move to the left), - towards the right |
| trunkTwist | 0 | trunk turned about its own axis on the pelvis: + turns the chest (and the arms with it) towards the left |
| neck | 0 | head: + chin down |
| shrug | 0 | per side: the shoulder girdle raised (the clavicle turned up about the trunk's forward axis: 35 lifts the shoulder about 5 cm on Michelle, whose clavicle is short), - depressed |
| shoulderFlex | 0 | upper arm forward and up, relative to the trunk: 90 forward, 180 overhead, - behind |
| shoulderAbd | 8 | upper arm out to the side: 90 level with the shoulder, 160 overhead |
| humRot | 0 | external rotation of the upper arm: with the arm out to the side and the elbow bent, 0 points the forearm forward, 90 up |
| elbow | 8 | elbow flexion: 0 straight, 140 fully curled |
| pronation | 0 | the forearm's turn, which sets the palm's side: 0 neutral (arm hanging: palm towards the thigh, a hammer grip), -90 supinated (palm forward when hanging, up on a curl), +90 pronated (palm back when hanging, down with the arm forward) |
| wrist | 0 | wrist flexion: + bends the hand towards the palm, - towards its back (extension) |
| hipFlex | 0 | thigh forward and up, relative to the pelvis: 90 seated, - behind |
| hipAbd | 4 | thigh out to the side |
| hipRot | 0 | the thigh turned about its own axis before the knee bends: + external (standing: toes out; seated, knee bent: the foot moves in), - internal |
| knee | 0 | knee flexion: 0 straight, 90 seated, 140 deep |
| ankle | 0 | toes down (plantar flexion), - toes up (dorsiflexion) |

A pose may hold `"left": {...}` and `"right": {...}` with that side's own values (a one-arm row, a lunge).

The renderer leaves the hand as the model holds it unless a spec sets `wrist` or `pronation` somewhere: then the forearm
is turned so the palm faces its side and the hand is bent by `wrist`. Neither changes a counter angle.

`mid` (optional): a via pose at u = 0.5. Every angle then moves start -> mid over the first half of the way out and mid ->
end over the second (piecewise linear; the way back retraces it), so a rep can pass through a pose that is neither end
(a burpee's crouch, a push press's dip, an Arnold press's sweep). A key that mid leaves out (for that side and shared)
sits halfway between its start and end values at u = 0.5, so it moves as it would without mid.

Angles are relative to the parent segment, as anatomy states them, not to the floor:

- the arms hang from the trunk: bent over at 60 degrees with the arms hanging to the floor is trunk 60 (or pitch 60)
  and shoulderFlex 60;
- the thighs hang from the pelvis, which follows pitch, not trunk: a hip hinge that keeps the legs vertical is pitch
  +40 with hipFlex +40 (the pelvis tips forward over the thighs);
- the shank is turned back from the thigh by the knee angle, the foot from the shank by the ankle: a foot stays flat on
  the floor when ankle = hipFlex - knee - pitch (a squat at hipFlex 90, knee 130: ankle -40);
- lying on the back (pitch -90), "forward" is towards the ceiling: arms pressed up are shoulderFlex 90; the legs bent
  with the feet on the floor, from a bench, are hipFlex -20, knee 90, ankle -20.

`support` places the body after it is posed. `anchor`, vertically: `feet` (the lowest foot point stays on the floor;
default), `lowest` (any bone at y, default 0.1: lying or planking on the floor), `hands` (their mean at y, default 2.1:
hanging from a bar), `hips` (at y, default 0.55: seated; 0.5 for a bench). `y` overrides the default. `pin`,
horizontally: the body slides so the pinned points keep the mean they have at rest (u = 0), as planted hands and feet
do: `"feet"` (ankles and balls of the feet), `"hands"` (wrists), `["feet", "hands"]` (each group's mean weighs half: a
push-up to a pike) or `"none"`. By default the feet anchor pins the feet (a squat's hips go back over the feet) and the
hands anchor the hands (a pull-up hangs under the bar); lowest and hips pin nothing. A one-sided movement plants only the
still side (`side`: the other side's foot or hand; `alternate` true: the side at rest on that rep), so a kickback's
standing foot stays put. `"pin": "none"` keeps the hips fixed horizontally (the renderer before 8 October).

`side`: "left" or "right" moves only that side (one arm, one leg; the other keeps its start pose). `alternate`: true
moves one side per rep, the left first, the other at its start pose (alternating curls); "mirror" moves both and swaps
their poses on every other rep (a lunge: left leg forward and right behind, then the other way), and on those reps
negates roll, yaw, trunkSide and trunkTwist, so the swapped rep is the body's mirror image (an archer push-up's shift,
a curtsy lunge's turn). `view`: the camera's angle about the body, 0 the front, 90 the left side; by default the
catalogue's view (side 90, front 0). `noReps`: a hold or a carry with no repetition to count (plank, wall sit, farmer
carry); kept for the catalogue, never rendered as reps.

`tempo` (optional): the render matrix's (library.mjs) range of seconds for the way out and the way back, in place of its
defaults out 0.5-1.8 and back 0.6-2.2 (fast cardio: high knees, jumping jacks at 0.25-0.5). synth.js jitters each rep
by 25 % on top and keeps its pause at the working end (about 0.15 s) and between reps (about 0.35 s).
`camLift` (optional): the camera's height above the centre of the body's box, in metres (default 0.15; a phone on the
floor for a lying exercise: about -0.2 to -0.3). The preview uses it as is; library.mjs draws within 0.2 m of it (without
it, 0.3 m below to 0.5 m above).

The camera frames the box of the skeleton and the head's top at rest, at mid and at the working end (both sides, each
side alone for alternate true, and the mirrored pose for "mirror"), grown by 0.2 m for the flesh and the hair.

## Check

    SYNTH_MODEL=<Michelle.glb or Soldier.glb> PW_CHROMIUM=<chrome> node test/real-phone/synth/motions/preview.mjs <out> [key or spec.json ...]

renders each spec at rest, halfway and at the working end, from its view and the other (front 0, side 90), each still
read by the app's pose model; writes <out>/<key>.jpg (the six stills, each labelled with the catalogue joint's angle on
the skeleton / as the pose model measures it) and <out>/checks.json. An argument ending in .json renders a draft spec
from its path. An alternating spec is shown as on its first rep (alternate true: the left side alone; "mirror": the
unswapped pose); PREVIEW_SIDE=right shows its second rep (the right side alone; the mirrored pose). FAIL: the pose model
loses the body on a still of the spec's view; or the catalogue joint swings under 30 degrees on the skeleton on every
side, or away from its rest side (rest high: the angle is larger at rest). WARN: the pose model measures, on its better side, under 20 degrees (the
core's floor) or a third of the true swing; the body is posed right and the pose model reads it poorly (lying, seated
from the front): the real-phone case too, so a WARN spec is kept.

The spec-guided counter reads the same specs through test/real-phone/template/fk.js, the renderer's kinematics on a
stick body; `node test/real-phone/template/fk-parity.mjs <out>/checks.json` compares its counter angles and trunk with
the rendered skeleton's (agreement within a few degrees: the bodies' proportions differ).

Models: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf (Michelle.glb, Soldier.glb).
