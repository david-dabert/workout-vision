# Using the iPhone's own chips: what is measured, what is not, and the next steps

Pillar 4 of David's order of 9 October 2026 ("Use the phone's own chips").
Nothing here is measured on an iPhone.
Every number below comes from this repository's machine, which has no GPU, and says so.

## 1. Why it matters

The pose model runs on the CPU, one sample at a time, in IMAGE mode (`poseAnalysis.js`, `getImageLandmarker`).
On this machine it costs 74 to 133 ms a sample (TRIED.md, 7 and 9 October).
David's iPhone took over a minute for 460 to 493 samples on 7 October, but that figure includes decoding and predates the pipelined read, so the iPhone's model time per sample is not known.
Live counting needs at most 66.7 ms a sample (`liveEngine.js`, `SLOW_MS`).
Above that, its 30-sample queue fills in 30 / (15 − 1000 / d) seconds for a cost of d ms a sample: about 2.4 s at 120 ms, 5.6 s at 80 ms.

## 2. The browser's GPU: measurable on the iPhone from today

`check.html` (the check page, internal) now prints on every row:
- the delegate the model ran on, and on the GPU the renderer WebGL names;
- the model's median and 90th-percentile time per sample;
- a fingerprint of the world landmarks (first 12 hex of their SHA-256), so a row read twice shows whether the model repeats itself.

Its first line shows the browser's user agent (Safari's `Version/NN` gives the iOS release).

- `check.html` reads on the CPU, as the app does: this gives the iPhone's CPU time per sample, the number pillar 3 needs.
- `check.html?delegate=gpu` reads with MediaPipe's GPU delegate (WebGL), with no fall back to the CPU: a GPU that fails shows an error.

The app itself stays on the CPU (`pose-model-path.test.js` pins it).

Measured here, on SwiftShader (a software renderer, blocklisted in `gpuBenchmark.js`), 9 October 2026:
- each delegate repeats itself bitwise from one read to the next;
- 0 of 78 frames read by both delegates gave identical landmarks;
- on three of David's videos the counted joint's angle differs by a median of 2.9° to 26.4° between them;
- the GPU took about 830 ms a sample, against 65 ms on the CPU.

None of this says anything about an iPhone's GPU.

### The test on David's iPhone (about 30 minutes)

1. Open `check.html` and read the six rows; note each row's time per sample and fingerprint.
2. Open `check.html?delegate=gpu` and read the same six rows.
3. Read the first row again with the GPU, then again on the CPU, to see whether each repeats itself and to control for heat.
4. Send the screenshots.

### What would make the GPU the app's default (written before the measurement)

All of these, on David's iPhone:
- the six rows "as before";
- on the 14 videos read on both delegates, the exact count not lower, no set newly off by 3 or more, no refused set turned into a count, no proposal moved off the label (the way VIDEO mode failed);
- the same row read twice gives the same fingerprint, on the CPU and on the GPU; otherwise the GPU stays a measured option, never the default;
- the GPU's median time per sample clearly below the CPU's (margin: experimental, UNSOURCED), and at most 66.7 ms for live counting;
- about 20 analyses and a live preview in a row with no reload, no crash log entry and no lost WebGL context.

Making it the default is more than one line.
CI's headless Chromium would then run the GPU on SwiftShader at about 12 times the CPU's time, so the worker would need a check that keeps software renderers on the CPU, and CI would then never test the engine iPhones run.
The stored real-phone sets were read on the CPU; the gate would need iPhone-GPU reads of the same videos.

## 3. WebGPU

MediaPipe 0.10.35 and 1.1.0 offer only 'CPU' and 'GPU' (WebGL); neither has a WebGPU pose path.
WebGPU means another runtime (LiteRT.js or ONNX Runtime Web) and the same or another model, which is a new engine under the full R2 gate.
Safari is reported to ship WebGPU on by default from iOS 26 (secondary sources only, not verified here).
In BACKLOG.md, not built.

## 4. Native iOS: what a first step needs

What David needs: a Mac with Xcode, his iPhone with Developer Mode on, and an Apple ID.
A free Apple ID can install an app on his own phone for 7 days.
The yearly developer programme is needed only to distribute the app to others (TestFlight, App Store).
These are Apple's terms as known here; check them at the time of the test.

A one-week test app, PoseBench (about 300 lines of Swift, not written):
- picks a video (PHPicker), reads it with AVAssetReader at 15 samples a second, 640 px on the long side, as the app samples it;
- runs on each sample: Apple's VNDetectHumanBodyPoseRequest (2D, 19 joints, iOS 14) and VNDetectHumanBodyPose3DRequest (3D, 17 joints, iOS 17; it follows the body from one sample to the next, so it goes through VNSequenceRequestHandler);
- optionally runs MediaPipe Tasks for iOS on the CPU and the GPU (the same model file and the same 33 points as the web app: only the speed would change);
- times each engine and writes one landmark file per video and engine, in the shape of `test/real-phone/sets-07oct-video/`, shared through the share sheet.

Apple's joints map onto 12 of MediaPipe's 33 limb points and some head points; hands, heels and feet are missing and would carry visibility 0.
The core's thresholds were tuned on MediaPipe, so each native engine gets its own scoreboard section, measured, deciding nothing until it passes R2 on the 14 videos.

Sources for the native facts: Apple's documentation for VNDetectHumanBodyPose3DRequest and VNHumanBodyPoseObservation.JointName; MediaPipe's iOS sources (`MPPBaseOptions.h`).
