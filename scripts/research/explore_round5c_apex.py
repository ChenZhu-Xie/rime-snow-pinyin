#!/usr/bin/env python3
"""Round 5C Apex Polish (< 45s):
1. Expand new Global #1 BCW-2992c2dd117a (9.55503, M=46, D=5), BCW-f128ba9dc16c (9.55818),
   BCW-6437d508508e (9.55844), and Pure 8B #1 BCW-9072021c0d2e (9.56214) via 1-swap initials,
   1-swap finals, and focused 2-swap finals.
2. Push Triple-Crown Dual-Gated (Pure 8B < 1.0 + Home >= 50% + Pmax <= 5.1%) below 9.60000
   from BCW-ac815a99a0f2 (9.60065) and BCW-6de88e55ba74 (9.60110).
3. Expand new M=42, D=1 cross-grafts BCW-ac739660ba29 (9.65469) & BCW-a97baf2a065e (9.65532)
   via 1-swap initials, 1-swap finals, and 2-swap finals to break 9.650 at D=1.
4. Diagnose and optimize eightWorstRatio at D=2 from BCW-504b91337b40 (8B=1.0075) &
   BCW-f54b4fba49fa (8B=1.0082) via joint initial+final swaps to crack Pure 8B at M=43, D=2.
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

FIXED_ONE_KEY = set("的一是在了不有和人中大为上个国我以要他时来用生到作")
keep_mask = np.array([r[0] not in FIXED_ONE_KEY for r in sorted((r for r in b.COMMON if r[3] > 0), key=lambda r: (-r[3], r[0]))], dtype=bool)
ckt_fast.char_rows = np.ascontiguousarray(ckt_fast.char_rows[keep_mask])

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

s0 = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
s1 = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
s2 = json.loads((DATA / 'shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
s3 = json.loads((DATA / 'shenyun-21x21-round3-summary.json').read_text(encoding='utf-8'))
s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))
s5 = json.loads((DATA / 'shenyun-21x21-round5-summary.json').read_text(encoding='utf-8'))

seed_lookup = {}
init_w34_cache = {}
for lst in (s0, s1, s2, s3, s4, s5):
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

def evaluate_state(st, origin, phase, cap_m=46, cap_d=5, max_eight=None, max_p=None, min_home=None):
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

t0 = time.time()

# Inspect bMetricsRatio of BCW-504b91337b40 and BCW-f54b4fba49fa
for sid in ('BCW-504b91337b40', 'BCW-f54b4fba49fa'):
    if sid in seed_lookup:
        bm = seed_lookup[sid].get('bMetricsRatio', {})
        over = {k: round(v, 4) for k, v in bm.items() if v >= 1.0}
        print(f"Diagnose {sid} (D={seed_lookup[sid]['D']}, 8B={seed_lookup[sid]['eightWorstRatio']:.4f}): tracks >= 1.0: {over}", flush=True)

# 1. Expand new Round 5B apex seeds (Initial 1-swap + Final 1-swap + Focused Final 2-swap)
apex_targets = [
    ('BCW-2992c2dd117a', 46, 5),  # 9.55503 Global #1
    ('BCW-f128ba9dc16c', 46, 5),  # 9.55818 Global #2 (graft)
    ('BCW-6437d508508e', 46, 5),  # 9.55844 Home=47.46%
    ('BCW-9072021c0d2e', 46, 5),  # 9.56214 Pure 8B #1
    ('BCW-87a6dc9e5cec', 46, 5),  # 9.56265 Pure 8B #2 (graft)
    ('BCW-6e3d331b343c', 44, 3),  # 9.59798 D=3 Pure 8B #1
    ('BCW-435d0b20afd0', 45, 4),  # 9.59786 Triple-Crown LowP #1
    ('BCW-ac815a99a0f2', 45, 4),  # 9.60065 Triple-Crown Dual-Gated #1
    ('BCW-6de88e55ba74', 45, 4),  # 9.60110 Triple-Crown Dual-Gated #2
    ('BCW-ac739660ba29', 42, 1),  # 9.65469 D=1 Speed #1 (graft!)
    ('BCW-a97baf2a065e', 42, 1),  # 9.65532 D=1 Speed #2 (graft!)
    ('BCW-4ccd3d0c6d3e', 43, 2),  # 9.62301 D=2 Pmax=3.77%
    ('BCW-a5dabb99498c', 43, 2),  # 9.62817 D=2 Home=49.90% Pmax=4.03%
    ('BCW-504b91337b40', 43, 2),  # 9.63259 D=2 Pmax=4.07% 8B=1.0075
]

for sid, cap_m, cap_d in apex_targets:
    if sid not in seed_lookup:
        continue
    bst = np.array(seed_lookup[sid]['state'], dtype=np.int32)
    # 1-swap initials
    for i in range(21):
        for j in range(i + 1, 21):
            st = bst.copy()
            st[i], st[j] = st[j], st[i]
            evaluate_state(st, sid, f'r5c_init_1swap_d{cap_d}', cap_m=cap_m, cap_d=cap_d, max_eight=1.032)
    # 1-swap finals
    f1_list = []
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, f'r5c_fin_1swap_d{cap_d}', cap_m=cap_m, cap_d=cap_d, max_eight=1.032)
                if rec:
                    f1_list.append(rec)
    # Focused 2-swap finals on top 6 1-swaps
    for r1 in sorted(f1_list, key=lambda x: x['surrogate_ckt'])[:6]:
        st1 = np.array(r1['state'], dtype=np.int32)
        for i in range(35):
            for j in range(i + 1, 35):
                if st1[27 + i] != st1[27 + j]:
                    st2 = st1.copy()
                    st2[27 + i], st2[27 + j] = st2[27 + j], st2[27 + i]
                    evaluate_state(st2, r1['id'], f'r5c_fin_2swap_d{cap_d}', cap_m=cap_m, cap_d=cap_d, max_eight=1.030)

print(f"Step 1 (Apex 1-swap & 2-swap) produced {len(all_candidates)} candidates ({time.time()-t0:.1f}s)", flush=True)

# 2. Targeted Triple-Crown Dual-Gated Sub-9.600 Search
# Take all Pure 8B + Home>=48.5% + Pmax<=5.1% states at D=4 and run 1-swap finals strictly gated by isPure8B + Home>=50%
tc_near = [
    x for x in list(seed_lookup.values()) + list(all_candidates.values())
    if x.get('D') == 4 and x.get('Pmax', 1.0) <= 0.0511 and x.get('eightWorstRatio', 2.0) <= 1.003 and x.get('homeS2', 0.0) >= 0.485
]
seen_tc = set()
for s in sorted(tc_near, key=lambda x: x.get('ckt_v3') or x.get('surrogate_ckt', 99.0))[:12]:
    if s['id'] in seen_tc:
        continue
    seen_tc.add(s['id'])
    bst = np.array(s['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                evaluate_state(st, s['id'], 'r5c_tc_dualgated_push', cap_m=45, cap_d=4, max_eight=1.0000, max_p=0.0511, min_home=0.5000)

print(f"After Step 2 (Triple-Crown Dual-Gated Sub-9.600 push): {len(all_candidates)} candidates ({time.time()-t0:.1f}s)", flush=True)

# 3. Targeted D=2 Pure 8B (< 1.0000) Search from M=43, D=2 low-8B states
d2_low8b = [
    x for x in list(seed_lookup.values()) + list(all_candidates.values())
    if x.get('D') == 2 and x.get('eightWorstRatio', 2.0) <= 1.0095 and (x.get('ckt_v3') or x.get('surrogate_ckt', 99.0)) <= 9.65
]
seen_d2 = set()
for s in sorted(d2_low8b, key=lambda x: x['eightWorstRatio'])[:10]:
    if s['id'] in seen_d2:
        continue
    seen_d2.add(s['id'])
    bst = np.array(s['state'], dtype=np.int32)
    # Try 1-swap initials + 1-swap finals
    for i in range(21):
        for j in range(i + 1, 21):
            st = bst.copy()
            st[i], st[j] = st[j], st[i]
            evaluate_state(st, s['id'], 'r5c_d2_p8b_init', cap_m=44, cap_d=2, max_eight=1.006)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                evaluate_state(st, s['id'], 'r5c_d2_p8b_fin', cap_m=44, cap_d=2, max_eight=1.006)

print(f"After Step 3 (D=2 low-8B search): {len(all_candidates)} candidates ({time.time()-t0:.1f}s)", flush=True)

# Select Elites
candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5c_global_speed')
for c in sorted([x for x in candidates_list if x['isPure8B']], key=lambda x: x['surrogate_ckt'])[:15]:
    add_elite(c, 'r5c_pure8b_speed')
for d_val in (2, 3, 4):
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5c_pure8b_d{d_val}')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5c_triple_lowp_d{d_val}')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5c_triple_dualgated_d{d_val}')
for d_val in (1, 2, 3):
    sub = [x for x in candidates_list if x['D'] == d_val]
    for c in sorted(sub, key=lambda x: x['surrogate_ckt'])[:12]:
        add_elite(c, f'r5c_d{d_val}_speed')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5c_d{d_val}_low_pinky')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5c_d{d_val}_dual_gated')
for c in sorted([x for x in candidates_list if x['D'] == 2], key=lambda x: x['eightWorstRatio'])[:8]:
    add_elite(c, 'r5c_d2_lowest_8b')

print(f"Selected {len(elites)} distinct Round 5C elite candidates.", flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round5c-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
out_meta_path = DATA / 'shenyun-21x21-round5c-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Saved {len(entries_for_scoring)} entries to {out_cands_path}", flush=True)
