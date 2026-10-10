import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
db = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']

print(f'Total 21x21 IVUAO schemes in database: {len(db)}')

# 1. Top CKT v3 Overall
by_v3 = sorted(db, key=lambda x: x['ckt_v3'])
print('\n=== 1. Top 15 Overall CKT v3 Schemes ===')
for i, s in enumerate(by_v3[:15]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")

# 2. D = 0 Champions
d0_schemes = [s for s in db if s['D'] == 0]
d0_by_v3 = sorted(d0_schemes, key=lambda x: x['ckt_v3'])
print(f'\n=== 2. Top D = 0 Schemes (Total {len(d0_schemes)}) ===')
for i, s in enumerate(d0_by_v3[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")

# 3. Low M Champions (M <= 41)
low_m_schemes = [s for s in db if s['M'] <= 41]
low_m_by_v3 = sorted(low_m_schemes, key=lambda x: x['ckt_v3'])
print(f'\n=== 3. Top Low-M Schemes (M <= 41, Total {len(low_m_schemes)}) ===')
for i, s in enumerate(low_m_by_v3[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")

# 4. Pure 8B Champions (eightWorstRatio < 1.0)
pure_8b_schemes = [s for s in db if s['isPure8B']]
pure_8b_by_v3 = sorted(pure_8b_schemes, key=lambda x: x['ckt_v3'])
print(f'\n=== 4. Top Pure 8B Schemes (< S005 on all 8 metrics, Total {len(pure_8b_schemes)}) ===')
for i, s in enumerate(pure_8b_by_v3[:10]):
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} 8B_worst={s['eightWorstRatio']:.6f} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}")

# 5. High Home Row Champions (Home >= 50%)
high_home = [s for s in db if s['homeS2'] >= 0.50]
high_home_by_v3 = sorted(high_home, key=lambda x: x['ckt_v3'])
print(f'\n=== 5. Top High Home Row Schemes (Home >= 50%, Total {len(high_home)}) ===')
for i, s in enumerate(high_home_by_v3[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} Home={s['homeS2']*100:.2f}% M={s['M']} D={s['D']} Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")

# 6. Low Pinky Champions (Pmax <= 0.05)
low_pinky = [s for s in db if s['Pmax'] <= 0.05]
low_pinky_by_v3 = sorted(low_pinky, key=lambda x: x['ckt_v3'])
print(f'\n=== 6. Top Low Right Pinky Schemes (Pmax <= 5%, Total {len(low_pinky)}) ===')
for i, s in enumerate(low_pinky_by_v3[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} Pmax={s['Pmax']*100:.2f}% M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% S2ms={s['S2ms']:.2f}{pure}")

# 7. Raw CKT (S2ms) Champions
by_s2 = sorted(db, key=lambda x: x['S2ms'])
print('\n=== 7. Top Lowest Raw CKT (S2ms) Schemes ===')
for i, s in enumerate(by_s2[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: S2ms={s['S2ms']:.3f} CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}%{pure}")

# 8. Highest Raw 2-Key Unique (unique399)
by_uniq = sorted(db, key=lambda x: -x['unique399'])
print('\n=== 8. Top Highest 2-Key Unique (unique399) Schemes ===')
for i, s in enumerate(by_uniq[:10]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: Unique399={s['unique399']} CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}%{pure}")
