#!/usr/bin/env python3
"""Execute the 4-direction high-dimensional exploration campaign for CKT v3 breakthroughs.

Direction 1: Local micro-annealing & 1-2 step mutations around BCW-18389e333036.
Direction 2: Orthogonal decoupling of 4-key collisions (2-char words vs 4-char idioms).
Direction 3: Asymmetric hand alternation for continuous initial sequences (S-S-S-S).
Direction 4: Deep dive into D=0 & M40/M41 basins (511d, b77e, 72a9, 5ec6).
"""
from __future__ import annotations
import os
import sys
import json
import gzip
import base64
import re
import random
import hashlib
import time
import subprocess
import importlib.util
from collections import Counter, defaultdict
from itertools import combinations, product
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

# Left and right physical keys (excluding AVUIO)
# Left: Q, W, E, R, T, S, D, F, G, Z, X, C (12 keys)
# Right: Y, P, H, J, K, L, B, N, M (9 keys)
left_keys = set(b.opt.META['keys'].index(k) for k in 'QWERTSDFGZXC')
right_keys = set(b.opt.META['keys'].index(k) for k in 'YPHJKLBNM')


p_r11 = DATA / 'shenyun-completion-ckt-fixed-r11.json'
p_v2 = DATA / 'shenyun-completion-ckt-fixed-v2.json'
frozen = json.loads(p_r11.read_text(encoding='utf-8'))['schemes'] if p_r11.exists() else json.loads(p_v2.read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

# Load seeds and existing summaries
db1 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
db2 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
seed_lookup = {s['id']: s for s in db1}
seed_lookup.update({s['id']: s for s in db2})

visited = set()
all_candidates = {}

def evaluate_state(st, origin, phase, cap_m=48, cap_d=7, max_eight=None):
    sig = tuple(map(int, st))
    if sig in visited:
        return None
    visited.add(sig)

    if not np.array_equal(st[62:], aux) or set(map(int, st[27:62])) != allowed:
        return None

    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > cap_m or displaced > cap_d:
        return None

    entry = b.opt.toentry(st, b.DATA, 'cand')
    bm = bfast.score(entry['codeList'])
    worst_8b = max(bm[key] / b_baseline[key] for key in NAMES)
    if max_eight is not None and worst_8b > max_eight:
        return None

    p_load = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)

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
        'S2ms': float(factors[0]),
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

print('Initialized fast evaluation environment.')
st_183 = np.array(seed_lookup['BCW-18389e333036']['state'], dtype=np.int32)
st_52e = np.array(seed_lookup['BCW-52efebf27ff1']['state'], dtype=np.int32)
st_d97 = np.array(seed_lookup['BCW-d976864e1f53']['state'], dtype=np.int32)
st_b77 = np.array(seed_lookup['BCW-b77e2d88ac94']['state'], dtype=np.int32)
st_511 = np.array(seed_lookup['BCW-511d69ea162d']['state'], dtype=np.int32)
st_72a = np.array(seed_lookup['BCW-72a9341d2fdc']['state'], dtype=np.int32)
st_5ec = np.array(seed_lookup['BCW-5ec69bbb9ec9']['state'], dtype=np.int32)

t0 = time.time()

# =========================================================================
# CAMPAIGN 1: LOCAL MICRO-ANNEALING AROUND BCW-18389e333036
# =========================================================================
print('\n[1/4] Campaign 1: Local micro-annealing around BCW-18389e333036...')
c1_count = 0

# 1.1 All 1-swap of finals in 18389e333036
print('  1.1 Systematic final swaps (35 choose 2)...')
for i in range(35):
    for j in range(i + 1, 35):
        if st_183[27 + i] != st_183[27 + j]:
            st = st_183.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            if evaluate_state(st, 'BCW-18389e333036', 'd1_final_swap', cap_m=46, cap_d=3, max_eight=1.06):
                c1_count += 1

# 1.2 All 1-swap of initials in 18389e333036 (within physical keys)
print('  1.2 Systematic initial swaps (21 choose 2)...')
for i in range(21):
    for j in range(i + 1, 21):
        if st_183[i] != st_183[j]:
            st = st_183.copy()
            st[i], st[j] = st[j], st[i]
            if evaluate_state(st, 'BCW-18389e333036', 'd1_initial_swap', cap_m=46, cap_d=3, max_eight=1.06):
                c1_count += 1

# 1.3 Sub-block grafting: 18389e333036 (word4 speed) <-> 52efebf27ff1 (char/word2 speed)
print('  1.3 Grafting sub-blocks between 18389e333036 and 52efebf27ff1...')
diff_finals = [i for i in range(35) if st_183[27 + i] != st_52e[27 + i]]
diff_initials = [i for i in range(21) if st_183[i] != st_52e[i]]
print(f'    Diff finals: {len(diff_finals)}, Diff initials: {len(diff_initials)}')

# Random combinations of grafting finals (subsets of size 1 to 4)
random.seed(42)
for k in (1, 2, 3, 4):
    for sample in combinations(diff_finals, k):
        if random.random() < 0.15: # sample representative combinations
            st = st_183.copy()
            for idx in sample:
                st[27 + idx] = st_52e[27 + idx]
            if evaluate_state(st, 'BCW-18389e333036+52efeb', 'd1_graft_finals', cap_m=46, cap_d=3, max_eight=1.05):
                c1_count += 1

# And grafting initials from 183 into 52e
for k in (1, 2, 3):
    for sample in combinations(diff_initials, k):
        st = st_52e.copy()
        for idx in sample:
            st[idx] = st_183[idx]
        if evaluate_state(st, 'BCW-52efeb+18389e', 'd1_graft_initials', cap_m=46, cap_d=3, max_eight=1.05):
            c1_count += 1

print(f'  Campaign 1 produced {c1_count} valid states.')

# =========================================================================
# CAMPAIGN 2: ORTHOGONAL DECOUPLING OF 4-KEY COLLISIONS
# =========================================================================
print('\n[2/4] Campaign 2: Orthogonal decoupling of 4-key collisions...')
c2_count = 0
# Identify the top 5 most heavily loaded final keys in st_183 and st_52e
# Perturb finals on those keys into keys with lower idiom-onset load
final_key_counts = Counter(st_183[27:62])
heavy_keys = [k for k, _ in final_key_counts.most_common(5)]
light_keys = [k for k in allowed if k not in heavy_keys]

for h_k in heavy_keys:
    h_indices = [i for i in range(35) if st_183[27 + i] == h_k]
    for l_k in light_keys[:6]:
        for idx in h_indices:
            st = st_183.copy()
            st[27 + idx] = l_k
            if evaluate_state(st, 'BCW-18389e333036', 'd2_decouple_move', cap_m=46, cap_d=3, max_eight=1.05):
                c2_count += 1

# Also test on st_52e
final_key_counts_52 = Counter(st_52e[27:62])
heavy_keys_52 = [k for k, _ in final_key_counts_52.most_common(5)]
light_keys_52 = [k for k in allowed if k not in heavy_keys_52]
for h_k in heavy_keys_52:
    h_indices = [i for i in range(35) if st_52e[27 + i] == h_k]
    for l_k in light_keys_52[:6]:
        for idx in h_indices:
            st = st_52e.copy()
            st[27 + idx] = l_k
            if evaluate_state(st, 'BCW-52efebf27ff1', 'd2_decouple_move', cap_m=46, cap_d=3, max_eight=1.05):
                c2_count += 1

print(f'  Campaign 2 produced {c2_count} valid states.')

# =========================================================================
# CAMPAIGN 3: ASYMMETRIC HAND ALTERNATION FOR S-S-S-S
# =========================================================================
print('\n[3/4] Campaign 3: Asymmetric hand alternation for S-S-S-S...')
c3_count = 0
# Swap pairs of initials between left hand and right hand on st_d97 (v3=9.6792, Home=51.86%, Pmax=3.63%)
# and st_183 to test if hand-alternating initial layouts lower L4 costs
for seed_name, base_st in [('BCW-d976864e1f53', st_d97), ('BCW-18389e333036', st_183)]:
    left_initials = [i for i in range(21) if base_st[i] in left_keys]
    right_initials = [i for i in range(21) if base_st[i] in right_keys]
    for li in left_initials:
        for ri in right_initials:
            st = base_st.copy()
            st[li], st[ri] = st[ri], st[li]
            if evaluate_state(st, seed_name, 'd3_hand_swap', cap_m=46, cap_d=3, max_eight=1.05):
                c3_count += 1

print(f'  Campaign 3 produced {c3_count} valid states.')

# =========================================================================
# CAMPAIGN 4: DEEP DIVE INTO D=0 & M40/M41 BASINS
# =========================================================================
print('\n[4/4] Campaign 4: Deep dive into D=0 & M40/M41 basins...')
c4_count = 0

# 4.1 Exhaustive coordinate face between 511d (M40/D0) and 72a9 (M40/D0)
# Exactly 7 differing final positions
diff_511_72a = [i for i in range(35) if st_511[27 + i] != st_72a[27 + i]]
print(f'  4.1 Exhaustive 2^{len(diff_511_72a)} coordinate face between 511d and 72a9...')
choices = [(pos, (int(st_511[27 + pos]), int(st_72a[27 + pos]))) for pos in diff_511_72a]
for choice in product(*(vals for _, vals in choices)):
    st = st_511.copy()
    for (pos, _), val in zip(choices, choice):
        st[27 + pos] = val
    if evaluate_state(st, 'BCW-511d<->72a9', 'd4_511_72a_face', cap_m=40, cap_d=0, max_eight=1.05):
        c4_count += 1

# 4.2 Systematic coordinate face between b77e (M41/D0) and 511d (M40/D0)
print('  4.2 Coordinate sampling between b77e and 511d...')
diff_b77_511 = [i for i in range(62) if st_b77[i] != st_511[i]]
choices_b_5 = [(pos, (int(st_b77[pos]), int(st_511[pos]))) for pos in diff_b77_511]
for _ in range(25000):
    st = st_b77.copy()
    for pos, vals in choices_b_5:
        if random.random() < 0.5:
            st[pos] = vals[1]
    if evaluate_state(st, 'BCW-b77e<->511d', 'd4_b77_511_face', cap_m=41, cap_d=0, max_eight=1.05):
        c4_count += 1

# 4.3 D=0 systematic 1-swap of finals around b77e and 511d (M<=41, D=0)
print('  4.3 D=0 systematic 1-swap of finals on b77e and 511d...')
for base_name, base_st in [('BCW-b77e2d88ac94', st_b77), ('BCW-511d69ea162d', st_511)]:
    for i in range(35):
        for j in range(i + 1, 35):
            if base_st[27 + i] != base_st[27 + j]:
                st = base_st.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                if evaluate_state(st, base_name, 'd4_d0_final_swap', cap_m=41, cap_d=0, max_eight=1.05):
                    c4_count += 1

# 4.4 Minimal D=1 relaxation around b77e and 511d (M<=41, D=1)
print('  4.4 D=1 minimal relaxation around b77e and 511d...')
for base_name, base_st in [('BCW-b77e2d88ac94', st_b77), ('BCW-511d69ea162d', st_511)]:
    for i in range(21):
        for j in range(i + 1, 21):
            if base_st[i] != base_st[j]:
                st = base_st.copy()
                st[i], st[j] = base_st[j], base_st[i]
                if evaluate_state(st, base_name, 'd4_d1_relax_swap', cap_m=41, cap_d=1, max_eight=1.045):
                    c4_count += 1

print(f'  Campaign 4 produced {c4_count} valid states.')

elapsed = time.time() - t0
print(f'\nTotal valid states across all 4 campaigns: {len(all_candidates)} in {elapsed:.1f}s')

# Select Pareto elites for exact 8-track CKT v3 evaluation
print('\nSelecting elite frontier candidates across multiple trade-offs...')
candidates_list = list(all_candidates.values())

# Pareto buckets
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        elites[c['id']]['elite_reasons'].append(reason)

# 1. Best surrogate CKT overall
for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:35]:
    add_elite(c, 'top_surrogate_speed')

# 2. Best D=0 schemes
d0_cands = [c for c in candidates_list if c['D'] == 0]
for c in sorted(d0_cands, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'top_d0_speed')
for c in sorted(d0_cands, key=lambda x: -x['homeS2'])[:15]:
    add_elite(c, 'top_d0_home')

# 3. Best D<=1 and M<=41 schemes
low_m_cands = [c for c in candidates_list if c['M'] <= 41 and c['D'] <= 1]
for c in sorted(low_m_cands, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'top_low_m_speed')
for c in sorted(low_m_cands, key=lambda x: x['eightWorstRatio'])[:15]:
    add_elite(c, 'top_low_m_pure8b')

# 4. Best High Home Row (>= 50%)
home_cands = [c for c in candidates_list if c['homeS2'] >= 0.50]
for c in sorted(home_cands, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'top_high_home_speed')

# 5. Best Pure 8B (< 1.0)
pure_cands = [c for c in candidates_list if c['isPure8B']]
for c in sorted(pure_cands, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'top_pure8b_speed')

# 6. Campaign 1 specific elites (micro-annealing around 18389e)
c1_cands = [c for c in candidates_list if 'd1_' in c['phase']]
for c in sorted(c1_cands, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'c1_micro_speed')

print(f'Selected {len(elites)} distinct elite candidates for exact CKT v3 scoring.')

# Format candidate entries for score_candidates_v3.js
entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round2-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}')

# Save summary metadata of elites
out_meta_path = DATA / 'shenyun-21x21-round2-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved elite metadata to {out_meta_path}')
