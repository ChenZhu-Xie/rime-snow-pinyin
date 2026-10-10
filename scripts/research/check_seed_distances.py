import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
db = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
lookup = {s['id']: s for s in db}

SEED_PAIRS = [
    ("BCW-18389e333036", "BCW-d0b1b29e49f9", "Speed <-> Low Pinky (M43/D2)"),
    ("BCW-18389e333036", "BCW-ebcefd552db9", "Speed <-> High Home Row (M43/D2 <-> M45/D3)"),
    ("BCW-18389e333036", "BCW-179ce0db1934", "Speed <-> Low M41/D1"),
    ("BCW-179ce0db1934", "BCW-832393ee6991", "M41/D1 Speed <-> M41/D1 Pure 8B+Home"),
    ("BCW-179ce0db1934", "BCW-f921a7d16044", "M41/D1 Speed <-> M41/D1 Pure 8B Speed"),
    ("BCW-179ce0db1934", "BCW-510c661a02b9", "M41/D1 Speed <-> M41/D0 Zero Displacement"),
    ("BCW-510c661a02b9", "BCW-0aaa5551675d", "M41/D0 Speed <-> M42/D0 Near 8B"),
    ("BCW-179ce0db1934", "BCW-ede7b2a9282b", "M41/D1 Speed <-> M40/D1 Pure 8B"),
    ("BCW-18389e333036", "BCW-b6d79577771b", "Speed <-> Lowest Raw CKT (65.61ms)"),
    ("BCW-d0b1b29e49f9", "BCW-46ea82b702a9", "M43/D2 Low Pinky <-> M43/D3 Pure 8B+Home"),
]

for id1, id2, desc in SEED_PAIRS:
    s1 = lookup[id1]
    s2 = lookup[id2]
    st1 = s1['state']
    st2 = s2['state']
    diff_onsets = [i for i in range(27) if st1[i] != st2[i]]
    diff_rhymes = [i for i in range(27, 62) if st1[i] != st2[i]]
    diff_aux = [i for i in range(62, 67) if st1[i] != st2[i]]
    total_diff = len(diff_onsets) + len(diff_rhymes) + len(diff_aux)
    print(f"\nPair: {id1} <-> {id2} ({desc})")
    print(f"  Total distance: {total_diff} (Onsets: {len(diff_onsets)}, Rhymes: {len(diff_rhymes)}, Aux: {len(diff_aux)})")
    print(f"  Diff onsets: {diff_onsets}")
    print(f"  Combinations if face: 2^{total_diff} = {2**total_diff if total_diff <= 30 else '> 10^9'}")
