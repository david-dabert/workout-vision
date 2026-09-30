"""
python3 scripts/ml/train.py cv        five-fold cross-validation on the public build half, by video
python3 scripts/ml/train.py fit       train on the whole build half, write src/lib/counting/learned-weights.json

A small temporal network over the pose sequence (scripts/ml/data.py): residual dilated 1D convolutions,
each sample's output a rep density, the count their sum over the samples the label covers. It learns from
counts alone (no rep marks), with augmentations the counting must not depend on: a slower or faster set,
left for right, the camera turned about the body's vertical axis, and noise. The held-out half and David's
sets are never trained on.

Both runs are deterministic (seed 0), with the committed model's settings by default: 3000 steps, no
lengthening. LENGTHEN=1 adds the hold and join augmentations (measured and not kept); TAG=<name> with fit
writes only test/real-phone/accuracy/learned-david-<name>.txt and leaves the app's weights untouched.
"""
import json
import math
import os
import sys

import jax
import jax.numpy as jnp
import numpy as np
import optax

sys.path.insert(0, os.path.dirname(__file__))
import data  # noqa: E402

HERE = os.path.dirname(__file__)
REPO = os.path.join(HERE, '..', '..')
CH, K, DIL = 32, 5, [1, 2, 4, 8, 16, 1]
IN = 37


def init(key):
    ks = jax.random.split(key, len(DIL) * 2 + 2)
    p = {'in_w': jax.random.normal(ks[0], (1, IN, CH)) * (1 / math.sqrt(IN)), 'in_b': jnp.zeros(CH), 'blocks': []}
    for i, _ in enumerate(DIL):
        p['blocks'].append({'w': jax.random.normal(ks[2 * i + 1], (K, CH, CH)) * (1 / math.sqrt(K * CH)), 'b': jnp.zeros(CH),
                            'w2': jax.random.normal(ks[2 * i + 2], (1, CH, CH)) * (1 / math.sqrt(CH)), 'b2': jnp.zeros(CH)})
    p['out_w'] = jax.random.normal(ks[-1], (1, CH, 1)) * 0.01
    p['out_b'] = jnp.full(1, -2.0)
    return p


def conv(x, w, b, dil=1):
    # x (B, T, C_in), w (K, C_in, C_out): 'same' padding, causal-free.
    y = jax.lax.conv_general_dilated(x, w, (1,), 'SAME', rhs_dilation=(dil,), dimension_numbers=('NWC', 'WIO', 'NWC'))
    return y + b


def forward(p, x):
    h = conv(x, p['in_w'], p['in_b'])
    for blk, d in zip(p['blocks'], DIL):
        r = jax.nn.gelu(conv(h, blk['w'], blk['b'], d))
        h = h + conv(r, blk['w2'], blk['b2'])
    return jax.nn.softplus(conv(jax.nn.gelu(h), p['out_w'], p['out_b'])[..., 0])  # (B, T) density


def loss_fn(p, x, inside, pad, count):
    dens = forward(p, x) * pad
    pred = (dens * inside).sum(1)
    return jnp.mean(jnp.abs(pred - count) / jnp.sqrt(count + 1.0)), pred


def augment(s, rng):
    pos, seen = s['pos'].copy(), s['seen'].copy()
    t = len(pos)
    # A slower or faster set: resample in time (the count is unchanged).
    r = rng.uniform(0.8, 1.25)
    n = max(8, int(round(t * r)))
    src = np.clip(np.round(np.linspace(0, t - 1, n)).astype(int), 0, t - 1)
    pos, seen, inside = pos[src], seen[src], s['inside'][src]
    if rng.random() < 0.5:  # left for right
        pos = pos[:, data.MIRROR] * np.array([-1, 1, 1], np.float32)
    a = rng.uniform(-math.pi / 3, math.pi / 3)  # camera turned about the vertical axis
    c, sn = math.cos(a), math.sin(a)
    rot = np.array([[c, 0, sn], [0, 1, 0], [-sn, 0, c]], np.float32)
    pos = pos @ rot.T + rng.normal(0, 0.02, pos.shape).astype(np.float32)
    return data.features(pos, seen), inside


def lengthen(s, sets, rng):
    """A real set, unlike a 10 s clip, is held still before and after, and runs longer: a still hold of 0.5
    to 3 s at each end, and half the time a second set of the same lift joined on (their counts add)."""
    parts = [s]
    if rng.random() < 0.5:
        same = [o for o in sets if o['lift'] == s['lift'] and o is not s]
        if same:
            parts.append(same[rng.integers(len(same))])
    pos, seen, inside, count = [], [], [], 0
    for q in parts:
        for end in ('before', 'after'):
            if rng.random() < 0.7:
                n = int(rng.uniform(0.5, 3.0) * 15)
                seen_idx = np.flatnonzero(q['seen'])
                k = (seen_idx[0] if end == 'before' else seen_idx[-1]) if len(seen_idx) else 0
                hold = (np.repeat(q['pos'][k:k + 1], n, 0), np.ones(n, np.float32), np.zeros(n, np.float32))
            else:
                hold = None
            if end == 'before' and hold:
                pos.append(hold[0]); seen.append(hold[1]); inside.append(hold[2])
            if end == 'before':
                pos.append(q['pos']); seen.append(q['seen']); inside.append(q['inside'])
            if end == 'after' and hold:
                pos.append(hold[0]); seen.append(hold[1]); inside.append(hold[2])
        count += q['count']
    return dict(pos=np.concatenate(pos), seen=np.concatenate(seen), inside=np.concatenate(inside), count=count, lift=s['lift'])


def batch(sets, rng, aug, pool=None):
    xs, ins = [], []
    # Off unless asked (LENGTHEN=1): measured and not kept (test/real-phone/accuracy/learned-cv-lengthen-run.txt,
    # learned-david-lengthen.txt).
    if aug and pool is not None and os.environ.get('LENGTHEN', '0') == '1':
        sets = [lengthen(s, pool, rng) for s in sets]
    for s in sets:
        if aug:
            x, inside = augment(s, rng)
        else:
            x, inside = data.features(s['pos'], s['seen']), s['inside']
        xs.append(x)
        ins.append(inside)
    t = max(len(x) for x in xs)
    X = np.zeros((len(xs), t, IN), np.float32)
    I = np.zeros((len(xs), t), np.float32)
    P = np.zeros((len(xs), t), np.float32)
    for i, (x, inside) in enumerate(zip(xs, ins)):
        X[i, :len(x)] = x
        I[i, :len(x)] = inside
        P[i, :len(x)] = 1
    return jnp.array(X), jnp.array(I), jnp.array(P), jnp.array([s['count'] for s in sets], jnp.float32)


def train(sets, steps=3000, seed=0, bs=32, lr=2e-3):
    rng = np.random.default_rng(seed)
    p = init(jax.random.PRNGKey(seed))
    sched = optax.cosine_decay_schedule(lr, steps)
    opt = optax.chain(optax.clip_by_global_norm(1.0), optax.adamw(sched, weight_decay=1e-4))
    st = opt.init(p)

    @jax.jit
    def step(p, st, X, I, P, C):
        (l, _), g = jax.value_and_grad(loss_fn, has_aux=True)(p, X, I, P, C)
        u, st = opt.update(g, st, p)
        return optax.apply_updates(p, u), st, l

    for i in range(steps):
        idx = rng.choice(len(sets), size=min(bs, len(sets)), replace=False)
        p, st, l = step(p, st, *batch([sets[j] for j in idx], rng, True, sets))
        if i % 500 == 0:
            print(f'  step {i} loss {float(l):.3f}', flush=True)
    return p


def predict(p, sets):
    out = []
    for s in sets:
        X, I, P, _ = batch([s], None, False)
        out.append(float((forward(p, X) * I).sum()))
    return out


def score(pred, sets):
    c = np.array([round(v) for v in pred])
    y = np.array([s['count'] for s in sets])
    return int((c == y).sum()), int((np.abs(c - y) <= 1).sum()), len(y)


def core_counts():
    base = json.load(open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', 'public-baseline.json')))['counts']
    return base


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'cv'
    sets = data.load('countix-whole')
    for s in sets:
        s['group'] = s['id'].rsplit('_', 2)[0]
    if mode == 'fit':
        # The whole build half, then David's sets, never trained on, and the weights for the app.
        p = train(sets, steps=int(os.environ.get('STEPS', 3000)))
        david = data.load_david()
        pr = predict(p, david)
        lines = [f'{os.path.basename(s["name"])[:40]:40s} label {s["count"]:2d} learned {v:5.2f} -> {round(v)}' for s, v in zip(david, pr)]
        e = score(pr, david)
        lines.append(f'David: learned exact {e[0]}/{e[2]}, within one {e[1]}')
        print('\n'.join(lines))
        out = {'note': 'Weights of the learned counter (scripts/ml/train.py fit), trained on the Countix build half only.',
               'channels': CH, 'kernel': K, 'dilations': DIL, 'inputs': IN,
               'params': jax.tree_util.tree_map(lambda a: np.round(np.asarray(a), 6).tolist(), p)}
        tag = os.environ.get('TAG')
        if tag:  # a variant measured and not kept: its report only, the app's weights untouched
            open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', f'learned-david-{tag}.txt'), 'w').write('\n'.join(lines) + '\n')
            sys.exit(0)
        json.dump(out, open(os.path.join(REPO, 'src', 'lib', 'counting', 'learned-weights.json'), 'w'))
        open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', 'learned-david.txt'), 'w').write('\n'.join(lines) + '\n')
        # The sums the app's inference (src/lib/counting/learned.ts) must reproduce from these weights.
        json.dump({os.path.relpath(s_['name'], os.path.join(REPO, 'test', 'real-phone')): v for s_, v in zip(david, pr)}, open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', 'learned-parity.json'), 'w'), indent=1)
    if mode == 'cv':
        groups = sorted({s['group'] for s in sets})
        rng = np.random.default_rng(1)
        rng.shuffle(groups)
        fold_of = {g: i % 5 for i, g in enumerate(groups)}
        base = core_counts()
        preds = {}
        tot = np.zeros(3, int)
        tot_core = np.zeros(3, int)
        lines = []
        for k in range(5):
            tr = [s for s in sets if fold_of[s['group']] != k]
            va = [s for s in sets if fold_of[s['group']] == k]
            p = train(tr, steps=int(os.environ.get('STEPS', 3000)))
            pr = predict(p, va)
            for s_, v in zip(va, pr): preds['public/countix-whole/build/' + os.path.basename(s_['name'])] = v
            e = score(pr, va)
            cc = [base.get('public/countix-whole/build/' + os.path.basename(s['name'])) for s in va]
            ce = (sum(1 for c, s in zip(cc, va) if c == s['count']), sum(1 for c, s in zip(cc, va) if c != 'refused' and c is not None and abs(c - s['count']) <= 1), len(va))
            tot += e
            tot_core += ce
            lines.append(f'fold {k}: learned exact {e[0]}/{e[2]} within one {e[1]}; core exact {ce[0]} within one {ce[1]}')
            print(lines[-1], flush=True)
        lines.append(f'all: learned exact {tot[0]}/{tot[2]} within one {tot[1]}; core exact {tot_core[0]} within one {tot_core[1]}')
        print(lines[-1])
        json.dump(preds, open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', 'learned-cv.json'), 'w'), indent=1)
        open(os.path.join(REPO, 'test', 'real-phone', 'accuracy', 'learned-cv.txt'), 'w').write('\n'.join(lines) + '\n')
