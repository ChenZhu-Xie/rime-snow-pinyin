#!/usr/bin/env python3
"""Report adaptive B-path key counts until two B keys (selection cost excluded)."""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, required=True)
p.add_argument('--benchmark', type=Path, default=HERE / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')
p.add_argument('--search', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
a.replay, a.benchmark, a.search, a.output = (x.resolve() for x in (a.replay, a.benchmark, a.search, a.output))
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(a.replay), '--output', str(a.benchmark)]
spec = importlib.util.spec_from_file_location('b_sets', HERE / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)

import numpy as np

benchmark = json.loads(a.benchmark.read_text(encoding='utf8'))
search = json.loads(a.search.read_text(encoding='utf8'))
base = benchmark['reference']['S005']
names = ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
rows = list({tuple(r['state']): r for r in search['results']}.values())
passing = [r for r in rows if all(r[k] < base[k] for k in names[:4]) and r['S2ms'] <= 74 and r['v5'] <= 11]
m40 = [r for r in passing if r['M'] <= 40]
m41 = [r for r in passing if r['M'] == 41]
representatives = {
    'fastM40AfterGate': min(m40, key=lambda r: (r['S2ms'], r['v5'])) if m40 else None,
    'bestWordM40AfterGate': min(m40, key=lambda r: (max(r[k] / base[k] for k in names[4:]), r['S2ms'])) if m40 else None,
    'bestWordM41AfterGate': min(m41, key=lambda r: (max(r[k] / base[k] for k in names[4:]), r['S2ms'])) if m41 else None,
    'bestWordAfterGate': min(passing, key=lambda r: (max(r[k] / base[k] for k in names[4:]), r['S2ms'])) if passing else None,
    'bestCharacterGate': min(rows, key=lambda r: (max(r[k] / base[k] for k in names[:4]), r['S2ms'])),
    'bestWordObjective': min(rows, key=lambda r: (max(r[k] / base[k] for k in names[4:]), r['S2ms'])),
    'bestAllEight': min(rows, key=lambda r: (max(r[k] / base[k] for k in names), r['S2ms'])),
}
entries = {entry['id']: entry for entry in b.DATA['entries']}


def bare_losses(codes):
    chars = {}
    ctotal = 0
    for char, py, tone, weight, common in b.COMMON:
        if weight > 0 and codes[py]:
            key = codes[py]
            chars[key] = max(chars.get(key, 0), weight)
            ctotal += weight
    words = {}
    wtotal = 0
    for word, p1, p2, t1, t2, weight, lex, common in b.WORDS:
        if weight > 0 and codes[p1] and codes[p2]:
            key = codes[p1] + codes[p2]
            words[key] = max(words.get(key, 0), weight)
            wtotal += weight
    return (ctotal - sum(chars.values())) / ctotal, (wtotal - sum(words.values())) / wtotal


def record(name, row, codes):
    c0, w0 = bare_losses(codes)
    return {'name': name, 'id': row['id'], 'characterBareMiss': c0, 'wordBareMiss': w0,
            'keytaoCharacterKeys': 2 + c0 + row['j1'],
            'sanpinCharacterKeys': 2 + c0 + row['s1'],
            'keytaoWordKeys': 4 + w0 + row['wj1'],
            'sanpinWordKeys': 4 + w0 + row['ws1'],
            'unresolvedAfterTwoB': {k: row[k] for k in ('j2', 's2', 'wj2', 'ws2')},
            'S2ms': row.get('S2ms'), 'v5': row.get('v5'), 'M': row.get('M'), 'D': row.get('D')}

out = {}
for alias, id_ in (('S005', 'S005'), ('R9', 'R9-21X21-M40-02')):
    row = benchmark['reference'][alias]
    x = record(alias, row, entries[id_]['codeList'])
    for key, track in (('characterBareMiss', 'C2'), ('wordBareMiss', 'W4-Snow')):
        assert abs(x[key] - b.DATA['ckt']['tracks'][id_][track]['miss']) < 1e-12, (alias, key, x[key])
    out[alias] = x
for alias, row in representatives.items():
    if row is None:
        continue
    out[alias] = record(alias, row, b.state_codes(np.array(row['state'], dtype=np.int32)))
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps({'definition': 'fixed phonetic base length + base weighted miss + first B weighted miss; stops after two B keys, excludes unresolved selection and commits', 'representatives': out}, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(out, ensure_ascii=False, indent=2))