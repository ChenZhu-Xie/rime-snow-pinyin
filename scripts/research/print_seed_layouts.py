import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
db = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
lookup = {s['id']: s for s in db}

SEED_IDS = [
    "BCW-18389e333036", # Global Speed
    "BCW-d0b1b29e49f9", # Speed + Low Pinky
    "BCW-ebcefd552db9", # High Home + Low Pinky
    "BCW-179ce0db1934", # Low M41/D1 Speed
    "BCW-832393ee6991", # M41/D1 Pure 8B + Home
    "BCW-510c661a02b9", # M41/D0 Zero Displacement
    "BCW-0aaa5551675d", # M42/D0 Near 8B
    "BCW-ede7b2a9282b", # M40/D1 Pure 8B
]

META_KEYS = "QWERTYUIOPASDFGHJKLZXCVBNM;/,.[]\\'"

for sid in SEED_IDS:
    s = lookup.get(sid)
    if not s:
        continue
    st = s['state']
    # Onsets: 27 onsets
    # Rhymes: 35 rhymes
    # Aux: 5 aux
    print(f"\n=======================================================")
    print(f"Seed: {sid} | CKT_v3={s['ckt_v3']:.5f} | M={s['M']} D={s['D']} | Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% | S2ms={s['S2ms']:.2f}")
    print(f"8B worst={s['eightWorstRatio']:.6f} ({'Pure 8B' if s['isPure8B'] else 'Overline'})")
    print(f"Onsets (27 keys): {[META_KEYS[k] for k in st[:27]]}")
    print(f"Rhymes sample (first 10): {[META_KEYS[k] for k in st[27:37]]}")
    print(f"Aux keys: {[META_KEYS[k] for k in st[62:]]}")
