#!/usr/bin/env python3
"""Round 4B Synthesis, Cross-Grafting & Deep Polish for Snow Shenyun 21x21 CKT v3.

Takes the newly discovered Round 4 breakthroughs:
1. Sub-9.580 Global Speed (BCW-f420619c19db 9.57109, BCW-ee2924bf75d6 9.57461, BCW-a1d0389fd54d 9.57687)
2. Pure 8B (< 1.0000) Champions (BCW-1e7bff4b6512 9.60110, BCW-cb37113b38ff 9.60112)
3. D=1 Canyon Bridge (BCW-135c591af5a3 9.66909) & D=2 Canyon (BCW-18389e333036 9.61100, BCW-c3eeb83075aa 9.63794)
4. D=0 Zero-Displacement (BCW-f7538fe6f956 9.71007, BCW-1a11061c8293 9.72004 M=40, BCW-7c4f6ca59b52 M=39)
5. Ergonomic Low-Pinky & Home>=50% (BCW-233a0ea09076 9.66826, BCW-9a856552678a 9.66771, BCW-d651a02d1be1 9.65493)

And runs:
- Full Cross-Grafting Matrix (Initials x Finals) across all Round 4 + Historical Elites
- Final 1-swap & 2-swap polishing on the new D=4 (< 9.570) and Pure 8B (< 9.595) grafts
- Deep Final 1-swap & 2-swap polishing on the D=1 bridge (BCW-135c591af5a3) and D=2 (BCW-18389e333036)
- Unfiltered M<=39 D=0 search around BCW-7c4f6ca59b52
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

# Load all existing scored schemes from Seeds, R1, R2, R3, R4
s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))
s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))

seed_lookup = {}
for lst in (s0, s1, s2, s3, s4):
    for x in lst:
        if x.get('ckt_v3') or x.get('state'):
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

print(f'Initialized Round 4B environment with {len(seed_lookup)} known states.', flush=True)
t0 = time.time()

# ============================================================================
# 1. Cross-Grafting Matrix: Elite Initials x Elite Finals
# ============================================================================
print('\n[1/4] Cross-grafting elite initials x elite finals...', flush=True)
init_donor_ids = [
    'BCW-f420619c19db',  # 9.57109 D=4 8B=1.0042
    'BCW-ee2924bf75d6',  # 9.57461 D=4
    'BCW-a1d0389fd54d',  # 9.57687 D=4
    'BCW-690e0cd2bd85',  # 9.58988 D=4 Home=44.11%
    'BCW-e806ff772afe',  # 9.58467 D=3 Home=43.56%
    'BCW-12d72973b5b5',  # 9.59785 D=3
    'BCW-135c591af5a3',  # 9.66909 D=1
    'BCW-0e456b88a08e',  # 9.72661 D=1
    'BCW-18389e333036',  # 9.61100 D=2
    'BCW-c3eeb83075aa',  # 9.63794 D=2
    'BCW-9a856552678a',  # 9.66771 D=2 Pmax=3.13%
    'BCW-233a0ea09076',  # 9.66826 D=2 Home=50.86%
    'BCW-d651a02d1be1',  # 9.65493 D=3 Pmax=3.42%
    'BCW-ca54a8174e46',  # 9.65784 D=3 Pmax=3.42%
    'BCW-6b507b25d1aa',  # 9.67356 D=3 Home=50.22% Pmax=3.42%
    'BCW-121d11f6b6c4',  # D=0
]
final_donor_ids = [
    'BCW-f420619c19db',  # 9.57109
    'BCW-865b326cd700',  # 9.58403 D=3
    'BCW-618ed33d99d7',  # 9.58448 D=3
    'BCW-dbc1a87a0a2b',  # 9.59001 D=3 8B=1.0092
    'BCW-1e7bff4b6512',  # 9.60110 Pure 8B!
    'BCW-cb37113b38ff',  # 9.60112 Pure 8B!
    'BCW-f00a8ecc044d',  # 9.60168 Pure 8B!
    'BCW-d7a01ae68ae9',  # 9.60191 Pure 8B!
    'BCW-900da5db90c4',  # 9.60299 Pure 8B!
    'BCW-54e5ff86e597',  # 9.60441 Pure 8B!
    'BCW-18389e333036',  # 9.61100 D=2
    'BCW-c3eeb83075aa',  # 9.63794 D=2
    'BCW-f7538fe6f956',  # 9.71007 D=0 M=41
    'BCW-2dd583d61844',  # 9.71203 D=0 M=41
    'BCW-1a11061c8293',  # 9.72004 D=0 M=40
    'BCW-807e974d14c4',  # 9.72112 D=0 M=40
    'BCW-9a856552678a',  # 9.66771 D=2 Pmax=3.13%
    'BCW-233a0ea09076',  # 9.66826 D=2 Home=50.86%
    'BCW-20ed6100907b',  # 9.66582 D=3 Home=49.91%
    'BCW-092e2020149e',  # 9.70587 D=3 Home=51.69%
]

s1_cnt = 0
for iid in init_donor_ids:
    if iid not in seed_lookup:
        continue
    ist = np.array(seed_lookup[iid]['state'], dtype=np.int32)
    for fid in final_donor_ids:
        if fid not in seed_lookup:
            continue
        fst = np.array(seed_lookup[fid]['state'], dtype=np.int32)
        st = ist.copy()
        st[21:62] = fst[21:62]
        if evaluate_state(st, f'{iid[:10]}x{fid[:10]}', 'r4b_cross_graft', cap_m=46, cap_d=5, max_eight=1.035):
            s1_cnt += 1
print(f'  Step 1 produced {s1_cnt} valid cross-grafts ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# 2. Polish Sub-9.580 D=4 & Sub-9.595 Pure 8B Champions
# ============================================================================
print('\n[2/4] Polishing Sub-9.580 speed & Sub-9.595 Pure 8B champions...', flush=True)
top_seeds = [
    ('BCW-f420619c19db', np.array(seed_lookup['BCW-f420619c19db']['state'], dtype=np.int32)),
    ('BCW-ee2924bf75d6', np.array(seed_lookup['BCW-ee2924bf75d6']['state'], dtype=np.int32)),
    ('BCW-a1d0389fd54d', np.array(seed_lookup['BCW-a1d0389fd54d']['state'], dtype=np.int32)),
]
step1_pure8b = sorted([r for r in all_candidates.values() if r['isPure8B']], key=lambda x: x['surrogate_ckt'])[:6]
step1_speed = sorted(all_candidates.values(), key=lambda x: x['surrogate_ckt'])[:6]
for r in step1_pure8b + step1_speed:
    top_seeds.append((r['id'], np.array(r['state'], dtype=np.int32)))

s2_cnt = 0
seen_top = set()
for sid, bst in top_seeds:
    if sid in seen_top:
        continue
    seen_top.add(sid)
    s1_found = []
    # 1-swap finals (pos 27..61)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, 'r4b_top_final_1swap', cap_m=45, cap_d=4, max_eight=1.012, max_s2=69.7)
                if rec:
                    s2_cnt += 1
                    s1_found.append(rec)
    # 1-swap initials (pos 0..20)
    for i in range(21):
        for j in range(i + 1, 21):
            if bst[i] != bst[j]:
                st = bst.copy()
                st[i], st[j] = st[j], st[i]
                rec = evaluate_state(st, sid, 'r4b_top_init_1swap', cap_m=45, cap_d=4, max_eight=1.012, max_s2=69.7)
                if rec:
                    s2_cnt += 1
                    s1_found.append(rec)
    # 2-swap finals from best 1-swaps
    for r1 in sorted(s1_found, key=lambda x: (not x['isPure8B'], x['surrogate_ckt']))[:4]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r4b_top_final_2swap', cap_m=45, cap_d=4, max_eight=1.010, max_s2=69.5):
                        s2_cnt += 1

print(f'  Step 2 produced {s2_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# 3. Deep Polish on D=1 (BCW-135c591af5a3) & D=2 (BCW-18389e333036)
# ============================================================================
print('\n[3/4] Deep polishing D=1 and D=2 canyon bridges...', flush=True)
canyon_seeds = [
    ('BCW-135c591af5a3', np.array(seed_lookup['BCW-135c591af5a3']['state'], dtype=np.int32)),
    ('BCW-18389e333036', np.array(seed_lookup['BCW-18389e333036']['state'], dtype=np.int32)),
    ('BCW-c3eeb83075aa', np.array(seed_lookup['BCW-c3eeb83075aa']['state'], dtype=np.int32)),
]
for r in sorted([x for x in all_candidates.values() if x['D'] in (1, 2)], key=lambda x: x['surrogate_ckt'])[:8]:
    canyon_seeds.append((r['id'], np.array(r['state'], dtype=np.int32)))

s3_cnt = 0
seen_canyon = set()
for sid, bst in canyon_seeds:
    if sid in seen_canyon:
        continue
    seen_canyon.add(sid)
    s1_found = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, 'r4b_canyon_final_1swap', cap_m=44, cap_d=2, max_eight=1.032, max_s2=70.6)
                if rec:
                    s3_cnt += 1
                    s1_found.append(rec)
    for r1 in sorted(s1_found, key=lambda x: x['surrogate_ckt'])[:6]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r4b_canyon_final_2swap', cap_m=44, cap_d=2, max_eight=1.030, max_s2=70.4):
                        s3_cnt += 1

print(f'  Step 3 produced {s3_cnt} valid states ({time.time()-t0:.1f}s).', flush=True)

# ============================================================================
# 4. Unfiltered M<=39 D=0 Search around BCW-7c4f6ca59b52 & M=40 seeds
# ============================================================================
print('\n[4/4] Unfiltered M<=39 D=0 search around BCW-7c4f6ca59b52 & M=40 seeds...', flush=True)
m39_seeds = [
    ('BCW-7c4f6ca59b52', np.array(seed_lookup['BCW-7c4f6ca59b52']['state'], dtype=np.int32)),
    ('BCW-1a11061c8293', np.array(seed_lookup['BCW-1a11061c8293']['state'], dtype=np.int32)),
    ('BCW-3c47744cf2f7', np.array(seed_lookup['BCW-3c47744cf2f7']['state'], dtype=np.int32)),
]
s4_cnt = 0
for sid, bst in m39_seeds:
    m39_1swaps = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, 'r4b_m39_1swap', cap_m=39, cap_d=0, max_eight=1.045)
                if rec:
                    s4_cnt += 1
                    m39_1swaps.append(rec)
    for r1 in sorted(m39_1swaps, key=lambda x: x['surrogate_ckt'])[:8]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                    if evaluate_state(st2, r1['id'], 'r4b_m39_2swap', cap_m=39, cap_d=0, max_eight=1.045):
                        s4_cnt += 1

print(f'  Step 4 produced {s4_cnt} valid M<=39 states ({time.time()-t0:.1f}s).', flush=True)
print(f'\nTotal NEW valid states in Round 4B: {len(all_candidates)} in {time.time()-t0:.1f}s', flush=True)

candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r4b_global_speed')
for c in sorted([x for x in candidates_list if x['isPure8B']], key=lambda x: x['surrogate_ckt'])[:25]:
    add_elite(c, 'r4b_pure8b_speed')
for c in sorted([x for x in candidates_list if x['D'] == 1], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4b_d1_canyon')
for c in sorted([x for x in candidates_list if x['D'] == 2], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4b_d2_canyon')
for c in sorted([x for x in candidates_list if x['D'] == 0], key=lambda x: x['surrogate_ckt'])[:12]:
    add_elite(c, 'r4b_d0_speed')
for c in sorted([x for x in candidates_list if x['M'] <= 39], key=lambda x: x['surrogate_ckt'])[:10]:
    add_elite(c, 'r4b_m39_speed')
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0510], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r4b_low_pinky')
for c in sorted([x for x in candidates_list if x['Pmax'] <= 0.0510 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:12]:
    add_elite(c, 'r4b_ergo_home50')

print(f'Selected {len(elites)} distinct Round 4B elite candidates for exact CKT v3 evaluation.', flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round4b-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}', flush=True)

out_meta_path = DATA / 'shenyun-21x21-round4b-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved elite metadata to {out_meta_path}', flush=True)
