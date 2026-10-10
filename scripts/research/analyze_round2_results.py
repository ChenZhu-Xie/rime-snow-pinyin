#!/usr/bin/env python3
"""Analyze the results of Round 2 4-direction exploration campaign."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'

meta = json.loads((DATA / 'shenyun-21x21-round2-elites-meta.json').read_text(encoding='utf-8'))
meta_map = {r['id']: r for r in meta}

scored = json.loads((DATA / 'shenyun-21x21-round2-elites-scored.json').read_text(encoding='utf-8'))
scored_map = {r['id']: r for r in scored}

merged = []
for cid, m in meta_map.items():
    sc = scored_map.get(cid)
    if sc and sc['ckt_v3'] is not None:
        merged.append({
            **m,
            'ckt_v3': sc['ckt_v3'],
            'modes': sc['modes']
        })

print(f"Total scored round 2 elites: {len(merged)}")

# Global Top 10 by CKT v3
print("\n==========================================================================")
print("GLOBAL TOP 10 CKT v3 IN ROUND 2:")
print("==========================================================================")
for i, s in enumerate(sorted(merged, key=lambda x: x['ckt_v3'])[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")
    print(f"    Phase: {s['phase']} | Origin: {s['origin']} | Reasons: {', '.join(s.get('elite_reasons', []))}")

# Direction 1: Micro-annealing around 18389e333036
print("\n==========================================================================")
print("DIRECTION 1: MICRO-ANNEALING AROUND 18389e333036:")
print("==========================================================================")
d1 = [s for s in merged if 'd1_' in s['phase']]
for i, s in enumerate(sorted(d1, key=lambda x: x['ckt_v3'])[:8]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (phase: {s['phase']})")

# Direction 2: Orthogonal Decoupling of 4-key collisions
print("\n==========================================================================")
print("DIRECTION 2: ORTHOGONAL DECOUPLING:")
print("==========================================================================")
d2 = [s for s in merged if 'd2_' in s['phase']]
for i, s in enumerate(sorted(d2, key=lambda x: x['ckt_v3'])[:8]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")

# Direction 3: Asymmetric Hand Alternation
print("\n==========================================================================")
print("DIRECTION 3: ASYMMETRIC HAND ALTERNATION:")
print("==========================================================================")
d3 = [s for s in merged if 'd3_' in s['phase']]
for i, s in enumerate(sorted(d3, key=lambda x: x['ckt_v3'])[:8]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")

# Direction 4: Deep Dive into D=0 & M40/M41 Basins
print("\n==========================================================================")
print("DIRECTION 4: D=0 & M40/M41 DEEP DIVE:")
print("==========================================================================")
d4 = [s for s in merged if 'd4_' in s['phase']]
for i, s in enumerate(sorted(d4, key=lambda x: x['ckt_v3'])[:12]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (phase: {s['phase']})")

# Save combined summary
out_combined = DATA / 'shenyun-21x21-round2-summary.json'
out_combined.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved combined summary to {out_combined}")
