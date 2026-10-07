// Synthetic sets with exact ground truth (2 October 2026). A rigged human (three.js, Mixamo skeleton) is posed
// frame by frame from set angles, rendered at the app's analysis size (640 px long side, 15 fps), and each
// frame goes through the app's own pose detection (getImageLandmarker, detectPoseImage: the worker's path).
// The truth is read from the skeleton's joint positions with the counter's three-point angle definitions, so
// the count, each side's range, the left/right gap and the phase times are known exactly. run.mjs drives it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getImageLandmarker, detectPoseImage } from '../../../src/lib/poseAnalysis.js';
import * as mpVision from '@mediapipe/tasks-vision';
import { TARGET_FPS, MAX_LONG_SIDE } from '../../../src/lib/extractionConfig.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { roiFromBoxes, shrinkRegion, GRID } from '../../../src/lib/counting/motionRhythm.js';

const P = window.SYNTH;
// P.video: render frames for a video file (run-video.mjs) at its own size and rate, without pose detection.
const H = P.video ? P.video.h : MAX_LONG_SIDE, W = P.video ? P.video.w : Math.round(MAX_LONG_SIDE * 9 / 16);
const FPS = P.video ? P.video.fps : TARGET_FPS;
const D = Math.PI / 180;

// Seeded random, so a set is reproducible from its seed.
let seed = P.seed >>> 0 || 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const jit = (x, f) => x * (1 + (rnd() * 2 - 1) * f);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(P.bg ?? 0x8a8f96);
const hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x5c5048 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 50);

const gltf = await new GLTFLoader().loadAsync('/synth-model.glb');
const body = gltf.scene;
scene.add(body);
const bone = n => body.getObjectByName(`mixamorig${n}`) || body.getObjectByName(`mixamorig:${n}`);
const B = Object.fromEntries(['Hips', 'Spine', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftShoulder', 'RightShoulder'].map(n => [n, bone(n)]));
const rest = new Map();
body.traverse(o => { if (o.isBone) rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() }); });
const resetPose = () => { for (const [o, r] of rest) { o.quaternion.copy(r.q); o.position.copy(r.p); } body.updateMatrixWorld(true); };

// Scale the body to 1.75 m and stand it on the floor.
resetPose();
const box = new THREE.Box3().setFromObject(body);
body.scale.multiplyScalar(1.75 / (box.max.y - box.min.y));
body.updateMatrixWorld(true);
const box2 = new THREE.Box3().setFromObject(body);
body.position.y -= box2.min.y;
body.updateMatrixWorld(true);
const wp = o => o.getWorldPosition(new THREE.Vector3());
// Turn the body to face the camera (+z): facing +z, the person's left (LeftArm) lies on +x. A model built
// facing away (the Soldier) is turned round.
if (wp(B.LeftArm).x < wp(B.RightArm).x) { body.rotation.y += Math.PI; body.updateMatrixWorld(true); }
const S = { left: Math.sign(wp(B.LeftArm).x - wp(B.RightArm).x) || 1 };
S.right = -S.left;
// The pose directions below are written for a body facing +z; a turned body needs them turned with it.

// Turn a bone so the segment to its child points along dir (world space).
const aim = (b, child, dir) => {
  body.updateMatrixWorld(true);
  const cur = wp(child).sub(wp(b)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
  const world = b.getWorldQuaternion(new THREE.Quaternion());
  const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(parent.invert().multiply(q.multiply(world)));
  body.updateMatrixWorld(true);
};
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const sideDirs = (s, abduct, bend = 0) => [v(s * Math.sin(abduct), -Math.cos(abduct), 0), v(s * Math.sin(abduct + bend), -Math.cos(abduct + bend), 0)];

// Each exercise: the pose at progress u (0 = rest, 1 = working end) for one side, with that side's peak.
const POSE = {
  lateral_raise(side, u, peak) { const s = S[side], a = (12 + (peak - 12) * u) * D; const [up, fore] = sideDirs(s, a, 8 * D); aim(B[`${cap(side)}Arm`], B[`${cap(side)}ForeArm`], up); aim(B[`${cap(side)}ForeArm`], B[`${cap(side)}Hand`], fore); },
  bicep_curl(side, u, peak) { const s = S[side], f = (8 + (peak - 8) * u) * D; aim(B[`${cap(side)}Arm`], B[`${cap(side)}ForeArm`], v(s * 0.12, -1, 0.06)); aim(B[`${cap(side)}ForeArm`], B[`${cap(side)}Hand`], v(s * 0.12, -Math.cos(f), Math.sin(f))); },
  // Pressing from the shoulders: the upper arm rises from 85° to the peak abduction, the forearm stays vertical.
  overhead_press(side, u, peak) { const s = S[side], a = (85 + (peak - 85) * (1 - u)) * D; aim(B[`${cap(side)}Arm`], B[`${cap(side)}ForeArm`], v(s * Math.sin(a), -Math.cos(a), 0.05)); aim(B[`${cap(side)}ForeArm`], B[`${cap(side)}Hand`], v(s * 0.04, 1, 0.02)); },
  // A calf raise: the foot turns down about the ankle by up to the peak, toes kept on the floor (below).
  calf_raise(side, u, peak) { const f = peak * u * D; aim(B[`${cap(side)}Foot`], B[`${cap(side)}ToeBase`], v(0, -0.45 * Math.cos(f) - Math.sin(f), Math.cos(f) - 0.45 * Math.sin(f))); },
  squat(side, u, peak) { const s = S[side], k = peak * u * D; aim(B[`${cap(side)}UpLeg`], B[`${cap(side)}Leg`], v(s * 0.14, -Math.cos(k / 2), Math.sin(k / 2))); aim(B[`${cap(side)}Leg`], B[`${cap(side)}Foot`], v(s * 0.06, -Math.cos(k / 2), -Math.sin(k / 2))); },
};
const cap = s => s[0].toUpperCase() + s.slice(1);
const neutralArms = () => { for (const side of ['left', 'right']) { const [up, fore] = sideDirs(S[side], 10 * D, 4 * D); aim(B[`${cap(side)}Arm`], B[`${cap(side)}ForeArm`], up); aim(B[`${cap(side)}ForeArm`], B[`${cap(side)}Hand`], fore); } };
const neutralLegs = () => { for (const side of ['left', 'right']) { aim(B[`${cap(side)}UpLeg`], B[`${cap(side)}Leg`], v(S[side] * 0.12, -1, 0)); aim(B[`${cap(side)}Leg`], B[`${cap(side)}Foot`], v(S[side] * 0.05, -1, 0)); } };

// P.seated: rest is the working end of the pose (a squat held low stands for sitting on a chair, there being no
// chair in the scene), and each rep rises from it and returns: the 30-second chair stand.
// The set's timeline: a still start, reps with jittered phases and peaks, a still end.
const reps = [];
let t = P.startRest ?? 1.0;
for (let i = 0; i < P.reps; i++) {
  const out = jit(P.outSec ?? 1.1, 0.25), back = jit(P.backSec ?? 1.4, 0.25), hold = jit(0.15, 0.5), gap = jit(0.35, 0.5);
  reps.push({ start: t, top: t + out, hold: t + out + hold, end: t + out + hold + back, j: jit(1, 0.04) });
  t += out + hold + back + gap;
}
// P.endUp: the last rep stops at its working end and holds it to the end of the video (a 30-second test
// whose time runs out with the person standing or the arm curled).
if (P.endUp && reps.length) { const last = reps.at(-1); last.hold = last.end = Infinity; }
const total = t + (P.endRest ?? 1.2);
// P.window (seconds): the protocol's score of a timed test (fitness-tests.js), the reps whose rise is past
// halfway within the window that opens at the first rise.
const score = P.window ? reps.filter(r => r.start + (r.top - r.start) / 2 <= reps[0].start + P.window).length : undefined;
const repAt = time => { let k = 0; for (let i = 0; i < reps.length; i++) if (time >= reps[i].start) k = i; return k; };
const ease = x => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2;
const progress = time => {
  for (const r of reps) {
    if (time < r.start || time > r.end) continue;
    const u = time < r.top ? ease((time - r.start) / (r.top - r.start)) : time < r.hold ? 1 : 1 - ease((time - r.hold) / (r.end - r.hold));
    return { u: P.seated ? 1 - u : u, j: r.j };
  }
  return { u: P.seated ? 1 : 0, j: 1 };
};

// The counter's own three-point angles (core.ts JOINT_POINTS), read from the skeleton: the truth.
const ang = (a, b, c) => { const x = a.clone().sub(b), y = c.clone().sub(b); return x.angleTo(y) / D; };
const truthAngles = () => ({
  elbow: { left: ang(wp(B.LeftArm), wp(B.LeftForeArm), wp(B.LeftHand)), right: ang(wp(B.RightArm), wp(B.RightForeArm), wp(B.RightHand)) },
  shoulder: { left: ang(wp(B.LeftUpLeg), wp(B.LeftArm), wp(B.LeftForeArm)), right: ang(wp(B.RightUpLeg), wp(B.RightArm), wp(B.RightForeArm)) },
  knee: { left: ang(wp(B.LeftUpLeg), wp(B.LeftLeg), wp(B.LeftFoot)), right: ang(wp(B.RightUpLeg), wp(B.RightLeg), wp(B.RightFoot)) },
  ankle: { left: ang(wp(B.LeftLeg), wp(B.LeftFoot), wp(B.LeftToeBase)), right: ang(wp(B.RightLeg), wp(B.RightFoot), wp(B.RightToeBase)) },
});

// Camera: chest height, facing the body from the view angle (0 = front, 90 = the person's left side).
const yaw = (P.view ?? 0) * D, dist = P.dist ?? 2.7;
camera.position.set(Math.sin(yaw) * dist * S.left, P.camY ?? 1.15, Math.cos(yaw) * dist);
camera.lookAt(0, 0.95, 0);

// P.occlude (7 October; test/real-phone/occlusion/README.md): occluders and degradations that mimic what goes wrong on
// David's real videos, opt-in per matrix entry; without it none of this runs and a set renders as before.
//   plate: a bar with two 45 cm plates (dark discs, 5 cm thick, at +-0.7 m from its middle along the body's left-right
//          axis), on the shoulders for a squat, in the hands otherwise; from the side the near plate hides the torso.
//   rack: { at, offsets }: vertical uprights (7 x 7 cm, 2.4 m tall, dark) `at` m from the body towards the camera,
//          shifted sideways by each offset (m, camera's right); default one upright at 0.8 m, offset 0.1 m.
//   light: scale of both lights (0.3 = a dim gym); noise: sigma of Gaussian pixel noise (0-255 levels, seeded);
//   blur: renders averaged per frame over the shutter (shutter, s, default one frame interval).
//   person: { side, depth }: a second body of the same model, static, standing `side` m to the camera's right of the
//          lifter (0.75 m: about half in frame at 2.7 m) and `depth` m farther from the camera.
const O = P.occlude || null;
const occ = { gray: [], boxes: [], onTarget: [] };
let placeOccluders = () => {}, renderBlurred = () => {}, addNoise = () => {};
let bystander = null; // the second person's hips, in world space (static)
if (O) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7, metalness: 0.2 });
  const camDir = camera.position.clone().sub(new THREE.Vector3(0, 0.95, 0)).setY(0).normalize();
  const camRight = new THREE.Vector3(camDir.z, 0, -camDir.x); // horizontal, to the camera's right
  if (O.light) { hemi.intensity *= O.light; sun.intensity *= O.light; }
  let bar = null;
  if (O.plate) {
    bar = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 }));
    rod.rotation.z = Math.PI / 2; bar.add(rod);
    for (const sgn of [-1, 1]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 48), dark);
      disc.rotation.z = Math.PI / 2; disc.position.x = sgn * 0.7; bar.add(disc);
    }
    scene.add(bar);
  }
  if (O.rack) {
    const r = O.rack === true ? {} : O.rack;
    for (const off of r.offsets ?? [0.1]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), dark);
      up.position.copy(camDir.clone().multiplyScalar(r.at ?? 0.8).add(camRight.clone().multiplyScalar(off))).setY(1.2);
      scene.add(up);
    }
  }
  if (O.person) {
    resetPose(); neutralArms(); neutralLegs();
    const other = cloneSkinned(body);
    const q = O.person === true ? {} : O.person;
    other.position.add(camRight.clone().multiplyScalar(q.side ?? 0.75)).add(camDir.clone().multiplyScalar(-(q.depth ?? 0.5)));
    // Faces the camera (about the world's vertical: a model's root may carry another rotation).
    other.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(camDir.x, camDir.z));
    scene.add(other);
    other.updateMatrixWorld(true);
    bystander = (other.getObjectByName('mixamorigHips') || other.getObjectByName('mixamorig:Hips')).getWorldPosition(new THREE.Vector3());
    resetPose();
  }
  placeOccluders = () => {
    if (!bar) return;
    body.updateMatrixWorld(true);
    const at = P.exercise === 'squat' ? wp(B.LeftArm).add(wp(B.RightArm)).multiplyScalar(0.5).add(v(0, 0.02, -0.06))
      : wp(B.LeftHand).add(wp(B.RightHand)).multiplyScalar(0.5);
    bar.position.copy(at);
  };
  // Noise from its own seeded generator, so the set's timeline (rnd) is the same with and without it.
  let ns = (P.seed >>> 0 || 1) ^ 0x5bd1e995;
  const nr = () => { ns = (ns * 1664525 + 1013904223) >>> 0; return (ns + 0.5) / 2 ** 32; };
  const gauss = () => Math.sqrt(-2 * Math.log(nr())) * Math.cos(2 * Math.PI * nr());
  addNoise = () => {
    const img = fctx.getImageData(0, 0, W, H), d = img.data;
    for (let k = 0; k < d.length; k += 4) { const e = gauss() * O.noise; d[k] += e; d[k + 1] += e; d[k + 2] += e; }
    fctx.putImageData(img, 0, 0);
  };
  renderBlurred = time => {
    const k = O.blur, shutter = O.shutter ?? 1 / FPS;
    fctx.globalAlpha = 1;
    for (let s = 0; s < k; s++) {
      poseAt(time - shutter * (1 - s / (k - 1)));
      renderer.render(scene, camera);
      fctx.globalAlpha = 1 / (s + 1); // running mean
      fctx.drawImage(renderer.domElement, 0, 0);
    }
    fctx.globalAlpha = 1;
  };
}
// Per frame, with P.occlude: the frame shrunk to 128 px gray (as test/real-phone/motion/capture.mjs takes it from the
// app's decode), the box of the pose found (image landmarks with visibility >= 0.5), and, with a second person, whether
// the pose found is the lifter: its hip midpoint nearer the lifter's projected hips than the bystander's (image
// coordinates, x scaled to the height). A fixed distance to the lifter's hips misfired on side views (MediaPipe's hip
// points sit off the rig's Hips bone), so only the nearer of the two people is read.
const GRAY_SIDE = 128, gw = Math.round(W * GRAY_SIDE / H), gh = GRAY_SIDE;
const small = document.createElement('canvas'); small.width = gw; small.height = gh;
const sctx = small.getContext('2d', { willReadFrequently: true });
const recordOcclusion = got => {
  sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(flat, 0, 0, gw, gh);
  const px = sctx.getImageData(0, 0, gw, gh).data, gray = new Uint8Array(gw * gh);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (77 * px[i] + 150 * px[i + 1] + 29 * px[i + 2]) >> 8;
  occ.gray.push(gray);
  const lm = got?.landmarks?.[0];
  let box = null, on = null;
  if (lm) {
    const vis = lm.filter(p => (p.visibility ?? 1) >= 0.5);
    if (vis.length >= 4) {
      const xs = vis.map(p => p.x), ys = vis.map(p => p.y);
      box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(z => Math.round(z * 1000) / 1000);
    }
    if (bystander) {
      const img = q => { const pr = q.clone().project(camera); return [(pr.x + 1) / 2, (1 - pr.y) / 2]; };
      const mx = (lm[23].x + lm[24].x) / 2, my = (lm[23].y + lm[24].y) / 2;
      const dist = ([x, y]) => Math.hypot((mx - x) * W / H, my - y);
      on = dist(img(wp(B.Hips))) <= dist(img(bystander));
    }
  }
  occ.boxes.push(box); occ.onTarget.push(on);
};
// The motion bench's input, kept small: each frame's region (motionRhythm.js roiFromBoxes over the set's boxes) shrunk
// to GRID x GRID gray bytes, base64; motionCount reads them back with w = h = GRID and the whole grid as its region.
const occlusionResult = () => {
  const roi = roiFromBoxes(occ.boxes);
  const grids = occ.gray.map(g => {
    const r = shrinkRegion(g, gw, gh, roi, GRID);
    let s = ''; for (let i = 0; i < r.length; i++) s += String.fromCharCode(Math.max(0, Math.min(255, Math.round(r[i]))));
    return btoa(s);
  });
  return { boxes: occ.boxes, ...(bystander ? { onTarget: occ.onTarget } : {}), motion: { grid: GRID, roi, frames: grids } };
};

const flat = document.createElement('canvas'); flat.width = W; flat.height = H;
const fctx = flat.getContext('2d', { willReadFrequently: true });
// A bench run may load another pose model (run.mjs, BENCH_POSE): its bytes are handed to the app's loader.
if (P.benchPose) globalThis.__WV_BENCH_POSE_MODEL__ = await (await fetch('bench-pose.task')).arrayBuffer();
// P.noCrop: the pose path without its crop pass on lost frames (poseAnalysis.js bench hook), to measure the pass
// against its absence (test/real-phone/far-camera/run.mjs).
if (P.noCrop) globalThis.__WV_BENCH_NO_CROP__ = true;
// P.lock: the pose path with the lifter lock (lifterLock.js; two poses asked, the lifter's kept), set before the model
// loads since it sets numPoses (7 October, run.mjs SYNTH_LOCK=1).
if (P.lock) globalThis.__WV_BENCH_LOCK__ = true;
const model = P.video ? null : await getImageLandmarker();
// P.lostPose: a second pose model (run.mjs, LOST_POSE, e.g. MediaPipe's heavy model) run on the whole frame of the
// frames still without a pose after the app's own path, to measure it (7 October). Bench only; the app has none.
let lostModel = null;
if (P.lostPose && !P.video) {
  const vision = await mpVision.FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`);
  const bytes = new Uint8Array(await (await fetch('lost-pose.task')).arrayBuffer());
  lostModel = await mpVision.PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetBuffer: bytes, delegate: 'CPU' }, runningMode: 'IMAGE', numPoses: 1, minPoseDetectionConfidence: 0.35, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.5 });
}
const frames = [], truth = [], ts = [], sources = [];
const sampleAt = new Map(); // detection timestamp -> frame index, for the backward pass
const round = w => w.map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), visibility: +(p.visibility ?? 1).toFixed(3) }));
// P.back / P.noBack: the pose path with or without its backward pass (poseAnalysis.js bench hooks; BACK_PASS is off in
// the app); P.backKeepMs: lost frames kept longer.
if (P.back) globalThis.__WV_BENCH_BACK__ = true;
if (P.noBack) globalThis.__WV_BENCH_NO_BACK__ = true;
if (P.backKeepMs) globalThis.__WV_BENCH_BACK_KEEP_MS__ = P.backKeepMs;
let detectMs = 0;
const n = Math.floor(total * FPS);
const jpegs = [];
// The body's pose at a time (the set's timeline above).
const poseAt = time => {
  resetPose();
  neutralArms(); neutralLegs();
  const { u, j } = progress(time);
  // P.alternate (7 October, opt-in): one side per rep, the left first (an alternating curl); the other side rests.
  const busy = P.alternate ? (repAt(time) % 2 === 0 ? 'left' : 'right') : null;
  for (const side of ['left', 'right']) POSE[P.exercise](side, busy && side !== busy ? 0 : u, (side === 'left' ? P.peakL : P.peakR) * j);
  // A squat lowers the hips so the feet stay on the floor.
  // The drop is set in world space and taken back through the Hips' parent, which in these models is scaled
  // and turned (review, 2 October: dividing by the body's scale left the feet 0.3 m off the floor).
  if (P.exercise === 'calf_raise') {
    body.updateMatrixWorld(true);
    const low = Math.min(wp(B.LeftToeBase).y, wp(B.RightToeBase).y);
    const hips = wp(B.Hips); hips.y -= low - (P.toeY ??= low);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(hips));
    body.updateMatrixWorld(true);
  }
  if (P.exercise === 'squat') {
    body.updateMatrixWorld(true);
    const low = Math.min(wp(B.LeftFoot).y, wp(B.RightFoot).y);
    const hips = wp(B.Hips); hips.y -= low - (P.footY ??= low);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(hips));
    body.updateMatrixWorld(true);
  }
  if (O) placeOccluders();
};
for (let i = 0; i < n; i++) {
  const time = i / FPS;
  // P.occlude.blur: the frame is the mean of `blur` renders over the shutter time before it (motion blur), the body
  // posed at each; the pose at the frame's own time is set last, for the truth.
  if (O?.blur > 1) renderBlurred(time);
  poseAt(time);
  if (!(O?.blur > 1)) {
    renderer.render(scene, camera);
    fctx.drawImage(renderer.domElement, 0, 0);
  }
  if (O?.noise) addNoise();
  if (P.video) { jpegs.push(flat.toDataURL('image/jpeg', 0.9)); truth.push(truthAngles()); ts.push(time); continue; }
  const d0 = performance.now();
  const res = detectPoseImage(model, flat, time * 1000, { backfill: true });
  detectMs += performance.now() - d0;
  // Backward pass (poseCrop.js), as the app applies it: earlier frames without a pose, now read on a crop.
  for (const b of res?.backfill || []) {
    const k = sampleAt.get(b.timestamp);
    if (k != null && !frames[k] && b.worldLandmarks[0]) { frames[k] = round(b.worldLandmarks[0]); sources[k] = 'back'; }
  }
  sampleAt.set(time * 1000, frames.length);
  let got = res?.worldLandmarks?.[0] ? res : null;
  if (!got && lostModel) {
    const d1 = performance.now();
    const r2 = lostModel.detect(flat);
    detectMs += performance.now() - d1;
    if (r2?.worldLandmarks?.[0]) got = { ...r2, source: 'lost-model' };
  }
  if (O) recordOcclusion(got, time);
  frames.push(got ? round(got.worldLandmarks[0]) : null);
  sources.push(got ? (got.source ?? 'full') : null);
  truth.push(truthAngles());
  ts.push(time);
  if (i === Math.floor(n / 3) && P.shot) window.SHOT = flat.toDataURL('image/jpeg', 0.8);
}
window.JPEGS = jpegs;
window.RESULT = { params: P, sides: S, reps: reps.map(r => ({ start: r.start, top: r.top, hold: r.hold, end: r.end })), score, worldLandmarks: frames, poseSources: sources, detectMs, truth, timestamps: ts, size: [W, H] };
if (O && !P.video) window.RESULT.occlusion = occlusionResult();
