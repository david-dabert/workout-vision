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
print('objective checks passed')
