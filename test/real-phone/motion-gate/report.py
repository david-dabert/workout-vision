#!/usr/bin/env python3 -I
"""The image-motion check's record (gate.txt), from gate.test.ts's rows, scored as plan.md fixed before the run.
Usage: python3 -I test/real-phone/motion-gate/report.py <rows.json> <out.txt>"""
import json, sys
rows = json.load(open(sys.argv[1]))
off = lambda c, l: float('inf') if c == 'refused' or c is None else abs(c - l)
L = []
p = L.append
def stats(sel):
    n = len(sel); ex = sum(off(r['core'], r['label']) == 0 for r in sel); bad = sum(off(r['core'], r['label']) >= 3 for r in sel)
    return n, ex, bad
def fmt(n, ex, bad, total):
    return f'{n:4} sure ({round(100 * n / total) if total else 0} % of {total}), {ex:4} exact ({round(100 * ex / n) if n else 0} %), {bad:3} off by 3 or more'
GATES = [('G1', None), ('G2(0.3)', 0.3), ('G2(0.5)', 0.5), ('G2(0.7)', 0.7)]
def gate(sel, c):
    return [r for r in sel if r['appSure'] and r['motion'] is not None and r['motion']['count'] == r['core'] and (c is None or r['motion']['confidence'] >= c)]
p('The image-motion check on the core\'s count, 24 October 2026 (plan.md; frames.mjs, gate.test.ts; bench only; measured, decides nothing).')
p('Countix clips decoded with ffmpeg at 15 samples per second, 128 x 128 grey, whole frame; motionRhythm.js with its defaults.')
p('')
for suite in ['A', 'B', 'exposed']:
    sel = [r for r in rows.values() if r['suite'] == suite]
    if not sel: continue
    n, ex, bad = stats(sel)
    p(f'-- {suite}: {n} sets; the core on every set {ex} exact ({round(100 * ex / n)} %), {bad} off by 3 or more')
    m = [r for r in sel if r['motion'] is not None]
    mex = sum(off(r['motion']['count'], r['label']) == 0 for r in m)
    p(f'   the motion count alone: {len(m)} counted, {mex} exact ({round(100 * mex / len(m)) if m else 0} %)')
    p(f'   today\'s sure set:  {fmt(*stats([r for r in sel if r["appSure"]]), n)}')
    for name, c in GATES:
        p(f'   {name:9}          {fmt(*stats(gate(sel, c)), n)}')
p('')
# The choice on A: the highest exact rate among gates covering at least a quarter of A's sets.
A = [r for r in rows.values() if r['suite'] == 'A']
best = None
for name, c in GATES:
    n, ex, bad = stats(gate(A, c))
    if n >= len(A) / 4 and (best is None or ex / n > best[0]): best = (ex / n, name, c)
if best is None:
    p('Choice on A: no gate covers a quarter of the sets; no verdict.')
else:
    _, name, c = best
    B = [r for r in rows.values() if r['suite'] == 'B']
    n0, e0, b0 = stats([r for r in B if r['appSure']]); n, e, b = stats(gate(B, c))
    r0 = e0 / n0
    z = (e - n * r0) / ((n * r0 * (1 - r0)) ** 0.5) if n else 0
    passed = n and z >= 1.96 and (b / n if n else 0) <= (b0 / n0)
    p(f'Choice on A: {name}. Verdict on B: {fmt(n, e, b, len(B))}; today {fmt(n0, e0, b0, len(B))}; z = {z:.2f}; {"PASS" if passed else "FAIL"} (plan.md: z >= 1.96 and no higher share off by 3).')
open(sys.argv[2], 'w').write('\n'.join(L) + '\n'); print('\n'.join(L))
