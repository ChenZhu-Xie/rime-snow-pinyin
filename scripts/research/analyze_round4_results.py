#!/usr/bin/env python3
"""Analyze the combined results of Round 4, Round 4B, and Round 4C multi-basin canyon and frontier campaign."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'

meta_all = []
scored_all = []
for suffix in ('round4', 'round4b', 'round4c'):
    mp = DATA / f'shenyun-21x21-{suffix}-elites-meta.json'
    sp = DATA / f'shenyun-21x21-{suffix}-elites-scored.json'
    if mp.exists() and sp.exists():
        meta_all.extend(json.loads(mp.read_text(encoding='utf-8')))
        scored_all.extend(json.loads(sp.read_text(encoding='utf-8')))

meta_map = {r['id']: r for r in meta_all}
scored_map = {r['id']: r for r in scored_all}

merged = []
for cid, m in meta_map.items():
    sc = scored_map.get(cid)
    if sc and sc['ckt_v3'] is not None:
        merged.append({
            **m,
            'ckt_v3': sc['ckt_v3'],
            'modes': sc['modes']
        })

print(f"Total scored Round 4 + 4B + 4C elites: {len(merged)}")

def show_list(title, items, limit=10):
    print("\n==========================================================================")
    print(title)
    print("==========================================================================")
    for i, s in enumerate(sorted(items, key=lambda x: x['ckt_v3'])[:limit]):
        pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
        print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")
        print(f"    Phase: {s['phase']} | Origin: {s['origin']} | Reasons: {', '.join(s.get('elite_reasons', []))}")

show_list("1. GLOBAL TOP 15 CKT v3 SCHEMES IN ROUND 4 (ALL D):", merged, 15)
show_list("2. D<=3 TOP 12 CKT v3 SCHEMES IN ROUND 4:", [s for s in merged if s['D'] <= 3], 12)
show_list("3. PURE 8B (8/8 < S005, eightWorstRatio < 1.0000) CHAMPIONS (ALL D):", [s for s in merged if s['isPure8B']], 10)
show_list("4. PURE 8B AT D<=3 CHAMPIONS:", [s for s in merged if s['isPure8B'] and s['D'] <= 3], 10)
show_list("5. D=1 LOW-DISPLACEMENT CANYON CHAMPIONS:", [s for s in merged if s['D'] == 1], 8)
show_list("6. D=2 LOW-DISPLACEMENT CANYON CHAMPIONS:", [s for s in merged if s['D'] == 2], 10)
show_list("7. D=0 ZERO-DISPLACEMENT CHAMPIONS (ALL M & M<=40 & M<=39):", [s for s in merged if s['D'] == 0], 10)
show_list("8. LOW-PINKY (Pmax <= 5.1%) CHAMPIONS:", [s for s in merged if s['Pmax'] <= 0.0511], 12)
show_list("9. ERGONOMIC DUAL-GATED (Pmax <= 5.1% AND Home >= 50%) CHAMPIONS:", [s for s in merged if s['Pmax'] <= 0.0511 and s['homeS2'] >= 0.50], 12)

out_combined = DATA / 'shenyun-21x21-round4-summary.json'
out_combined.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved combined Round 4+4B+4C summary ({len(merged)} schemes) to {out_combined}")
