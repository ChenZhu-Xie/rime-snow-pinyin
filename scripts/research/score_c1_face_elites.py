import os
import sys
import json
import gzip
import base64
import re
import hashlib
import time
import subprocess
import importlib.util
from itertools import product
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
HTML_PATH = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
DATA = ROOT / 'research-notes/data'

os.chdir(REPLAY)
sys.path[:0] = [str(REPLAY), str(ROOT / 'scripts/research')]
sys.argv = ['b', '--replay', str(REPLAY), '--output', 'out.json']

spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

from b_path_fast import FastBuckets, NAMES

bfast = FastBuckets(b, first_word=True)
aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
physical = [k for k in range(26) if k not in aux]
allowed = set(physical)

frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

db = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
seed_lookup = {s['id']: s for s in db}

s_speed = seed_lookup["BCW-18389e333036"]
s_pinky = seed_lookup["BCW-d0b1b29e49f9"]
st_speed = np.array(s_speed['state'], dtype=np.int32)
st_pinky = np.array(s_pinky['state'], dtype=np.int32)

diff_pos = [i for i in range(67) if st_speed[i] != st_pinky[i]]
base_st = st_speed.copy()
varying_choices = [(pos, (int(st_speed[pos]), int(st_pinky[pos]))) for pos in diff_pos]

c1_cands = []
for choice in product(*(vals for _, vals in varying_choices)):
    curr = base_st.copy()
    for (pos, _), val in zip(varying_choices, choice):
        curr[pos] = val
    if set(map(int, curr[27:62])) != allowed:
        continue
    unique, memory, displaced = b.se.stats(curr, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > 43 or displaced > 2:
        continue
    entry = b.opt.toentry(curr, b.DATA, 'cand')
    bm = bfast.score(entry['codeList'])
    worst_8b = max(bm[key] / b_baseline[key] for key in NAMES)
    if worst_8b > 1.025: # tighter filter
        continue
    p_load = float(b.r5.rp(curr)[1])
    home = float(b.r5.home(curr)[0])
    factors = b.opt.metrics(b.opt.initialize(curr, b.opt.PARAMS)[1], b.opt.PARAMS)

    ident = 'BCW-' + hashlib.sha256(curr.tobytes()).hexdigest()[:12]
    c1_cands.append({
        'id': ident,
        'origin': 'face:18389e333036-d0b1b29e49f9',
        'phase': 'c1_face',
        'state': list(map(int, curr)),
        'codeList': list(entry['codeList']),
        'capacity': [21, 21],
        'tone': 'IVUAO',
        'M': int(memory),
        'D': int(displaced),
        'unique399': int(unique),
        'homeS2': home,
        'Pmax': p_load,
        'S2ms': float(factors[0]),
        'eightWorstRatio': float(worst_8b),
        'isPure8B': bool(worst_8b < 1.0)
    })

print(f"C1 tight candidates: {len(c1_cands)}")
# Select top 15 Pareto elites for C1
elites_c1 = {}
for c in sorted(c1_cands, key=lambda x: x['S2ms'])[:8]:
    elites_c1[c['id']] = c
for c in sorted(c1_cands, key=lambda x: x['Pmax'])[:8]:
    elites_c1[c['id']] = c
for c in sorted(c1_cands, key=lambda x: x['eightWorstRatio'])[:8]:
    elites_c1[c['id']] = c
for c in sorted(c1_cands, key=lambda x: -x['homeS2'])[:8]:
    elites_c1[c['id']] = c

c1_list = list(elites_c1.values())
print(f"Selected {len(c1_list)} elites from C1 face.")

cand_file = DATA / 'c1_face_elites.json'
cand_file.write_text(json.dumps(c1_list, indent=2, ensure_ascii=False), encoding='utf-8')

scored_file = DATA / 'c1_face_elites_scored.json'
cmd = ['node', str(ROOT / 'scripts/research/score_candidates_v3.js'),
       '--input', str(cand_file), '--output', str(scored_file)]
subprocess.run(cmd, check=True)

res = json.loads(scored_file.read_text(encoding='utf-8'))
for item in res:
    for c in c1_list:
        if c['id'] == item['id']:
            c['ckt_v3'] = item['ckt_v3']

print("\n--- Top C1 Face Intermediate Schemes ---")
for i, s in enumerate(sorted(c1_list, key=lambda x: x['ckt_v3'] or 999)[:10]):
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f} (8B={s['eightWorstRatio']:.4f})")

# Merge into final summary
all_sum = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
all_lookup = {x['id']: x for x in all_sum}
for c in c1_list:
    all_lookup[c['id']] = c
final_list = list(all_lookup.values())
(DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').write_text(json.dumps(final_list, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Updated final summary with {len(final_list)} total schemes.")
