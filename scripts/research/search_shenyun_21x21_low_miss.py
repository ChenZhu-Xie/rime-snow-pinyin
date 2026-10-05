#!/usr/bin/env python3
"""Bounded AVUIO fixed-auxiliary search on the frozen R11 factor model.

Requires the unzipped R11_integrated_replay with source.json (run
prepare_r11.py with PYTHONUTF8=1 on Windows) and its model.npz. This is a
heuristic search; replay finalists with the original eval_full.js engine.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--seeds', type=Path, nargs='*', default=[])
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--rounds', type=int, default=24)
parser.add_argument('--steps', type=int, default=50000)
parser.add_argument('--max-memory', type=int, default=44)
parser.add_argument('--max-d', type=int, default=3)
parser.add_argument('--min-mx', type=float, default=140.6807263387)
parser.add_argument('--seed', type=int, default=21021)
args = parser.parse_args()
replay = args.replay.resolve()
sys.path.insert(0, str(replay))
os.chdir(replay)

import numpy as np
import opt
import r5_search as r5
import r10_search as r10
import search_engine as se
from numba import njit

PARAMS = opt.PARAMS
LIMIT = float(r5.D['ckt']['tracks']['S005']['S2']['miss'])
TONE = np.array([opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)

@njit

def value(track, state, miss, profile):
    a = opt.metrics(track, PARAMS)
    mx = r10.mx(state)
    return (profile[0] * a[0] / 70.1890673523 +
            profile[1] * a[1] / 10.3977595859 +
            profile[2] * a[2] / 10.7422163477 +
            profile[3] * 140.6807263387 / mx +
            profile[4] * max(0., miss - LIMIT) / .01 +
            profile[5] * max(0., profile[6] - mx) / 10. +
            profile[7] * max(0, opt.memory(state) - 40))

@njit

def walk(start, steps, seed, temperature, profile, cap, displacement):
    np.random.seed(seed)
    state = start.copy()
    cached, tracks = opt.initialize(state, PARAMS)
    miss = r5.ambiguity(state)[2]
    current = value(tracks, state, miss, profile)
    best, best_tracks, best_miss, best_value = state.copy(), tracks.copy(), miss, current
    keys = np.array([k for k in range(26) if k not in state[62:]], np.int32)
    stamp = np.zeros(len(cached), np.int64)
    ids = np.empty(len(cached), np.int32)
    costs = np.empty(len(cached))
    delta = np.zeros(60)
    evaluated = accepted = 0
    for i in range(steps):
        trial = r5.proposal(state, keys, 21, displacement)
        if np.all(trial == state):
            continue
        unique, memory, _displaced = se.stats(trial, PARAMS[-2], PARAMS[-1], 21, displacement, 1)
        if unique < 369 or memory > cap or np.any(trial[62:] != TONE):
            continue
        next_miss = r5.ambiguity(trial)[2]
        if next_miss > .037 or r10.mx(trial) < profile[8]:
            continue
        evaluated += 1
        n = opt.probe(state, trial, cached, PARAMS, stamp, evaluated, ids, costs, delta)
        next_tracks = tracks + delta
        score = value(next_tracks, trial, next_miss, profile)
        temp = temperature * (1 - i / steps) ** 2 + 1e-9
        if score < current or np.random.random() < np.exp(min(0., (current - score) / temp)):
            state, tracks, miss, current = trial, next_tracks, next_miss, score
            accepted += 1
            for j in range(n):
                cached[ids[j]] = costs[j]
            if score < best_value - 1e-12:
                best, best_tracks, best_miss, best_value = state.copy(), tracks.copy(), miss, score
    return best, best_tracks, best_miss, evaluated, accepted

def main() -> None:
    rng = random.Random(args.seed)
    entries = {entry['id']: entry for entry in r5.D['entries']}
    anchor = opt.state(entries['R9-21X21-M40-02'], r5.D)
    pool = [('R9-21X21-M40-02', anchor)]
    for path in args.seeds:
        payload = json.loads(path.read_text(encoding='utf-8'))
        for row in payload:
            state = row.get('state')
            if state is None and 'entry' in row:
                state = opt.state(row['entry'], r5.D)
            if state is not None and len(state) == 67:
                state = np.array(state, dtype=np.int32)
                if np.array_equal(state[62:], TONE):
                    pool.append((path.name, state))
    results = []
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    for index in range(args.rounds):
        label, root = pool[0] if index % 8 == 0 else rng.choice(pool[:60])
        floor = [args.min_mx, args.min_mx + 2, args.min_mx + 4, args.min_mx + 8][index % 4]
        profile = np.array([
            rng.uniform(.12, .6), rng.uniform(.55, 1.2), rng.uniform(.3, 2),
            rng.uniform(.025, .2), rng.uniform(.18, .4), rng.uniform(.8, 1.7),
            floor, rng.uniform(.005, .05), max(args.min_mx - 5, floor - 7)
        ], dtype=np.float64)
        state, tracks, miss, evaluated, accepted = walk(
            root, args.steps, args.seed + index, .0025, profile, args.max_memory, args.max_d)
        a = opt.metrics(tracks, PARAMS)
        unique, memory, displaced = se.stats(state, PARAMS[-2], PARAMS[-1], 21, args.max_d, 1)
        result = {
            'parent': label, 'state': state.tolist(), 'M': int(memory), 'D': int(displaced),
            'U': int(unique), 'miss': float(miss), 'S2': float(a[0]), 'v5': float(a[1]),
            'v4': float(a[2]), 'mx': float(r10.mx(state)), 'profile': profile.tolist(),
            'proposals': args.steps, 'evaluated': evaluated, 'accepted': accepted,
        }
        results.append(result)
        pool.append((f'round-{index}', state))
        output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        print(index, 'M',memory,'D',displaced,'miss',round(miss,6), 'S2',round(a[0],3),
              'v5',round(a[1],4),'v4',round(a[2],4),'MX',round(result['mx'],2),flush=True)

if __name__ == '__main__':
    main()
