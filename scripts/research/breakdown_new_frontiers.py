import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
results = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))

print(f"Total newly scored Pareto elites: {len(results)}")

# Group by category
print("\n=======================================================")
print("CATEGORY A: NEW D = 0 SCHEMES (ZERO ONSET DISPLACEMENT)")
print("=======================================================")
d0 = [r for r in results if r['D'] == 0]
for i, s in enumerate(sorted(d0, key=lambda x: x['ckt_v3'] or 999)[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")

print("\n=======================================================")
print("CATEGORY B: NEW LOW M (M <= 41, D <= 1) SCHEMES")
print("=======================================================")
lowm = [r for r in results if r['M'] <= 41 and r['D'] <= 1]
for i, s in enumerate(sorted(lowm, key=lambda x: x['ckt_v3'] or 999)[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")

print("\n=======================================================")
print("CATEGORY C: NEW PURE 8B SCHEMES (ALL 8 METRICS < S005)")
print("=======================================================")
pure8b = [r for r in results if r['isPure8B']]
for i, s in enumerate(sorted(pure8b, key=lambda x: x['ckt_v3'] or 999)[:10]):
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} 8B_worst={s['eightWorstRatio']:.6f} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f} (origin: {s['origin']})")

print("\n=======================================================")
print("CATEGORY D: NEW HIGH HOME ROW (HOME >= 50%) SCHEMES")
print("=======================================================")
high_home = [r for r in results if r['homeS2'] >= 0.50]
for i, s in enumerate(sorted(high_home, key=lambda x: x['ckt_v3'] or 999)[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} Home={s['homeS2']*100:.2f}% M={s['M']} D={s['D']} Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")

print("\n=======================================================")
print("CATEGORY E: NEW CAMPAIGN 1 (18389e333036 <-> d0b1b29e49f9) FACE CANDIDATES")
print("=======================================================")
c1 = [r for r in results if 'c1_face' in r.get('phase', '')]
for i, s in enumerate(sorted(c1, key=lambda x: x['ckt_v3'] or 999)[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")
