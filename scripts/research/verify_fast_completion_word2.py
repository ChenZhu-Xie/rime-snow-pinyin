"""Compare the Numba B completion scorer with frozen JS results."""
from __future__ import annotations

import base64
import gzip
import importlib.util
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
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
from fast_completion_word2 import FastCompletion

text = HTML.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
assert match
data = json.loads(gzip.decompress(base64.b64decode(match[1])))
by_id = {e['id']: e for e in data['entries']}
scores = json.loads((ROOT / 'research-notes/data/shenyun-completion-ckt-r11.json').read_text(encoding='utf-8'))['schemes']
fast = FastCompletion(b, HTML)
ids = ['R9-21X21-M40-02', 'EXPERIMENT-21X21-110d170fca',
       'EXPERIMENT-21X21-e11ce783d7', 'LOWM-21X21-f8b4a909fa',
       'BPW-c1924db8d054', 'BPK-e12a551b29f1', 'BPC-d9492d2a5588']
for ident in ids:
    state = b.opt.state(by_id[ident], b.DATA)
    times, misses = fast.score(state)
    expected = [scores[ident]['modes'][mode][kind]
                for mode, kind in [('keytao', 'character'), ('sanpin', 'character'),
                                   ('keytao', 'word'), ('sanpin', 'word')]]
    delta_ms = max(abs(float(value) - row['completionUpperMs']) for value, row in zip(times, expected))
    delta_p2 = max(abs(float(value) - row['p2']) for value, row in zip(misses, expected))
    print(ident, 'max_ms', delta_ms, 'max_p2', delta_p2, flush=True)
    assert delta_ms < 1e-8 and delta_p2 < 1e-12
start = time.perf_counter()
for _ in range(100):
    fast.score(state)
print('100 repeated evaluations in seconds', time.perf_counter() - start)
