// Synthetic sets with exact ground truth (2 October 2026). A rigged human (three.js, Mixamo skeleton) is posed
// frame by frame from set angles, rendered at the app's analysis size (640 px long side, 15 fps), and each
// frame goes through the app's own pose detection (getImageLandmarker, detectPoseImage: the worker's path).
// The truth is read from the skeleton's joint positions with the counter's three-point angle definitions, so
// the count, each side's range, the left/right gap and the phase times are known exactly. run.mjs drives it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getImageLandmarker, detectPoseImage } from '../../../src/lib/poseAnalysis.js';
import { TARGET_FPS, MAX_LONG_SIDE } from '../../../src/lib/extractionConfig.js';

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
scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x5c5048 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 50);

const gltf = await new GLTFLoader().loadAsync('/synth-model.glb');
const body = gltf.scene;
scene.add(body);
const bone = n => body.getObjectByName(`mixamorig${n}`) || body.getObjectByName(`mixamorig:${n}`);
const B = Object.fromEntries(['Hips', 'Spine', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftShoulder', 'RightShoulder'].map(n => [n, bone(n)]));
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
});

// Camera: chest height, facing the body from the view angle (0 = front, 90 = the person's left side).
const yaw = (P.view ?? 0) * D, dist = P.dist ?? 2.7;
camera.position.set(Math.sin(yaw) * dist * S.left, P.camY ?? 1.15, Math.cos(yaw) * dist);
camera.lookAt(0, 0.95, 0);

const flat = document.createElement('canvas'); flat.width = W; flat.height = H;
const fctx = flat.getContext('2d', { willReadFrequently: true });
const model = P.video ? null : await getImageLandmarker();
const frames = [], truth = [], ts = [];
const n = Math.floor(total * FPS);
const jpegs = [];
for (let i = 0; i < n; i++) {
  const time = i / FPS;
  resetPose();
  neutralArms(); neutralLegs();
  const { u, j } = progress(time);
  for (const side of ['left', 'right']) POSE[P.exercise](side, u, (side === 'left' ? P.peakL : P.peakR) * j);
  // A squat lowers the hips so the feet stay on the floor.
  // The drop is set in world space and taken back through the Hips' parent, which in these models is scaled
  // and turned (review, 2 October: dividing by the body's scale left the feet 0.3 m off the floor).
  if (P.exercise === 'squat') {
    body.updateMatrixWorld(true);
    const low = Math.min(wp(B.LeftFoot).y, wp(B.RightFoot).y);
    const hips = wp(B.Hips); hips.y -= low - (P.footY ??= low);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(hips));
    body.updateMatrixWorld(true);
  }
  renderer.render(scene, camera);
  fctx.drawImage(renderer.domElement, 0, 0);
  if (P.video) { jpegs.push(flat.toDataURL('image/jpeg', 0.9)); truth.push(truthAngles()); ts.push(time); continue; }
  const res = detectPoseImage(model, flat, time * 1000);
  frames.push(res?.worldLandmarks?.[0] ? res.worldLandmarks[0].map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), visibility: +(p.visibility ?? 1).toFixed(3) })) : null);
  truth.push(truthAngles());
  ts.push(time);
  if (i === Math.floor(n / 3) && P.shot) window.SHOT = flat.toDataURL('image/jpeg', 0.8);
}
window.JPEGS = jpegs;
window.RESULT = { params: P, sides: S, reps: reps.map(r => ({ start: r.start, top: r.top, hold: r.hold, end: r.end })), score, worldLandmarks: frames, truth, timestamps: ts, size: [W, H] };
