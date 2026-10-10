#!/usr/bin/env python3
"""Diagnose the structural anatomy of Round 3 champions and frontier gaps."""
import json
from pathlib import Path
import numpy as np

DATA = Path('research-notes/data')
s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text('utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text('utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text('utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text('utf-8'))

pool = {}
for lst in (s0, s1, s2, s3):
    for x in lst:
        if x.get('ckt_v3'):
            pool[x['id']] = x

# Compare e806ff772afe vs 40d7168c0550 vs 18389e333036
for cid in ['BCW-e806ff772afe', 'BCW-40d7168c0550', 'BCW-12d72973b5b5', 'BCW-18389e333036', 'BCW-121d11f6b6c4', 'BCW-3c47744cf2f7', 'BCW-d0b1b29e49f9', 'BCW-d976864e1f53', 'BCW-d44b7e444f49', 'BKP-e0048df69193']:
    r = pool[cid]
    bm = r['bMetricsRatio']
    over1 = {k: round(v, 4) for k, v in bm.items() if v >= 1.0}
    print(f"{cid}: v3={r['ckt_v3']:.5f} M={r['M']} D={r['D']} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% | over1={over1}")

e806 = np.array(pool['BCW-e806ff772afe']['state'])
c40d = np.array(pool['BCW-40d7168c0550']['state'])
c183 = np.array(pool['BCW-18389e333036']['state'])
c121 = np.array(pool['BCW-121d11f6b6c4']['state'])

print("\nDiff between e806ff772afe and 40d7168c0550:")
for i in range(67):
    if e806[i] != c40d[i]:
        print(f"  pos {i}: 40d7={c40d[i]} -> e806={e806[i]}")

print("\nInitials comparison (pos 0..20) between D=0 (121d11f6b6c4), D=2 (18389e333036), D=3 (e806ff772afe):")
for i in range(21):
    if len({c121[i], c183[i], e806[i]}) > 1:
        print(f"  init {i:2d}: D0={c121[i]:2d} | D2(183)={c183[i]:2d} | D3(e806)={e806[i]:2d}")
