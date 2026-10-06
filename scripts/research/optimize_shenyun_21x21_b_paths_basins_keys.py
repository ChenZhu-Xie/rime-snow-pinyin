#!/usr/bin/env python3
"""Optimize final-key placement while preserving all eight B-path collision rates."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--rounds', type=int, default=5)
parser.add_argument('--beam', type=int, default=28)
parser.add_argument('--max-memory', type=int, default=42)
parser.add_argument('--seed-ids', nargs='*', default=[])
parser.add_argument('--allow-bridge-seeds', action='store_true')
parser.add_argument('--home-min', type=float, default=.5)
parser.add_argument('--p-cap', type=float)
parser.add_argument('--bridge-home', type=float, default=.47)
parser.add_argument('--bridge-p', type=float, default=.07)
parser.add_argument('--memory-penalty', type=float, default=3.0)
parser.add_argument('--home-weight', type=float, default=70.0)
args = parser.parse_args()
args.replay, args.input, args.output = (p.resolve() for p in (args.replay, args.input, args.output))
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
os.chdir(args.replay)
sys.path.insert(0, str(args.replay))
import numpy as np
import opt
import r5_search as r5
import search_engine as se

data = json.loads(args.input.read_text(encoding='utf8'))
seeds = [r for r in data['results'] if r['M'] <= args.max_memory + int(args.allow_bridge_seeds)
         and (not args.seed_ids or r['id'] in args.seed_ids)]
assert seeds
for seed in seeds:
    state = np.array(seed['state'], np.int32)
    seed.setdefault('Pmax', float(r5.rp(state)[1]))
    seed.setdefault('homeS2', float(r5.home(state)[0]))
baseline = json.loads((ROOT / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json').read_text(encoding='utf8'))['reference']
p_cap = float(args.p_cap if args.p_cap is not None else r5.rp(np.array(baseline['R9']['state'], np.int32))[1])
aux = set(int(i) for i in seeds[0]['state'][62:])
keys = [i for i in range(26) if i not in aux]


def endpoint(row):
    return row['M'] <= args.max_memory and row['D'] <= 1 and row['Pmax'] <= p_cap + 1e-12 and row['homeS2'] >= args.home_min - 1e-12


def bridge_penalty(row):
    return args.memory_penalty * max(0, row['M'] - args.max_memory) + 70 * max(0, row['Pmax'] - p_cap) + 100 * max(0, args.home_min - row['homeS2'])


def rank(row, name):
    penalty = bridge_penalty(row)
    if name == 'speed':
        return (row['S2ms'] + penalty, row['v5'])
    if name == 'v5':
        return (row['v5'] * 10 + penalty, row['S2ms'])
    if name == 'balanced':
        return (row['S2ms'] + row['v5'] * 4 + penalty, row['Pmax'])
    if name == 'load':
        return (row['S2ms'] + row['v5'] * 4 + 130 * row['Pmax'] + penalty, row['homeS2'])
    return (row['S2ms'] + row['v5'] * 4 - args.home_weight * row['homeS2'] + penalty, row['Pmax'])


def select(rows, size):
    goals = ('speed', 'v5', 'balanced', 'load', 'home')
    sorted_rows = {g: sorted(rows, key=lambda r: rank(r, g)) for g in goals}
    out = []
    selected = set()
    for i in range(size):
        for r in sorted_rows[goals[i % len(goals)]]:
            state = tuple(r['state'])
            if state not in selected:
                selected.add(state)
                out.append(r)
                break
    return out


frontier = []
for r in seeds:
    frontier.append({**r, 'sourceId': r['id'], 'parent': None, 'depth': 0})
visited = {tuple(r['state']) for r in frontier}
endpoints = [r for r in frontier if endpoint(r)]
counts = {'proposals': 0, 'legal': 0, 'bridge': 0, 'endpoint': len(endpoints)}
for depth in range(1, args.rounds + 1):
    children = []
    for parent in frontier:
        st = np.array(parent['state'], np.int32)
        cache, vs = opt.initialize(st, opt.PARAMS)
        stamp = np.zeros(len(cache), np.int64)
        ids = np.empty(len(cache), np.int32)
        costs = np.empty(len(cache))
        delta = np.zeros(60)
        epoch = 0
        for ia, a in enumerate(keys):
            for c in keys[ia + 1:]:
                counts['proposals'] += 1
                q = st.copy()
                opt.swapkeys(q, 27, 62, a, c)
                signature = tuple(map(int, q))
                if signature in visited:
                    continue
                visited.add(signature)
                unique, memory, displaced = se.stats(q, opt.PARAMS[-2], opt.PARAMS[-1], 21, 1, 1)
                if unique < 0 or memory > args.max_memory + 2 or displaced > 1:
                    continue
                counts['legal'] += 1
                p, home = float(r5.rp(q)[1]), float(r5.home(q)[0])
                if p > args.bridge_p or home < args.bridge_home:
                    continue
                counts['bridge'] += 1
                epoch += 1
                opt.probe(st, q, cache, opt.PARAMS, stamp, epoch, ids, costs, delta)
                factors = opt.metrics(vs + delta, opt.PARAMS)
                row = {'id': 'BPK-' + hashlib.sha256(q.tobytes()).hexdigest()[:12],
                       'sourceId': parent['sourceId'], 'parent': parent['id'], 'depth': depth,
                       'state': list(signature), 'M': int(memory), 'D': int(displaced),
                       'unique399': int(unique), 'Pmax': p, 'homeS2': home,
                       'S2ms': float(factors[0]), 'v5': float(factors[1]), 'v4': float(factors[2])}
                children.append(row)
                if endpoint(row):
                    endpoints.append(row)
                    counts['endpoint'] += 1
    if not children:
        break
    frontier = select(children, args.beam)
    if endpoints:
        fastest = min(endpoints, key=lambda r: r['S2ms'])
        best_v5 = min(endpoints, key=lambda r: r['v5'])
        print('depth', depth, counts, 'fast', fastest['id'], round(fastest['S2ms'], 4),
              'v5', best_v5['id'], round(best_v5['v5'], 5), flush=True)
    else:
        print('depth', depth, counts, 'no endpoint', flush=True)

saved = select([r for r in endpoints if endpoint(r)], 200)
saved = list({r['id']: r for r in
              (saved + sorted((r for r in endpoints if endpoint(r)), key=lambda r: r['S2ms'])[:80]
               + sorted((r for r in endpoints if endpoint(r)), key=lambda r: r['v5'])[:80])}.values())
source_by_id = {r['id']: r for r in seeds}
for row in saved:
    source = source_by_id[row['sourceId']]
    row.update({k: source[k] for k in ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')})
out = {'purpose': __doc__, 'source': str(args.input.relative_to(ROOT)),
       'maxMemory': args.max_memory, 'pCap': p_cap, 'homeMin': args.home_min,
       'bridgeHome': args.bridge_home, 'bridgeP': args.bridge_p, 'memoryPenalty': args.memory_penalty,
       'homeWeight': args.home_weight,
       'counts': counts, 'results': saved}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
print(json.dumps({'counts': counts, 'fastest':
                  [{k: r[k] for k in ('id', 'sourceId', 'M', 'Pmax', 'homeS2', 'S2ms', 'v5')}
                   for r in sorted(saved, key=lambda r: r['S2ms'])[:5]]}, ensure_ascii=False, indent=2))
