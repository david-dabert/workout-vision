#!/usr/bin/env python3 -I
"""The sealed run's record (exam-result.txt), scored as exam-plan.md fixed before the run.
Usage: python3 -I test/real-phone/loop/exam-report.py <rows-holdout-*.json> <out.txt>"""
import json, sys
d = json.load(open(sys.argv[1])); meta = d.pop('_missing', {}) or {}
rows = list(d.values())
off = lambda c, l: float('inf') if c == 'refused' else abs(c - l)
def line(sel, key):
    n = len(sel); ex = sum(off(key(r), r['label']) == 0 for r in sel); bad = sum(off(key(r), r['label']) >= 3 for r in sel)
    return n, ex, bad, f'{n} sets, {ex} exact ({round(100 * ex / n) if n else 0} %), {bad} off by 3 or more'
def sure(r, rule, k):
    x = r[rule]; return x['count'] != 'refused' and x['count'] > 0 and r['minRatio'] is not None and r['minRatio'] >= k and not x['ambiguous']
L = []
p = L.append
sel = [r for r in rows if r['suite'] == 'holdout']
p('The loop gate on the sealed public half, run once on 24 October 2026 at 0241be61 (exam-plan.md; loop.test.ts with HOLDOUT=1).')
p(f'Countix held-out sets rebuilt in the cloud container through the app\'s extraction: {len(sel)} scored; {len(meta.get("missing", []))} recorded as written by the')
p('first build of this half but failed on this read (missing); RepCount-A\'s held-out sets were not rebuilt; CFRep\'s are exposed.')
p('')
_, _, _, all_core = line(sel, lambda r: r['core']); p(f'The core on every set: {all_core}.')
n0, e0, b0, today = line([r for r in sel if r['appSure']], lambda r: r['core']); p(f'The app\'s sure set today: {today}.')
p('')
for rule, k, tag in [('rest', 12, 'Primary gate (fixed beforehand on public A)'), ('round', 3, 'Secondary gate (picked after the build halves were seen; exploratory)')]:
    g = [r for r in sel if r['core'] != 'refused' and sure(r, rule, k) and r[rule]['count'] == r['core']]
    n, e, b, txt = line(g, lambda r: r['core'])
    rate0 = e0 / n0 if n0 else 0
    z = (e - n * rate0) / ((n * rate0 * (1 - rate0)) ** 0.5) if n else 0
    passed = n and e / n > rate0 and b <= b0
    p(f'{tag}, end rule {rule}, k = {k}: {txt}; coverage {round(100 * n / len(sel))} % of the sets.')
    p(f'   Against the sure set\'s exact rate: z = {z:.2f} (binomial, the sure set\'s rate as the null). Pass rule of exam-plan.md: {"PASS" if passed else "FAIL"}.')
p('')
for rule in ['rest', 'round']:
    p(f'The loop counter alone ({rule}): {line(sel, lambda r, rule=rule: r[rule]["count"])[3]}.')
p('')
p('Every k, for the record (exploratory):')
for rule in ['rest', 'round']:
    cells = []
    for k in [2, 3, 4, 6, 8, 12]:
        g = [r for r in sel if r['core'] != 'refused' and sure(r, rule, k) and r[rule]['count'] == r['core']]
        n, e, b, _ = line(g, lambda r: r['core']); cells.append(f'k{k}: {n} sure, {round(100 * e / n) if n else 0} %, {b} off3')
    p(f'   {rule}: ' + ' | '.join(cells))
open(sys.argv[2], 'w').write('\n'.join(L) + '\n'); print('\n'.join(L))
