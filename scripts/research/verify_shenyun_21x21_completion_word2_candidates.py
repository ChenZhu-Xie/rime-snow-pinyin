#!/usr/bin/env python3
"""Independently replay fixed-IVUAO 21x21 first-character-first layouts with frozen JS."""
from __future__ import annotations

import argparse
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
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--files', type=Path, nargs='+', default=[ROOT / 'research-notes/data/shenyun-21x21-completion-fixed-face-search-r2.json', ROOT / 'research-notes/data/shenyun-21x21-completion-fixed-local-polish.json'])
parser.add_argument('--ids', nargs='+', default=['BCW-553dbe07fc7c', 'BCW-2a915aa92474', 'BCL-0b818d71385f', 'BCL-cff9677af1ba'])
args = parser.parse_args()
args.files = [path.resolve() for path in args.files]
IDS = tuple(args.ids)
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
for path in args.files:
    for row in json.loads(path.read_text(encoding='utf-8'))['results']:
        if row['id'] in IDS:
            results[row['id']] = row
assert set(results) == set(IDS), set(IDS) - set(results)
for ident in IDS:
    row = results[ident]
    entry = b.opt.toentry(__import__('numpy').array(row['state'], __import__('numpy').int32), b.DATA, ident)
    entry['capacity'] = [21, 21]
    entry['actual'] = [21, 21]
    if ident in by_id:
        assert by_id[ident]['codeList'] == entry['codeList']
    else:
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
    path_error = max(abs(row[key] - parts[i][stage])
                     for i, keys in enumerate((('j1','j2'), ('s1','s2'), ('wj1','wj2'), ('ws1','ws2')))
                     for key, stage in zip(keys, ('p1','p2')))
    assert time_error < 1e-8 and miss_error < 1e-12 and path_error < 1e-12, (ident, time_error, miss_error, path_error)
    print(ident, 'max time error', time_error, 'max p2 error', miss_error, 'max eight-path error', path_error)
