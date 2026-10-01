"""Counter agreement on Countix whole clips, build half, as SPEC.md fixes it. python3 test/real-phone/agreement/agreement.py
Reads counts.json (counts.test.ts) and accuracy/learned-cv.json; writes agreement.txt. Nothing is tuned."""
import json, os, math
from collections import defaultdict
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
counts = json.load(open(os.path.join(HERE, 'counts.json')))
learned = json.load(open(os.path.join(HERE, '..', 'accuracy', 'learned-cv.json')))
assert set(counts) == set(learned) and len(counts) == 447

clips = sorted(counts)
lab = {k: counts[k]['label'] for k in clips}
lift = {k: counts[k]['lift'] for k in clips}
pred = {'C': {k: counts[k]['core'] for k in clips},
        'L': {k: round(learned[k]) for k in clips},
        'P': {k: counts[k]['period'] for k in clips}}
group = {k: os.path.basename(k)[:-len('.json.gz')].rsplit('_', 2)[0] for k in clips}
groups = sorted(set(group.values()))
by_group = defaultdict(list)
for k in clips: by_group[group[k]].append(k)

def answer(rule, k):
    """The count a rule gives on clip k, or None when it does not answer."""
    vals = [pred[c][k] for c in rule]
    if any(v == 'refused' for v in vals) or len(set(vals)) != 1: return None
    return vals[0]

RULES = ['C', 'L', 'P', 'CL', 'CP', 'LP', 'CLP']

def stats(rule, ks):
    a = [(k, answer(rule, k)) for k in ks]
    acc = [(k, v) for k, v in a if v is not None]
    ex = sum(v == lab[k] for k, v in acc)
    cat = sum(abs(v - lab[k]) >= 3 for k, v in acc)
    ref = sum(any(pred[c][k] == 'refused' for c in rule) for k in ks)
    return len(ks), len(acc), ex, cat, ref

rng = np.random.default_rng(1)
boots = [rng.choice(len(groups), len(groups)) for _ in range(2000)]

def interval(rule):
    cov, accu = [], []
    for b in boots:
        ks = [k for i in b for k in by_group[groups[i]]]
        n, a, ex, _, _ = stats(rule, ks)
        cov.append(a / n)
        if a: accu.append(ex / a)
    q = lambda xs: (np.percentile(xs, 2.5), np.percentile(xs, 97.5))
    return q(cov), q(accu)

pct = lambda x: f'{100 * x:.0f}%'
L = ['# Counter agreement, Countix whole clips, build half (SPEC.md)', '',
     f'{len(clips)} clips from {len(groups)} source videos. Development results, not an untouched test.',
     'C core, L learned (out of fold), P period counter. A rule answers when its counters all answer with the same count.', '',
     '| Rule | Answered | Coverage (95% CI) | Exact | Exact when answered (95% CI) | Off by 3+ when answered | A counter refused |',
     '|---|---:|---|---:|---|---:|---:|']
for r in RULES:
    n, a, ex, cat, ref = stats(r, clips)
    (c0, c1), (e0, e1) = interval(r)
    L.append(f'| {r} | {a} | {pct(a / n)} ({pct(c0)} to {pct(c1)}) | {ex} | {pct(ex / a) if a else "-"} ({pct(e0)} to {pct(e1)}) | {cat} ({pct(cat / a) if a else "-"}) | {ref} |')

L += ['', '## By exercise: answered / exact', '', '| Lift | Clips | ' + ' | '.join(RULES) + ' |', '|---|---:|' + '---|' * len(RULES)]
for lf in sorted(set(lift.values()), key=lambda x: -sum(lift[k] == x for k in clips)):
    ks = [k for k in clips if lift[k] == lf]
    cells = []
    for r in RULES:
        _, a, ex, _, _ = stats(r, ks)
        cells.append(f'{a}/{ex}')
    L.append(f'| {lf} | {len(ks)} | ' + ' | '.join(cells) + ' |')

L += ['', '## Error correlation, on clips both counters answer', '', '| Pair | Both answer | Both wrong | Same wrong count | Phi of being wrong |', '|---|---:|---:|---:|---:|']
for x, y in [('C', 'L'), ('C', 'P'), ('L', 'P')]:
    ks = [k for k in clips if pred[x][k] != 'refused' and pred[y][k] != 'refused']
    wx = np.array([pred[x][k] != lab[k] for k in ks], float)
    wy = np.array([pred[y][k] != lab[k] for k in ks], float)
    same = sum(pred[x][k] == pred[y][k] != lab[k] for k in ks)
    phi = np.corrcoef(wx, wy)[0, 1] if wx.std() and wy.std() else float('nan')
    L.append(f'| {x}{y} | {len(ks)} | {int((wx * wy).sum())} | {same} | {phi:.2f} |')

L += ['', '## Every agreed count that is wrong', '']
for r in ['CL', 'CP', 'LP', 'CLP']:
    wrong = [(k, answer(r, k)) for k in clips if answer(r, k) is not None and answer(r, k) != lab[k]]
    L.append(f'{r}: {len(wrong)}')
    for k, v in wrong:
        L.append(f'  {os.path.basename(k)} {lift[k]} label {lab[k]} count {v} error {v - lab[k]:+d}')
open(os.path.join(HERE, 'agreement.txt'), 'w').write('\n'.join(L) + '\n')
print('\n'.join(L[:40]))
