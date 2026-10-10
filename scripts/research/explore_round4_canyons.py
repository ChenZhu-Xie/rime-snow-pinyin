#!/usr/bin/env python3
"""Round 4 Multi-Basin Canyon & Frontier Breakthrough Campaign for Snow Shenyun 21x21 CKT v3.

Track 1: Sub-9.580 Global Speed Pinnacle (around BCW-e806ff772afe & Round 3 final mutations)
Track 2: Pure 8B (8/8 < S005, eightWorstRatio < 1.0000) Speed Revolution (around BCW-12d72973b5b5)
Track 3: D=1 & D=2 Low-Displacement Canyon Bridge (projecting e806/1838/12d7/121d to D=1 and D=2)
Track 4: D=0 Zero-Displacement & Low-M (M39/M40/M41/M42) Deepening
Track 5: Low-Pinky (Pmax <= 5.1%) & Ergonomic High-Home (Home >= 50%) Basin Discovery
"""
from __future__ import annotations
import os
import sys
import json
import random
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

# Load all existing scored schemes from Seeds, R1, R2, R3
s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))

seed_lookup = {}
for lst in (s0, s1, s2, s3):
    for x in lst:
        if x.get('ckt_v3'):
            seed_lookup[x['id']] = x

visited = set()
for x in seed_lookup.values():
    visited.add(tuple(map(int, x['state'])))

all_candidates = {}

def evaluate_state(st, origin, phase, cap_m=46, cap_d=7, max_eight=None, max_p=None, min_home=None, max_s2=None):
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

print(f'Initialized Round 4 environment with {len(seed_lookup)} historical scored states.', flush=True)
random.seed(20261010)
t0 = time.time()

st_e806 = np.array(seed_lookup['BCW-e806ff772afe']['state'], dtype=np.int32)
st_40d7 = np.array(seed_lookup['BCW-40d7168c0550']['state'], dtype=np.int32)
st_12d7 = np.array(seed_lookup['BCW-12d72973b5b5']['state'], dtype=np.int32)
st_1838 = np.array(seed_lookup['BCW-18389e333036']['state'], dtype=np.int32)
st_121d = np.array(seed_lookup['BCW-121d11f6b6c4']['state'], dtype=np.int32)
st_3c47 = np.array(seed_lookup['BCW-3c47744cf2f7']['state'], dtype=np.int32)
st_4119 = np.array(seed_lookup['BCW-4119add30591']['state'], dtype=np.int32)
st_7c4f = np.array(seed_lookup['BCW-7c4f6ca59b52']['state'], dtype=np.int32)
st_d0b1 = np.array(seed_lookup['BCW-d0b1b29e49f9']['state'], dtype=np.int32)
st_d976 = np.array(seed_lookup['BCW-d976864e1f53']['state'], dtype=np.int32)
st_d44b = np.array(seed_lookup['BCW-d44b7e444f49']['state'], dtype=np.int32)
st_e51b = np.array(seed_lookup['LOWM-21X21-e51b9fed23']['state'], dtype=np.int32)
st_e004 = np.array(seed_lookup['BKP-e0048df69193']['state'], dtype=np.int32)

# =========================================================================
# TRACK 1: SUB-9.580 GLOBAL SPEED PINNACLE (AROUND BCW-e806ff772afe)
# =========================================================================
print('\n[1/5] Track 1: Sub-9.580 descent around BCW-e806ff772afe (9.58467)...', flush=True)
t1_count = 0

# 1.1 All 1-swap of finals on e806ff772afe
t1_1swaps = []
for i in range(35):
    for j in range(i + 1, 35):
        if st_e806[27 + i] != st_e806[27 + j]:
            st = st_e806.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            rec = evaluate_state(st, 'BCW-e806ff772afe', 'r4_e806_final_swap', cap_m=45, cap_d=4, max_eight=1.015, max_s2=69.2)
            if rec:
                t1_count += 1
                t1_1swaps.append(rec)

# 1.2 All 1-swap of initials on e806ff772afe
for i in range(21):
    for j in range(i + 1, 21):
        if st_e806[i] != st_e806[j]:
            st = st_e806.copy()
            st[i], st[j] = st[j], st[i]
            rec = evaluate_state(st, 'BCW-e806ff772afe', 'r4_e806_initial_swap', cap_m=45, cap_d=4, max_eight=1.015, max_s2=69.3)
            if rec:
                t1_count += 1
                t1_1swaps.append(rec)

# 1.3 Apply e806 initial swap (pos 15 <-> pos 16) to top 10 Round 3 speed elites and do 2-swaps on top 6
r3_top = sorted(s3, key=lambda x: x['ckt_v3'])[:10]
for item in r3_top:
    base_st = np.array(item['state'], dtype=np.int32)
    st_trans = base_st.copy()
    st_trans[:27] = st_e806[:27]
    rec = evaluate_state(st_trans, item['id'], 'r4_e806_init_graft', cap_m=45, cap_d=4, max_eight=1.015, max_s2=69.2)
    if rec:
        t1_count += 1
        t1_1swaps.append(rec)

for rec in sorted(t1_1swaps, key=lambda x: x['surrogate_ckt'])[:6]:
    bst = np.array(rec['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st2 = bst.copy()
                st2[27 + i], st2[27 + j] = st2[27 + j], st2[27 + i]
                if evaluate_state(st2, rec['id'], 'r4_e806_2swap', cap_m=44, cap_d=3, max_eight=1.011, max_s2=68.8):
                    t1_count += 1

print(f'  Track 1 produced {t1_count} valid states ({time.time()-t0:.1f}s).', flush=True)

# =========================================================================
# TRACK 2: PURE 8B (8/8 < S005) SPEED REVOLUTION (AROUND BCW-12d72973b5b5)
# =========================================================================
print('\n[2/5] Track 2: Pure 8B (< 1.0000) revolution around BCW-12d72973b5b5 (8B=1.0042)...', flush=True)
t2_count = 0

st_12d7_e806 = st_12d7.copy()
st_12d7_e806[:27] = st_e806[:27]
if evaluate_state(st_12d7_e806, 'BCW-12d72973b5b5', 'r4_12d7_e806_init', cap_m=45, cap_d=4, max_eight=1.01):
    t2_count += 1

for seed_name, seed_st in [('BCW-12d72973b5b5', st_12d7), ('12d7+e806_init', st_12d7_e806)]:
    pure_1swaps = []
    for i in range(35):
        for j in range(i + 1, 35):
            if seed_st[27 + i] != seed_st[27 + j]:
                st = seed_st.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, seed_name, 'r4_pure8b_final_1swap', cap_m=45, cap_d=4, max_eight=1.0045, max_s2=69.8)
                if rec:
                    t2_count += 1
                    pure_1swaps.append(rec)
    for i in range(21):
        for j in range(i + 1, 21):
            if seed_st[i] != seed_st[j]:
                st = seed_st.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, seed_name, 'r4_pure8b_init_1swap', cap_m=45, cap_d=4, max_eight=1.0045, max_s2=69.8)
                if rec:
                    t2_count += 1
                    pure_1swaps.append(rec)
    for rec in sorted(pure_1swaps, key=lambda x: x['eightWorstRatio'])[:8]:
        st1 = np.array(rec['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st2[27 + i]
                    if evaluate_state(st2, seed_name, 'r4_pure8b_final_2swap', cap_m=45, cap_d=4, max_eight=1.0000, max_s2=69.8):
                        t2_count += 1

print(f'  Track 2 produced {t2_count} valid states ({time.time()-t0:.1f}s).', flush=True)

# =========================================================================
# TRACK 3: THE D=1 & D=2 CANYON BRIDGE (BETWEEN D=0 9.721 AND D=3 9.584)
# =========================================================================
print('\n[3/5] Track 3: Exploring D=1 and D=2 Canyon Bridges...', flush=True)
t3_count = 0

d0_init = st_121d[:27].copy()
elite_finals = [
    ('e806', st_e806[27:]),
    ('1838', st_1838[27:]),
    ('12d7', st_12d7[27:]),
    ('121d', st_121d[27:]),
    ('3c47', st_3c47[27:]),
    ('4119', st_4119[27:]),
]

d1_d2_seeds = []
for i in range(21):
    for j in range(i + 1, 21):
        if d0_init[i] != d0_init[j]:
            init_cand = d0_init.copy()
            init_cand[i], init_cand[j] = init_cand[j], init_cand[i]
            for fname, fvec in elite_finals:
                st = np.concatenate([init_cand, fvec])
                rec = evaluate_state(st, f'D0_init_swap+{fname}', 'r4_d1d2_bridge_init', cap_m=44, cap_d=2, max_eight=1.032, max_s2=70.5)
                if rec:
                    t3_count += 1
                    d1_d2_seeds.append(rec)

for bname, bst in [('e806', st_e806), ('1838', st_1838), ('12d7', st_12d7)]:
    for i in range(21):
        for j in range(i + 1, 21):
            if bst[i] != bst[j]:
                st = bst.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, bname, 'r4_d1d2_proj_init', cap_m=44, cap_d=2, max_eight=1.028, max_s2=70.2)
                if rec:
                    t3_count += 1
                    d1_d2_seeds.append(rec)

d1_top = sorted([r for r in d1_d2_seeds if r['D'] == 1], key=lambda x: x['surrogate_ckt'])[:6]
d2_top = sorted([r for r in d1_d2_seeds if r['D'] == 2], key=lambda x: x['surrogate_ckt'])[:6]

for rec in d1_top + d2_top:
    bst = np.array(rec['state'], dtype=np.int32)
    d_val = rec['D']
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                if evaluate_state(st, rec['id'], f'r4_d{d_val}_final_polish', cap_m=43, cap_d=d_val, max_eight=1.022, max_s2=70.0):
                    t3_count += 1

print(f'  Track 3 produced {t3_count} valid states ({time.time()-t0:.1f}s).', flush=True)

# =========================================================================
# TRACK 4: D=0 ZERO-DISPLACEMENT & LOW-M (M39/M40/M41/M42) DEEPENING
# =========================================================================
print('\n[4/5] Track 4: D=0 Zero-Displacement & M39-M42 deepening...', flush=True)
t4_count = 0

d0_1swaps = []
for bname, bst in [('BCW-121d11f6b6c4', st_121d), ('BCW-3c47744cf2f7', st_3c47), ('BCW-4119add30591', st_4119), ('BCW-7c4f6ca59b52', st_7c4f)]:
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, bname, 'r4_d0_final_1swap', cap_m=42, cap_d=0, max_eight=1.036, max_s2=70.9)
                if rec:
                    t4_count += 1
                    d0_1swaps.append(rec)

st_d0_e806 = st_e806.copy()
st_d0_e806[:27] = st_121d[:27]
if evaluate_state(st_d0_e806, 'D0+e806_finals', 'r4_d0_e806_graft', cap_m=43, cap_d=0, max_eight=1.04):
    t4_count += 1
for i in range(35):
    for j in range(i + 1, 35):
        if st_d0_e806[27 + i] != st_d0_e806[27 + j]:
            st = st_d0_e806.copy()
            st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
            rec = evaluate_state(st, 'D0+e806_finals', 'r4_d0_e806_1swap', cap_m=42, cap_d=0, max_eight=1.036, max_s2=70.8)
            if rec:
                t4_count += 1
                d0_1swaps.append(rec)

for rec in sorted(d0_1swaps, key=lambda x: x['surrogate_ckt'])[:8]:
    bst = np.array(rec['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                if evaluate_state(st, rec['id'], 'r4_d0_final_2swap', cap_m=41, cap_d=0, max_eight=1.033, max_s2=70.5):
                    t4_count += 1

print(f'  Track 4 produced {t4_count} valid states ({time.time()-t0:.1f}s).', flush=True)

# =========================================================================
# TRACK 5: LOW-PINKY (Pmax <= 5.1%) & ERGONOMIC HIGH-HOME (Home >= 50%) BASINS
# =========================================================================
print('\n[5/5] Track 5: Low-Pinky (Pmax <= 5.1%) & High-Home (Home >= 50%) basin discovery...', flush=True)
t5_count = 0

ergo_seeds = [
    ('BCW-d0b1b29e49f9', st_d0b1),
    ('LOWM-21X21-e51b9fed23', st_e51b),
    ('BCW-d976864e1f53', st_d976),
    ('BCW-d44b7e444f49', st_d44b),
    ('BKP-e0048df69193', st_e004),
]

ergo_found = []
for ename, est in ergo_seeds:
    for i in range(35):
        for j in range(i + 1, 35):
            if est[27 + i] != est[27 + j]:
                st = est.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, ename, 'r4_ergo_final_1swap', cap_m=45, cap_d=3, max_eight=1.038, max_p=0.0510, max_s2=71.2)
                if rec:
                    t5_count += 1
                    ergo_found.append(rec)
    for i in range(21):
        for j in range(i + 1, 21):
            if est[i] != est[j]:
                st = est.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, ename, 'r4_ergo_init_1swap', cap_m=45, cap_d=3, max_eight=1.038, max_p=0.0510, max_s2=71.2)
                if rec:
                    t5_count += 1
                    ergo_found.append(rec)

for ename, est in [('d0b1', st_d0b1), ('e51b', st_e51b), ('d44b', st_d44b)]:
    for fname, fst in [('e806', st_e806), ('121d', st_121d), ('1838', st_1838)]:
        diff_pos = [i for i in range(62) if est[i] != fst[i]]
        choices = [(pos, (int(est[pos]), int(fst[pos]))) for pos in diff_pos]
        for _ in range(3000):
            st = est.copy()
            for pos, vals in choices:
                if random.random() < 0.35:
                    st[pos] = vals[1]
            rec = evaluate_state(st, f'{ename}<->{fname}', 'r4_ergo_cross', cap_m=44, cap_d=3, max_eight=1.035, max_p=0.0510, max_s2=71.0)
            if rec:
                t5_count += 1
                ergo_found.append(rec)

ergo_top = sorted(ergo_found, key=lambda x: x['surrogate_ckt'])[:6] + sorted([r for r in ergo_found if r['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:6]
seen_ergo = set()
for rec in ergo_top:
    if rec['id'] in seen_ergo:
        continue
    seen_ergo.add(rec['id'])
    bst = np.array(rec['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                if evaluate_state(st, rec['id'], 'r4_ergo_final_2swap', cap_m=44, cap_d=3, max_eight=1.035, max_p=0.0510, max_s2=70.8):
                    t5_count += 1

print(f'  Track 5 produced {t5_count} valid states ({time.time()-t0:.1f}s).', flush=True)

elapsed = time.time() - t0
print(f'\nTotal NEW valid states across all Round 4 tracks: {len(all_candidates)} in {elapsed:.1f}s', flush=True)

candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

# 1. Global top surrogate speed (targeting < 9.580)
for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:40]:
    add_elite(c, 'r4_global_speed')

# 2. Pure 8B (< 1.0000) & Near-Pure 8B (< 1.0040)
pure8b = [c for c in candidates_list if c['isPure8B']]
for c in sorted(pure8b, key=lambda x: x['surrogate_ckt'])[:30]:
    add_elite(c, 'r4_pure8b_speed')

near8b = [c for c in candidates_list if not c['isPure8B'] and c['eightWorstRatio'] <= 1.005]
for c in sorted(near8b, key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4_near8b_speed')

# 3. D=1 Canyon Bridge
d1_cands = [c for c in candidates_list if c['D'] == 1]
for c in sorted(d1_cands, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r4_d1_canyon')

# 4. D=2 Canyon Bridge
d2_cands = [c for c in candidates_list if c['D'] == 2]
for c in sorted(d2_cands, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r4_d2_canyon')

# 5. D=0 Zero-Displacement (All M, M<=40, M<=39)
d0_cands = [c for c in candidates_list if c['D'] == 0]
for c in sorted(d0_cands, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r4_d0_speed')
for c in sorted([x for x in d0_cands if x['M'] <= 40], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4_m40_d0_speed')
for c in sorted([x for x in d0_cands if x['M'] <= 39], key=lambda x: x['surrogate_ckt'])[:12]:
    add_elite(c, 'r4_m39_d0_speed')

# 6. Low-Pinky (Pmax <= 5.1%) & Ergonomic Dual-Gated (Pmax <= 5.1% & Home >= 50%)
lowp_cands = [c for c in candidates_list if c['Pmax'] <= 0.0510]
for c in sorted(lowp_cands, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r4_low_pinky_speed')
for d_val in (0, 1, 2, 3):
    sub = [c for c in lowp_cands if c['D'] == d_val]
    for c in sorted(sub, key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r4_low_pinky_d{d_val}')
    sub_home = [c for c in sub if c['homeS2'] >= 0.50]
    for c in sorted(sub_home, key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r4_ergo_home50_d{d_val}')

print(f'Selected {len(elites)} distinct Round 4 elite candidates for exact 8-track CKT v3 evaluation.', flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round4-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}', flush=True)

out_meta_path = DATA / 'shenyun-21x21-round4-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved elite metadata to {out_meta_path}', flush=True)
