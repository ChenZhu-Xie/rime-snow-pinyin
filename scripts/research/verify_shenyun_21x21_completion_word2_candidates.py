#!/usr/bin/env python3
"""Independently replay selected new word-2 layouts with the frozen JS scorer."""
from __future__ import annotations

import base64
import gzip
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
IDS = ('BCW-728ebe1b8ae6', 'BCW-062294ac76a9', 'BCW-fcde88067f0c',
       'BCW-eb540e052854', 'BCW-d3f836f32da1', 'BCW-3245b61eed72')
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
os.chdir(REPLAY)
sys.path[:0] = [str(REPLAY), str(ROOT / 'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(REPLAY),
            '--output', str(ROOT / 'research-notes/data/shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
text = HTML.read_text(encoding='utf-8')
match = re.search(r'(<script id="payload"[^>]*>)([^<]+)(</script>)', text)
assert match
page = json.loads(gzip.decompress(base64.b64decode(match[2])))
by_id = {e['id']: e for e in page['entries']}
known = b.opt.state(by_id['R9-21X21-M40-02'], b.DATA)
assert b.opt.toentry(known, b.DATA, 'R9-21X21-M40-02')['codeList'] == by_id['R9-21X21-M40-02']['codeList']
results = {}
for name in ('shenyun-21x21-completion-word2-face-search-r1.json',
             'shenyun-21x21-completion-word2-face-search-r2.json'):
    for row in json.loads((ROOT / 'research-notes/data' / name).read_text(encoding='utf-8'))['results']:
        if row['id'] in IDS:
            results[row['id']] = row
assert set(results) == set(IDS), set(IDS) - set(results)
for ident in IDS:
    row = results[ident]
    entry = b.opt.toentry(__import__('numpy').array(row['state'], __import__('numpy').int32), b.DATA, ident)
    entry['capacity'] = [21, 21]
    entry['actual'] = [21, 21]
    page['entries'].append(entry)
blob = base64.b64encode(gzip.compress(json.dumps(page, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), mtime=0)).decode('ascii')
with tempfile.TemporaryDirectory(prefix='word2-js-replay-') as location:
    tmp = Path(location)
    html = tmp / 'replay.html'
    html.write_text(text[:match.start(2)] + blob + text[match.end(2):], encoding='utf-8', newline='')
    output = tmp / 'replayed.json'
    subprocess.run(['node', str(ROOT / 'scripts/research/score_shenyun_completion_ckt.js'),
                    '--html', str(html), '--output', str(output), '--ids', ','.join(IDS)],
                   check=True, cwd=ROOT)
    checks = json.loads(output.read_text(encoding='utf-8'))['schemes']
for ident in IDS:
    row = results[ident]
    metric = checks[ident]['modes']
    parts = [metric[mode][kind] for mode, kind in (('keytao', 'character'), ('sanpin', 'character'),
                                                  ('keytao', 'word'), ('sanpin', 'word'))]
    time_error = max(abs(row['times'][i] - parts[i]['completionUpperMs']) for i in range(4))
    miss_error = max(abs(row['p2'][i] - parts[i]['p2']) for i in range(4))
    assert time_error < 1e-8 and miss_error < 1e-12, (ident, time_error, miss_error)
    print(ident, 'max time error', time_error, 'max p2 error', miss_error)
