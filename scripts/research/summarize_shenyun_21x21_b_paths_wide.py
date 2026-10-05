#!/usr/bin/env python3
"""Select the reproducible M/D and speed frontiers from wide B-path traces."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--inputs', type=Path, nargs='+', required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
inputs = [x.resolve() for x in a.inputs]
reference = json.loads(inputs[0].read_text(encoding='utf8'))['baseline']
keys = ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
rows = {}
for path in inputs:
    data = json.loads(path.read_text(encoding='utf8'))
    assert all(abs(data['baseline'][k] - reference[k]) < 1e-15 for k in keys)
    for row in data['results']:
        rows[tuple(row['state'])] = row
passed = [row for row in rows.values() if all(row[k] < reference[k] for k in keys)]
assert passed
by_memory_displaced = {}
for memory, displaced in sorted({(row['M'], row['D']) for row in passed}):
    group = [row for row in passed if (row['M'], row['D']) == (memory, displaced)]
    fastest = min(group, key=lambda row: (row['S2ms'], row['v5']))
    best_word = min(group, key=lambda row: (max(row[k] / reference[k] for k in keys[4:]), row['S2ms']))
    by_memory_displaced[f'M{memory}D{displaced}'] = {
        'count': len(group), 'fastest': fastest['id'], 'bestWord': best_word['id']}

def word_ratio(row):
    return max(row[k] / reference[k] for k in keys[4:])

selected = {}
for label, row in (
    ('fastest', min(passed, key=lambda r: (r['S2ms'], r['v5']))),
    ('lowestV5', min(passed, key=lambda r: (r['v5'], r['S2ms']))),
    ('bestWord', min(passed, key=lambda r: (word_ratio(r), r['S2ms']))),
    ('lowestM', min(passed, key=lambda r: (r['M'], r['D'], r['S2ms']))),
    ('M42D2Fast', min((r for r in passed if (r['M'], r['D']) == (42, 2)), key=lambda r:r['S2ms'])),
    ('M43D3Fast', min((r for r in passed if (r['M'], r['D']) == (43, 3)), key=lambda r:r['S2ms'])),
    ('M44D4Fast', min((r for r in passed if (r['M'], r['D']) == (44, 4)), key=lambda r:r['S2ms'])),
    ('M45D5Fast', min((r for r in passed if (r['M'], r['D']) == (45, 5)), key=lambda r:r['S2ms'])),
    ('M46D5Fast', min((r for r in passed if (r['M'], r['D']) == (46, 5)), key=lambda r:r['S2ms'])),
    ('M46D5LowestV5', min((r for r in passed if (r['M'], r['D']) == (46, 5)), key=lambda r:r['v5'])),
    ('M47D6Fast', min((r for r in passed if (r['M'], r['D']) == (47, 6)), key=lambda r:r['S2ms'])),
    ('M47D6LowestV5', min((r for r in passed if (r['M'], r['D']) == (47, 6)), key=lambda r:r['v5'])),
    ('M48D7Fast', min((r for r in passed if (r['M'], r['D']) == (48, 7)), key=lambda r:r['S2ms'])),
    ('lowestMDdouble', min((r for r in passed if r['S2ms'] < 70.1890673523 and r['v5'] < 10.3977595859),
                            key=lambda r:(r['M'], r['D'], r['v5'], r['S2ms']))),
    ('M46D5Balanced', min((r for r in passed if (r['M'], r['D']) == (46, 5)),
                          key=lambda r:max(r['S2ms']/70.1890673523,r['v5']/10.3977595859,r['v4']/10.7422163477))),
):
    selected[label] = row['id']
selected_rows = {row['id']: row for row in passed if row['id'] in set(selected.values())}
assert set(selected_rows) == set(selected.values()), selected
for row in selected_rows.values():
    row['minimumGateMarginPoints'] = min((reference[key] - row[key])*100 for key in keys)
    row['worstRatio'] = max(row[key] / reference[key] for key in keys)
output = {
    'purpose': 'fully reproducible strict eight-path winner frontier from frozen R11 traces',
    'inputs': [path.name for path in inputs], 'totalUniqueStates': len(rows),
    'passesAllEight': len(passed),
    'passesByMD': {key: by_memory_displaced[key] for key in by_memory_displaced},
    'reference': reference, 'selection': selected, 'results': list(selected_rows.values()),
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'unique':len(rows),'passesAllEight':len(passed),
                  'selection':selected, 'byMD': by_memory_displaced}, ensure_ascii=False, indent=2))
