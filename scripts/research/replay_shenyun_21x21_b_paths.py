#!/usr/bin/env python3
"""Replay selected 21x21 states through R11's original 20-contract Node engine."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--search', type=Path, required=True)
p.add_argument('--ids', nargs='+', required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
a.replay, a.search, a.output = (x.resolve() for x in (a.replay, a.search, a.output))
source = a.replay / 'entries_to_score.json'
original = source.read_bytes()
search = json.loads(a.search.read_text(encoding='utf8'))
by_id = {r['id']: r for r in search['results']}
missing = set(a.ids) - set(by_id)
if missing:
    p.error('missing ids: ' + ','.join(sorted(missing)))

sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(a.replay),
            '--output', str(HERE / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)

import numpy as np

entries = json.loads(original)
first = len(entries)
for ident in a.ids:
    row = by_id[ident]
    entry = b.opt.toentry(np.array(row['state'], dtype=np.int32), b.DATA, ident)
    entry['id'] = ident
    entries.append(entry)
try:
    source.write_text(json.dumps(entries, ensure_ascii=False), encoding='utf8')
    env = {**os.environ, 'PYTHONUTF8': '1'}
    subprocess.run(['node', 'eval_full.js', str(first), str(len(entries))], cwd=a.replay, env=env, check=True)
finally:
    source.write_bytes(original)
results = {}
for ident in a.ids:
    path = a.replay / 'exact' / (ident + '.json')
    exact = json.loads(path.read_text(encoding='utf8'))
    if exact['entry']['codeList'] != entries[first + a.ids.index(ident)]['codeList']:
        raise RuntimeError('stale R11 exact file for ' + ident)
    row = by_id[ident]
    results[ident] = {'search': {k: row[k] for k in ('M', 'D', 'unique399', 'j1', 'j2', 's1', 's2',
                                                    'wj1', 'wj2', 'ws1', 'ws2', 'S2ms', 'v5', 'v4')},
                      'exact': {'verification': exact['verification'],
                                'S2upperMs': exact['tracks']['S2']['upperMs'],
                                'S2miss': exact['tracks']['S2']['miss'],
                                'charShapeMiss': exact['tracks']['C4-Snow']['miss'],
                                'wordShapeMiss': exact['tracks']['WX-Snow-21']['miss'],
                                'sanpinWordTwoBMiss': exact['tracks']['W6-21']['miss'],
                                'v5': exact['scores']['ensembleV5']['score'],
                                'v4': exact['scores']['ensembleV4']['score'],
                                'S2completionUpperMs': exact['fair']['S2Completion']['upperMs']}}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps({'source': 'R11 original eval_full.js, frozen 20 contracts', 'results': results}, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(results, ensure_ascii=False, indent=2))