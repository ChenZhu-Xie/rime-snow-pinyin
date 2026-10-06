#!/usr/bin/env python3
"""Recompute selected B-path basin layouts with the independent benchmark."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--search', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--ids', nargs='*', default=[])
args = parser.parse_args()
args.replay, args.search, args.output = (p.resolve() for p in (args.replay, args.search, args.output))
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay),
            '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
import numpy as np
sys.path.insert(0, str(ROOT / 'scripts/research'))
from b_path_fast import NAMES

source = json.loads(args.search.read_text(encoding='utf8'))
baseline = source.get('baseline') or json.loads(
    (DATA / 'shenyun-21x21-b-sets-benchmark.json').read_text(encoding='utf8'))['reference']['S005']
passing = [r for r in source['results'] if r['M'] <= source['maxMemory']
           and r['D'] <= 1 and r['Pmax'] <= source['pCap'] + 1e-12
           and r['homeS2'] >= source.get('homeMin', .5) - 1e-12
           and all(r[k] < baseline[k] for k in NAMES)]
assert passing
for row in passing:
    state = np.array(row['state'], dtype=np.int32)
    factors = b.opt.metrics(b.opt.initialize(state, b.opt.PARAMS)[1], b.opt.PARAMS)
    row.update({'S2ms': float(factors[0]), 'v5': float(factors[1]), 'v4': float(factors[2])})


def worst(row):
    return max(row[k] / baseline[k] for k in NAMES)


if args.ids:
    rows_by_id = {r['id']: r for r in passing}
    assert set(args.ids) <= set(rows_by_id), set(args.ids) - set(rows_by_id)
    selectors = {id: rows_by_id[id] for id in args.ids}
else:
    selectors = {
        'eightMargin': min(passing, key=lambda r: (worst(r), r['M'], r['S2ms'])),
        'minP': min(passing, key=lambda r: (r['Pmax'], worst(r), r['S2ms'])),
        'maxHome': max(passing, key=lambda r: (r['homeS2'], -worst(r), -r['S2ms'])),
        'fastS2': min(passing, key=lambda r: (r['S2ms'], worst(r))),
        'bestV5': min(passing, key=lambda r: (r['v5'], worst(r))),
    }
    m43 = [r for r in passing if r['M'] == 43]
    if m43:
        selectors['bestM43'] = min(m43, key=lambda r: (worst(r), r['S2ms']))
selected = list({r['id']: r for r in selectors.values()}.values())
checks = {}
for row in selected:
    codes = b.state_codes(np.array(row['state'], dtype=np.int32))
    independent = {**b.losses(codes), **b.word_losses(codes)}
    for name in NAMES:
        assert abs(independent[name] - row[name]) < 1e-12, (row['id'], name, independent[name], row[name])
    checks[row['id']] = independent

output = {'source': 'Independent dictionary bucket recount plus frozen R11 opt model',
          'search': str(args.search.relative_to(ROOT)),
          'passingSaved': len(passing),
          'selectors': {label: row['id'] for label, row in selectors.items()},
          'independentEight': checks,
          'results': selected}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'passingSaved': len(passing), 'selectors': output['selectors'],
                  'selected': [{k: r[k] for k in ('id', 'M', 'D', 'Pmax', 'homeS2', 'S2ms', 'v5')}
                               | {'worstRatio': worst(r)} for r in selected]}, ensure_ascii=False, indent=2))
