#!/usr/bin/env python3
"""Cross-check fast B-path buckets against the independent reference implementation."""
from __future__ import annotations

import argparse
import importlib.util
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--search', type=Path, required=True)
p.add_argument('--samples', type=int, default=100)
p.add_argument('--seed', type=int, default=20261006)
a = p.parse_args()
a.search = a.search.resolve()
a.replay = a.replay.resolve()
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(a.replay),
            '--output', str(HERE / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
assert spec and spec.loader
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
sys.path.insert(0, str(HERE / 'scripts/research'))
from b_path_fast import FastBuckets, NAMES

import numpy as np

records = json.loads(a.search.read_text(encoding='utf-8'))
rows = records['results']
by_id = {row['id']: row for row in rows}
selected = [by_id[ident] for ident in set(records.get('selection', {}).values())]
rng = random.Random(a.seed)
others = rng.sample(rows, min(a.samples, len(rows)))
fast = FastBuckets(b)
worst = 0.0
for row in {tuple(r['state']): r for r in selected + others}.values():
    codes = b.state_codes(np.asarray(row['state'], dtype=np.int32))
    direct = {**b.losses(codes), **b.word_losses(codes)}
    accelerated = fast.score(codes)
    for key in NAMES:
        error = max(abs(direct[key] - accelerated[key]),
                    abs(row[key] - accelerated[key]))
        worst = max(worst, error)
        assert error < 1e-12, (row['id'], key, direct[key], accelerated[key], row[key])
print(json.dumps({'validatedStates': len({tuple(r['state']) for r in selected + others}),
                  'worstAbsoluteDifference': worst}, indent=2))
