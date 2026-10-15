#!/usr/bin/env python3
"""Verify that filtering FIXED_ONE_KEY from ckt_fast.char_rows makes ckt_fast.score(st)
match score_candidates_v3.js to 0.000000ms across all 4 tracks (char_kt, char_sp, word2_kt, word2_sp)."""
from __future__ import annotations
import os
import sys
import json
import gzip
import base64
import re
import importlib.util
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
REPLAY = Path(os.environ.get("RIME_RESEARCH_REPLAY_DIR", Path(__file__).resolve().parents[2] / ".research-cache" / "R11_integrated_replay"))
HTML_PATH = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
DATA = ROOT / 'research-notes/data'

os.chdir(REPLAY)
sys.path[:0] = [str(REPLAY), str(ROOT / 'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(REPLAY), '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]

spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

from fast_completion_word2 import FastCompletion
ckt_fast = FastCompletion(b, HTML_PATH, first_word=True, v2=True)

# Filter out FIXED_ONE_KEY from ckt_fast.char_rows!
FIXED_ONE_KEY = set("的一是在了不有和人中大为上个国我以要他时来用生到作")
keep_mask = [r[0] not in FIXED_ONE_KEY for r in sorted((r for r in b.COMMON if r[3] > 0), key=lambda r: (-r[3], r[0]))]
keep_mask = np.array(keep_mask, dtype=bool)
print(f"Original char_rows: {len(ckt_fast.char_rows)}, after removing 25 one-key chars: {np.sum(keep_mask)}")
ckt_fast.char_rows = np.ascontiguousarray(ckt_fast.char_rows[keep_mask])

s4 = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))

text = HTML_PATH.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
hdata = json.loads(gzip.decompress(base64.b64decode(match.group(1))))
s005_v3 = hdata['completionBV3']['schemes']['S005']['modes']

def mode_cost(m, base_len, tau=600):
    f = 1.0 - (m['stageWeight'][0] if m.get('stageWeight') else 1.0)
    f2 = max(0.0, m['meanKeys'] - base_len - f)
    return m['completionUpperMs'] + tau * m['p2'] + 300.0 * f + 300.0 * f2

base_c = np.array([
    mode_cost(s005_v3['keytao']['character'], 2),
    mode_cost(s005_v3['sanpin']['character'], 2),
    mode_cost(s005_v3['keytao']['word2'], 4),
    mode_cost(s005_v3['sanpin']['word2'], 4),
], dtype=np.float64)

weights_4 = np.array([1.0, 1.0, 3.0, 3.0], dtype=np.float64)

def fast_v3_4track(st):
    times, misses, first_c, second_c = ckt_fast.score(st)
    costs = times + 600.0 * misses + 300.0 * first_c + 300.0 * second_c
    ratios4 = (costs / base_c) ** 4
    return float(10.0 * (np.sum(weights_4 * ratios4) / 8.0) ** 0.25), costs, ratios4

for x in sorted(s4, key=lambda r: r['ckt_v3'])[:10]:
    st = np.array(x['state'], dtype=np.int32)
    f4, costs, ratios4 = fast_v3_4track(st)
    m = x['modes']
    js_costs = [
        mode_cost(m['keytao']['character'], 2),
        mode_cost(m['sanpin']['character'], 2),
        mode_cost(m['keytao']['word2'], 4),
        mode_cost(m['sanpin']['word2'], 4),
    ]
    errs = [abs(costs[i] - js_costs[i]) for i in range(4)]
    w34_sum4 = (
        (mode_cost(m['keytao']['word3'], 3) / mode_cost(s005_v3['keytao']['word3'], 3)) ** 4 +
        (mode_cost(m['sanpin']['word3'], 3) / mode_cost(s005_v3['sanpin']['word3'], 3)) ** 4 +
        (mode_cost(m['keytao']['word4'], 4) / mode_cost(s005_v3['keytao']['word4'], 4)) ** 4 +
        (mode_cost(m['sanpin']['word4'], 4) / mode_cost(s005_v3['sanpin']['word4'], 4)) ** 4
    )
    exact_reconstructed = 10.0 * ((np.sum(weights_4 * ratios4) + w34_sum4) / 12.0) ** 0.25
    print(f"{x['id']}: exact_v3={x['ckt_v3']:.6f} | recon_v3={exact_reconstructed:.6f} | f4={f4:.6f} | track_errs={[round(e, 6) for e in errs]}")
