#!/usr/bin/env python3
"""Bounded D=0, low-M local probe of eight character/word B paths."""
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
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--benchmark', type=Path, default=HERE / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--trials', type=int, default=360)
parser.add_argument('--max-memory', type=int, default=40)
parser.add_argument('--seed', type=int, default=20261006)
parser.add_argument('--prior', type=Path, help='Optional previous probe results to resume from')
parser.add_argument('--max-s2', type=float, default=74.0)
parser.add_argument('--max-v5', type=float, default=11.0)
parser.add_argument('--focus', choices=['eight', 'gate', 'word'], default='eight')
args = parser.parse_args()
args.output = args.output.resolve()
args.benchmark = args.benchmark.resolve()
args.replay = args.replay.resolve()
if args.prior:
    args.prior = args.prior.resolve()

# The benchmark owns the frozen source and the repository shape/stroke validation.
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay),
            '--output', str(args.benchmark)]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)

import numpy as np
from numba import njit

@njit
def seed_numba(seed: int) -> None:
    np.random.seed(seed)

seed_numba(args.seed)
rng = random.Random(args.seed)
payload = json.loads(args.benchmark.read_text(encoding='utf-8'))
names = ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
baseline = payload['reference']['S005']
seeds = [row for row in payload['results'] if row['D'] == 0 and row['M'] <= args.max_memory]
if args.prior:
    seeds += json.loads(args.prior.read_text(encoding='utf-8'))['results']
seeds = [row for row in seeds if row['M'] <= args.max_memory and row['D'] == 0
         and row['S2ms'] <= args.max_s2 and row['v5'] <= args.max_v5]
seeds.sort(key=lambda r: max(r[k] / baseline[k] for k in names))
assert seeds
keys = np.array([k for k in range(26) if k not in np.array(seeds[0]['state'])[62:]], np.int32)
visited = {tuple(row['state']) for row in seeds}
front = list(seeds)
evaluated = 0
valid_proposals = 0
for i in range(args.trials):
    if args.focus == 'gate':
        objectives = ('s1', 'gate', 's1', 'j2', 'gate', 's2', 'j1', 'gate')
    elif args.focus == 'word':
        objectives = ('word', 'wj1', 'word', 'wj2', 'word', 'ws1', 'word', 'ws2')
    else:
        objectives = names + ('balanced',)
    focus = objectives[i % len(objectives)]
    if focus == 'gate':
        quality = lambda row: max(row[k] / baseline[k] for k in names[:4])
    elif focus == 'word':
        quality = lambda row: max(row[k] / baseline[k] for k in names[4:])
    elif focus == 'balanced':
        quality = lambda row: max(row[k] / baseline[k] for k in names)
    else:
        quality = lambda row: row[focus] / baseline[focus]
    pool = seeds if i % 7 == 0 else front
    if args.focus == 'word' and any(r['passesAllFour'] for r in pool):
        pool = [r for r in pool if r['passesAllFour']]
    ranked = sorted(pool, key=quality)
    parent = rng.choice(ranked[:min(15 if args.focus == 'gate' else 25, len(ranked))])
    state = np.array(parent['state'], dtype=np.int32)
    trial = b.r5.proposal(state, keys, 21, 0)
    unique, memory, displaced = b.se.stats(trial, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 0, 1)
    if memory > args.max_memory or displaced != 0 or not np.array_equal(trial[62:], state[62:]):
        continue
    valid_proposals += 1
    signature = tuple(trial.tolist())
    if signature in visited:
        continue
    visited.add(signature)
    candidate = b.report({'codeList': b.state_codes(trial)}, 'probe', trial)
    if candidate['S2ms'] > args.max_s2 or candidate['v5'] > args.max_v5:
        continue
    candidate['id'] = 'BP0-' + hashlib.sha256(trial.tobytes()).hexdigest()[:12]
    candidate['parent'] = parent['id']
    candidate['passesAllFour'] = all(candidate[k] < baseline[k] for k in names[:4])
    candidate['passesAllEight'] = all(candidate[k] < baseline[k] for k in names)
    front.append(candidate)
    evaluated += 1
    if evaluated % 25 == 0:
        best = min(front, key=lambda r: max(r[k] / baseline[k] for k in names))
        print('evaluated', evaluated, 'trial', i + 1, 'best max ratio',
              round(max(best[k] / baseline[k] for k in names), 6), flush=True)

front.sort(key=lambda r: max(r[k] / baseline[k] for k in names))
out = {'purpose': 'bounded D=0 B-path local probe; no global optimality claim',
       'seed': args.seed, 'rng': 'Python and Numba PRNG seeded', 'trials': args.trials, 'validProposals': valid_proposals,
       'evaluated': evaluated, 'maxMemory': args.max_memory,
       'maxS2': args.max_s2, 'maxV5': args.max_v5, 'focus': args.focus, 'baseline': baseline,
       'results': front}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'validProposals': valid_proposals, 'evaluated': evaluated,
                  'best': [{k: x[k] for k in ('id', 'M', 'D', 'j1', 'j2', 's1', 's2',
                                              'wj1', 'wj2', 'ws1', 'ws2', 'S2ms', 'v5')}
                           for x in front[:3]]}, ensure_ascii=False, indent=2))
