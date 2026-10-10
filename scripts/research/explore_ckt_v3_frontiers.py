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
from itertools import product
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
p_v2 = DATA / 'shenyun-completion-ckt-fixed-v2.json'
frozen = json.loads(p_r11.read_text(encoding='utf-8'))['schemes'] if p_r11.exists() else json.loads(p_v2.read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

db = json.loads((DATA / 'shenyun-21x21-seeds-database.json').read_text(encoding='utf-8'))['schemes']
seed_lookup = {s['id']: s for s in db}

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

    ident = 'BCW-' + hashlib.sha256(st.tobytes()).hexdigest()[:12]
    cand = {
        'id': ident,
        'origin': origin,
        'phase': phase,
        'state': list(sig),
        'codeList': list(entry['codeList']),
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
        'surrogate_ckt': surrogate_ckt
    }
    all_candidates[ident] = cand
    return cand

def repair_finals(st, anchor):
    counts_local = Counter(map(int, st[27:62]))
    missing = list(allowed - set(map(int, st[27:62])))
    random.shuffle(missing)
    for key in missing:
        duplicate = [i for i in range(27, 62) if counts_local[int(st[i])] > 1]
        if not duplicate:
            break
        preferred = [i for i in duplicate if int(anchor[i]) == key]
        pos = random.choice(preferred or duplicate)
        counts_local[int(st[pos])] -= 1
        st[pos] = key
        counts_local[key] += 1

# Mark all existing seeds as visited
for s in db:
    visited.add(tuple(s['state']))

print("=================================================================")
print("STARTING 4 HIGH-DIMENSIONAL SWEEP & EXPLORATION CAMPAIGNS")
print("=================================================================")

t0 = time.time()

# -------------------------------------------------------------
# CAMPAIGN 1: 524,288 Exact Coordinate Face (Speed <-> Low Pinky)
# Seeds: BCW-18389e333036 (Speed) <-> BCW-d0b1b29e49f9 (Low Pinky Pmax=3.42%)
# -------------------------------------------------------------
print("\n--- CAMPAIGN 1: Exhaustive 524k Coordinate Face (BCW-18389e333036 <-> BCW-d0b1b29e49f9) ---")
s_speed = seed_lookup["BCW-18389e333036"]
s_pinky = seed_lookup["BCW-d0b1b29e49f9"]
st_speed = np.array(s_speed['state'], dtype=np.int32)
st_pinky = np.array(s_pinky['state'], dtype=np.int32)

diff_pos = [i for i in range(67) if st_speed[i] != st_pinky[i]]
print(f"Diff positions ({len(diff_pos)}): {diff_pos}")
base_st = st_speed.copy()

varying_choices = [(pos, (int(st_speed[pos]), int(st_pinky[pos]))) for pos in diff_pos]

c1_tested = 0
c1_scored = 0
for choice in product(*(vals for _, vals in varying_choices)):
    c1_tested += 1
    curr = base_st.copy()
    for (pos, _), val in zip(varying_choices, choice):
        curr[pos] = val
    # Fast check
    if set(map(int, curr[27:62])) != allowed:
        continue
    unique, memory, displaced = b.se.stats(curr, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > 43 or displaced > 2:
        continue
    # Evaluate
    cand = evaluate_state(curr, "face:18389e333036-d0b1b29e49f9", "c1_face", cap_m=43, cap_d=2, max_eight=1.05)
    if cand:
        c1_scored += 1

print(f"Campaign 1 completed: {c1_tested} combinations checked, {c1_scored} valid candidates scored ({time.time()-t0:.1f}s)")

# -------------------------------------------------------------
# CAMPAIGN 2: M41/D1 & M40/D1 Low Memory Basin Exploration
# Seeds: BCW-179ce0db1934, BCW-f921a7d16044, BCW-832393ee6991, BCW-ede7b2a9282b, BCW-0a4182c7a5a0
# -------------------------------------------------------------
print("\n--- CAMPAIGN 2: Low-M / Low-D Basin Exploration (M<=41, D<=1) ---")
c2_seeds = [
    np.array(seed_lookup["BCW-179ce0db1934"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-f921a7d16044"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-832393ee6991"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-ede7b2a9282b"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-0a4182c7a5a0"]['state'], dtype=np.int32),
]

c2_scored = 0
for proposal_idx in range(40000):
    parents = random.sample(c2_seeds, 2)
    p0, p1 = parents[0], parents[1]
    child = p0.copy()
    
    # Crossover onsets
    if random.random() < 0.6:
        child[:27] = p1[:27]
    else:
        for i in random.sample(range(27), random.randint(1, 3)):
            child[i] = p1[i]
            
    # Crossover rhymes
    cuts = sorted(random.sample(range(28, 62), random.randint(1, 4)))
    for lo, hi in zip([27, *cuts], [*cuts, 62]):
        if random.random() < 0.5:
            child[lo:hi] = p1[lo:hi]
            
    # Swap mutation
    if random.random() < 0.3:
        i, j = random.sample(range(27, 62), 2)
        child[i], child[j] = child[j], child[i]
        
    repair_finals(child, p0)
    cand = evaluate_state(child, "basin:low_m_d1", "c2_basin", cap_m=41, cap_d=1, max_eight=1.03)
    if cand:
        c2_scored += 1

print(f"Campaign 2 completed: 40000 proposals, {c2_scored} valid candidates scored ({time.time()-t0:.1f}s)")

# -------------------------------------------------------------
# CAMPAIGN 3: D = 0 Zero-Displacement Deep Ravine Exploration
# Seeds: BCW-510c661a02b9, BCW-0aaa5551675d, BCW-0e5e12498ab0, BCW-6cb12649c8bb
# -------------------------------------------------------------
print("\n--- CAMPAIGN 3: D = 0 Zero-Displacement Ravine (M<=42, D=0) ---")
c3_seeds = [
    np.array(seed_lookup["BCW-510c661a02b9"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-0aaa5551675d"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-0e5e12498ab0"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-6cb12649c8bb"]['state'], dtype=np.int32),
]

c3_scored = 0
for proposal_idx in range(35000):
    parents = random.sample(c3_seeds, 2)
    p0, p1 = parents[0], parents[1]
    child = p0.copy()
    
    if random.random() < 0.5:
        child[:27] = p1[:27]
    else:
        for i in random.sample(range(27), random.randint(1, 2)):
            child[i] = p1[i]
            
    cuts = sorted(random.sample(range(28, 62), random.randint(1, 3)))
    for lo, hi in zip([27, *cuts], [*cuts, 62]):
        if random.random() < 0.5:
            child[lo:hi] = p1[lo:hi]
            
    if random.random() < 0.35:
        i, j = random.sample(range(27, 62), 2)
        child[i], child[j] = child[j], child[i]
        
    repair_finals(child, p0)
    cand = evaluate_state(child, "ravine:d0", "c3_d0", cap_m=42, cap_d=0, max_eight=1.05)
    if cand:
        c3_scored += 1

print(f"Campaign 3 completed: 35000 proposals, {c3_scored} valid candidates scored ({time.time()-t0:.1f}s)")

# -------------------------------------------------------------
# CAMPAIGN 4: Speed Breakthrough & Ergonomics Frontier
# Seeds: BCW-18389e333036, BCW-ebcefd552db9, BCW-b6d79577771b, BCW-c55c43d4afaa
# -------------------------------------------------------------
print("\n--- CAMPAIGN 4: Speed Breakthrough & Ergonomics (M<=46, D<=3) ---")
c4_seeds = [
    np.array(seed_lookup["BCW-18389e333036"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-ebcefd552db9"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-b6d79577771b"]['state'], dtype=np.int32),
    np.array(seed_lookup["BCW-c55c43d4afaa"]['state'], dtype=np.int32),
]

c4_scored = 0
for proposal_idx in range(40000):
    parents = random.sample(c4_seeds, 2)
    p0, p1 = parents[0], parents[1]
    child = p0.copy()
    
    if random.random() < 0.5:
        child[:27] = p1[:27]
    else:
        for i in random.sample(range(27), random.randint(1, 4)):
            child[i] = p1[i]
            
    cuts = sorted(random.sample(range(28, 62), random.randint(1, 4)))
    for lo, hi in zip([27, *cuts], [*cuts, 62]):
        if random.random() < 0.5:
            child[lo:hi] = p1[lo:hi]
            
    if random.random() < 0.25:
        i, j = random.sample(range(27, 62), 2)
        child[i], child[j] = child[j], child[i]
        
    repair_finals(child, p0)
    cand = evaluate_state(child, "speed:frontier", "c4_speed", cap_m=46, cap_d=3, max_eight=1.04)
    if cand:
        c4_scored += 1

print(f"Campaign 4 completed: 40000 proposals, {c4_scored} valid candidates scored ({time.time()-t0:.1f}s)")
print(f"\nTOTAL unique new candidates discovered across all campaigns: {len(all_candidates)}")

# -------------------------------------------------------------
# SELECT ELITE CANDIDATES ACROSS PARETO DIMENSIONS FOR EXACT CKT v3 SCORING
# -------------------------------------------------------------
print("\nSelecting Pareto elites for exact 8-track CKT v3 scoring...")
elites = {}

def add_elites(cands, key_fn, n=12):
    for c in sorted(cands, key=key_fn)[:n]:
        elites[c['id']] = c

pool = list(all_candidates.values())

# 1. Overall speed (lowest S2ms / surrogate)
add_elites(pool, lambda c: c['S2ms'], 15)
add_elites(pool, lambda c: c['surrogate_ckt'], 15)

# 2. Pure 8B elites
pure_pool = [c for c in pool if c['isPure8B']]
print(f"Discovered Pure 8B candidates: {len(pure_pool)}")
if pure_pool:
    add_elites(pure_pool, lambda c: c['eightWorstRatio'], 15)
    add_elites(pure_pool, lambda c: c['S2ms'], 15)

# 3. High Home Row elites (Home >= 50%)
home_pool = [c for c in pool if c['homeS2'] >= 0.50]
print(f"Discovered Home >= 50% candidates: {len(home_pool)}")
if home_pool:
    add_elites(home_pool, lambda c: c['S2ms'], 15)
    add_elites(home_pool, lambda c: -c['homeS2'], 15)

# 4. Low Pinky elites (Pmax <= 4%)
pinky_pool = [c for c in pool if c['Pmax'] <= 0.04]
print(f"Discovered Pmax <= 4% candidates: {len(pinky_pool)}")
if pinky_pool:
    add_elites(pinky_pool, lambda c: c['S2ms'], 15)

# 5. D = 0 elites
d0_pool = [c for c in pool if c['D'] == 0]
print(f"Discovered D = 0 candidates: {len(d0_pool)}")
if d0_pool:
    add_elites(d0_pool, lambda c: c['S2ms'], 15)
    add_elites(d0_pool, lambda c: c['eightWorstRatio'], 15)

# 6. Low M (M <= 41, D <= 1) elites
lowm_pool = [c for c in pool if c['M'] <= 41 and c['D'] <= 1]
print(f"Discovered M <= 41, D <= 1 candidates: {len(lowm_pool)}")
if lowm_pool:
    add_elites(lowm_pool, lambda c: c['S2ms'], 15)
    add_elites(lowm_pool, lambda c: c['eightWorstRatio'], 15)

# 7. M <= 40, D <= 1 elites
m40_pool = [c for c in pool if c['M'] <= 40 and c['D'] <= 1]
print(f"Discovered M <= 40, D <= 1 candidates: {len(m40_pool)}")
if m40_pool:
    add_elites(m40_pool, lambda c: c['S2ms'], 10)
    add_elites(m40_pool, lambda c: c['eightWorstRatio'], 10)

elite_list = list(elites.values())
print(f"\nTotal unique Pareto elites selected for exact CKT v3 scoring: {len(elite_list)}")

# Save elite candidates to JSON for score_candidates_v3.js
candidates_file = DATA / 'shenyun-21x21-explored-elites.json'
candidates_file.write_text(json.dumps(elite_list, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Saved elite candidate entries to {candidates_file}")

# Invoke score_candidates_v3.js
output_scores_file = DATA / 'shenyun-21x21-explored-elites-scored.json'
print("Invoking score_candidates_v3.js...")
t_eval0 = time.time()
cmd = [
    'node',
    str(ROOT / 'scripts/research/score_candidates_v3.js'),
    '--input', str(candidates_file),
    '--output', str(output_scores_file),
    '--tau', '600',
    '--first-aux', '300',
    '--second-aux', '300'
]
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("Scoring failed:")
    print(res.stderr)
    sys.exit(1)

print(f"Exact CKT v3 scoring finished in {time.time()-t_eval0:.1f}s!")
scored_results = json.loads(output_scores_file.read_text(encoding='utf-8'))
scores_by_id = {r['id']: r['ckt_v3'] for r in scored_results}

for e in elite_list:
    e['ckt_v3'] = scores_by_id.get(e['id'])

# Save final comprehensive results
final_results_file = DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json'
final_results_file.write_text(json.dumps(elite_list, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Saved comprehensive results to {final_results_file}")

print("\n=================================================================")
print("EXACT CKT v3 RANKINGS OF NEWLY DISCOVERED SCHEMES")
print("=================================================================")

by_v3 = sorted(elite_list, key=lambda x: (x['ckt_v3'] is None, x['ckt_v3'] or 999))
for i, s in enumerate(by_v3[:25]):
    pure = ' [Pure 8B]' if s['isPure8B'] else f" (8B={s['eightWorstRatio']:.4f})"
    print(f"{i+1:2d}. {s['id']}: CKT_v3={s['ckt_v3']:.5f} M={s['M']} D={s['D']} Home={s['homeS2']*100:.2f}% Pmax={s['Pmax']*100:.2f}% S2ms={s['S2ms']:.2f}{pure} (origin: {s['origin']})")
