#!/usr/bin/env python3
"""Round 3 Deep Dive Exploration Campaign for Snow Shenyun 21x21 CKT v3.

Target A: Breach 9.58 towards 9.57 by hybridizing BCW-40d7168c0550 (9.59014) and BCW-12d72973b5b5 (9.59785)
Target B: Push D=0 zero-displacement limit below 9.72 towards 9.70 around BCW-4e12e84ed877 and BCW-9d3ffcc750b2
Target C: High home row (>45%) combined with CKT v3 < 9.65
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
from collections import Counter
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

p_r11 = DATA / 'shenyun-completion-ckt-fixed-r11.json'
frozen = json.loads(p_r11.read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

# Load seeds from round 2 summary
r2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
seed_lookup = {s['id']: s for s in r2}

visited = set()
all_candidates = {}

def evaluate_state(st, origin, phase, cap_m=46, cap_d=7, max_eight=None):
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

print('Initialized Round 3 evaluation environment.')

st_40d = np.array(seed_lookup['BCW-40d7168c0550']['state'], dtype=np.int32)
st_12d = np.array(seed_lookup['BCW-12d72973b5b5']['state'], dtype=np.int32)
st_e3a = np.array(seed_lookup['BCW-e3a5ec0586d5']['state'], dtype=np.int32)
st_4e1 = np.array(seed_lookup['BCW-4e12e84ed877']['state'], dtype=np.int32)
st_9d3 = np.array(seed_lookup['BCW-9d3ffcc750b2']['state'], dtype=np.int32)
st_106 = np.array(seed_lookup['BCW-106d38018322']['state'], dtype=np.int32)

t0 = time.time()

# =========================================================================
# TRACK A: PUSHING BELOW 9.59 (SPEED CHAMPIONS 40d7 + 12d7 + e3a5)
# =========================================================================
print('\n[1/3] Track A: Deep micro-search on 9.59 speed champions...')
cA_count = 0

# A.1 Systematic 1-swap of finals on BCW-40d7168c0550 (35 choose 2)
print('  A.1 Final swaps on 40d7168c0550...')
for i in range(35):
    for j in range(i + 1, 35):
        if st_40d[27 + i] != st_40d[27 + j]:
            st = st_40d.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            if evaluate_state(st, 'BCW-40d7168c0550', 'r3_40d_final_swap', cap_m=45, cap_d=3, max_eight=1.04):
                cA_count += 1

# A.2 Systematic 1-swap of initials on BCW-40d7168c0550 (21 choose 2)
print('  A.2 Initial swaps on 40d7168c0550...')
for i in range(21):
    for j in range(i + 1, 21):
        if st_40d[i] != st_40d[j]:
            st = st_40d.copy()
            st[i], st[j] = st[j], st[i]
            if evaluate_state(st, 'BCW-40d7168c0550', 'r3_40d_initial_swap', cap_m=45, cap_d=3, max_eight=1.04):
                cA_count += 1

# A.3 Cross-breeding between 40d7 (word4=419ms) and 12d7 (char=109ms, 8B=1.0042)
print('  A.3 Crossing 40d7 and 12d7...')
diff_40_12 = [i for i in range(62) if st_40d[i] != st_12d[i]]
print(f'    Diff count: {len(diff_40_12)}')
choices_40_12 = [(pos, (int(st_40d[pos]), int(st_12d[pos]))) for pos in diff_40_12]
for _ in range(12000):
    st = st_40d.copy()
    for pos, vals in choices_40_12:
        if random.random() < 0.5:
            st[pos] = vals[1]
    if evaluate_state(st, '40d7<->12d7', 'r3_cross_40_12', cap_m=45, cap_d=3, max_eight=1.03):
        cA_count += 1

# A.4 Hybridizing with e3a5 (high home row 43.56%)
diff_40_e3 = [i for i in range(62) if st_40d[i] != st_e3a[i]]
choices_40_e3 = [(pos, (int(st_40d[pos]), int(st_e3a[pos]))) for pos in diff_40_e3]
for _ in range(8000):
    st = st_40d.copy()
    for pos, vals in choices_40_e3:
        if random.random() < 0.5:
            st[pos] = vals[1]
    if evaluate_state(st, '40d7<->e3a5', 'r3_cross_40_e3', cap_m=45, cap_d=3, max_eight=1.03):
        cA_count += 1

print(f'  Track A produced {cA_count} valid states.')

# =========================================================================
# TRACK B: PUSHING D=0 BELOW 9.72 (4e12 + 9d3f + 106d)
# =========================================================================
print('\n[2/3] Track B: Deep search on D=0 & M40/M41 zero-displacement frontiers...')
cB_count = 0

# B.1 Systematic 1-swap of finals on BCW-4e12e84ed877 (M41/D0, v3=9.72460)
print('  B.1 Final swaps on 4e12e84ed877...')
for i in range(35):
    for j in range(i + 1, 35):
        if st_4e1[27 + i] != st_4e1[27 + j]:
            st = st_4e1.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            if evaluate_state(st, 'BCW-4e12e84ed877', 'r3_4e1_final_swap', cap_m=41, cap_d=0, max_eight=1.038):
                cB_count += 1

# B.2 Systematic 1-swap of finals on BCW-9d3ffcc750b2 (M40/D0, v3=9.72823)
print('  B.2 Final swaps on 9d3ffcc750b2...')
for i in range(35):
    for j in range(i + 1, 35):
        if st_9d3[27 + i] != st_9d3[27 + j]:
            st = st_9d3.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            if evaluate_state(st, 'BCW-9d3ffcc750b2', 'r3_9d3_final_swap', cap_m=40, cap_d=0, max_eight=1.035):
                cB_count += 1

# B.3 Cross-face between 4e12 (M41/D0) and 9d3f (M40/D0)
diff_4e_9d = [i for i in range(27, 62) if st_4e1[i] != st_9d3[i]]
print(f'    Diff finals between 4e12 and 9d3f: {len(diff_4e_9d)}')
choices_4e_9d = [(pos, (int(st_4e1[pos]), int(st_9d3[pos]))) for pos in diff_4e_9d]
for _ in range(15000):
    st = st_4e1.copy()
    for pos, vals in choices_4e_9d:
        if random.random() < 0.5:
            st[pos] = vals[1]
    if evaluate_state(st, '4e12<->9d3f', 'r3_cross_4e_9d', cap_m=41, cap_d=0, max_eight=1.035):
        cB_count += 1

# B.4 Coordinate face between 9d3f (M40/D0) and 106d (M40/D0, Home 44.71%)
diff_9d_106 = [i for i in range(27, 62) if st_9d3[i] != st_106[i]]
print(f'    Diff finals between 9d3f and 106d: {len(diff_9d_106)}')
choices_9d_106 = [(pos, (int(st_9d3[pos]), int(st_106[pos]))) for pos in diff_9d_106]
for _ in range(10000):
    st = st_9d3.copy()
    for pos, vals in choices_9d_106:
        if random.random() < 0.5:
            st[pos] = vals[1]
    if evaluate_state(st, '9d3f<->106d', 'r3_cross_9d_106', cap_m=40, cap_d=0, max_eight=1.035):
        cB_count += 1

print(f'  Track B produced {cB_count} valid states.')

# =========================================================================
# TRACK C: EXTREME HOME ROW (>45% ~ 50%) WITH LOW CKT V3
# =========================================================================
print('\n[3/3] Track C: High home row (>45%) with low CKT v3...')
cC_count = 0
# Perturb finals on st_106 (Home=44.71%) to test if home row can be elevated to >= 46% with CKT v3 < 9.73
for i in range(35):
    for j in range(i + 1, 35):
        if st_106[27 + i] != st_106[27 + j]:
            st = st_106.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            home = float(b.r5.home(st)[0])
            if home >= 0.44:
                if evaluate_state(st, 'BCW-106d38018322', 'r3_high_home_swap', cap_m=41, cap_d=0, max_eight=1.04):
                    cC_count += 1

print(f'  Track C produced {cC_count} valid states.')

elapsed = time.time() - t0
print(f'\nTotal valid states across all Round 3 tracks: {len(all_candidates)} in {elapsed:.1f}s')

# Select Round 3 elites for exact CKT v3 scoring
print('\nSelecting Round 3 elite candidates...')
candidates_list = list(all_candidates.values())

elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        elites[c['id']]['elite_reasons'].append(reason)

# 1. Best surrogate speed overall (targeting < 9.58)
for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:40]:
    add_elite(c, 'r3_top_speed')

# 2. Best D=0 speed overall (targeting < 9.72)
d0_cands = [c for c in candidates_list if c['D'] == 0]
for c in sorted(d0_cands, key=lambda x: x['surrogate_ckt'])[:30]:
    add_elite(c, 'r3_top_d0_speed')

# 3. Best M40/D0 speed (targeting < 9.725)
m40_d0 = [c for c in candidates_list if c['M'] <= 40 and c['D'] == 0]
for c in sorted(m40_d0, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r3_top_m40_d0_speed')

# 4. Best High Home Row (>= 44%) in D=0
home_d0 = [c for c in candidates_list if c['D'] == 0 and c['homeS2'] >= 0.44]
for c in sorted(home_d0, key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r3_high_home_d0')

# 5. Best Pure 8B / low 8B (< 1.015)
low8b = [c for c in candidates_list if c['eightWorstRatio'] <= 1.015]
for c in sorted(low8b, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r3_low8b_speed')

print(f'Selected {len(elites)} distinct Round 3 elites.')

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round3-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}')

out_meta_path = DATA / 'shenyun-21x21-round3-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved elite metadata to {out_meta_path}')
