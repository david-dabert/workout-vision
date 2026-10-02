# Synthetic sets with exact truth (2 October 2026)

Public datasets with motion-capture truth (REHAB24-6, MobiPhysio) are out of reach of this environment's
network, and none labels a known asymmetry. So the truth is built: a rigged human body (three.js examples'
Michelle and Soldier, Mixamo rigs) is posed frame by frame from set joint angles, with a chosen left/right
difference, rendered at the app's analysis size (360x640, 15 fps), and every frame goes through the app's own
pose detection (getImageLandmarker, detectPoseImage). The count, each side's range, the phase times and the
gap are read from the skeleton with the counter's three-point angles, so they are exact.

- synth.js: the renderer (window.SYNTH holds the set; P.video renders frames for a video instead).
- run.mjs: renders a matrix of sets and stores landmarks with their truth (SYNTH_OUT, SYNTH_MODEL).
- analyse.test.ts: the app against the truth; writes synth.txt (SYNTH_DIR).
- run-video.mjs: one set encoded as an H.264 MP4 (FFMPEG), for smoke.mjs.
- smoke.mjs: the production app end to end with such a video, every screen shot, every fault listed.

Models: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf (Michelle.glb, Soldier.glb).
Limits: synthetic bodies are not people. These figures bound what the pipeline does in clean conditions; they
do not replace real-phone sets.
