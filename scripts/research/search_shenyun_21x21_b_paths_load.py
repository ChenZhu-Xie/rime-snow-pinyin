#!/usr/bin/env python3
"""Search AVUIO-locked 21x21 layouts with load gates ahead of ensemble scores."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
DATA = HERE / 'research-notes/data'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--trials', type=int, default=40000)
parser.add_argument('--max-memory', type=int, default=41)
parser.add_argument('--max-d', type=int, default=1)
parser.add_argument('--p-cap', type=float, default=None)
parser.add_argument('--home-min', type=float, default=.5)
parser.add_argument('--seed', type=int, default=20261016)
parser.add_argument('--strategy', choices=('balanced', 'word'), default='balanced')
parser.add_argument('--prior', type=Path, nargs='*', default=[])
args = parser.parse_args()
args.replay = args.replay.resolve()
args.output = args.output.resolve()
args.prior = [path.resolve() for path in args.prior]

os.environ['PYTHONUTF8'] = '1'
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
os.chdir(args.replay)
sys.path.insert(0, str(args.replay))
import numpy as np
import r5_search as r5
import search_engine as se
import opt

sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay),
            '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
sys.path.insert(0, str(HERE / 'scripts/research'))
from b_path_fast import FastBuckets, NAMES

np.random.seed(args.seed)
rng = random.Random(args.seed)
reference = json.loads((DATA / 'shenyun-21x21-b-sets-benchmark.json').read_text(encoding='utf8'))['reference']
baseline = reference['S005']
p_cap = args.p_cap if args.p_cap is not None else r5.rp(np.array(reference['R9']['state'], np.int32))[1]
fast = FastBuckets(b)
physical_aux = np.array([opt.META['keys'].index(k) for k in 'IVUAO'], np.int32)
keys = np.array([i for i in range(26) if i not in physical_aux], np.int32)


def quality(row):
    return max(row[k] / baseline[k] for k in NAMES)


def score(row):
    return (quality(row), row['M'], row['D'], row.get('S2ms', 999))


all_rows = {}
files = sorted(DATA.glob('shenyun-21x21-b-paths-*.json')) + list(args.prior)
for path in files:
    payload = json.loads(path.read_text(encoding='utf8'))
    if not isinstance(payload.get('results'), list):
        continue
    for row in payload['results']:
        st = row.get('state')
        if isinstance(st, list) and len(st) == 67 and all(key in row for key in NAMES):
            all_rows[tuple(st)] = row
visited = set(all_rows)
seeds = []
for signature, row in all_rows.items():
    if row.get('M', 999) > args.max_memory or row.get('D', 999) > args.max_d:
        continue
    state = np.array(signature, np.int32)
    if not np.array_equal(state[62:], physical_aux):
        continue
    p, home = r5.rp(state)[1], r5.home(state)[0]
    if p <= p_cap + 1e-12 and home >= args.home_min - 1e-12:
        seeds.append({**row, 'Pmax': float(p), 'homeS2': float(home)})
assert seeds, 'No load-feasible seeds'
seeds.sort(key=score)
frontier = seeds[:140]
leaders = list(frontier)
for memory in range(38, args.max_memory + 1):
    leaders.extend(sorted((r for r in seeds if r['M'] == memory), key=score)[:12])
for displaced in range(args.max_d + 1):
    leaders.extend(sorted((r for r in seeds if r['D'] == displaced), key=score)[:12])
leaders = list({tuple(r['state']): r for r in leaders}.values())

count = {'proposals': 0, 'legal': 0, 'loadFeasible': 0, 'scored': 0, 'allEight': 0}
new_rows = {}
best = score(frontier[0])
focuses = ((*NAMES, 'balanced', 'balanced', 'character', 'word')
           if args.strategy == 'balanced' else
           ('wj2', 'ws2', 'word', 'wj1', 'ws1', 'word', 'balanced', 'word', 'character'))
for index in range(args.trials):
    count['proposals'] += 1
    focus = focuses[index % len(focuses)]
    if index % 250 == 0:
        fresh = sorted(new_rows.values(), key=score)[:80]
        pool = list({tuple(r['state']): r for r in (leaders + fresh)}.values())
        frontier = sorted(pool, key=score)[:140]
        if args.strategy == 'word':
            word_pool = [r for r in new_rows.values()
                         if max(r[k] / baseline[k] for k in NAMES[:4]) < 1.012]
            word_pool = sorted(word_pool,
                               key=lambda r: (max(r[k] / baseline[k] for k in NAMES[4:]), quality(r)))[:100]
            frontier = list({tuple(r['state']): r for r in (frontier + word_pool)}.values())
    pool = frontier if index % 7 else seeds[:80]
    if args.strategy == 'word' and focus != 'character':
        near = [r for r in pool if max(r[k] / baseline[k] for k in NAMES[:4]) < 1.012]
        if near:
            pool = near
    if focus in NAMES:
        ranked = sorted(pool, key=lambda r: (r[focus] / baseline[focus], quality(r), r['M']))
    elif focus == 'character':
        ranked = sorted(pool, key=lambda r: (max(r[k] / baseline[k] for k in NAMES[:4]), quality(r)))
    elif focus == 'word':
        ranked = sorted(pool, key=lambda r: (max(r[k] / baseline[k] for k in NAMES[4:]), quality(r)))
    else:
        ranked = sorted(pool, key=score)
    parent = rng.choice(ranked[:min(28, len(ranked))])
    state = np.array(parent['state'], np.int32)
    steps = 1 if index % 4 else rng.choice((2, 3))
    for _ in range(steps):
        state = r5.proposal(state, keys, 21, args.max_d)
    if not np.array_equal(state[62:], physical_aux):
        continue
    signature = tuple(map(int, state))
    if signature in visited:
        continue
    visited.add(signature)
    unique, memory, displaced = se.stats(state, opt.PARAMS[-2], opt.PARAMS[-1], 21, args.max_d, 1)
    if unique < 0 or memory > args.max_memory or displaced > args.max_d:
        continue
    count['legal'] += 1
    p, home = r5.rp(state)[1], r5.home(state)[0]
    if p > p_cap + 1e-12 or home < args.home_min - 1e-12:
        continue
    count['loadFeasible'] += 1
    metrics = fast.score(b.state_codes(state))
    row = {'id': 'BPL-' + hashlib.sha256(state.tobytes()).hexdigest()[:12],
           'parent': parent['id'], 'state': list(signature), 'M': int(memory),
           'D': int(displaced), 'unique399': int(unique), 'Pmax': float(p),
           'homeS2': float(home), **metrics}
    ratio = quality(row)
    # Score R11 model only for candidates near the emerging frontier.
    if ratio < max(1.05, best[0] + .025) or ratio < 1:
        factors = opt.metrics(opt.initialize(state, opt.PARAMS)[1], opt.PARAMS)
        row.update({'S2ms': float(factors[0]), 'v5': float(factors[1]), 'v4': float(factors[2])})
    new_rows[signature] = row
    count['scored'] += 1
    if ratio < 1:
        count['allEight'] += 1
    if score(row) < best:
        best = score(row)
        print('best', index + 1, row['id'], 'M', memory, 'D', displaced,
              'ratio', round(ratio, 8), 'P', round(p, 5), 'home', round(home, 5), flush=True)
    if (index + 1) % 5000 == 0:
        print('progress', index + 1, count, flush=True)

saved = sorted(new_rows.values(), key=score)[:500]
out = {'purpose': 'AVUIO-locked 21x21 low-M D<=1 search; load gates precede B paths and ensemble',
       'seed': args.seed, 'trials': args.trials, 'strategy': args.strategy, 'maxMemory': args.max_memory,
       'maxD': args.max_d, 'PmaxCap': p_cap, 'homeS2Min': args.home_min,
       'baseline': {key: baseline[key] for key in NAMES},
       'initialStates': len(all_rows), 'loadFeasibleSeeds': len(seeds),
       'counts': count, 'results': saved}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
print(json.dumps({'counts': count, 'saved': len(saved), 'best':
                  [{k: r.get(k) for k in ('id', 'M', 'D', 'Pmax', 'homeS2', 'S2ms', 'v5')}
                   | {'worstRatio': quality(r)} for r in saved[:5]]},
                 ensure_ascii=False, indent=2))
