// Monocular 3D Inverse Taylor Projection: bone length invariance under scaled orthographic projection.
// Physics & Geometry: under scaled orthographic projection a bone of length L whose image projection measures l,
// in metres at the set's scale, has a depth extent |dz| = sqrt(L^2 - l^2) (Taylor, "Reconstruction of articulated
// objects from point correspondences in a single uncalibrated image", CVIU 80(3), 2000; status: literature).
// Solves foreshortening along the depth axis (z-depth compression) on compound back movements (e.g. lat pulldowns)
// filmed from front or back views, while preserving planar side-view exercises.
import { depthShare } from './survey';

export type P = { x: number; y: number; z: number; visibility?: number };
export type Frame = P[] | null;

const ROOT = -1;
// Parent of each joint along the body's tree, from the hips outward (MediaPipe's 33 landmarks).
const PARENT: Record<number, number> = {
  23: ROOT, 24: ROOT, 25: 23, 27: 25, 29: 27, 31: 27, 26: 24, 28: 26, 30: 28, 32: 28,
  11: 23, 12: 24, 13: 11, 15: 13, 17: 15, 19: 15, 21: 15, 14: 12, 16: 14, 18: 16, 20: 16, 22: 16,
  0: -2, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
};
const SHOULDERS = -2; // the nose hangs from the shoulders' midpoint
const ORDER = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MIRROR: Record<number, number> = { 23: 24, 25: 26, 27: 28, 29: 30, 31: 32, 11: 12, 13: 14, 15: 16, 17: 18, 19: 20, 21: 22 };
for (const [l, r] of Object.entries(MIRROR)) MIRROR[r as any] = Number(l);
// The bones that calibrate the scale: the limbs and the torso, not the hands or the face.
const CALIBRATE = [25, 26, 27, 28, 11, 12, 13, 14, 15, 16];

const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const at = (f: P[], j: number): P => (j === ROOT ? mid(f[23], f[24]) : j === SHOULDERS ? mid(f[11], f[12]) : f[j]);
const quantile = (v: number[], q: number) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/** Image landmarks of one sample as points (a flat [x0, y0, x1, y1, ...] or MediaPipe's objects), or null. */
export function imagePoints(f: any): P[] | null {
  if (!f) return null;
  if (typeof f[0] === 'number') return Array.from({ length: f.length / 2 }, (_, j) => ({ x: f[2 * j], y: f[2 * j + 1], z: 0 }));
  return f.map((p: any) => ({ x: p.x, y: p.y, z: 0, visibility: p.visibility }));
}

export type LiftInfo = { kx: number; ky: number; aspect: number; samples: number };
export type LiftMode = 'geometry' | 'blend' | 'fused';

/** The set's world landmarks re-built from its image landmarks; samples without both are left as they were. */
export function liftSet(world: Frame[], image: any[], mode: LiftMode = 'fused', aspect?: number): { frames: Frame[]; info: LiftInfo } {
  const img = image.map(imagePoints);
  const both = world.map((w, i) => (w && img[i] && img[i]!.length >= 33 ? i : -1)).filter(i => i >= 0);
  // The image-to-world slope per axis, through the hips: dx_image = kx * dx_world (likewise y).
  let sxx = 0, sx = 0, syy = 0, sy = 0;
  for (const i of both) {
    const w = world[i]!, m = img[i]!;
    for (const j of CALIBRATE) {
      if ((w[j].visibility ?? 1) < 0.5) continue;
      const p = PARENT[j], dxw = w[j].x - at(w, p).x, dyw = w[j].y - at(w, p).y, dxi = m[j].x - at(m, p).x, dyi = m[j].y - at(m, p).y;
      sxx += dxw * dxw; sx += dxi * dxw; syy += dyw * dyw; sy += dyi * dyw;
    }
  }
  const ky = sy / syy, info = { kx: sx / sxx, ky, aspect: Math.abs(ky * sxx / sx), samples: both.length };
  // Where the frame's size is known, its aspect ratio (width / height) fixes the x slope from the y slope.
  const kx = aspect ? Math.sign(sx / sxx) * Math.abs(ky) / aspect : sx / sxx;
  if (!(both.length >= 10 && Number.isFinite(kx) && Number.isFinite(ky) && kx !== 0 && ky !== 0)) return { frames: world, info };
  // In metres at the set's scale: the image plane through the hips.
  const plane = (m: P[], j: number) => { const p = at(m, j), r = at(m, ROOT); return { x: (p.x - r.x) / kx, y: (p.y - r.y) / ky }; };
  // Each bone's length: its world length (median) or its long image reading, whichever is larger; left = right.
  const own: Record<number, number> = {};
  for (const j of ORDER) {
    const p = PARENT[j], w3: number[] = [], i2: number[] = [];
    for (const i of both) {
      const w = world[i]!, a = at(w, j), b = at(w, p);
      w3.push(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
      const u = plane(img[i]!, j), v = plane(img[i]!, p);
      i2.push(Math.hypot(u.x - v.x, u.y - v.y));
    }
    own[j] = Math.max(quantile(w3, 0.5), quantile(i2, 0.85));
  }
  const len: Record<number, number> = {};
  for (const j of ORDER) len[j] = MIRROR[j] !== undefined ? (own[j] + own[MIRROR[j]]) / 2 : own[j];
  const sign: Record<number, number> = {};
  const frames = world.map((w, i) => {
    const m = img[i];
    if (!w || !m || m.length < 33) return w;
    const out: P[] = w.map(p => ({ ...p }));
    const placed: Record<number, P> = {};
    const r0 = at(w, ROOT), root = mode === 'fused' ? { ...r0 } : { x: 0, y: 0, z: r0.z };
    const pos = (j: number): P => (j === ROOT ? root : j === SHOULDERS ? mid(placed[11], placed[12]) : placed[j]);
    for (const j of ORDER) {
      const p = PARENT[j], q = pos(p), u = plane(m, j), v = plane(m, p);
      const dx = u.x - v.x, dy = u.y - v.y, dz = Math.sqrt(Math.max(0, len[j] * len[j] - dx * dx - dy * dy));
      const read = at(w, j).z - at(w, p).z;
      if (mode === 'geometry') {
        if (sign[j] === undefined || Math.abs(read) >= 0.25 * dz) sign[j] = read < 0 ? -1 : 1;
        placed[j] = { x: q.x + dx, y: q.y + dy, z: q.z + sign[j] * dz };
      } else {
        // The geometry is trusted in proportion to the bone's share along the depth, (dz / L)^2: well determined when the
        // bone points at the camera, unstable when it lies in the image plane (d(dz)/dl = -l/dz), where the pose model's
        // own depth is kept. The world's in-plane position and depth sign are kept (mode 'fused').
        const c = Math.min(1, (dz / len[j]) ** 2), wd = Math.abs(read), wp = at(w, j), wq = at(w, p);
        const z = (read < 0 ? -1 : 1) * (c * dz + (1 - c) * wd);
        placed[j] = mode === 'fused' ? { x: q.x + (wp.x - wq.x), y: q.y + (wp.y - wq.y), z: q.z + z } : { x: q.x + dx, y: q.y + dy, z: q.z + z };
      }
      out[j] = { ...out[j], x: placed[j].x, y: placed[j].y, z: placed[j].z };
    }
    return out;
  });
  return { frames, info };
}

const BACK_COMPOUND_LIFTS = new Set([
  'lat_pulldown',
  'close_grip_lat_pulldown',
  'wide_grip_lat_pulldown',
  'banded_lat_pulldown',
  'leg_extension',
  'seated_leg_extension',
  'chest_press',
  'machine_chest_press',
  'bench_press',
  'dumbbell_bench_press',
  'incline_bench_press',
  'push_up',
  'seated_cable_row',
  'seated_row',
  'machine_row',
]);

/**
 * Identifies depth-axis compound back lifts where foreshortening along the camera axis (z-depth)
 * distorts 2D/unconstrained joint excursion, while guarding planar side-view exercises (depthShare >= 0.6).
 */
export function isDepthAxisCompoundLift(lift: string, worldLandmarks: Frame[]): boolean {
  if (!BACK_COMPOUND_LIFTS.has(lift)) return false;
  const ds = depthShare(worldLandmarks as any);
  return Number.isFinite(ds) && ds < 0.6;
}
