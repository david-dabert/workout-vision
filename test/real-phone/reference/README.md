# Physiotherapist reference exercises

Source: four videos from Olivier, physiotherapist, sent on 15 October 2026 with his consent for the tests ("Ci-joint les vidéos pour faire les tests"; DECISION recorded on issue #190).
They are the reference his patients are to reproduce.
The videos and their pose landmarks stay out of this public repository (his consent covers the tests, not publication). The landmarks were extracted by the app's own harness (`test/real-phone/harness.js`, MediaPipe, 15 samples a second, 640 px), after re-encoding to VP9 because the test browser has no H.264 decoder.

| Landmark file (local) | Exercise | Pose found | Joints the app reads well enough |
|---|---|---|---|
| `olivier-1-supine-clasped` | On the back, hands clasped: arms up, hands to the forehead, overhead | 100 % | Near arm (right): shoulder and elbow. The far arm, partly hidden, is left out (seen 61 % and 68 %). |
| `olivier-2-side-lying` | On the side, forearm lifting | 100 % | None that follow the movement: the elbow angle read moves, the forearm's rotation is not read. |
| `olivier-3-prone-y-t` | Face down, one arm from Y to T, filmed from the head end | 93 % | None that follow the movement: the shoulder read moves 14.5 degrees for a Y-to-T sweep. |
| `olivier-4-supine-staged-raise` | On the back, straight arms raised in stages to overhead | 100 % | Near arm (right): shoulder (range 126 degrees) and elbow. |

References 2 and 3 are to be filmed again from an angle where the arm sweeps across the picture (video 3 from the side, at table height).
The engine still builds a reference from them, on joints that do not follow the movement: a reference needs a person to check its replay before patients use it.

Bench: `REFERENCE_LANDMARKS=<local folder> node test/real-phone/reference/bench.mjs` prints the tables; the four landmark tests in `src/lib/reference/__tests__/compare.test.js` run when the same variable is set, and are skipped otherwise.
Each reference is compared with itself, with itself 1.3 times slower with 3 s of extra footage before and after, with the other three videos, and with two faulty versions of itself (the first moving joint stopped at 70 % of its range; the elbows 30 degrees more bent).
On references 1 and 4: itself and slower match; the other videos and both faults are asked to revise, each fault on the joint that carries it.
No patient attempt has been measured yet: the tolerances (`src/lib/reference/compare.js`) are experimental and UNSOURCED (R9).
