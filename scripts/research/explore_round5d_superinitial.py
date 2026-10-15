#!/usr/bin/env python3
"""Round 5D Super-Initial Exploitation (< 45s, ~3000 states):
Exploit the two breakthrough initial maps discovered in Round 5C:
- BCW-f52619067db6 (CKT_v3 = 9.58290, M=44, D=3, Home=43.93%, Pure 8B!)
- BCW-ccf01e81bdff (CKT_v3 = 9.55950, M=46, D=5, Home=47.26%, Pure 8B!)
and the new Global #1 BCW-cdf451dbb5af (9.55477) and Triple-Crown Dual-Gated #1 BCW-183af75dd6ef (9.59960).
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
REPLAY = Path(os.environ.get("RIME_RESEARCH_REPLAY_DIR", Path(__file__).resolve().parents[2] / ".research-cache" / "R11_integrated_replay"))
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

# Inspect what initial swap BCW-f52619067db6 and BCW-ccf01e81bdff made!
for sid, p_id in [('BCW-f52619067db6', 'BCW-6e3d331b343c'), ('BCW-ccf01e81bdff', 'BCW-9072021c0d2e')]:
    if sid in seed_lookup and p_id in seed_lookup:
        s_init = seed_lookup[sid]['codeList'][:21]
        p_init = seed_lookup[p_id]['codeList'][:21]
        diffs = [(i, p_init[i], s_init[i]) for i in range(21) if p_init[i] != s_init[i]]
        init_k = tuple(map(int, seed_lookup[sid]['state'][:21]))
        print(f"{sid} vs {p_id}: diffs={diffs}, w34_sum4={init_w34_cache.get(init_k):.5f}", flush=True)

# 1. Cross-graft the 2 super-initials (f52619067db6 & ccf01e81bdff) with top 30 finals across all basins!
super_inits = ['BCW-f52619067db6', 'BCW-ccf01e81bdff', 'BCW-038da68d8312']
top_finals = [
    'BCW-cdf451dbb5af',  # 9.55477 Global #1
    'BCW-2992c2dd117a',  # 9.55503 Global #2
    'BCW-f128ba9dc16c',  # 9.55818
    'BCW-6437d508508e',  # 9.55844 Home=47.46%
    'BCW-9072021c0d2e',  # 9.56214 Pure 8B
    'BCW-e4e75796846f',  # 9.56206 Pure 8B
    'BCW-c62dfc519746',  # 9.58513 D=3
    'BCW-cd70079467ce',  # 9.58969 D=3 Home=47.46%
    'BCW-6e3d331b343c',  # 9.59798 D=3 Pure 8B
    'BCW-03a5dd877fec',  # 9.59873 D=3 Pure 8B Home=44.30%
    'BCW-a589dc815187',  # 9.59531 D=4 Triple-Crown LowP
    'BCW-183af75dd6ef',  # 9.59960 D=4 Triple-Crown Dual-Gated
    'BCW-46888b0ed91c',  # 9.60006 D=4 Triple-Crown Home=53.00%
    'BCW-1c10aa7eb448',  # 9.60887 D=4 Triple-Crown Pmax=3.67%
    'BCW-342a964e819b',  # 9.61253 D=2 Speed
    'BCW-1a040659d24b',  # 9.62180 D=2 LowP
    'BCW-930ec5a423bf',  # 9.62283 D=2 Pmax=3.77%
    'BCW-2d7139ba68aa',  # 9.63574 D=2 Dual-Gated
    'BCW-ac739660ba29',  # 9.65469 D=1 Speed
    'BCW-3f9c225a709d',  # 9.77502 D=0 Dual-Gated
]

for iid in super_inits:
    if iid not in seed_lookup:
        continue
    ist = np.array(seed_lookup[iid]['state'], dtype=np.int32)
    for fid in top_finals:
        if fid not in seed_lookup:
            continue
        fst = np.array(seed_lookup[fid]['state'], dtype=np.int32)
        st = ist.copy()
        st[21:62] = fst[21:62]
        evaluate_state(st, f'{iid[:10]}x{fid[:10]}', 'r5d_super_graft', cap_m=46, cap_d=5, max_eight=1.025)

print(f"Step 1 (Super-initial cross-grafts): {len(all_candidates)} states ({time.time()-t0:.1f}s)", flush=True)

# 2. 1-swap finals & 1-swap initials on BCW-f52619067db6 (9.58290 D=3 Pure 8B) and BCW-ccf01e81bdff (9.55950 D=5 Pure 8B)
#    plus the top 4 super-grafts from Step 1!
targets_1swap = [
    ('BCW-f52619067db6', 46, 3),
    ('BCW-ccf01e81bdff', 46, 5),
]
for g in sorted(all_candidates.values(), key=lambda x: x['surrogate_ckt'])[:4]:
    targets_1swap.append((g['id'], 46, g['D']))
for g in sorted([x for x in all_candidates.values() if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:3]:
    targets_1swap.append((g['id'], 46, g['D']))

seen_t = set()
for sid, cap_m, cap_d in targets_1swap:
    if sid in seen_t:
        continue
    seen_t.add(sid)
    src = seed_lookup.get(sid) or all_candidates.get(sid)
    if not src:
        continue
    bst = np.array(src['state'], dtype=np.int32)
    # 1-swap finals
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                evaluate_state(st, sid, f'r5d_fin_1swap_d{cap_d}', cap_m=cap_m, cap_d=cap_d, max_eight=1.020)

print(f"Step 2 (1-swap finals on super-initial seeds & grafts): {len(all_candidates)} states ({time.time()-t0:.1f}s)", flush=True)

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
    add_elite(c, 'r5d_global_speed')
for c in sorted([x for x in candidates_list if x['isPure8B']], key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5d_pure8b_speed')
for d_val in (2, 3, 4):
    for c in sorted([x for x in candidates_list if x['D'] == d_val], key=lambda x: x['surrogate_ckt'])[:12]:
        add_elite(c, f'r5d_d{d_val}_speed')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val], key=lambda x: x['surrogate_ckt'])[:12]:
        add_elite(c, f'r5d_pure8b_d{d_val}')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5d_triple_lowp_d{d_val}')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:10]:
        add_elite(c, f'r5d_triple_dualgated_d{d_val}')

print(f"Selected {len(elites)} distinct Round 5D elite candidates.", flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round5d-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
out_meta_path = DATA / 'shenyun-21x21-round5d-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Saved {len(entries_for_scoring)} entries to {out_cands_path}", flush=True)
