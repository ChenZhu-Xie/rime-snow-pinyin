#!/usr/bin/env python3
"""Diagnose the 823-scheme scored 21x21 pool after Round 4 to identify Round 5 frontiers, seeds, basins, and canyons."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'

s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))
s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))

pool_map = {}
for lst in (s0, s1, s2, s3, s4):
    for x in lst:
        if x.get('ckt_v3') is not None and x.get('state'):
            pool_map[x['id']] = x

pool = list(pool_map.values())
print(f"Total unique exact-scored 21x21 schemes in pool: {len(pool)}")

print("\n=== 1. BEST CKT v3 BY DISPLACEMENT D (0..7)Across Categories ===")
header = f"{'D':>2} | {'Overall Best':<28} | {'Pure 8B (<1.0)':<28} | {'Low-Pinky (<=5.1%)':<28} | {'Dual-Gated (H>=50,P<=5.1)':<28}"
print(header)
print("-" * len(header))
for d in range(8):
    sub = [x for x in pool if x['D'] == d]
    def fmt(items):
        if not items:
            return "---"
        best = min(items, key=lambda r: r['ckt_v3'])
        return f"{best['ckt_v3']:.5f} ({best['id'][:10]} M{best['M']})"
    c_all = fmt(sub)
    c_p8b = fmt([x for x in sub if x.get('isPure8B') or x.get('eightWorstRatio', 9) < 1.0])
    c_lp = fmt([x for x in sub if x['Pmax'] <= 0.0511])
    c_dg = fmt([x for x in sub if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50])
    print(f"{d:>2} | {c_all:<28} | {c_p8b:<28} | {c_lp:<28} | {c_dg:<28}")

print("\n=== 2. BEST CKT v3 BY MEMORY M (38..46) ===")
for m in range(38, 47):
    sub = [x for x in pool if x['M'] == m]
    if not sub:
        continue
    best = min(sub, key=lambda r: r['ckt_v3'])
    p8b = [x for x in sub if x.get('isPure8B') or x.get('eightWorstRatio', 9) < 1.0]
    bp8 = f"{min(p8b, key=lambda r: r['ckt_v3'])['ckt_v3']:.5f}" if p8b else "---"
    lp = [x for x in sub if x['Pmax'] <= 0.0511]
    blp = f"{min(lp, key=lambda r: r['ckt_v3'])['ckt_v3']:.5f}" if lp else "---"
    print(f"M={m:2d}: Best={best['ckt_v3']:.5f} ({best['id']} D={best['D']} Home={best['homeS2']*100:.2f}% Pmax={best['Pmax']*100:.2f}% 8B={best['eightWorstRatio']:.4f}) | Pure8B={bp8} | LowP={blp}")

print("\n=== 3. NEAR-PURE-8B + ERGONOMIC CANDIDATES (Pmax <= 5.1%, eightWorstRatio <= 1.008) ===")
near_ergo = [x for x in pool if x['Pmax'] <= 0.0511 and x['eightWorstRatio'] <= 1.0085]
for x in sorted(near_ergo, key=lambda r: (r['eightWorstRatio'], r['ckt_v3']))[:15]:
    bm = x.get('bMetricsRatio', {})
    over = {k: round(v, 4) for k, v in bm.items() if v >= 1.0}
    print(f"  {x['id']}: v3={x['ckt_v3']:.5f} M={x['M']} D={x['D']} Home={x['homeS2']*100:.2f}% Pmax={x['Pmax']*100:.2f}% 8B={x['eightWorstRatio']:.4f} over={over}")

print("\n=== 4. D=3 NEAR-PURE-8B FAST SCHEMES (D<=3, v3 <= 9.595) ===")
d3_fast = [x for x in pool if x['D'] <= 3 and x['ckt_v3'] <= 9.595]
for x in sorted(d3_fast, key=lambda r: r['ckt_v3'])[:12]:
    bm = x.get('bMetricsRatio', {})
    over = {k: round(v, 4) for k, v in bm.items() if v >= 1.0}
    print(f"  {x['id']}: v3={x['ckt_v3']:.5f} M={x['M']} D={x['D']} Home={x['homeS2']*100:.2f}% Pmax={x['Pmax']*100:.2f}% 8B={x['eightWorstRatio']:.4f} over={over}")

print("\n=== 5. SURROGATE vs EXACT CKT v3 GAP IN TOP D=4 / D=3 SCHEMES ===")
for x in sorted(pool, key=lambda r: r['ckt_v3'])[:15]:
    sur = x.get('surrogate_ckt')
    diff = (x['ckt_v3'] - sur) if sur else 0.0
    sur_str = f"{sur:.5f}" if sur else "N/A"
    print(f"  {x['id']}: exact={x['ckt_v3']:.5f} sur={sur_str} diff={diff:+.5f} M={x['M']} D={x['D']} 8B={x['eightWorstRatio']:.4f} ({x.get('phase')})")
