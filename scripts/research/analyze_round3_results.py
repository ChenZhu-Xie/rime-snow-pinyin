#!/usr/bin/env python3
"""Analyze the results of Round 3 deep dive exploration campaign."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'

meta = json.loads((DATA / 'shenyun-21x21-round3-elites-meta.json').read_text(encoding='utf-8'))
meta_map = {r['id']: r for r in meta}

scored = json.loads((DATA / 'shenyun-21x21-round3-elites-scored.json').read_text(encoding='utf-8'))
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

print(f"Total scored round 3 elites: {len(merged)}")

# Global Top 10 by CKT v3 in Round 3
print("\n==========================================================================")
print("ROUND 3 TOP 10 CKT v3 SCHEMES:")
print("==========================================================================")
for i, s in enumerate(sorted(merged, key=lambda x: x['ckt_v3'])[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")
    print(f"    Phase: {s['phase']} | Origin: {s['origin']} | Reasons: {', '.join(s.get('elite_reasons', []))}")

# Track A: Speed champions below 9.59
print("\n==========================================================================")
print("TRACK A: SPEED CHAMPIONS (BELOW 9.59):")
print("==========================================================================")
trA = [s for s in merged if 'r3_40d_' in s['phase'] or 'r3_cross_40_' in s['phase']]
for i, s in enumerate(sorted(trA, key=lambda x: x['ckt_v3'])[:8]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (phase: {s['phase']})")

# Track B: D=0 & M40/M41 zero-displacement frontiers
print("\n==========================================================================")
print("TRACK B: D=0 & M40/M41 ZERO-DISPLACEMENT FRONTIERS:")
print("==========================================================================")
trB = [s for s in merged if s['D'] == 0]
for i, s in enumerate(sorted(trB, key=lambda x: x['ckt_v3'])[:12]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (phase: {s['phase']})")

# Track C: High Home Row (>= 44%)
print("\n==========================================================================")
print("TRACK C: HIGH HOME ROW (>= 44%):")
print("==========================================================================")
trC = [s for s in merged if s['homeS2'] >= 0.44]
for i, s in enumerate(sorted(trC, key=lambda x: x['ckt_v3'])[:8]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (phase: {s['phase']})")

# Save combined summary
out_combined = DATA / 'shenyun-21x21-round3-summary.json'
out_combined.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved combined summary to {out_combined}")
