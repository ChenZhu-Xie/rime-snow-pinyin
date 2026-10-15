#!/usr/bin/env python3
"""Round 5B Fast Synthesis & Canyon Eradication (< 45s).

1. Graft new Round 5 D=5 speed initials (25fd28a07cb2 9.55845, e3a211b578a9 9.55996, a091aefd7c62 9.55898)
   and new D=2 near-Pure8B initial (f54b4fba49fa 9.61527, 8B=1.0082) with all Round 4+5 Pure 8B, Triple-Crown,
   and Speed finals.
2. Graft new Round 5 D=0 Dual-Gated finals (3f9c225a709d 9.77502 Home=50.01% Pmax=3.13%, cbd7c46bdceb Home=50.32%)
   and Triple-Crown finals (16b0d2563e9d, 2076db7bcc07, 4917e0cca8bb, 03a5dd877fec) onto D=3, D=2, D=1, D=0 initials.
3. 1-swap final polish on:
   - BCW-25fd28a07cb2 (9.55845 D=5) & BCW-e3a211b578a9 (9.55996 D=5) -> target < 9.555 & Pure 8B < 9.560
   - BCW-f54b4fba49fa (9.61527 D=2, 8B=1.0082) + D=2 Pure8B grafts -> target D=2 Pure 8B < 9.625!
   - D=3 Triple-Crown grafts -> target D=3 Pure 8B + Home>=50% + Pmax<=5.1% < 9.620!
   - D=1 Dual-Gated grafts -> target D=1 Home>=50% + Pmax<=5.1% < 9.730!
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

t0 = time.time()

# 1. Cross-Grafting Matrix across D=5, D=4, D=3, D=2, D=1, D=0 Elites
init_donors = [
    'BCW-25fd28a07cb2',  # D=5 9.55845
    'BCW-a091aefd7c62',  # D=5 9.55898 Home=47.46%
    'BCW-e3a211b578a9',  # D=5 9.55996 S2ms=68.18ms
    'BCW-f420619c19db',  # D=4 9.57109
    'BCW-865b326cd700',  # D=3 9.58403
    'BCW-03a5dd877fec',  # D=3 9.59873 Pure 8B
    'BCW-1dbe7cd3f266',  # D=3 9.61154 LowP
    'BCW-6b1cc27a7754',  # D=3 9.61373 Home=52.87%
    'BCW-1b52baf9e888',  # D=3 9.64504 Pmax=3.42%
    'BCW-f54b4fba49fa',  # D=2 9.61527 8B=1.0082!
    'BCW-18389e333036',  # D=2 9.61100
    'BCW-1dced4a29334',  # D=2 9.62198 Pmax=4.03%
    'BCW-2d7139ba68aa',  # D=2 9.63574 Home=50.04%
    'BCW-ed7d5ba01a64',  # D=1 9.71450 Pmax=3.89%
    'BCW-75269766dc55',  # D=1 9.72448 Pmax=3.89%
    'LOWM-21X21-234186882e',  # D=1 Home=52.26% Pmax=3.54%
    'BCW-b51182f30d14',  # D=1 9.66722 M=41
    'BCW-3f9c225a709d',  # D=0 9.77502 Home=50.01% Pmax=3.13%
    'BCW-46ff90c789bf',  # D=0 9.70661 M=41
]
final_donors = [
    'BCW-25fd28a07cb2',  # 9.55845
    'BCW-a091aefd7c62',  # 9.55898 Home=47.46% 8B=1.0043
    'BCW-9b09bf40226a',  # 9.56024 8B=1.0042
    'BCW-f420619c19db',  # 9.57109
    'BCW-4f7b475cca86',  # 9.57392 Pure 8B
    'BCW-884b4ac1c600',  # 9.57564 Pure 8B Home=43.93%
    'BCW-ece555c0f1e7',  # 9.57580 Pure 8B Home=44.30%
    'BCW-03a5dd877fec',  # 9.59873 D=3 Pure 8B Home=44.30%
    'BCW-90e19a9aa7b7',  # 9.59878 D=3 Pure 8B Home=43.93%
    'BCW-1e7bff4b6512',  # 9.60110 D=3 Pure 8B
    'BCW-cb37113b38ff',  # 9.60112 D=3 Pure 8B
    'BCW-2076db7bcc07',  # 9.59940 Pure 8B + LowP (4.15%)
    'BCW-16b0d2563e9d',  # 9.60153 Pure 8B + Home=52.87% + Pmax=4.01%
    'BCW-1c10aa7eb448',  # 9.60887 Pure 8B + Home=52.86% + Pmax=3.67%
    'BCW-4917e0cca8bb',  # 9.61148 Pure 8B + Home=53.00% + Pmax=3.67%
    'BCW-fae31a82cf63',  # 9.60916 Pure 8B + Pmax=3.67%
    'BCW-0612e4476c25',  # 9.59082 Home=52.87% Pmax=4.15%
    'BCW-1dced4a29334',  # 9.62198 D=2 LowP
    'BCW-2d7139ba68aa',  # 9.63574 D=2 Home=50.04%
    'BCW-3db1e439d71d',  # 9.63969 D=2 Home=50.56%
    'BCW-3f9c225a709d',  # 9.77502 D=0 Home=50.01% Pmax=3.13%
    'BCW-cbd7c46bdceb',  # 9.78285 D=0 Home=50.32% Pmax=3.13%
    'BCW-ed7d5ba01a64',  # 9.71450 D=1 LowP
    'BCW-46ff90c789bf',  # 9.70661 D=0 M=41
    'BCW-8a3bc6ddb1fe',  # 9.70707 D=0 M=41 Home=41.24%
]

for iid in init_donors:
    if iid not in seed_lookup:
        continue
    ist = np.array(seed_lookup[iid]['state'], dtype=np.int32)
    for fid in final_donors:
        if fid not in seed_lookup:
            continue
        fst = np.array(seed_lookup[fid]['state'], dtype=np.int32)
        st = ist.copy()
        st[21:62] = fst[21:62]
        evaluate_state(st, f'{iid[:10]}x{fid[:10]}', 'r5b_cross_graft', cap_m=46, cap_d=5, max_eight=1.035)

print(f'Step 1 cross-grafts produced {len(all_candidates)} valid states ({time.time()-t0:.1f}s)', flush=True)

# 2. Fast 1-Swap Final Polish on Key Breakthrough Seeds & Grafts
polish_targets = []
for sid in (
    'BCW-25fd28a07cb2',  # D=5 9.55845
    'BCW-e3a211b578a9',  # D=5 9.55996
    'BCW-a091aefd7c62',  # D=5 9.55898 Home=47.46%
    'BCW-f54b4fba49fa',  # D=2 9.61527 8B=1.0082!
    'BCW-03a5dd877fec',  # D=3 9.59873 Pure 8B
    'BCW-2076db7bcc07',  # D=4 9.59940 Pure 8B + LowP
    'BCW-16b0d2563e9d',  # D=4 9.60153 Triple-Crown
    'BCW-3f9c225a709d',  # D=0 9.77502 Dual-Gated
    'BCW-ed7d5ba01a64',  # D=1 9.71450 LowP
    'BCW-46ff90c789bf',  # D=0 9.70661
    'BCW-6a2c3cb77e53',  # D=0 M=39 9.75080
):
    if sid in seed_lookup:
        polish_targets.append((sid, np.array(seed_lookup[sid]['state'], dtype=np.int32), seed_lookup[sid]['D']))

# Also add top D=3 Triple-Crown grafts, top D=2 near-Pure8B grafts, and top D=1 Dual-Gated grafts from Step 1
c_list = list(all_candidates.values())
for r in sorted([x for x in c_list if x['D'] == 3 and x['isPure8B'] and x['Pmax'] <= 0.0511], key=lambda k: k['surrogate_ckt'])[:3]:
    polish_targets.append((r['id'], np.array(r['state'], dtype=np.int32), 3))
for r in sorted([x for x in c_list if x['D'] == 2], key=lambda k: (k['eightWorstRatio'], k['surrogate_ckt']))[:3]:
    polish_targets.append((r['id'], np.array(r['state'], dtype=np.int32), 2))
for r in sorted([x for x in c_list if x['D'] == 1 and x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda k: k['surrogate_ckt'])[:3]:
    polish_targets.append((r['id'], np.array(r['state'], dtype=np.int32), 1))
for r in sorted([x for x in c_list if x['D'] == 5 and x['isPure8B']], key=lambda k: k['surrogate_ckt'])[:2]:
    polish_targets.append((r['id'], np.array(r['state'], dtype=np.int32), 5))

seen_p = set()
d2_low8b_1swaps = []
for sid, bst, d_val in polish_targets:
    if sid in seen_p:
        continue
    seen_p.add(sid)
    for i in range(35):
        for j in range(i + 1, 35):
            if bst[27 + i] != bst[27 + j]:
                st = bst.copy()
                st[27 + i], st[27 + j] = st[27 + j], st[27 + i]
                rec = evaluate_state(st, sid, f'r5b_d{d_val}_1swap', cap_m=46, cap_d=d_val, max_eight=1.032)
                if rec and d_val == 2 and rec['eightWorstRatio'] <= 1.005:
                    d2_low8b_1swaps.append(rec)

# Do a 2-swap final check strictly gated by max_eight=1.0000 on the best D=2 near-Pure8B 1-swaps!
for r1 in sorted(d2_low8b_1swaps, key=lambda x: (x['eightWorstRatio'], x['surrogate_ckt']))[:4]:
    st1 = np.array(r1['state'], dtype=np.int32)
    for i in range(35):
        for j in range(i + 1, 35):
            if st1[27 + i] != st1[27 + j]:
                st2 = st1.copy()
                st2[27 + i], st2[27 + j] = st2[27 + j], st1[27 + i]
                evaluate_state(st2, r1['id'], 'r5b_d2_2swap_pure8b', cap_m=44, cap_d=2, max_eight=1.0000)

print(f'After Step 2: {len(all_candidates)} total Round 5B candidates ({time.time()-t0:.1f}s)', flush=True)

candidates_list = list(all_candidates.values())
elites = {}

def add_elite(c, reason):
    if c['id'] not in elites:
        elites[c['id']] = {**c, 'elite_reasons': [reason]}
    else:
        if reason not in elites[c['id']]['elite_reasons']:
            elites[c['id']]['elite_reasons'].append(reason)

for c in sorted(candidates_list, key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5b_global_speed')
for c in sorted([x for x in candidates_list if x['isPure8B']], key=lambda x: x['surrogate_ckt'])[:20]:
    add_elite(c, 'r5b_pure8b_speed')
for d_val in (0, 1, 2, 3, 4):
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_pure8b_d{d_val}')
for d_val in (2, 3, 4):
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_triple_lowp_d{d_val}')
    for c in sorted([x for x in candidates_list if x['isPure8B'] and x['D'] == d_val and x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_triple_dualgated_d{d_val}')
for d_val in (0, 1, 2, 3):
    sub = [x for x in candidates_list if x['D'] == d_val]
    for c in sorted(sub, key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_d{d_val}_speed')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_d{d_val}_low_pinky')
    for c in sorted([x for x in sub if x['Pmax'] <= 0.0511 and x['homeS2'] >= 0.50], key=lambda x: x['surrogate_ckt'])[:8]:
        add_elite(c, f'r5b_d{d_val}_dual_gated')
for m_val in (38, 39, 40):
    for c in sorted([x for x in candidates_list if x['M'] == m_val], key=lambda x: x['surrogate_ckt'])[:6]:
        add_elite(c, f'r5b_m{m_val}_speed')

print(f'Selected {len(elites)} distinct Round 5B elite candidates for exact 8-track CKT v3 evaluation.', flush=True)

entries_for_scoring = []
for cid, c in elites.items():
    st = np.array(c['state'], dtype=np.int32)
    entry = b.opt.toentry(st, b.DATA, cid)
    entry['id'] = cid
    entry['capacity'] = [21, 21]
    entry['tone'] = 'IVUAO'
    entries_for_scoring.append(entry)

out_cands_path = DATA / 'shenyun-21x21-round5b-elites.json'
out_cands_path.write_text(json.dumps(entries_for_scoring, ensure_ascii=False), encoding='utf-8')
out_meta_path = DATA / 'shenyun-21x21-round5b-elites-meta.json'
out_meta_path.write_text(json.dumps(list(elites.values()), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Saved {len(entries_for_scoring)} entries to {out_cands_path}', flush=True)
