#!/usr/bin/env python3
"""Explore four load-gated 21x21 seeds through final-key exchange basins.

Bridge states may briefly violate load or memory limits. Only endpoints are
reported as feasible; all eight B paths must strictly beat S005 to pass.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_SEED_IDS = ('BPL-3d849cf8c254', 'BPL-2fc9e18325ef',
                    'BPL-07efc5133241', 'BPL-e745cf5b09ee')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--rounds', type=int, default=4)
parser.add_argument('--beam', type=int, default=14)
parser.add_argument('--max-memory', type=int, default=43)
parser.add_argument('--bridge-memory', type=int, default=45)
parser.add_argument('--bridge-p', type=float, default=.075)
parser.add_argument('--bridge-home', type=float, default=.47)
parser.add_argument('--seed', type=int, default=20261017)
parser.add_argument('--seed-ids', nargs='+', default=DEFAULT_SEED_IDS)
args = parser.parse_args()
seed_ids = tuple(args.seed_ids)
args.replay = args.replay.resolve()
args.output = args.output.resolve()

os.environ['PYTHONUTF8'] = '1'
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
os.chdir(args.replay)
sys.path.insert(0, str(args.replay))
import numpy as np
from numba import njit
import opt
import r5_search as r5
import search_engine as se

sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay),
            '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
sys.path.insert(0, str(ROOT / 'scripts/research'))
from b_path_fast import FastBuckets, NAMES

source = json.loads((DATA / 'shenyun-21x21-b-sets-benchmark.json').read_text(encoding='utf8'))
baseline = source['reference']['S005']
p_cap = r5.rp(np.array(source['reference']['R9']['state'], np.int32))[1]
aux = np.array([opt.META['keys'].index(k) for k in 'IVUAO'], np.int32)
fast = FastBuckets(b)
@njit(cache=True)
def seed_numba(value):
    np.random.seed(value)


seed_numba(args.seed)

known = {}
for path in DATA.glob('shenyun-21x21-b-paths-*.json'):
    payload = json.loads(path.read_text(encoding='utf8'))
    for row in payload.get('results', []):
        if isinstance(row, dict) and row.get('id') in seed_ids:
            known[row['id']] = row
assert set(known) == set(seed_ids), set(seed_ids) - set(known)


def ratio(row):
    return max(row[k] / baseline[k] for k in NAMES)


def deficits(row):
    return np.array([row[k] / baseline[k] - 1 for k in NAMES])


def feasible(row):
    return row['M'] <= args.max_memory and row['D'] <= 1 and row['Pmax'] <= p_cap + 1e-12 and row['homeS2'] >= .5 - 1e-12


def evaluate(st, parent, origin, depth):
    unique, memory, displaced = se.stats(st, opt.PARAMS[-2], opt.PARAMS[-1], 21, 1, 1)
    if unique < 0 or memory > args.bridge_memory or displaced > 1:
        return None
    p, home = float(r5.rp(st)[1]), float(r5.home(st)[0])
    if p > args.bridge_p or home < args.bridge_home:
        return None
    metrics = fast.score(b.state_codes(st))
    row = {'id': 'BPB-' + hashlib.sha256(st.tobytes()).hexdigest()[:12],
           'parent': parent, 'origin': origin, 'depth': depth,
           'state': st.tolist(), 'M': int(memory), 'D': int(displaced),
           'unique399': int(unique), 'Pmax': p, 'homeS2': home, **metrics}
    return row


def rank(row, objective):
    v = deficits(row)
    # Feasible states win ties, but no gate blocks temporary bridge states.
    bridge = .15 * max(0, row['Pmax'] - p_cap) + .15 * max(0, .5 - row['homeS2'])
    bridge += .0005 * max(0, row['M'] - args.max_memory)
    if objective == 'worst':
        return (float(max(v)) + bridge, float(sum(np.maximum(0, v))), row['M'])
    if objective == 'sum':
        return (float(sum(np.maximum(0, v))) + bridge, float(max(v)), row['M'])
    if objective == 'word2':
        return (float(max(v[5], v[7])) + bridge, float(max(v)), row['M'])
    if objective == 'ws2':
        return (float(v[7]) + bridge, float(sum(np.maximum(0, v))), row['M'])
    if objective == 'wj2':
        return (float(v[5]) + bridge, float(sum(np.maximum(0, v))), row['M'])
    if objective == 'wj1':
        return (float(v[4]) + bridge, float(sum(np.maximum(0, v))), row['M'])
    if objective == 'word':
        return (float(max(v[4:])) + bridge, float(max(v)), row['M'])
    return (float(max(v[:4])) + bridge, float(max(v)), row['M'])


def neighbors(st):
    # Swaps retain 21 final keys and permit two-move repair of a B-path loss.
    for a in range(27, 62):
        for c in range(a + 1, 62):
            if st[a] != st[c]:
                q = st.copy()
                q[a], q[c] = q[c], q[a]
                yield q
    # A few different moves admit nearby basins outside the swap orbit.
    for _ in range(100):
        q = r5.proposal(st, np.array([k for k in range(26) if k not in aux], np.int32), 21, 1)
        if not np.array_equal(q, st):
            yield q


def select(pool, size):
    selected = []
    seen = set()
    metric_counts = {}
    objectives = ('worst', 'sum', 'wj1', 'ws2', 'word2', 'word', 'character', 'wj2')
    ordered = {name: sorted(pool, key=lambda r: rank(r, name)) for name in objectives}
    for i in range(size):
        order = ordered[objectives[i % len(objectives)]]
        for row in order:
            signature = tuple(row['state'])
            metric_signature = tuple(round(row[k], 12) for k in NAMES)
            if signature not in seen and metric_counts.get(metric_signature, 0) < 2:
                seen.add(signature)
                metric_counts[metric_signature] = metric_counts.get(metric_signature, 0) + 1
                selected.append(row)
                break
    return selected


all_results = []
summary = []
for seed_id in seed_ids:
    seed = known[seed_id]
    # Re-evaluate seeds to make all search rows self-contained.
    start = evaluate(np.array(seed['state'], np.int32), None, seed_id, 0)
    assert start and feasible(start)
    visited = {tuple(start['state'])}
    frontier = [start]
    endpoints = [start]
    bridges = []
    counts = {'proposals': 0, 'unique': 0, 'validBridge': 0,
              'feasible': 1, 'allEight': 0}
    for depth in range(1, args.rounds + 1):
        new = []
        for parent in frontier:
            for st in neighbors(np.array(parent['state'], np.int32)):
                counts['proposals'] += 1
                signature = tuple(map(int, st))
                if signature in visited or not np.array_equal(st[62:], aux):
                    continue
                visited.add(signature)
                counts['unique'] += 1
                row = evaluate(st, parent['id'], seed_id, depth)
                if row is None:
                    continue
                counts['validBridge'] += 1
                new.append(row)
                if feasible(row):
                    counts['feasible'] += 1
                    endpoints.append(row)
                    if ratio(row) < 1:
                        counts['allEight'] += 1
                        if counts['allEight'] <= 3:
                            print('ALL EIGHT', seed_id, depth, row['id'], row['M'], row['D'], ratio(row), flush=True)
                else:
                    bridges.append(row)
        if not new:
            break
        frontier = select(new, args.beam)
        best = min(endpoints, key=ratio)
        print(seed_id, 'depth', depth, 'proposals', counts['proposals'],
              'bridge', counts['validBridge'], 'endpoints', counts['feasible'],
              'best', best['id'], round(ratio(best), 9), flush=True)
    best_endpoints = sorted(endpoints, key=lambda r: (ratio(r), r['M'], r['Pmax']))[:150]
    best_bridges = sorted(bridges, key=lambda r: rank(r, 'worst'))[:50]
    all_results.extend(best_endpoints)
    all_results.extend(best_bridges)
    summary.append({'seed': seed_id, 'counts': counts,
                    'best': {key: min(endpoints, key=ratio)[key]
                             for key in ('id', 'M', 'D', 'Pmax', 'homeS2')},
                    'bestRatio': ratio(min(endpoints, key=ratio)),
                    'savedEndpoints': len(best_endpoints), 'savedBridges': len(best_bridges)})

output = {'purpose': __doc__, 'seedIds': seed_ids, 'rngSeed': args.seed,
          'rngSeedApplied': True,
          'rounds': args.rounds, 'beam': args.beam,
          'maxMemory': args.max_memory, 'bridgeMemory': args.bridge_memory,
          'pCap': float(p_cap), 'bridgeP': args.bridge_p, 'homeMin': .5,
          'bridgeHome': args.bridge_home, 'baseline': {k: baseline[k] for k in NAMES},
          'summary': summary, 'results': all_results}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
print(json.dumps(summary, ensure_ascii=False, indent=2))
