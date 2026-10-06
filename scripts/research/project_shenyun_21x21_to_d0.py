#!/usr/bin/env python3
"""Project high-M/D eight-path winners onto fixed-initial D=0 layouts."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--prior', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--parents', type=int, default=400)
p.add_argument('--repetitions', type=int, default=8)
p.add_argument('--max-memory', type=int, default=46)
p.add_argument('--seed', type=int, default=20261026)
a = p.parse_args()
a.replay, a.prior, a.output = (path.resolve() for path in (a.replay, a.prior, a.output))
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(a.replay),
            '--output', str(ROOT / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
assert spec and spec.loader
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
sys.path.insert(0, str(ROOT / 'scripts/research'))
from b_path_fast import FastBuckets, NAMES

import numpy as np

payload = json.loads(a.prior.read_text(encoding='utf-8'))
base = payload['baseline']
rng = random.Random(a.seed)
fast = FastBuckets(b)
fixed = set(map(int, b.se.ORD))
aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], np.int32)
eligible = [row for row in payload['results'] if row['M'] >= 44 and row['D'] >= 2
            and all(row[key] < base[key] for key in NAMES)]
eligible.sort(key=lambda row: (max(row[key] / base[key] for key in NAMES),
                               row['M'], row['D'], row['S2ms']))
# Mix strong collision parents with fast ones; deduplicate by state.
fastest = sorted(eligible, key=lambda row: (row['S2ms'], row['v5']))[:a.parents // 2]
selected = list({tuple(row['state']): row for row in
                 eligible[:a.parents] + fastest}.values())
seen = set()
results = []
attempts = valid = 0
for parent in selected:
    source = np.asarray(parent['state'], np.int32)
    displaced = [j for j in fixed if source[j] != b.opt.PREF[j]]
    assert len(displaced) == parent['D']
    for _ in range(a.repetitions):
        state = source.copy()
        order = displaced.copy()
        rng.shuffle(order)
        for j in order:
            if state[j] == b.opt.PREF[j]:
                continue
            target = b.opt.PREF[j]
            slots = [k for k in range(27) if k not in fixed and state[k] == target]
            if slots:
                k = rng.choice(slots)
                state[j], state[k] = state[k], state[j]
            else:
                state[j] = target
        attempts += 1
        signature = tuple(map(int, state))
        if signature in seen:
            continue
        seen.add(signature)
        assert np.array_equal(state[62:], aux)
        unique, memory, disp = b.se.stats(state, b.opt.PARAMS[-2], b.opt.PARAMS[-1],
                                          21, 0, 1)
        if unique < 0 or memory > a.max_memory or disp != 0:
            continue
        valid += 1
        scores = fast.score(b.state_codes(state))
        factors = b.opt.metrics(b.opt.initialize(state, b.opt.PARAMS)[1], b.opt.PARAMS)
        row = {'id': 'BPP-' + hashlib.sha256(state.tobytes()).hexdigest()[:12],
               'parent': parent['id'], 'parentM': parent['M'], 'parentD': parent['D'],
               'state': list(signature), 'M': int(memory), 'D': 0,
               'unique399': int(unique), **scores,
               'S2ms': float(factors[0]), 'v5': float(factors[1]),
               'v4': float(factors[2])}
        row['passesAllFour'] = all(row[key] < base[key] for key in NAMES[:4])
        row['passesAllEight'] = all(row[key] < base[key] for key in NAMES)
        results.append(row)

output = {'purpose': 'high-M/D to D0 fixed-initial projection under AVUIO lock',
          'prior': a.prior.name, 'seed': a.seed, 'requestedParents': a.parents,
          'selectedParents': len(selected), 'repetitions': a.repetitions,
          'attempts': attempts, 'valid': valid, 'maxMemory': a.max_memory,
          'baseline': base, 'results': results}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
ranked = sorted(results, key=lambda row: (max(row[key] / base[key] for key in NAMES),
                                         row['M'], row['S2ms']))
print(json.dumps({'selectedParents': len(selected), 'attempts': attempts,
                  'valid': valid, 'passingEight': sum(row['passesAllEight'] for row in results),
                  'best': [{key: row[key] for key in ('id', 'parent', 'M', 'D', 'S2ms', 'v5')}
                           | {'maxEightRatio': max(row[key] / base[key] for key in NAMES)}
                           for row in ranked[:10]]}, ensure_ascii=False, indent=2))
