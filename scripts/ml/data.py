"""
The learned counter's data: public labelled sets and David's own, turned into one feature sequence per set.

Features, per sample (the app samples at 15 per second; some public sets were decoded at other rates, which
the training's time-stretch partly covers): the 12 joints of the shoulders, elbows, wrists, hips, knees and
ankles, in the pose model's 3D world coordinates, relative to the mid-hip and in torso lengths
(36 values), then each channel centred and scaled over its set, so the camera's distance and angle weigh
less. A sample with no pose repeats the last one seen, and a mask channel says so. The same features are
computed in the app by src/lib/counting/learned.ts; learned.test.ts checks that both give the same count
on David's sets (learned-parity.json), which a feature difference would change.
"""
import glob
import gzip
import json
import os

import numpy as np

JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
MIRROR = [1, 0, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10]  # the same joints, left for right
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'test', 'real-phone')


def positions(frames):
    """(T, 12, 3) positions relative to the mid-hip in torso lengths, and a (T,) mask of samples seen."""
    t = len(frames)
    out = np.zeros((t, 12, 3), np.float32)
    seen = np.zeros(t, np.float32)
    last = None
    for i, f in enumerate(frames):
        ok = f is not None and all(f[j] is not None for j in JOINTS)
        if ok:
            p = np.array([[f[j]['x'], f[j]['y'], f[j]['z']] for j in JOINTS], np.float32)
            hip = (p[6] + p[7]) / 2
            sh = (p[0] + p[1]) / 2
            torso = float(np.linalg.norm(sh - hip)) or 1.0
            last = (p - hip) / torso
            seen[i] = 1
        if last is not None:
            out[i] = last
    # Samples before the first pose take the first one seen.
    first = int(np.argmax(seen)) if seen.any() else 0
    out[:first] = out[first]
    return out, seen


# NORM=body (review of 30 September): no per-set rescaling, which can amplify the noise of a nearly still
# body; the positions, already in torso lengths relative to the mid-hip, are divided by one fixed scale per
# channel, taken over the training sets (set_body_scale). Off by default until measured.
BODY_SCALE = None


def set_body_scale(sets):
    """One scale per joint for the horizontal plane (x and z share it, so turning the camera about the
    vertical axis does not change a feature's size) and one for the vertical axis (y), over the training
    sets' seen samples (review of 30 September)."""
    global BODY_SCALE
    p = np.concatenate([s['pos'][s['seen'] > 0] for s in sets])  # (N, 12, 3)
    horizontal = np.sqrt((p[:, :, 0].var(0) + p[:, :, 2].var(0)) / 2)
    vertical = p[:, :, 1].std(0)
    BODY_SCALE = (np.stack([horizontal, vertical, horizontal], 1).reshape(-1) + 1e-3).astype(np.float32)


def norm_mode():
    """NORM: unset or 'set' for per-set standardisation, 'body' for the fixed body scale; anything else stops."""
    v = os.environ.get('NORM', 'set')
    if v not in ('set', 'body'):
        raise SystemExit(f'NORM takes set or body, not {v!r}')
    return v


def features(pos, seen):
    """(T, 37): the 36 position channels centred and scaled over the set (or, with NORM=body, divided by the
    fixed training scale), then the mask."""
    x = pos.reshape(len(pos), -1)
    if norm_mode() == 'body':
        # Clipped: a frame with a nearly collapsed torso length would otherwise reach tens of units.
        return np.concatenate([np.clip(x / BODY_SCALE, -10, 10), seen[:, None]], 1).astype(np.float32)
    m = seen.astype(bool)
    ref = x[m] if m.any() else x
    mu = ref.mean(0)
    sd = ref.std(0) + 1e-3
    return np.concatenate([(x - mu) / sd, seen[:, None]], 1).astype(np.float32)


def on_timebase(pos, seen, ts, rate=15.0):
    """A set moved onto one timebase, `rate` samples per second from its first timestamp: each position
    interpolated linearly between the two samples around it, a sample seen only if both of them were
    (review of 30 September: the public clips were decoded at 8 to 20 per second; the app samples at 15).
    Returns positions, seen mask and the new timestamps."""
    ts = np.asarray(ts, np.float64)
    grid = np.arange(ts[0], ts[-1] + 1e-9, 1.0 / rate)
    j = np.clip(np.searchsorted(ts, grid, side='right') - 1, 0, len(ts) - 1)
    k = np.clip(j + 1, 0, len(ts) - 1)
    span = np.where(ts[k] > ts[j], ts[k] - ts[j], 1.0)
    w = np.clip((grid - ts[j]) / span, 0, 1)[:, None, None].astype(np.float32)
    out = pos[j] * (1 - w) + pos[k] * w
    # A grid point on an original sample (within a thousandth of the gap, for float32 timestamps) takes that
    # sample's own flag; between two samples, both must have been seen (review of 30 September).
    wf = w[:, 0, 0]
    ok = np.where(wf < 1e-3, seen[j] > 0, np.where(wf > 1 - 1e-3, seen[k] > 0, (seen[j] > 0) & (seen[k] > 0)))
    return out.astype(np.float32), ok.astype(np.float32), grid.astype(np.float32)


def load(dataset, split='build'):
    """Sets of one public dataset's half: features, label, the sample range the label covers, lift, id, group."""
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'public', dataset, split, '*.json.gz'))):
        d = json.load(gzip.open(f))
        if d.get('admitted') is False:
            continue
        pos, seen = positions(d['worldLandmarks'])
        ts = np.array(d['timestamps'], np.float32)
        if os.environ.get('TIMEBASE', '0') == '1':
            pos, seen, ts = on_timebase(pos, seen, ts)
        w = d.get('window') or [0, float(ts[-1]) + 1]
        inside = (ts >= w[0]) & (ts <= w[1])
        out.append(dict(pos=pos, seen=seen, count=d['count'], inside=inside.astype(np.float32), lift=d['lift'],
                        id=d['id'], group=d['id'].split('_0')[0] if dataset.startswith('countix') else d['id'], name=f))
    return out


def load_david():
    """David's own labelled sets (sets-*/ and landmarks/): never trained on, only measured."""
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'sets-*', '*.json.gz')) + glob.glob(os.path.join(ROOT, 'landmarks', '*.json.gz'))):
        d = json.load(gzip.open(f))
        name = os.path.basename(f)
        import re
        m = re.match(r'^(?:set\d+_)?(.+?)_(\d+)_', name)
        lift = d.get('lift') or m.group(1)
        count = d.get('count') if d.get('count') is not None else int(m.group(2))
        pos, seen = positions(d['worldLandmarks'])
        out.append(dict(pos=pos, seen=seen, count=count, inside=np.ones(len(pos), np.float32), lift=lift, id=name, group=name, name=f))
    return out
