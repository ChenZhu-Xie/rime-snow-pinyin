#!/usr/bin/env python3
"""Round 5 Exact 4-Track [1, 1, 3, 3] Power-4 Mean Frontier, Basin & Canyon Campaign (Fast Pre-Gated Edition).

Key algorithmic upgrades:
1. Filters the 25 FIXED_ONE_KEY characters from ckt_fast.char_rows (matching CKT v3 character track to 0.000000ms).
2. Uses the exact 4-track [1, 1, 3, 3] power-4 mean with 300ms first/second aux penalties (`f4_v3`),
   plus cached w34_sum4 per initial layout (`est_v3`), giving 100% monotonic alignment with 8-track CKT v3.
3. Uses 0.5ms `bfast.score` (8B) and 0.05ms `s2ms` pre-gating in 2-swap loops + iterative 1-swap steepest descent
   so all 5 tracks complete in ~90 seconds.
"""
from __future__ import annotations
import os
import sys
import json
import gzip
import base64
import re
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

# Upgrade 1: Filter out FIXED_ONE_KEY from ckt_fast.char_rows for exact CKT v3 alignment!
FIXED_ONE_KEY = set("的一是在了不有和人中大为上个国我以要他时来用生到作")
keep_mask = np.array([r[0] not in FIXED_ONE_KEY for r in sorted((r for r in b.COMMON if r[3] > 0), key=lambda r: (-r[3], r[0]))], dtype=bool)
ckt_fast.char_rows = np.ascontiguousarray(ckt_fast.char_rows[keep_mask])

# Upgrade 2: Exact 4-track [1, 1, 3, 3] power-4 mean baseline from S005
text = HTML_PATH.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
hdata = json.loads(gzip.decompress(base64.b64decode(match.group(1))))
s005_v3 = hdata['completionBV3']['schemes']['S005']['modes']

def mode_cost(m, base_len, tau=600):
    f = 1.0 - (m['stageWeight'][0] if m.get('stageWeight') else 1.0)
    f2 = max(0.0, m['meanKeys'] - base_len - f)
    return m['completionUpperMs'] + tau * m['p2'] + 300.0 * f + 300.0 * f2

base_c = np.array([
    mode_cost(s005_v3['keytao']['character'], 2),
    mode_cost(s005_v3['sanpin']['character'], 2),
    mode_cost(s005_v3['keytao']['word2'], 4),
    mode_cost(s005_v3['sanpin']['word2'], 4),
], dtype=np.float64)
weights_4 = np.array([1.0, 1.0, 3.0, 3.0], dtype=np.float64)

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

# Load all 823 scored schemes + cache w34_sum4 by initial layout tuple(st[:21])!
s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))
s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))

seed_lookup = {}
init_w34_cache = {}
for lst in (s0, s1, s2, s3, s4):
    for x in lst:
        if x.get('ckt_v3') is not None and x.get('state'):
            seed_lookup[x['id']] = x
            init_key = tuple(map(int, x['state'][:21]))
            if init_key not in init_w34_cache and x.get('modes'):
                m = x['modes']
                if 'word3' in m.get('keytao', {}):
                    w34_sum4 = (
                        (mode_cost(m['keytao']['word3'], 3) / mode_cost(s005_v3['keytao']['word3'], 3)) ** 4 +
                        (mode_cost(m['sanpin']['word3'], 3) / mode_cost(s005_v3['sanpin']['word3'], 3)) ** 4 +
                        (mode_cost(m['keytao']['word4'], 4) / mode_cost(s005_v3['keytao']['word4'], 4)) ** 4 +
                        (mode_cost(m['sanpin']['word4'], 4) / mode_cost(s005_v3['sanpin']['word4'], 4)) ** 4
                    )
                    init_w34_cache[init_key] = float(w34_sum4)

visited = {tuple(map(int, x['state'])) for x in seed_lookup.values()}
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

    times, misses, first_c, second_c = ckt_fast.score(st)
    costs = times + 600.0 * misses + 300.0 * first_c + 300.0 * second_c
    ratios4 = (costs / base_c) ** 4
    sum4_char_w2 = float(np.sum(weights_4 * ratios4))
    f4_v3 = float(10.0 * (sum4_char_w2 / 8.0) ** 0.25)

    init_key = tuple(map(int, st[:21]))
    if init_key in init_w34_cache:
        est_v3 = float(10.0 * ((sum4_char_w2 + init_w34_cache[init_key]) / 12.0) ** 0.25)
    else:
        est_v3 = f4_v3 + 0.030

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
        'surrogate_ckt': est_v3,
        'f4_v3': f4_v3,
        'ckt_v3': None
    }
    all_candidates[ident] = rec
    return rec

print(f'Initialized Round 5 environment with {len(seed_lookup)} scored states and {len(init_w34_cache)} cached w34 initial layouts.', flush=True)
t0 = time.time()

# ============================================================================
# Track 1: True-f4 Steepest Descent on Global Speed & D=3/D=4 Pure 8B
# ============================================================================
print('\n[1/5] Track 1: True-f4 steepest descent on D=4 & D=3 Speed and Pure 8B...', flush=True)
t1_seeds = [
    'BCW-f420619c19db',  # 9.57109 D=4 8B=1.0042
    'BCW-4f7b475cca86',  # 9.57392 D=4 Pure 8B
    'BCW-d18a30c7ca84',  # 9.57431 D=4
    'BCW-ee2924bf75d6',  # 9.57461 D=4
    'BCW-865b326cd700',  # 9.58403 D=3
    'BCW-e806ff772afe',  # 9.58467 D=3
    'BCW-993862278e9c',  # 9.58811 D=3 8B=1.0085
    'BCW-2e7e32291884',  # 9.58857 D=3 8B=1.0082
    'BCW-1e7bff4b6512',  # 9.60110 D=3 Pure 8B
    'BCW-cb37113b38ff',  # 9.60112 D=3 Pure 8B
]
t1_cnt = 0
for sid in t1_seeds:
    if sid not in seed_lookup:
        continue
    bst = np.array(seed_lookup[sid]['state'], dtype=np.int32)
    d_cap = max(4, int(seed_lookup[sid]['D']))
    base_s2 = float(seed_lookup[sid]['S2ms'])
    s1_list = []
    # 1-swap finals
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, 'r5_t1_final_1swap', cap_m=45, cap_d=d_cap, max_eight=1.010, max_s2=base_s2 + 0.65)
                if rec:
                    t1_cnt += 1
                    s1_list.append(rec)
    # 1-swap initials (up to D=5)
    for i in range(21):
        for j in range(i + 1, 21):
            if bst[i] != bst[j]:
                st = bst.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, sid, 'r5_t1_init_1swap', cap_m=46, cap_d=5, max_eight=1.010, max_s2=base_s2 + 0.50)
                if rec:
                    t1_cnt += 1
                    s1_list.append(rec)
    # Tightly gated 2-swap finals: top 2 by est_v3 (with s2ms gate) + top 2 by Pure 8B (with max_eight=1.0005 gate!)
    for r1 in sorted(s1_list, key=lambda x: x['surrogate_ckt'])[:2]:
        st1 = np.array(r1['state'], dtype=np.int32)
        r1_s2 = r1['S2ms']
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r5_t1_final_2swap_speed', cap_m=46, cap_d=5, max_eight=1.006, max_s2=r1_s2 + 0.15):
                        t1_cnt += 1
    for r1 in sorted(s1_list, key=lambda x: (x['eightWorstRatio'], x['surrogate_ckt']))[:2]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r5_t1_final_2swap_pure8b', cap_m=46, cap_d=5, max_eight=1.0000, max_s2=69.8):
                        t1_cnt += 1

print(f'  Track 1 produced {t1_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# Track 2: Triple-Crown Basin (Pure 8B < 1.0000 + Low-Pinky <= 5.1% + Home >= 50%)
# ============================================================================
print('\n[2/5] Track 2: Discovering Triple-Crown Basin (Pure 8B + Low-Pinky + High-Home)...', flush=True)
t2_seeds = [
    'BCW-0612e4476c25',  # 9.59082 D=4 Home=52.87% Pmax=4.15% 8B=1.0045
    'BCW-a9410622dcee',  # 9.59164 D=4 Home=49.09% Pmax=4.15% 8B=1.0040
    'BCW-695b434e897f',  # 9.58898 D=4 Home=48.95% Pmax=4.15% 8B=1.0043
    'BCW-1dbe7cd3f266',  # 9.61154 D=3 Home=46.01% Pmax=4.15% 8B=1.0044
    'BCW-6b1cc27a7754',  # 9.61373 D=3 Home=52.87% Pmax=4.56% 8B=1.0141
    'BCW-1b52baf9e888',  # 9.64504 D=3 Home=50.54% Pmax=3.42% 8B=1.0078
    'BCW-6b733a54e711',  # 9.66555 D=2 Home=46.94% Pmax=3.13% 8B=1.0079
    'BCW-9a856552678a',  # 9.66771 D=2 Home=46.95% Pmax=3.13% 8B=1.0078
    'BCW-233a0ea09076',  # 9.66826 D=2 Home=50.86% Pmax=3.42% 8B=1.0100
    'BCW-cf5b93b6f0f2',  # 9.62408 D=2 Home=46.01% Pmax=4.03% 8B=1.0095
]
t2_cnt = 0
for sid in t2_seeds:
    if sid not in seed_lookup:
        continue
    bst = np.array(seed_lookup[sid]['state'], dtype=np.int32)
    base_s2 = float(seed_lookup[sid]['S2ms'])
    s1_list = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, 'r5_t2_ergo_1swap', cap_m=45, cap_d=4, max_eight=1.010, max_p=0.0510, max_s2=base_s2 + 0.55)
                if rec:
                    t2_cnt += 1
                    s1_list.append(rec)
    for i in range(21):
        for j in range(i + 1, 21):
            if bst[i] != bst[j]:
                st = bst.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, sid, 'r5_t2_ergo_init_1swap', cap_m=45, cap_d=4, max_eight=1.010, max_p=0.0510, max_s2=base_s2 + 0.55)
                if rec:
                    t2_cnt += 1
                    s1_list.append(rec)
    # 2-swap finals strictly gated by max_eight=1.0020 (0.5ms bfast check!) so only near-Pure-8B / Pure-8B states call ckt_fast!
    for r1 in sorted(s1_list, key=lambda x: (x['eightWorstRatio'], x['surrogate_ckt']))[:2]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r5_t2_ergo_2swap_pure8b', cap_m=45, cap_d=4, max_eight=1.0020, max_p=0.0510, max_s2=71.0):
                        t2_cnt += 1
    # And top 1 by speed with tight s2ms gate
    for r1 in sorted(s1_list, key=lambda x: x['surrogate_ckt'])[:1]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r5_t2_ergo_2swap_speed', cap_m=45, cap_d=4, max_eight=1.006, max_p=0.0510, max_s2=r1['S2ms'] + 0.10):
                        t2_cnt += 1

print(f'  Track 2 produced {t2_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# Track 3: Bridging the D=0, D=1, D=2 Pure 8B (< 1.0000) & Ergonomic Canyons
# ============================================================================
print('\n[3/5] Track 3: Bridging D=0, D=1, D=2 Pure 8B (< 1.0000) & Ergonomic canyons...', flush=True)
low_d_init_donors = [
    'BCW-18389e333036',  # D=2 9.61100
    'BCW-cf5b93b6f0f2',  # D=2 9.62408 Pmax=4.03%
    'BCW-9a856552678a',  # D=2 9.66771 Pmax=3.13%
    'BCW-f78441d245f0',  # D=2 Pure 8B 9.93933
    'BCW-9bb794f486aa',  # D=1 9.66837 M=41
    'BCW-135c591af5a3',  # D=1 9.66909 M=42
    'BCW-75269766dc55',  # D=1 9.72448 Pmax=3.89%
    'LOWM-21X21-234186882e',  # D=1 9.82395 Home=52.26% Pmax=3.54%
    'BCW-5ec69bbb9ec9',  # D=1 Pure 8B 9.97533
    'BCW-f7538fe6f956',  # D=0 9.71007 M=41
    'BCW-1a11061c8293',  # D=0 9.72004 M=40
    'BCW-ce040cbc475e',  # D=0 9.75651 Pmax=3.12%
    'BKP-e0048df69193',  # D=0 9.92827 Home=50.51% Pmax=2.94% 8B=1.0116
]
pure8b_final_donors = [
    'BCW-4f7b475cca86',
    'BCW-af71075edb2d',
    'BCW-dc651555df92',
    'BCW-34dd9890bd1b',
    'BCW-1e7bff4b6512',
    'BCW-cb37113b38ff',
    'BCW-54e5ff86e597',
    'BCW-f78441d245f0',
    'BCW-5ec69bbb9ec9',
    'BKP-e0048df69193',
    'BCW-0612e4476c25',
    'BCW-a9410622dcee',
    'BCW-233a0ea09076',
    'BCW-9a856552678a',
    'BCW-cf5b93b6f0f2',
    'BCW-f7538fe6f956',
    'BCW-1a11061c8293',
]
t3_cnt = 0
low_d_grafts = []
for iid in low_d_init_donors:
    if iid not in seed_lookup:
        continue
    ist = np.array(seed_lookup[iid]['state'], dtype=np.int32)
    for fid in pure8b_final_donors:
        if fid not in seed_lookup:
            continue
        fst = np.array(seed_lookup[fid]['state'], dtype=np.int32)
        st = ist.copy()
        st[21:62] = fst[21:62]
        rec = evaluate_state(st, f'{iid[:10]}x{fid[:10]}', 'r5_t3_lowd_graft', cap_m=45, cap_d=2, max_eight=1.035)
        if rec:
            t3_cnt += 1
            low_d_grafts.append(rec)

low_d_polish_pool = list(low_d_grafts)
for sid in ('BCW-18389e333036', 'BCW-5ec69bbb9ec9', 'BCW-f78441d245f0', 'BKP-e0048df69193', 'BCW-ce040cbc475e', 'BCW-75269766dc55', 'LOWM-21X21-234186882e'):
    if sid in seed_lookup:
        low_d_polish_pool.append(seed_lookup[sid])

t3_targets = []
for d_val in (0, 1, 2):
    sub = [x for x in low_d_polish_pool if x['D'] == d_val]
    t3_targets.extend(sorted(sub, key=lambda r: (r['eightWorstRatio'], r.get('surrogate_ckt', 99)))[:2])
    t3_targets.extend(sorted([x for x in sub if x['Pmax'] <= 0.0511], key=lambda r: r.get('surrogate_ckt', 99))[:2])
    t3_targets.extend(sorted([x for x in sub if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda r: r.get('surrogate_ckt', 99))[:2])

seen_t3 = set()
for r in t3_targets:
    if r['id'] in seen_t3:
        continue
    seen_t3.add(r['id'])
    bst = np.array(r['state'], dtype=np.int32)
    d_val = r['D']
    s1_list = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, r['id'], f'r5_t3_d{d_val}_1swap', cap_m=44, cap_d=d_val, max_eight=1.032)
                if rec:
                    t3_cnt += 1
                    s1_list.append(rec)
    # 2-swap gated by max_eight <= r1['eightWorstRatio'] (for Pure 8B pursuit)
    for r1 in sorted(s1_list, key=lambda x: (x['eightWorstRatio'], x['surrogate_ckt']))[:2]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], f'r5_t3_d{d_val}_2swap_8b', cap_m=44, cap_d=d_val, max_eight=min(1.005, r1['eightWorstRatio'])):
                        t3_cnt += 1

print(f'  Track 3 produced {t3_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# Track 4: True-f4 Steepest Descent on D=2 (9.611), D=1 (9.668), D=0 (9.710, M40, M39, M38)
# ============================================================================
print('\n[4/5] Track 4: True-f4 steepest descent on D=2, D=1, D=0 & M=38..40 speed...', flush=True)
t4_seeds = [
    ('BCW-18389e333036', 43, 2, 70.3),  # D=2 9.61100
    ('BCW-9bb794f486aa', 42, 1, 70.8),  # D=1 9.66837 M=41
    ('BCW-135c591af5a3', 42, 1, 70.8),  # D=1 9.66909 M=42
    ('BCW-f7538fe6f956', 41, 0, 70.8),  # D=0 9.71007 M=41
    ('BCW-1a11061c8293', 40, 0, 70.8),  # D=0 9.72004 M=40
    ('BCW-7c4f6ca59b52', 39, 0, 77.5),  # D=0 9.75915 M=39
    ('BCW-6cb12649c8bb', 38, 0, 80.0),  # D=0 9.79951 M=38
]
t4_cnt = 0
for sid, cap_m, cap_d, max_s2 in t4_seeds:
    if sid not in seed_lookup:
        continue
    bst = np.array(seed_lookup[sid]['state'], dtype=np.int32)
    s1_list = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, f'r5_t4_m{cap_m}d{cap_d}_1swap', cap_m=cap_m, cap_d=cap_d, max_s2=max_s2)
                if rec:
                    t4_cnt += 1
                    s1_list.append(rec)
    for r1 in sorted(s1_list, key=lambda x: x['surrogate_ckt'])[:2]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], f'r5_t4_m{cap_m}d{cap_d}_2swap', cap_m=cap_m, cap_d=cap_d, max_s2=r1['S2ms'] + 0.15):
                        t4_cnt += 1

print(f'  Track 4 produced {t4_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# Track 5: New D=1 and D=2 Initial Mutations from D=0 / D=2 / D=3 Champions
# ============================================================================
print('\n[5/5] Track 5: Discovering new D=1 and D=2 initial seeds paired with Round 4 elite finals...', flush=True)
t5_cnt = 0
st_d0 = np.array(seed_lookup['BCW-f7538fe6f956']['state'], dtype=np.int32)
elite_finals_t5 = [
    ('f420', np.array(seed_lookup['BCW-f420619c19db']['state'], dtype=np.int32)),
    ('4f7b', np.array(seed_lookup['BCW-4f7b475cca86']['state'], dtype=np.int32)),
    ('0612', np.array(seed_lookup['BCW-0612e4476c25']['state'], dtype=np.int32)),
    ('233a', np.array(seed_lookup['BCW-233a0ea09076']['state'], dtype=np.int32)),
    ('9a85', np.array(seed_lookup['BCW-9a856552678a']['state'], dtype=np.int32)),
    ('f753', np.array(seed_lookup['BCW-f7538fe6f956']['state'], dtype=np.int32)),
]
t5_d1d2_found = []
for i in range(21):
    for j in range(i + 1, 21):
        if st_d0[i] == st_d0[j]:
            continue
        ist = st_d0.copy()
        ist[i], ist[j] = ist[j], ist[i]
        for fname, fst in elite_finals_t5:
            st = ist.copy()
            st[21:62] = fst[21:62]
            rec = evaluate_state(st, f'D0_swap({i},{j})x{fname}', 'r5_t5_d1d2_init_scan', cap_m=44, cap_d=2, max_eight=1.032, max_s2=71.2)
            if rec:
                t5_cnt += 1
                t5_d1d2_found.append(rec)

t5_top = (
    sorted([x for x in t5_d1d2_found if x['D'] == 1], key=lambda r: r['surrogate_ckt'])[:3] +
    sorted([x for x in t5_d1d2_found if x['D'] == 1 and x['Pmax'] <= 0.0511], key=lambda r: r['surrogate_ckt'])[:3] +
    sorted([x for x in t5_d1d2_found if x['D'] == 2], key=lambda r: r['surrogate_ckt'])[:2]
)
seen_t5 = set()
for r in t5_top:
    if r['id'] in seen_t5:
        continue
    seen_t5.add(r['id'])
    bst = np.array(r['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                if evaluate_state(st, r['id'], 'r5_t5_d1d2_polish', cap_m=44, cap_d=r['D'], max_eight=1.030, max_s2=71.0):
                    t5_cnt += 1

print(f'  Track 5 produced {t5_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)
print(f'\nTotal NEW valid states across all Round 5 tracks: {len(all_candidates)} in {time.time()-t0:.1f}s', flush=True)

# ============================================================================
# Select Elite Candidates Across All Categories for Exact 8-Track JS Scoring
# ============================================================================
candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

# 1. Global Speed (All D, D=4, D=3)
for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r5_global_speed')
for c in sorted([x for x in candidates_list if x['D'] <= 3], key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5_d3_speed')

# 2. Pure 8B (< 1.0000) across D=4, D=3, D=2, D=1, D=0
pure8b = [x for x in candidates_list if x['isPure8B']]
for c in sorted(pure8b, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5_pure8b_speed')
for d_val in (0, 1, 2, 3):
    for c in sorted([x for x in pure8b if x['D'] == d_val], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5_pure8b_d{d_val}')

# 3. Triple-Crown: Pure 8B + Low-Pinky (<= 5.1%) & Pure 8B + Dual-Gated (Home >= 50%)
for c in sorted([x for x in pure8b if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r5_triple_crown_lowp_pure8b')
for c in sorted([x for x in pure8b if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r5_triple_crown_dualgated_pure8b')

# 4. D=0, D=1, D=2 Speed & Ergonomic Canyons
for d_val in (0, 1, 2):
    sub = [x for x in candidates_list if x['D'] == d_val]
    for c in sorted(sub, key=lambda x: x['surrogate_ckt'])[:12]:
        add_elite(c, f'r5_d{d_val}_speed')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5_d{d_val}_low_pinky')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5_d{d_val}_dual_gated')

# 5. Low-M (M=38, M=39, M=40)
for m_val in (38, 39, 40):
    for c in sorted([x for x in candidates_list if x['M'] == m_val], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5_m{m_val}_speed')

# 6. Global Low-Pinky & Dual-Gated
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r5_low_pinky_speed')
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r5_dual_gated_speed')

print(f'Selected {len(elites)} distinct Round 5 elite candidates for exact 8-track CKT v3 evaluation.', flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round5-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
out_meta_path = DATA / 'shenyun-21x21-round5-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}', flush=True)
