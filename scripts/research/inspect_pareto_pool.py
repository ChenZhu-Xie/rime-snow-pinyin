#!/usr/bin/env python3
"""Inspect current 21x21 CKT v3 Pareto frontiers across Seeds, R1, R2, and R3."""
import json
from pathlib import Path

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

print(f'Total unique scored 21x21 schemes in pool: {len(pool)}')

print('\n--- Best CKT v3 by D (0 to 7) ---')
for d in range(8):
    sub = [x for x in pool.values() if x['D'] == d]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"D={d}: {best['id']} v3={best['ckt_v3']:.5f} M={best['M']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")

print('\n--- Best Pure 8B (worst_ratio < 1.0) by D ---')
for d in range(8):
    sub = [x for x in pool.values() if x['D'] == d and x['eightWorstRatio'] < 1.0]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"D={d} [Pure8B]: {best['id']} v3={best['ckt_v3']:.5f} M={best['M']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")

print('\n--- Best Low Pmax (<= 5.11%) by D ---')
for d in range(8):
    sub = [x for x in pool.values() if x['D'] == d and x['Pmax'] <= 0.0511]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"D={d} [P<=5.1%]: {best['id']} v3={best['ckt_v3']:.5f} M={best['M']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")

print('\n--- Best High Home (>= 50%) by D ---')
for d in range(8):
    sub = [x for x in pool.values() if x['D'] == d and x['homeS2'] >= 0.50]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"D={d} [Home>=50%]: {best['id']} v3={best['ckt_v3']:.5f} M={best['M']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")

print('\n--- Best CKT v3 by M (38 to 46) ---')
for m in range(38, 47):
    sub = [x for x in pool.values() if x['M'] == m]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"M={m}: {best['id']} v3={best['ckt_v3']:.5f} D={best['D']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")

print('\n--- Best Ergonomic Gated (Pmax <= 5.11% AND Home >= 50%) by D ---')
for d in range(8):
    sub = [x for x in pool.values() if x['D'] == d and x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50]
    if sub:
        best = min(sub, key=lambda x: x['ckt_v3'])
        print(f"D={d} [P<=5.1%, Home>=50%]: {best['id']} v3={best['ckt_v3']:.5f} M={best['M']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}")
