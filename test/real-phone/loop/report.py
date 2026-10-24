#!/usr/bin/env python3 -I
"""The loop counter's record (test/real-phone/loop/loop.txt), from loop.test.ts's rows.
Usage: python3 -I test/real-phone/loop/report.py <dir holding rows-*.json> <out.txt>
Choices are made on the public build half A only, and read on every other suite: the end rule and the certificate's k
for the counter alone, and k for the gate on the core's count. The holdout halves are never opened by the bench."""
import glob, json, os, subprocess, sys, tempfile

D, OUT = sys.argv[1], sys.argv[2]
rows = {}
for f in sorted(glob.glob(os.path.join(D, 'rows-*.json'))):
    rows.update(json.load(open(f)))
L = []
p = lambda *a: L.append(' '.join(str(x) for x in a))
SUITES = ['david', 'video', 'publicA', 'publicB', 'repcount', 'synthetic', 'occlusion']
KS = [2, 3, 4, 6, 8, 12]
off = lambda c, l: float('inf') if c == 'refused' else abs(c - l)
pct = lambda k, n: f'{round(100 * k / n)} %' if n else '-'

def sure(r, rule, k):
    x = r[rule]
    return x['count'] != 'refused' and x['count'] > 0 and r['minRatio'] is not None and r['minRatio'] >= k and not x['ambiguous']

def line(sel, key):
    n = len(sel); ex = sum(off(key(r), r['label']) == 0 for r in sel); bad = sum(off(key(r), r['label']) >= 3 for r in sel)
    return n, ex, bad, f'{n:4} sets, {ex:4} exact ({pct(ex, n)}), {bad:3} off by 3+'

def of(s): return [r for r in rows.values() if r['suite'] == s]

p(f'The loop counter, 24 October 2026 (loop.js, loop.test.ts; bench only, the app imports none of it; measured, decides nothing).')
p('A rep counted as one turn of the body\'s movement around its centre, in the position-velocity plane of the noise-whitened principal')
p('component with the clearest rhythm; "sure" when the least distance to the centre stays above k times the pose noise measured on the')
p('set (the dog-on-a-leash lemma: a perturbation smaller than that distance cannot change the count) and no end fragment is ambiguous.')
p('Two end rules, both fixed before the run: "rest" (complete turns from rest to rest, a fragment at either end counted at 0.7 of a')
p('turn, unsure between 0.35 and 0.85) and "round" (the whole turns rounded, unsure within 0.15 of a half). Every constant: UNSOURCED,')
p('experimental, none tuned on a clip. Choices made on publicA only.')
p('')
n_by = {s: len(of(s)) for s in SUITES}
p('Sets: ' + ', '.join(f'{s} {n_by[s]}' for s in SUITES) + f'; mean time per set {round(sum(r["ms"] for r in rows.values()) / max(1, len(rows)))} ms (Node, this machine).')
p('')
p('1. The loop counter alone against the core (compare-variants.mjs; exact / off by 3 or more, a refusal off by 3 or more).')
with tempfile.TemporaryDirectory() as tmp:
    def dump(name, key):
        path = os.path.join(tmp, name + '.json')
        json.dump({'sets': {n: {'suite': r['suite'], 'lift': r['lift'], 'label': r['label'], 'count': key(r)} for n, r in rows.items()}}, open(path, 'w'))
        return path
    base = dump('core', lambda r: r['core'])
    for rule in ['rest', 'round']:
        out = subprocess.run(['node', 'scripts/compare-variants.mjs', base, dump(rule, lambda r, rule=rule: r[rule]['count'])], capture_output=True, text=True).stdout
        p(f'-- core -> loop, end rule {rule}')
        L.extend('   ' + l for l in out.strip().split('\n'))
p('')
p('2. The certificate on the loop\'s own count: of the sets it calls sure, how many are exact (by k, the noise multiple).')
for rule in ['rest', 'round']:
    p(f'-- end rule {rule}')
    for s in SUITES:
        sel = of(s)
        if not sel: continue
        cells = []
        for k in KS:
            n, ex, bad, _ = line([r for r in sel if sure(r, rule, k)], lambda r: r[rule]['count'])
            cells.append(f'k{k}: {n}/{len(sel)} sure, {pct(ex, n)} exact, {bad} off3')
        p(f'   {s:9} ' + ' | '.join(cells))
p('')
p('3. The gate on the core\'s count, as the app would ship it: the core\'s count shown as sure when the loop is sure and counts the same.')
p('   Beside it, the app\'s sure set today (sure.ts: not flagged by the body check, the sensitivity check or a refused head rep).')
for rule in ['rest', 'round']:
    p(f'-- end rule {rule}')
    for s in SUITES:
        sel = of(s)
        if not sel: continue
        _, _, _, today = line([r for r in sel if r['appSure']], lambda r: r['core'])
        p(f'   {s:9} today: {today}')
        for k in KS:
            both = [r for r in sel if r['core'] != 'refused' and sure(r, rule, k) and r[rule]['count'] == r['core']]
            and_app = [r for r in both if r['appSure']]
            p(f'             k{k:<3} loop agrees and sure: {line(both, lambda r: r["core"])[3]}   and the app sure too: {line(and_app, lambda r: r["core"])[3]}')
p('')
# The choice on publicA: the gate (loop agrees and sure) with the most sets at an exact rate of at least 90 %, else the
# highest exact rate; then read on every suite.
best = None
for rule in ['rest', 'round']:
    for k in KS:
        sel = [r for r in of('publicA') if r['core'] != 'refused' and sure(r, rule, k) and r[rule]['count'] == r['core']]
        n, ex, _, _ = line(sel, lambda r: r['core'])
        rate = ex / n if n else 0
        key = (rate >= 0.9, n if rate >= 0.9 else rate)
        if best is None or key > best[0]: best = (key, rule, k)
_, rule, k = best
p(f'4. Chosen on publicA (the gate with the most sets at 90 % exact or more, else the highest exact rate): end rule {rule}, k = {k}.')
for s in SUITES:
    sel = of(s)
    if not sel: continue
    both = [r for r in sel if r['core'] != 'refused' and sure(r, rule, k) and r[rule]['count'] == r['core']]
    p(f'   {s:9} sure: {line(both, lambda r: r["core"])[3]}  (of {len(sel)});  today: {line([r for r in sel if r["appSure"]], lambda r: r["core"])[3]}')
p('')
p('5. David\'s sets, set by set (label, core, app sure today, loop by each rule, least ratio, end fragments).')
for n, r in rows.items():
    if r['suite'] not in ('david', 'video'): continue
    mr = '-' if r['minRatio'] is None else f'{r["minRatio"]:.1f}'
    fr = '-' if r['head'] is None else f'{r["head"]:.2f}/{r["tail"]:.2f}'
    p(f'   {r["suite"]:5} {r["label"]:>3} core {str(r["core"]):>7}{" S" if r["appSure"] else "  "} rest {str(r["rest"]["count"]):>7}{"?" if r["rest"]["ambiguous"] else " "} round {str(r["round"]["count"]):>7}{"?" if r["round"]["ambiguous"] else " "} ratio {mr:>6} ends {fr:>9}  {n.split("/")[-1][:40]}')
open(OUT, 'w').write('\n'.join(L) + '\n')
print('\n'.join(L[:60]))
