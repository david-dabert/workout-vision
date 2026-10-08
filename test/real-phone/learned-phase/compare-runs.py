#!/usr/bin/env python3
"""python3 -I test/real-phone/learned-phase/compare-runs.py <runs folder>

The learned phase counter's variants on real sets only, from a folder of runs (motion-library.yml): each
<variant>-s<seed>/ holds eval-all.json (train.py: RepCount-A test and validation build half, by model-all, never
trained on) and lphase.txt (learned-phase.test.ts: David's 13 real videos and 20 stored sets, set by set, by model-all,
never trained on). Prints, per run and per variant over its seeds: exact, within 1, off by 3 or more, and the mean
absolute error, on each of the three and on all of them together."""
import json, os, re, sys
from collections import defaultdict


def bench_sets(txt):
    out = {'real video': [], 'stored sets': []}
    sec = None
    for line in open(txt):
        if line.startswith('real video (exam), set by set'):
            sec = 'real video'
        elif line.startswith('stored sets (exam), set by set'):
            sec = 'stored sets'
        m = re.match(r'- (\S+): (\d+) \| (\d+) \(', line)
        if m and sec:
            out[sec].append((int(m.group(2)), int(m.group(3))))
    return out


def stats(pairs):
    n = len(pairs)
    ex = sum(1 for l, p in pairs if l == p)
    w1 = sum(1 for l, p in pairs if abs(l - p) <= 1)
    o3 = sum(1 for l, p in pairs if abs(l - p) >= 3)
    mae = sum(abs(l - p) for l, p in pairs) / max(n, 1)
    return n, ex, w1, o3, mae


root = sys.argv[1]
by_variant = defaultdict(list)
print('| Run | Suite | Sets | Exact | Within 1 | Off 3+ | Mean error |')
print('|---|---|---:|---:|---:|---:|---:|')
for run in sorted(os.listdir(root)):
    d = os.path.join(root, run)
    if not (os.path.isdir(d) and os.path.exists(os.path.join(d, 'eval-all.json')) and os.path.exists(os.path.join(d, 'lphase.txt'))):
        continue
    ev = json.load(open(os.path.join(d, 'eval-all.json')))
    suites = {'repcount eval': [(e['label'], e['density']) for e in ev if e['suite'] == 'repcount'], **bench_sets(os.path.join(d, 'lphase.txt'))}
    suites['all real'] = [p for k in ('repcount eval', 'real video', 'stored sets') for p in suites[k]]
    for k, pairs in suites.items():
        n, ex, w1, o3, mae = stats(pairs)
        print(f'| {run} | {k} | {n} | {ex} | {w1} | {o3} | {mae:.2f} |')
    by_variant[run.rsplit('-s', 1)[0]].append(suites)
print()
print('Per variant, summed over its seeds (mean error averaged):')
print('| Variant | Seeds | Suite | Exact | Within 1 | Off 3+ | Mean error |')
print('|---|---:|---|---:|---:|---:|---:|')
for v, runs in sorted(by_variant.items()):
    for k in ('repcount eval', 'real video', 'stored sets', 'all real'):
        st = [stats(r[k]) for r in runs]
        print(f'| {v} | {len(runs)} | {k} | {sum(s[1] for s in st)} | {sum(s[2] for s in st)} | {sum(s[3] for s in st)} | {sum(s[4] for s in st) / len(st):.2f} |')
