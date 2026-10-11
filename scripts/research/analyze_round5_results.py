#!/usr/bin/env python3
"""Analyze the results of Round 5 exact-4-track multi-basin and canyon campaign."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'

meta_all = []
scored_all = []
for suffix in ('round5', 'round5b', 'round5c', 'round5d'):
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

print(f"Total scored Round 5 elites: {len(merged)}")

def show_list(title, items, limit=10):
    print("\n==========================================================================")
    print(title)
    print("==========================================================================")
    for i, s in enumerate(sorted(items, key=lambda x: x['ckt_v3'])[:limit]):
        pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
        print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} (est={s['surrogate_ckt']:.5f}) M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")
        print(f"    Phase: {s['phase']} | Origin: {s['origin']} | Reasons: {', '.join(s.get('elite_reasons', []))}")

show_list("1. GLOBAL TOP 15 CKT v3 SCHEMES IN ROUND 5:", merged, 15)
show_list("2. D<=3 TOP 12 CKT v3 SCHEMES IN ROUND 5:", [s for s in merged if s['D'] <= 3], 12)
show_list("3. PURE 8B (< 1.0000) CHAMPIONS (ALL D):", [s for s in merged if s['isPure8B']], 12)
show_list("4. PURE 8B AT D<=3 CHAMPIONS:", [s for s in merged if s['isPure8B'] and s['D'] <= 3], 12)
show_list("5. PURE 8B AT D<=2 (D=0, D=1, D=2) CANYON BRIDGES:", [s for s in merged if s['isPure8B'] and s['D'] <= 2], 12)
show_list("6. TRIPLE-CROWN BASIN (Pure 8B < 1.0 + Low-Pinky <= 5.1%):", [s for s in merged if s['isPure8B'] and s['Pmax'] <= 0.0511], 12)
show_list("7. TRIPLE-CROWN DUAL-GATED (Pure 8B < 1.0 + Home >= 50% + Pmax <= 5.1%):", [s for s in merged if s['isPure8B'] and s['Pmax'] <= 0.0511 and s['homeS2'] >= 0.50], 10)
show_list("8. D=0, D=1, D=2 LOW-PINKY (Pmax <= 5.1%) & DUAL-GATED CHAMPIONS:", [s for s in merged if s['D'] <= 2 and s['Pmax'] <= 0.0511], 15)
show_list("9. D=0, D=1, D=2 OVERALL SPEED & M<=40 CHAMPIONS:", [s for s in merged if s['D'] <= 2], 15)
show_list("10. D=0 & D=1 ALL CHAMPIONS IN ROUND 5:", [s for s in merged if s['D'] <= 1], 15)

out_combined = DATA / 'shenyun-21x21-round5-summary.json'
out_combined.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved combined Round 5 summary ({len(merged)} schemes) to {out_combined}")

