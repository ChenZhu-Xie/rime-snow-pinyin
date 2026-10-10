#!/usr/bin/env python3
"""Round 4C Fast Surgical Extraction & 1-Swap Polish (< 30s).

1. D=3 Pure 8B (< 1.0000) & D=3 Speed: Graft e806 D=3 initials onto all R4B Pure 8B (< 9.579) & Speed finals.
2. Pure 8B + Low-Pinky (Pmax <= 5.1% AND 8B < 1.0000): 1-swap polish around BCW-930db2f8379f (8B=1.0044, Pmax=4.15%, v3=9.59113) and BCW-9a856552678a (8B=1.0078, Pmax=3.13%, D=2).
3. 1-swap final polish on new cross-graft ergonomic champions:
   - BCW-cf5b93b6f0f2 (D=2, v3=9.62408, Pmax=4.03%, Home=46.01%)
   - BCW-15e191408091 (D=4, v3=9.59351, Pmax=4.50%, Home=52.87%)
   - BCW-6b1cc27a7754 (D=3, v3=9.61373, Pmax=4.56%, Home=52.87%)
   - BCW-1b52baf9e888 (D=3, v3=9.64504, Pmax=3.42%, Home=50.54%, 8B=1.0078)
"""
from __future__ import annotations
import os
import sys
import json
import hashlib
import time
import importlib.util
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
HTML_PATH = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
DATA = ROOT / 'research-notes/data'

os.chdir(REPLAY)
sys.path[:0] = [str(REPLAY), str(ROOT / 'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(REPLAY), '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]

spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

from b_path_fast import FastBuckets, NAMES
from fast_completion_word2 import FastCompletion

bfast = FastBuckets(b, first_word=True)
ckt_fast = FastCompletion(b, HTML_PATH, first_word=True, v2=True)

aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
physical = [k for k in range(26) if k not in aux]
allowed = set(physical)

p_r11 = DATA / 'shenyun-completion-ckt-fixed-r11.json'
frozen = json.loads(p_r11.read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))
s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))

seed_lookup = {}
for lst in (s0, s1, s2, s3, s4):
    for x in lst:
        if x.get('state'):
            seed_lookup[x['id']] = x

# Keep visited only for already-SCORED states so any unscored graft from R4B can be picked!
visited = set()
for x in seed_lookup.values():
    if x.get('ckt_v3') is not None:
        visited.add(tuple(map(int, x['state'])))

all_candidates = {}

def evaluate_state(st, origin, phase, cap_m=46, cap_d=5, max_eight=None, max_p=None, min_home=None, max_s2=None):
    sig = tuple(map(int, st))
    if sig in visited:
        return None
    visited.add(sig)

    if not np.array_equal(st[62:], aux) or set(map(int, st[27:62])) != allowed:
        return None

    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > cap_m or displaced > cap_d:
        return None

    p_load = float(b.r5.rp(st)[1])
    if max_p is not None and p_load > max_p:
        return None

    home = float(b.r5.home(st)[0])
    if min_home is not None and home < min_home:
        return None

    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
    s2ms = float(factors[0])
    if max_s2 is not None and s2ms > max_s2:
        return None

    entry = b.opt.toentry(st, b.DATA, 'cand')
    bm = bfast.score(entry['codeList'])
    worst_8b = max(bm[key] / b_baseline[key] for key in NAMES)
    if max_eight is not None and worst_8b > max_eight:
        return None

    times, misses, first_counts, second_counts = ckt_fast.score(st)
    surrogate_ckt = float(times[0] + 600 * misses[0])

    digest = hashlib.sha256(json.dumps(entry['codeList'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()[:12]
    ident = f'BCW-{digest}'

    rec = {
        'id': ident,
        'origin': origin,
        'phase': phase,
        'state': [int(x) for x in st],
        'codeList': entry['codeList'],
        'capacity': [21, 21],
        'tone': 'IVUAO',
        'M': int(memory),
        'D': int(displaced),
        'unique399': int(unique),
        'homeS2': home,
        'Pmax': p_load,
        'S2ms': s2ms,
        'v5': float(factors[1]),
        'v4': float(factors[2]),
        'eightWorstRatio': float(worst_8b),
        'isPure8B': bool(worst_8b < 1.0),
        'bMetricsRatio': {k: float(bm[k] / b_baseline[k]) for k in NAMES},
        'surrogate_ckt': surrogate_ckt,
        'ckt_v3': None
    }
    all_candidates[ident] = rec
    return rec

t0 = time.time()

# 1. Graft D=3 (e806, d651, ca54) & D=2 (1838, 9a85, 233a) initials onto R4B Pure 8B & Top Speed finals
init_ids = [
    'BCW-e806ff772afe',  # D=3 Home=43.56%
    'BCW-f420619c19db',  # D=4 Home=43.56%
    'BCW-ee2924bf75d6',  # D=4 Home=43.56%
    'BCW-d651a02d1be1',  # D=3 Pmax=3.42%
    'BCW-ca54a8174e46',  # D=3 Pmax=3.42%
    'BCW-6b507b25d1aa',  # D=3 Home=50.22% Pmax=3.42%
    'BCW-18389e333036',  # D=2
    'BCW-9a856552678a',  # D=2 Pmax=3.13%
]
final_ids = [
    'BCW-4f7b475cca86',  # 9.57392 Pure 8B
    'BCW-d18a30c7ca84',  # 9.57431 Speed
    'BCW-af71075edb2d',  # 9.57447 Pure 8B
    'BCW-e751eb3fc2e0',  # 9.57454 Pure 8B
    'BCW-0314ee40d385',  # 9.57487 Pure 8B
    'BCW-e20b131daf85',  # 9.57568 Speed
    'BCW-16af7820e167',  # 9.57580 Pure 8B
    'BCW-54aa88731d97',  # 9.57636 Pure 8B
    'BCW-a9abf69fd843',  # 9.57640 Pure 8B
    'BCW-dc651555df92',  # 9.57702 Pure 8B
    'BCW-34dd9890bd1b',  # 9.57798 Pure 8B
    'BCW-44416892ccfa',  # 9.57820 Pure 8B
    'BCW-1e7bff4b6512',  # 9.60110 Pure 8B
    'BCW-cb37113b38ff',  # 9.60112 Pure 8B
    'BCW-f00a8ecc044d',  # 9.60168 Pure 8B
    'BCW-d7a01ae68ae9',  # 9.60191 Pure 8B
]

for iid in init_ids:
    if iid not in seed_lookup:
        continue
    ist = np.array(seed_lookup[iid]['state'], dtype=np.int32)
    for fid in final_ids:
        if fid not in seed_lookup:
            continue
        fst = np.array(seed_lookup[fid]['state'], dtype=np.int32)
        st = ist.copy()
        st[21:62] = fst[21:62]
        evaluate_state(st, f'{iid[:10]}x{fid[:10]}', 'r4c_d3_pure8b_graft', cap_m=45, cap_d=4, max_eight=1.015)

print(f'Step 1 grafts: {len(all_candidates)} ({time.time()-t0:.1f}s)', flush=True)

# 2. 1-swap final polish on new ergonomic & low-pinky cross-graft champions
ergo_polish_ids = [
    'BCW-cf5b93b6f0f2',  # D=2 9.62408 Pmax=4.03% Home=46.01%
    'BCW-930db2f8379f',  # D=4 9.59113 Pmax=4.15% Home=48.97% 8B=1.0044
    'BCW-15e191408091',  # D=4 9.59351 Pmax=4.50% Home=52.87%
    'BCW-6b1cc27a7754',  # D=3 9.61373 Pmax=4.56% Home=52.87%
    'BCW-1b52baf9e888',  # D=3 9.64504 Pmax=3.42% Home=50.54% 8B=1.0078
    'BCW-9a856552678a',  # D=2 9.66771 Pmax=3.13% Home=46.95% 8B=1.0078
]

for sid in ergo_polish_ids:
    if sid not in seed_lookup:
        continue
    bst = np.array(seed_lookup[sid]['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                evaluate_state(st, sid, 'r4c_ergo_1swap', cap_m=45, cap_d=4, max_eight=1.018, max_p=0.0510, max_s2=70.6)

print(f'After Step 2: {len(all_candidates)} total candidates ({time.time()-t0:.1f}s)', flush=True)

candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

# D=3 Pure 8B
for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] <= 3], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_d3_pure8b')
# D=3 Speed
for c in sorted([x for x in candidates_list if x['D'] <= 3], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_d3_speed')
# Pure 8B + Low Pinky!
for c in sorted([x for x in candidates_list if x['isPure8B'] and x['Pmax'] <= 0.0510], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_pure8b_low_pinky')
# D=2 Low Pinky
for c in sorted([x for x in candidates_list if x['D'] <= 2 and x['Pmax'] <= 0.0510], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_d2_low_pinky')
# Dual-gated Home >= 50% & Pmax <= 5.1%
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0510 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_ergo_home50')
# Low Pinky overall
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0510], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4c_low_pinky_speed')

print(f'Selected {len(elites)} distinct Round 4C elite candidates for exact CKT v3 evaluation.', flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round4c-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
out_meta_path = DATA / 'shenyun-21x21-round4c-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}', flush=True)
