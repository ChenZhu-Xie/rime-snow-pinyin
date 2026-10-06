#!/usr/bin/env python3
"""Repair a single displaced initial by replacement or a flexible-slot swap.

This checks the 21 occupied initial keys and the locked AVUIO mapping. It
enumerates direct replacement and one-swap repairs from recorded D=1 states, then evaluates
the resulting D=0 states on the same frozen B-path and R11 performance models.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--prior', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--max-parent-memory', type=int, default=43)
p.add_argument('--max-memory', type=int, default=43)
p.add_argument('--max-s2', type=float, default=76.0)
p.add_argument('--max-v5', type=float, default=11.2)
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
fast = FastBuckets(b)
ordinal = set(map(int, b.se.ORD))
physical_aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], np.int32)
seen: set[tuple[int, ...]] = set()
rows = []
parents = repairs = valid = 0
for parent in payload['results']:
    if parent['D'] != 1 or parent['M'] > a.max_parent_memory:
        continue
    parents += 1
    state = np.asarray(parent['state'], dtype=np.int32)
    displaced = [j for j in ordinal if state[j] != b.opt.PREF[j]]
    assert len(displaced) == 1
    j = displaced[0]
    target = b.opt.PREF[j]
    for k in [-1, *range(27)]:
        if k >= 0 and (k == j or k in ordinal or state[k] != target):
            continue
        repairs += 1
        candidate = state.copy()
        if k < 0:
            candidate[j] = target
        else:
            candidate[j], candidate[k] = candidate[k], candidate[j]
        signature = tuple(map(int, candidate))
        if signature in seen:
            continue
        seen.add(signature)
        assert np.array_equal(candidate[62:], physical_aux)
        unique, memory, disp = b.se.stats(candidate, b.opt.PARAMS[-2],
                                          b.opt.PARAMS[-1], 21, 0, 1)
        if unique < 0 or memory > a.max_memory or disp != 0:
            continue
        valid += 1
        measures = fast.score(b.state_codes(candidate))
        factors = b.opt.metrics(b.opt.initialize(candidate, b.opt.PARAMS)[1], b.opt.PARAMS)
        if factors[0] > a.max_s2 or factors[1] > a.max_v5:
            continue
        row = {'id': 'BPR-' + hashlib.sha256(candidate.tobytes()).hexdigest()[:12],
               'parent': parent['id'], 'parentM': parent['M'], 'parentD': 1,
               'repairedPositions': [j] if k < 0 else [j, k], 'state': list(signature),
               'M': int(memory), 'D': int(disp), 'unique399': int(unique),
               **measures, 'S2ms': float(factors[0]), 'v5': float(factors[1]),
               'v4': float(factors[2])}
        row['passesAllFour'] = all(row[key] < base[key] for key in NAMES[:4])
        row['passesAllEight'] = all(row[key] < base[key] for key in NAMES)
        rows.append(row)

output = {'purpose': 'one-swap D=1 to D=0 repair under AVUIO lock',
          'prior': a.prior.name, 'maxParentMemory': a.max_parent_memory,
          'maxMemory': a.max_memory, 'maxS2': a.max_s2, 'maxV5': a.max_v5,
          'parents': parents, 'repairAttempts': repairs, 'validRepairs': valid,
          'kept': len(rows), 'baseline': base, 'results': rows}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
ranked = sorted(rows, key=lambda row: (max(row[key] / base[key] for key in NAMES),
                                       row['S2ms']))
print(json.dumps({'parents': parents, 'repairs': repairs, 'valid': valid,
                  'kept': len(rows), 'passingEight': sum(row['passesAllEight'] for row in rows),
                  'best': [{key: row[key] for key in ('id', 'parent', 'M', 'D', 'S2ms', 'v5')}
                           | {'maxEightRatio': max(row[key] / base[key] for key in NAMES)}
                           for row in ranked[:10]]}, ensure_ascii=False, indent=2))
