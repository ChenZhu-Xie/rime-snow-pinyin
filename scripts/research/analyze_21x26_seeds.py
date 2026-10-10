#!/usr/bin/env python3
"""Analyze all 102 21x26 IEUAO 399-unique pure-y schemes across all extreme dimensions."""
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
db = json.loads((DATA / 'shenyun-21x26-seeds-database.json').read_text(encoding='utf-8'))['schemes']

print(f'Total 21x26 IEUAO 399-unique pure-y schemes: {len(db)}')
print('D distribution:', sorted(Counter(s['D'] for s in db).items()))
print('M distribution:', sorted(Counter(s['M'] for s in db).items()))
print('V distribution:', sorted(Counter(s['V'] for s in db).items()))
print('Pure8B (B2B1 vs S005 B2B1) count:', sum(1 for s in db if s['isPure8B']))
print('8B worst ratio (B2B1 vs S005 B2B1) range:', min(s['eightWorstRatioB2B1'] for s in db), max(s['eightWorstRatioB2B1'] for s in db))
print('8B worst ratio (B1B2 vs S005 B1B2) range:', min(s['eightWorstRatioB1B2'] for s in db), max(s['eightWorstRatioB1B2'] for s in db))

def fmt(s):
    return (f"{s['id']:42s} | v3={s['ckt_v3']:.5f} raw={s['ckt_v3_raw']:.5f} v2={s['ckt_v2']:.5f} "
            f"| M={s['M']:2d}/D={s['D']}/V={s['V']} | Home={s['homeS2']*100:.2f}%({s['homeFloor']*100:.2f}%) "
            f"| Pmax={s['Pmax']*100:.2f}% | S2={s['S2ms']:.2f} E6={s['E6']:.4f} | Aff={s['crossAffected5Cut']*100:.2f}% "
            f"| w3p0={s['v3Tracks']['keytao_word3']['p0']*100:.2f}% w4p0={s['v3Tracks']['keytao_word4']['p0']*100:.2f}%")

print('\n=== 1. TOP 20 OVERALL CKT v3 ===')
for i, s in enumerate(sorted(db, key=lambda x: x['ckt_v3'])[:20], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 2. BEST BY DISPLACEMENT D (D=0, 1, 2, 3, 4, 5, 6) ===')
for d_val in sorted({s['D'] for s in db}):
    sub = sorted([s for s in db if s['D'] == d_val], key=lambda x: x['ckt_v3'])
    print(f"--- D = {d_val} (count={len(sub)}) ---")
    for s in sub[:5]:
        print("  ", fmt(s))

print('\n=== 3. BEST BY MEMORY M (M <= 38) ===')
for m_val in sorted({s['M'] for s in db if s['M'] <= 38}):
    sub = sorted([s for s in db if s['M'] == m_val], key=lambda x: x['ckt_v3'])
    print(f"--- M = {m_val} (count={len(sub)}) ---")
    for s in sub[:5]:
        print("  ", fmt(s))

print('\n=== 4. TOP 15 HIGH HOME ROW (homeS2 & homeFloor) ===')
for i, s in enumerate(sorted(db, key=lambda x: -x['homeS2'])[:15], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 5. TOP 15 LOW RIGHT PINKY (Pmax) ===')
for i, s in enumerate(sorted(db, key=lambda x: (x['Pmax'], x['ckt_v3']))[:15], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 6. TOP 15 LOWEST RAW CKT (S2ms) & EnsembleV6 ===')
for i, s in enumerate(sorted(db, key=lambda x: x['S2ms'])[:15], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 7. TOP 15 LOWEST COMPLETION CKT v2 & RAW v3 ===')
for i, s in enumerate(sorted(db, key=lambda x: x['ckt_v2'])[:15], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 8. TOP 15 LOWEST 4-CODE CROSS COLLISION (crossAffected5Cut) ===')
for i, s in enumerate(sorted(db, key=lambda x: x['crossAffected5Cut'])[:15], 1):
    print(f"{i:2d}. {fmt(s)}")

print('\n=== 9. TOP 15 LOWEST WORD3 / WORD4 COLLISION (w3_p0 + w4_p0) ===')
for i, s in enumerate(sorted(db, key=lambda x: x['v3Tracks']['keytao_word3']['p0'] + x['v3Tracks']['keytao_word4']['p0'])[:15], 1):
    print(f"{i:2d}. {fmt(s)}")
