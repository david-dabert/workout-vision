"""
python3 scripts/ml/test_objective.py
The objective is checked before any training run (PLAN.md, the learned counter's release gate):
- density during a known still hold raises the loss;
- density in a stretch of unknown content (outside a labelled window) leaves it unchanged;
- an inserted hold is marked known, with no rep added, and unknown footage stays unknown.
"""
import os
import sys

import jax.numpy as jnp
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from train import count_loss, held, init, lengthen, predict  # noqa: E402
import jax

# One set of 30 samples: 10 unknown, 10 labelled with 2 reps, 10 of an inserted hold.
inside = jnp.array([[0.0] * 10 + [1.0] * 10 + [1.0] * 10])
base = jnp.array([[0.0] * 10 + [0.2] * 10 + [0.0] * 10])  # sums to the label, 2
count = jnp.array([2.0])
l0, _ = count_loss(base, inside, count)
assert float(l0) < 1e-5, l0
more_in_hold = base.at[0, 25].add(0.5)
l1, _ = count_loss(more_in_hold, inside, count)
assert float(l1) > float(l0), 'density during a known hold must raise the loss'
more_unknown = base.at[0, 5].add(0.5)
l2, _ = count_loss(more_unknown, inside, count)
assert abs(float(l2) - float(l0)) < 1e-7, 'density in unknown footage must not change the loss'

# lengthen: holds known and adding no rep; the set's own unknown samples stay unknown.
s = dict(pos=np.zeros((20, 12, 3), np.float32), seen=np.ones(20, np.float32),
         inside=np.array([0] * 5 + [1] * 10 + [0] * 5, np.float32), count=3, lift='squat')
rng = np.random.default_rng(0)
for _ in range(50):
    out = lengthen(s, [s], rng)
    n_extra = len(out['pos']) - 20 * (out['count'] // 3)
    assert out['count'] % 3 == 0
    assert out['inside'].sum() == 10 * (out['count'] // 3) + n_extra, 'every inserted sample is known, the set keeps its unknown samples'
# Two sets joined: the second set's own unknown footage stays unknown too.
t = dict(s, inside=np.array([0] * 8 + [1] * 12, np.float32), count=2)
for _ in range(50):
    out = lengthen(s, [s, t], rng)
    assert out['inside'].sum() <= len(out['pos'])
    if out['count'] == 5:
        assert out['inside'].sum() == 22 + (len(out['pos']) - 40)

# The held score sums every sample, as the app does, over the clip cut to its window with its holds.
p = init(jax.random.PRNGKey(0))
p['out_w'] = p['out_w'] * 0
p['out_b'] = p['out_b'] * 0 + float(np.log(np.exp(0.1) - 1))
c = dict(pos=np.random.default_rng(1).normal(size=(60, 12, 3)).astype(np.float32), seen=np.ones(60, np.float32),
         inside=np.array([0] * 20 + [1] * 20 + [0] * 20, np.float32), count=2, lift='squat', name='x')
h = held(c)
assert len(h['pos']) == 20 + 60 and h['inside'].all()
assert abs(predict(p, [h])[0] - 0.1 * len(h['pos'])) < 1e-3, 'the held score must sum every sample'
# One timebase: a ramp decoded at 10 per second comes out at 15 per second on the same line; a set already
# at 15 comes out unchanged; a sample next to an unseen one is unseen.
import data  # noqa: E402
t10 = np.arange(0, 2.0001, 0.1)
ramp = np.zeros((len(t10), 12, 3), np.float32); ramp[:, 0, 0] = t10
pos15, seen15, g = data.on_timebase(ramp, np.ones(len(t10), np.float32), t10)
assert len(g) == 31 and np.allclose(pos15[:, 0, 0], g, atol=1e-5)
t15 = np.arange(0, 2.0001, 1 / 15)
same, _, g2 = data.on_timebase(np.random.default_rng(2).normal(size=(len(t15), 12, 3)).astype(np.float32), np.ones(len(t15), np.float32), t15)
assert len(g2) == len(t15)
mask = np.ones(len(t10), np.float32); mask[5] = 0
_, seen_m, _ = data.on_timebase(ramp, mask, t10)
assert seen_m[np.argmin(np.abs(g - 0.45))] == 0
# A set already at 15 per second keeps its own seen flags, with float64 or float32 timestamps.
for dt in (np.float64, np.float32):
    t = np.arange(0, 2.0001, 1 / 15).astype(dt); m = np.ones(len(t), np.float32); m[[10, 20]] = 0
    _, sm, _ = data.on_timebase(np.zeros((len(t), 12, 3), np.float32), m, t)
    assert len(sm) == len(m) and (sm == m).all(), (dt, np.flatnonzero(sm == 0))

# load() with TIMEBASE=1: a 10 per second file comes out at 15 per second, its window recomputed on the grid.
import gzip, json, tempfile  # noqa: E401,E402
tmp = tempfile.mkdtemp()
os.makedirs(os.path.join(tmp, 'public', 'fx', 'build'))
frame = [{'x': 0.0, 'y': 0.0, 'z': 0.0, 'visibility': 1.0}] * 33
frame = [dict(p, x=0.01 * i, y=0.02 * i) for i, p in enumerate(frame)]
json.dump({'lift': 'squat', 'count': 2, 'window': [0.5, 1.5], 'id': 'fx', 'worldLandmarks': [frame] * 21,
           'timestamps': [round(0.1 * i, 3) for i in range(21)]}, gzip.open(os.path.join(tmp, 'public', 'fx', 'build', 'fx.json.gz'), 'wt'))
root = data.ROOT
data.ROOT = tmp
os.environ['TIMEBASE'] = '1'
fx = data.load('fx')[0]
os.environ['TIMEBASE'] = '0'
data.ROOT = root
assert len(fx['pos']) == 31, len(fx['pos'])
grid = np.arange(0, 2.0 + 1e-9, 1 / 15)
assert fx['inside'].sum() == ((grid >= 0.5) & (grid <= 1.5)).sum(), fx['inside'].sum()
print('objective checks passed')
