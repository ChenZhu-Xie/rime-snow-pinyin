#!/usr/bin/env python3
"""Large, reproducible AVUIO-locked 21x21 search across M and D caps."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--benchmark', type=Path, default=HERE / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')
p.add_argument('--prior', type=Path, nargs='+', default=[])
p.add_argument('--output', type=Path, required=True)
p.add_argument('--trials', type=int, default=10000)
p.add_argument('--max-memory', type=int, default=44)
p.add_argument('--max-d', type=int, default=3)
p.add_argument('--max-s2', type=float, default=76.0)
p.add_argument('--max-v5', type=float, default=11.2)
p.add_argument('--gate-slack', type=float, default=.025)
p.add_argument('--proposal-steps', type=int, default=1,
               help='maximum successive mutations before validating a candidate')
p.add_argument('--strategy', choices=('word', 'word_bridge', 'speed', 'speed_frontier', 'v5_frontier'), default='speed')
p.add_argument('--seed', type=int, default=20261011)
args = p.parse_args()
assert args.proposal_steps >= 1
args.replay, args.benchmark, args.output = (x.resolve() for x in (args.replay, args.benchmark, args.output))
args.prior = [path.resolve() for path in args.prior]

sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay),
            '--output', str(args.benchmark)]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
sys.path.insert(0, str(HERE / 'scripts/research'))
from b_path_fast import FastBuckets, NAMES

import numpy as np
from numba import njit


@njit
def seed_numba(seed):
    np.random.seed(seed)


seed_numba(args.seed)
rng = random.Random(args.seed)
baseline = json.loads(args.benchmark.read_text(encoding='utf8'))['reference']['S005']
benchmark = json.loads(args.benchmark.read_text(encoding='utf8'))
fast = FastBuckets(b)
objectives = (('word', 'wj1', 'word', 'wj2', 'word', 'ws1', 'word', 'ws2',
               'balanced', 'gate', 'speed') if args.strategy == 'word' else
              ('word', 'wj1', 'word', 'wj2', 'word', 'ws1', 'word', 'ws2',
               'word', 'balanced', 'gate', 'speed') if args.strategy == 'word_bridge' else
              ('word', 'wj1', 'word', 'wj2', 'word', 'ws1', 'word', 'ws2',
               'balanced', 'gate', 'speed', 'speed', 'speed') if args.strategy == 'speed' else
              ('speed', 'speed', 'speed', 'speed', 'speed', 'speed', 'speed',
               'word', 'wj1', 'ws1', 'balanced', 'gate') if args.strategy == 'speed_frontier' else
              ('v5', 'v5', 'v5', 'v5', 'v5', 'v5', 'speed', 'speed', 'word', 'balanced', 'gate'))
rows = {}
for row in benchmark['results']:
    if row['M'] <= args.max_memory and row['D'] <= args.max_d:
        rows[tuple(row['state'])] = row
for path in args.prior:
    for row in json.loads(path.read_text(encoding='utf8'))['results']:
        if row['M'] <= args.max_memory and row['D'] <= args.max_d:
            rows[tuple(row['state'])] = row
rows = {state: row for state, row in rows.items()
        if row['S2ms'] <= args.max_s2 and row['v5'] <= args.max_v5}
assert rows
initial_count = len(rows)
physical_aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], np.int32)
assert all(np.array_equal(np.array(state[62:]), physical_aux) for state in rows)
keys = np.array([k for k in range(26) if k not in physical_aux], np.int32)
visited = set(rows)


def gate_ratio(row):
    return max(row[key] / baseline[key] for key in NAMES[:4])


def word_ratio(row):
    return max(row[key] / baseline[key] for key in NAMES[4:])


def key_score(row, focus):
    if focus == 'word':
        return word_ratio(row)
    if focus == 'gate':
        return gate_ratio(row)
    if focus == 'balanced':
        return max(gate_ratio(row), word_ratio(row))
    if focus == 'v5':
        return row['v5'] / 10.3977595859
    if focus == 'speed':
        if args.strategy == 'word':
            return row['S2ms'] / 70.1890673523 + row['v5'] / 10.3977595859
        return max(row['S2ms'] / 70.1890673523,
                   row['v5'] / 10.3977595859,
                   row['v4'] / 10.7422163477)
    return row[focus] / baseline[focus]


def build_elites():
    values = list(rows.values())
    gated = [row for row in values if gate_ratio(row) < 1]
    all_eight = [row for row in gated if word_ratio(row) < 1]
    nearby = [row for row in values if gate_ratio(row) < 1 + args.gate_slack]
    result = {}
    for focus in set(objectives):
        bridge_word = args.strategy == 'word_bridge' and focus in (
            'word', 'wj1', 'wj2', 'ws1', 'ws2', 'balanced')
        pool = (nearby if bridge_word or focus == 'gate' or
                (focus == 'speed' and args.strategy == 'word') else
                all_eight if focus in ('speed', 'v5') and all_eight else gated)
        if not pool:
            pool = nearby or values
        # Retain M/D diversity in addition to rank leaders.
        leaders = sorted(pool, key=lambda row: (key_score(row, focus), row['M'], row['D']))[:35]
        for memory in range(38, args.max_memory + 1):
            group = [row for row in pool if row['M'] == memory]
            leaders.extend(sorted(group, key=lambda row: key_score(row, focus))[:4])
        for disp in range(args.max_d + 1):
            group = [row for row in pool if row['D'] == disp]
            leaders.extend(sorted(group, key=lambda row: key_score(row, focus))[:4])
        result[focus] = list({tuple(row['state']): row for row in leaders}.values())
    return result


elites = build_elites()
evaluated = valid = near = gated_new = 0
best_gate_word = min((word_ratio(row) for row in rows.values() if gate_ratio(row) < 1), default=float('inf'))
for trial_index in range(args.trials):
    focus = objectives[trial_index % len(objectives)]
    if trial_index % 97 == 0:
        elites = build_elites()
    pool = elites[focus]
    parent = rng.choice(pool[:min(len(pool), 45)])
    state = np.array(parent['state'], np.int32)
    candidate_state = state
    steps = 1 if args.proposal_steps == 1 else rng.randint(1, args.proposal_steps)
    for _ in range(steps):
        candidate_state = b.r5.proposal(candidate_state, keys, 21, args.max_d)
    unique, memory, displaced = b.se.stats(candidate_state, b.opt.PARAMS[-2],
                                           b.opt.PARAMS[-1], 21, args.max_d, 1)
    if unique < 0 or memory > args.max_memory or displaced > args.max_d:
        continue
    if not np.array_equal(candidate_state[62:], physical_aux):
        continue
    valid += 1
    signature = tuple(map(int, candidate_state))
    if signature in visited:
        continue
    visited.add(signature)
    codes = b.state_codes(candidate_state)
    measures = fast.score(codes)
    row = {'id': 'BPW-' + hashlib.sha256(candidate_state.tobytes()).hexdigest()[:12],
           'parent': parent['id'], 'state': list(signature), 'M': int(memory),
           'D': int(displaced), 'unique399': int(unique), **measures}
    if gate_ratio(row) >= 1 + args.gate_slack:
        continue
    near += 1
    factors = b.opt.metrics(b.opt.initialize(candidate_state, b.opt.PARAMS)[1], b.opt.PARAMS)
    row.update({'S2ms': float(factors[0]), 'v5': float(factors[1]), 'v4': float(factors[2])})
    if row['S2ms'] > args.max_s2 or row['v5'] > args.max_v5:
        continue
    row['passesAllFour'] = gate_ratio(row) < 1
    row['passesAllEight'] = row['passesAllFour'] and word_ratio(row) < 1
    rows[signature] = row
    evaluated += 1
    if row['passesAllFour']:
        gated_new += 1
        if word_ratio(row) < best_gate_word:
            best_gate_word = word_ratio(row)
            print('best', trial_index + 1, row['id'], 'M', row['M'], 'D', row['D'],
                  'wordRatio', round(best_gate_word, 6), 'S2', round(row['S2ms'], 3), flush=True)
    if (trial_index + 1) % 1000 == 0:
        print('progress', trial_index + 1, 'valid', valid, 'near', near,
              'kept', evaluated, 'gate', gated_new, flush=True)

out = {'purpose': 'AVUIO-locked 21x21 bounded M/D-expanded B-path search',
       'source': 'frozen R11 source484 and repository runtime shape/stroke maps',
       'seed': args.seed, 'trials': args.trials, 'initialStates': initial_count,
       'validProposals': valid, 'nearGate': near, 'evaluated': evaluated,
       'newPassingCharacterGate': gated_new, 'maxMemory': args.max_memory,
       'maxD': args.max_d, 'maxS2': args.max_s2, 'maxV5': args.max_v5,
       'gateSlack': args.gate_slack, 'strategy': args.strategy,
       'proposalSteps': args.proposal_steps,
       'prior': [path.name for path in args.prior],
       'baseline': baseline, 'results': list(rows.values())}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
print(json.dumps({'evaluated': evaluated, 'passingGate': sum(gate_ratio(row) < 1 for row in rows.values()),
                  'passingAllEight': sum(gate_ratio(row) < 1 and word_ratio(row) < 1 for row in rows.values()),
                  'best': sorted((row for row in rows.values() if gate_ratio(row) < 1),
                                 key=lambda row: (word_ratio(row), row['S2ms']))[:5]},
                 ensure_ascii=False, indent=2))
