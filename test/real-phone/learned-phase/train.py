#!/usr/bin/env python3
"""Learned phase counter, bench only: training (numpy only, no framework).

python3 -I test/real-phone/learned-phase/train.py <export folder> <out folder> [--epochs N] [--seed S] [--folds 0,1,all] [--progress]

Reads <export folder>/index.json and joints.f32 (export.test.ts). Trains, per fold f in {0, 1}, a model on
RepCount-A train (role train) + the cv sets of the other fold; and "all": RepCount-A train + every cv set (the model the
exams read). RepCount-A eval sets (test and validation build half) are never trained on; David's sets are not in the
export at all. Writes <out>/model-<fold>.json (float16 weights, base64) and <out>/eval-<fold>.json (counts of the
held-out sets of that fold, every readout), and prints the per-dataset tallies.

Formulation (see README.md): a non-causal dilated temporal convolution over per-frame pose features (data.js
features(), reproduced in features() here; parity checked by learned-phase-unit.test.ts) predicts per 15 Hz frame:
a rep rate z (reps per second; its sum over the set / 15 is the count, trained on every labelled set), the rep's phase
as (sin, cos) of 2 pi phi (phi 0 -> 1 from a rep's start to its end) and whether the frame is inside a rep (both
trained only where rep bounds are known: RepCount-A, CF-Rep, synthetic). Augmentation, with the counts known by
construction (RepNet's trick, Dwibedi et al. 2020; R1: no label is changed, a constructed sequence's count is the
number of copies of a labelled rep it holds): repeat one labelled rep 2-30 times with per-copy time warp,
amplitude jitter, pauses and dropouts; crop a natural set at rep boundaries; rotate about the vertical axis, mirror,
time-stretch. All constants UNSOURCED, experimental.

--progress (the progress input mode; off by default): the features gain two channels per frame from the progress p of
the set's motion spec (export.test.ts with LPHASE_PROGRESS=1 writes progress.f32; data.js progressFeatures, mirrored in
progress_features() here): p minus its median over the set, clipped to [-2, 2], 0 where absent, and a mask (1 where p
is finite). The model JSON then says "input": "progress", and model.js computes p for it (sgc.js specProgress). The
augmentation carries p along the joints: the same frames are cut, repeated, held and stretched, a repeated rep's p is
scaled by the same amplitude around its first frame, a dropped stretch longer than 8 frames has no p (PSC bridges
shorter gaps, psc.js BRIDGE_SEC); rotation, mirror and jitter leave it (it is read from rotation-free signals, the
more periodic side or both sides).
"""
import base64, json, math, os, sys, time
import numpy as np

HZ = 15
NJ = 13
F = 110
MIRROR = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11]
# joint positions in JOINTS order (data.js): 0 nose, 1 ls, 2 rs, 3 le, 4 re, 5 lw, 6 rw, 7 lh, 8 rh, 9 lk, 10 rk, 11 la, 12 ra
ANG = [(1, 3, 5), (2, 4, 6), (3, 1, 7), (4, 2, 8), (1, 7, 9), (2, 8, 10), (7, 9, 11), (8, 10, 12)]
DIL = [1, 2, 4, 8, 16, 32, 64]
C = 32
GAP = sum(DIL) + 2


# ---------------------------------------------------------------- features (mirror of data.js features())
def features(J, P=None):
    """J: (T, 13, 4) float32 joints (x, y, z, seen); P: (T,) progress or None. Returns (T, F) float32, or (T, F + 2)
    with P, as data.js."""
    T = J.shape[0]
    J = J.astype(np.float64)
    seen = J[:, :, 3] > 0
    hipok = seen[:, 7] & seen[:, 8]
    shok = seen[:, 1] & seen[:, 2]
    hip = (J[:, 7, :3] + J[:, 8, :3]) / 2
    sh = (J[:, 1, :3] + J[:, 2, :3]) / 2
    tv = np.linalg.norm(sh - hip, axis=1)[hipok & shok]
    S = max((float(np.median(tv)) if len(tv) else 0.5) or 0.5, 0.05)
    raw = np.full((T, 48), np.nan)
    rel = (J[:, :, :3] - hip[:, None, :]) / S
    ok = seen & hipok[:, None]
    relm = np.where(ok[:, :, None], rel, np.nan)
    raw[:, :39] = relm.reshape(T, 39)
    for a, (p, q, r) in enumerate(ANG):
        u = J[:, p, :3] - J[:, q, :3]
        v = J[:, r, :3] - J[:, q, :3]
        nu = np.linalg.norm(u, axis=1)
        nv = np.linalg.norm(v, axis=1)
        good = seen[:, p] & seen[:, q] & seen[:, r] & (nu >= 1e-6) & (nv >= 1e-6) & hipok
        with np.errstate(invalid='ignore', divide='ignore'):
            c = np.clip((u * v).sum(1) / (nu * nv), -1, 1)
        raw[:, 39 + a] = np.where(good, np.arccos(c) / np.pi, np.nan)
    d = sh - hip
    n = np.linalg.norm(d, axis=1)
    good = hipok & shok & (n > 1e-6)
    with np.errstate(invalid='ignore', divide='ignore'):
        raw[:, 47] = np.where(good, np.arccos(np.clip(-d[:, 1] / n, -1, 1)) / np.pi, np.nan)
    out = np.zeros((T, F), np.float32)
    for c in range(48):
        col = raw[:, c]
        m = ~np.isnan(col)
        if not m.any():
            continue
        med = np.median(col[m])
        sp = max(1.4826 * np.median(np.abs(col[m] - med)), 0.05)
        out[m, c] = col[m] - med
        out[m, 48 + c] = (col[m] - med) / sp
    out[:, 96:109] = seen
    out[:, 109] = ~seen.any(1)
    if P is None:
        return out
    return np.concatenate([out, progress_features(P)], 1)


PROGRESS_CLIP = 2.0


def progress_features(P):
    """(T, 2) float32, as data.js progressFeatures: p minus its median over the frames where it is finite, clipped to
    [-2, 2], 0 where absent; and 1 where p is finite."""
    P = np.asarray(P, np.float32).astype(np.float64)
    fin = np.isfinite(P)
    out = np.zeros((len(P), 2), np.float32)
    if fin.any():
        out[fin, 0] = np.clip(P[fin] - np.median(P[fin]), -PROGRESS_CLIP, PROGRESS_CLIP)
    out[:, 1] = fin
    return out


# ---------------------------------------------------------------- targets
def targets(T, bounds):
    """Per frame: rate (reps/s), sin, cos, active, phase mask. Frames k with s <= k < e belong to the rep."""
    rate = np.zeros(T, np.float32)
    sc = np.zeros((T, 2), np.float32)
    act = np.zeros(T, np.float32)
    for s, e in bounds:
        k0, k1 = max(0, int(math.ceil(s))), min(T, int(math.ceil(e)))
        if k1 <= k0:
            continue
        k = np.arange(k0, k1)
        rate[k0:k1] = HZ / (k1 - k0)
        ph = (k - s) / max(e - s, 1e-6)
        sc[k0:k1, 0] = np.sin(2 * np.pi * ph)
        sc[k0:k1, 1] = np.cos(2 * np.pi * ph)
        act[k0:k1] = 1
    return rate, sc, act


# ---------------------------------------------------------------- augmentation (on joints)
def rotate_mirror(J, rng):
    J = J.copy()
    th = rng.uniform(-np.pi / 2, np.pi / 2)
    c, s = np.cos(th), np.sin(th)
    x, z = J[:, :, 0].copy(), J[:, :, 2].copy()
    J[:, :, 0] = c * x - s * z
    J[:, :, 2] = s * x + c * z
    if rng.random() < 0.5:
        J = J[:, MIRROR]
        J[:, :, 0] *= -1
    J[:, :, :3] *= J[:, :, 3:4]
    return J


def stretch(J, bounds, f, P=None):
    T = J.shape[0]
    T2 = max(2, int(round(T / f)))
    src = np.minimum(np.round(np.arange(T2) * f).astype(int), T - 1)
    return J[src], (None if bounds is None else [(s / f, e / f) for s, e in bounds]), (None if P is None else P[src])


def jitter(J, rng, sd=0.006):
    J = J.copy()
    J[:, :, :3] += rng.normal(0, sd, J[:, :, :3].shape) * J[:, :, 3:4]
    return J


def dropout(J, rng, P=None):
    J = J.copy()
    P = None if P is None else P.copy()
    T = J.shape[0]
    for _ in range(rng.integers(1, 4)):
        L = int(rng.integers(2, 16))
        a = int(rng.integers(0, max(1, T - L)))
        J[a:a + L] = 0
        if P is not None and L > 8:
            P[a:a + L] = np.nan
    return J, P


def repeat_rep(J, bounds, rng, P=None):
    """One labelled rep repeated 2-30 times (RepCount-A counts reach the 30s and beyond): per-copy warp 0.6-1.5, amplitude 0.8-1.15 around its first frame,
    pauses at rest (p 0.25, up to 1.5 s), still lead-in and tail from the set's own frames before its first rep / after
    its last (or the rep's first frame held). Count = copies. P (progress, or None) follows the same frames, a copy's
    scaled by the same amplitude around the rep's first frame. Returns (J, bounds, P) or None."""
    i = int(rng.integers(0, len(bounds)))
    s, e = bounds[i]
    k0, k1 = max(0, int(math.ceil(s))), min(J.shape[0], int(math.ceil(e)))
    if k1 - k0 < 6:
        return None
    rep = J[k0:k1]
    first = rep[0]
    prep = None if P is None else P[k0:k1]

    def held(k, n):
        return None if P is None else np.repeat(P[k:k + 1], n)
    N = int(rng.integers(2, 31))
    parts, pparts, bnd, t = [], [], [], 0.0
    lead_end = max(0, int(bounds[0][0]))
    if lead_end > 3 and rng.random() < 0.6:
        L = int(rng.integers(1, min(lead_end, 3 * HZ) + 1))
        parts.append(J[lead_end - L:lead_end])
        pparts.append(None if P is None else P[lead_end - L:lead_end])
    else:
        n = int(rng.integers(0, 2 * HZ + 1))
        parts.append(np.repeat(first[None], n, 0))
        pparts.append(held(k0, n))
    t = sum(len(p) for p in parts)
    for _ in range(N):
        if rng.random() < 0.25:
            n = int(rng.integers(2, int(1.5 * HZ)))
            parts.append(np.repeat(first[None], n, 0))
            pparts.append(held(k0, n))
            t += n
        w = rng.uniform(0.6, 1.5)
        L = max(4, int(round(len(rep) * w)))
        src = np.minimum((np.arange(L) * len(rep) / L).astype(int), len(rep) - 1)
        r = rep[src].copy()
        a = rng.uniform(0.8, 1.15)
        both = (r[:, :, 3] > 0) & (first[None, :, 3] > 0)
        r[:, :, :3] = np.where(both[:, :, None], first[None, :, :3] + a * (r[:, :, :3] - first[None, :, :3]), r[:, :, :3])
        parts.append(r)
        if P is not None:
            pr = prep[src]
            pparts.append(pr if not np.isfinite(prep[0]) else (prep[0] + a * (pr - prep[0])).astype(np.float32))
        bnd.append((t, t + L))
        t += L
    tail_start = min(J.shape[0], int(math.ceil(bounds[-1][1])))
    if J.shape[0] - tail_start > 3 and rng.random() < 0.6:
        L = int(rng.integers(1, min(J.shape[0] - tail_start, 3 * HZ) + 1))
        parts.append(J[tail_start:tail_start + L])
        pparts.append(None if P is None else P[tail_start:tail_start + L])
    else:
        n = int(rng.integers(0, 2 * HZ + 1))
        parts.append(np.repeat(rep[-1][None], n, 0))
        pparts.append(held(k1 - 1, n))
    return np.concatenate(parts, 0), bnd, (None if P is None else np.concatenate(pparts, 0))


def crop_reps(J, bounds, rng, P=None):
    """A natural set cut at rep boundaries: reps i..j with up to 2 s around them (never into a neighbouring rep).
    Returns (J, bounds, P) or None."""
    n = len(bounds)
    i = int(rng.integers(0, n))
    j = int(rng.integers(i, n))
    s, e = bounds[i][0], bounds[j][1]
    lo = bounds[i - 1][1] if i > 0 else 0
    hi = bounds[j + 1][0] if j + 1 < n else J.shape[0]
    a = int(max(0, math.ceil(max(lo, s - rng.uniform(0, 2 * HZ)))))
    b = int(min(J.shape[0], math.floor(min(hi, e + rng.uniform(0, 2 * HZ)))))
    if b - a < 10:
        return None
    return J[a:b], [(p - a, q - a) for p, q in bounds[i:j + 1]], (None if P is None else P[a:b])


# ---------------------------------------------------------------- model
def init(rng, F=F):
    P = {'Win': rng.normal(0, math.sqrt(2 / F), (F, C)), 'bin': np.zeros(C)}
    for l in range(len(DIL)):
        P[f'Wd{l}'] = rng.normal(0, math.sqrt(2 / (3 * C)), (3 * C, C))
        P[f'bd{l}'] = np.zeros(C)
        P[f'Wp{l}'] = rng.normal(0, 0.1 * math.sqrt(1 / C), (C, C))
        P[f'bp{l}'] = np.zeros(C)
    P['Wh'] = rng.normal(0, math.sqrt(1 / C) * 0.5, (C, 4))
    P['bh'] = np.array([-1.0, 0, 0, 0])
    return {k: v.astype(np.float32) for k, v in P.items()}


def shift(h, d):
    """out[t] = h[t - d] (zeros outside)."""
    out = np.zeros_like(h)
    if d > 0:
        out[d:] = h[:-d]
    elif d < 0:
        out[:d] = h[-d:]
    else:
        out[:] = h
    return out


def forward(P, X, m):
    cache = []
    u0 = X @ P['Win'] + P['bin']
    h = np.maximum(u0, 0) * m
    cache.append(u0)
    for l, d in enumerate(DIL):
        xc = np.concatenate([shift(h, d), h, shift(h, -d)], 1)
        u = xc @ P[f'Wd{l}'] + P[f'bd{l}']
        a = np.maximum(u, 0) * m
        h = h + (a @ P[f'Wp{l}'] + P[f'bp{l}']) * m
        cache.append((xc, u, a))
    o = h @ P['Wh'] + P['bh']
    cache.append(h)
    return o, cache


def backward(P, X, m, cache, do):
    G = {}
    h = cache[-1]
    G['Wh'] = h.T @ do
    G['bh'] = do.sum(0)
    dh = do @ P['Wh'].T
    for l in reversed(range(len(DIL))):
        d = DIL[l]
        xc, u, a = cache[1 + l]
        dr = dh * m
        G[f'Wp{l}'] = a.T @ dr
        G[f'bp{l}'] = dr.sum(0)
        da = dr @ P[f'Wp{l}'].T
        du = da * m * (u > 0)
        G[f'Wd{l}'] = xc.T @ du
        G[f'bd{l}'] = du.sum(0)
        dxc = du @ P[f'Wd{l}'].T
        dh = dh + shift(dxc[:, :C], -d) + dxc[:, C:2 * C] + shift(dxc[:, 2 * C:], d)
    u0 = cache[0]
    du0 = dh * m * (u0 > 0)
    G['Win'] = X.T @ du0
    G['bin'] = du0.sum(0)
    return G


def softplus(x):
    return np.logaddexp(0, x)


def sigmoid(x):
    return 0.5 * (1 + np.tanh(0.5 * x))


def loss_and_grad(o, segs, W):
    """o: (T, 4) outputs of a packed batch; segs: list of (a, b, label, rate, sc, act, has_bounds)."""
    do = np.zeros_like(o)
    L = 0.0
    for (a, b, N, rate, sc, act, hb) in segs:
        oo = o[a:b]
        z = softplus(oo[:, 0])
        dz = sigmoid(oo[:, 0])
        cnt = z.sum() / HZ
        r = cnt - N
        # smooth L1 on the count, beta 0.5 rep
        g = r / 0.5 if abs(r) < 0.5 else np.sign(r)
        L += W['count'] * (0.5 * r * r / 0.5 if abs(r) < 0.5 else abs(r) - 0.25)
        do[a:b, 0] += W['count'] * g * dz / HZ
        if hb:
            T = b - a
            e = z - rate
            L += W['rate'] * (e * e).mean()
            do[a:b, 0] += W['rate'] * 2 * e / T * dz
            p = sigmoid(oo[:, 3])
            L += W['act'] * -(act * np.log(p + 1e-7) + (1 - act) * np.log(1 - p + 1e-7)).mean()
            do[a:b, 3] += W['act'] * (p - act) / T
            na = max(act.sum(), 1)
            ep = (oo[:, 1:3] - sc) * act[:, None]
            L += W['phase'] * (ep * ep).sum() / na
            do[a:b, 1:3] += W['phase'] * 2 * ep / na
    return L, do


# ---------------------------------------------------------------- readouts (mirror in model.js)
def readouts(o):
    z = softplus(o[:, 0])
    dens = float(z.sum() / HZ)
    p = sigmoid(o[:, 3])
    ang = (np.arctan2(o[:, 1], o[:, 2]) / (2 * np.pi)) % 1.0
    count_ph, u, prev, active_frames = 0, None, None, 0
    total = 0
    for t in range(len(o)):
        if p[t] > 0.5:
            active_frames += 1
            if u is None:
                u = ang[t]
                start = u
            else:
                dlt = ang[t] - prev
                dlt -= math.floor(dlt + 0.5)
                u += dlt
            prev = ang[t]
        else:
            if u is not None:
                total += math.floor(u - 0.5) - math.floor(start - 0.5)
            u = None
    if u is not None:
        total += math.floor(u - 0.5) - math.floor(start - 0.5)
    return {'density': int(math.floor(dens + 0.5)), 'densityRaw': dens, 'phase': int(max(0, total)), 'activeShare': active_frames / max(1, len(o))}


# ---------------------------------------------------------------- data
def load(folder, prog=False):
    ix = json.load(open(os.path.join(folder, 'index.json')))
    allj = np.fromfile(os.path.join(folder, 'joints.f32'), dtype=np.float32)
    allp = None
    if prog:
        if not os.path.exists(os.path.join(folder, 'progress.f32')) or any('progress' not in e for e in ix):
            sys.exit(f'{folder}: no progress channel (export with LPHASE_PROGRESS=1)')
        allp = np.fromfile(os.path.join(folder, 'progress.f32'), dtype=np.float32)
    for e in ix:
        e['J'] = allj[e['offset']:e['offset'] + e['T'] * NJ * 4].reshape(e['T'], NJ, 4)
        e['bounds'] = [tuple(b) for b in e['bounds']] if e['bounds'] else None
        e['P'] = None if allp is None else allp[e['progress']:e['progress'] + e['T']]
    return ix


def make_sample(e, rng, aug=True):
    """The progress input rides along when the set carries it (load(prog=True)), with the same random draws."""
    J, bounds, N, P = e['J'], e['bounds'], e['label'], e['P']
    if aug and bounds:
        u = rng.random()
        if u < 0.35:
            r = repeat_rep(J, bounds, rng, P)
            if r is not None:
                J, bounds, P = r
                N = len(bounds)
        elif u < 0.55:
            r = crop_reps(J, bounds, rng, P)
            if r is not None:
                J, bounds, P = r
                N = len(bounds)
    if aug and not bounds and rng.random() < 0.4:
        # a count-only clip (Countix, MM-Fit) held still 0-3 s at each end, as a recording that starts and ends at
        # rest: holding a pose adds no rep, so the count stands
        a0, a1 = int(rng.integers(0, 3 * HZ + 1)), int(rng.integers(0, 3 * HZ + 1))
        J = np.concatenate([np.repeat(J[:1], a0, 0), J, np.repeat(J[-1:], a1, 0)], 0)
        if P is not None:
            P = np.concatenate([np.repeat(P[:1], a0), P, np.repeat(P[-1:], a1)])
    if aug:
        if rng.random() < 0.5:
            J, bounds, P = stretch(J, bounds, rng.uniform(0.6, 1.5), P)
        J = rotate_mirror(J, rng)
        J = jitter(J, rng)
        if rng.random() < 0.3:
            J, P = dropout(J, rng, P)
    X = features(J, P)
    T = X.shape[0]
    if bounds:
        rate, sc, act = targets(T, bounds)
    else:
        rate, sc, act = np.zeros(T, np.float32), np.zeros((T, 2), np.float32), np.zeros(T, np.float32)
    return X, N, rate, sc, act, bool(bounds)


def pack(samples):
    T = sum(s[0].shape[0] for s in samples) + GAP * (len(samples) + 1)
    X = np.zeros((T, samples[0][0].shape[1]), np.float32)
    m = np.zeros((T, 1), np.float32)
    segs, t = [], GAP
    for (x, N, rate, sc, act, hb) in samples:
        n = x.shape[0]
        X[t:t + n] = x
        m[t:t + n] = 1
        segs.append((t, t + n, N, rate, sc, act, hb))
        t += n + GAP
    return X, m, segs


def predict(P, x):
    m = np.ones((x.shape[0], 1), np.float32)
    o, _ = forward(P, x, m)
    return o


def train(items, rng, epochs, W, log, max_frames=6000, lr=2e-3, n_in=F):
    P = init(rng, n_in)
    M = {k: np.zeros_like(v) for k, v in P.items()}
    V = {k: np.zeros_like(v) for k, v in P.items()}
    step = 0
    # sets with rep bounds appear twice per epoch (natural + one constructed draw)
    pool = items + [e for e in items if e['bounds']]
    total_steps = epochs * max(1, sum(min(e['T'], 1200) for e in pool) // max_frames + 1)
    t0 = time.time()
    for ep in range(epochs):
        order = rng.permutation(len(pool))
        batch, fr, Ls = [], 0, []
        for n, i in enumerate(order):
            e = pool[i]
            s = make_sample(e, rng, aug=True)
            if s[0].shape[0] > 1500:
                continue
            batch.append(s)
            fr += s[0].shape[0] + GAP
            if fr >= max_frames or n == len(order) - 1:
                X, m, segs = pack(batch)
                o, cache = forward(P, X, m)
                L, do = loss_and_grad(o, segs, W)
                G = backward(P, X, m, cache, do / len(batch))
                step += 1
                lr_t = lr * 0.5 * (1 + math.cos(math.pi * min(1.0, step / total_steps)))
                for k in P:
                    g = G[k].astype(np.float32) + 1e-4 * P[k]
                    M[k] = 0.9 * M[k] + 0.1 * g
                    V[k] = 0.999 * V[k] + 0.001 * g * g
                    mh = M[k] / (1 - 0.9 ** step)
                    vh = V[k] / (1 - 0.999 ** step)
                    P[k] -= lr_t * mh / (np.sqrt(vh) + 1e-8)
                Ls.append(L / len(batch))
                batch, fr = [], 0
        log(f'  epoch {ep + 1}/{epochs} loss {np.mean(Ls):.4f} ({time.time() - t0:.0f} s)')
    return P


def to_json(P, meta):
    out = {'meta': meta, 'dil': DIL, 'C': C, 'F': int(P['Win'].shape[0]), 'tensors': {}}
    if meta.get('input', 'pose') != 'pose':
        out['input'] = meta['input']
    for k, v in P.items():
        h = v.astype(np.float16)
        out['tensors'][k] = {'shape': list(v.shape), 'f16': base64.b64encode(h.tobytes()).decode()}
    return out


def from_json(d):
    return {k: np.frombuffer(base64.b64decode(t['f16']), dtype=np.float16).astype(np.float32).reshape(t['shape']) for k, t in d['tensors'].items()}


def fixture(src, model_path, out_path, T=40):
    """A small parity fixture for learned-phase-unit.test.ts: one synthetic set's first T frames of joints, the
    features and the model outputs train.py computes for them. For a progress-input model (fixture-progress.json): also
    the set's progress (null where absent: the missing stretch; two frames beyond the clip) and the model itself."""
    mj = json.load(open(model_path))
    prog = mj.get('input', 'pose') == 'progress'
    ix = load(src, prog)
    e = next(x for x in ix if x['suite'] == 'synthetic' and (not prog or np.isfinite(x['P'][:T]).all()))
    J = e['J'][:T].copy()
    J[5:9, 4] = 0  # a joint unseen for a few frames
    J[20:22] = 0   # a missing stretch
    Pg = None
    if prog:
        Pg = e['P'][:T].copy()
        Pg[20:22] = np.nan
        Pg[30:32] = [9.0, -9.0]  # beyond the clip
    P = from_json(mj)
    X = features(J, Pg)
    o = predict(P, X)
    out = {'name': e['name'], 'T': T, 'joints': [round(float(v), 6) for v in J.reshape(-1)],
           'features': [round(float(v), 5) for v in X.reshape(-1)], 'outputs': [round(float(v), 5) for v in o.reshape(-1)]}
    if prog:
        out['progress'] = [round(float(v), 6) if np.isfinite(v) else None for v in Pg]
        out['model'] = mj
    json.dump(out, open(out_path, 'w'))


def main():
    if sys.argv[1] == '--fixture':
        return fixture(sys.argv[2], sys.argv[3], sys.argv[4])
    src, out = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    epochs = int(args[args.index('--epochs') + 1]) if '--epochs' in args else 30
    seed = int(args[args.index('--seed') + 1]) if '--seed' in args else 1
    folds = (args[args.index('--folds') + 1] if '--folds' in args else '0,1,all').split(',')
    prog = '--progress' in args
    W = {'count': 1.0, 'rate': 0.5, 'act': 0.5, 'phase': 0.5}
    os.makedirs(out, exist_ok=True)
    ix = load(src, prog)
    logf = open(os.path.join(out, 'train.log'), 'a')

    def log(s):
        print(s, flush=True)
        logf.write(s + '\n')
        logf.flush()
    if '--val' in args:
        # design choices are made on a fifth of the RepCount-A train split held out (never on the eval sets)
        import hashlib
        for e in ix:
            if e['role'] == 'train' and int(hashlib.sha256(e['name'].encode()).hexdigest()[0], 16) < 3:
                e['role'], e['suite'] = 'eval', 'repcount-trainval'
        ix = [e for e in ix if e['suite'] != 'repcount']
    for fold in folds:
        rng = np.random.default_rng(seed)
        if fold == 'all':
            tr = [e for e in ix if e['role'] == 'train' or e['role'] == 'cv']
            ev = [e for e in ix if e['role'] == 'eval']
        else:
            f = int(fold)
            tr = [e for e in ix if e['role'] == 'train' or (e['role'] == 'cv' and e['fold'] != f)]
            ev = [e for e in ix if e['role'] == 'eval' or (e['role'] == 'cv' and e['fold'] == f)]
        log(f'fold {fold}: train {len(tr)} sets ({sum(e["T"] for e in tr)} frames, {sum(1 for e in tr if e["bounds"])} with rep bounds), held out {len(ev)}; epochs {epochs}, seed {seed}'
            + (f'; progress input, {sum(1 for e in tr if e.get("spec"))} training sets with a spec' if prog else ''))
        P = train(tr, rng, epochs, W, log, n_in=F + 2 if prog else F)
        meta = {'fold': fold, 'epochs': epochs, 'seed': seed, 'trainSets': len(tr), 'weights': W,
                'trainSuites': sorted(set(e['suite'] for e in tr))}
        if prog:
            meta['input'] = 'progress'
        json.dump(to_json(P, meta), open(os.path.join(out, f'model-{fold}.json'), 'w'))
        res = []
        for e in ev:
            o = predict(P, features(e['J'], e['P']))
            r = readouts(o)
            res.append({'name': e['name'], 'suite': e['suite'], 'cls': e['cls'], 'label': e['label'], 'role': e['role'], **r})
        json.dump(res, open(os.path.join(out, f'eval-{fold}.json'), 'w'))
        for suite in sorted(set(r['suite'] for r in res)):
            rs = [r for r in res if r['suite'] == suite]
            for k in ['density', 'phase']:
                ex = sum(r[k] == r['label'] for r in rs)
                w1 = sum(abs(r[k] - r['label']) <= 1 for r in rs)
                o3 = sum(abs(r[k] - r['label']) >= 3 for r in rs)
                log(f'  {suite:10s} {k:8s} n {len(rs):4d} exact {ex:4d} within1 {w1:4d} off3+ {o3:4d}')


if __name__ == '__main__':
    main()
