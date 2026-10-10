#!/usr/bin/env python3
"""Build the comprehensive seed database for 21x26 IEUAO (AEUIO fixed auxiliary order)
no-flying-key, 399-unique schemes, with CKT v3 and full multi-dimensional metrics.
"""
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
REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
HTML_PATH = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
DATA = ROOT / 'research-notes/data'

os.chdir(REPLAY)
sys.path[:0] = [str(REPLAY), str(ROOT / 'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(REPLAY), '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]

spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

from b_path_fast import FastBuckets, NAMES

# For 21x26 (non-21x21), word2 uses B2B1 (second char shape first -> first_word=False)
bfast_native = FastBuckets(b, first_word=False)
bfast_b1b2 = FastBuckets(b, first_word=True)

aux_ieuao = np.array([b.opt.META['keys'].index(k) for k in 'IEUAO'], dtype=np.int32)

text = HTML_PATH.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
page = json.loads(gzip.decompress(base64.b64decode(match.group(1))))

frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}
s005_entry = next(e for e in page['entries'] if e['id'] == 'S005')
b_baseline_b2b1 = s005_entry['bPathMetrics']

v3_data = page.get('completionBV3', {}).get('schemes', {})
v2_data = page.get('completionBV2', {}).get('schemes', {})
s005_v3 = v3_data.get('S005', {}).get('modes', {})
s005_v2 = v2_data.get('S005', {}).get('modes', {})

TRACKS_V3 = [
    ('keytao', 'character', 1, 2),
    ('keytao', 'word2', 3, 4),
    ('keytao', 'word3', 1, 3),
    ('keytao', 'word4', 1, 4),
    ('sanpin', 'character', 1, 2),
    ('sanpin', 'word2', 3, 4),
    ('sanpin', 'word3', 1, 3),
    ('sanpin', 'word4', 1, 4),
]

TRACKS_V2 = [
    ('keytao', 'character', 1, 2),
    ('keytao', 'word', 2, 4),
    ('sanpin', 'character', 1, 2),
    ('sanpin', 'word', 2, 4),
]

def score_v3(m, tau=600, first_aux=300, second_aux=300, ref=s005_v3):
    if not m or not ref:
        return None
    s = 0.0
    tot = 0.0
    for mode, kind, w, base in TRACKS_V3:
        r = m.get(mode, {}).get(kind)
        br = ref.get(mode, {}).get(kind)
        if not r or not br:
            return None
        f = 1.0 - (r.get('stageWeight', [1])[0] if r.get('stageWeight') else 1.0)
        bf = 1.0 - (br.get('stageWeight', [1])[0] if br.get('stageWeight') else 1.0)
        f2 = max(0.0, r['meanKeys'] - base - f)
        bf2 = max(0.0, br['meanKeys'] - base - bf)
        a = r['completionUpperMs'] + tau * r['p2'] + first_aux * f + second_aux * f2
        c = br['completionUpperMs'] + tau * br['p2'] + first_aux * bf + second_aux * bf2
        if not (a > 0 and c > 0):
            return None
        s += w * ((a / c) ** 4)
        tot += w
    return float(10.0 * ((s / tot) ** 0.25))

def score_v2(m, tau=600, first_aux=300, second_aux=300, ref=s005_v2):
    if not m or not ref:
        return None
    s = 0.0
    tot = 0.0
    for mode, kind, w, base in TRACKS_V2:
        r = m.get(mode, {}).get(kind)
        br = ref.get(mode, {}).get(kind)
        if not r or not br:
            return None
        f = 1.0 - (r.get('stageWeight', [1])[0] if r.get('stageWeight') else 1.0)
        bf = 1.0 - (br.get('stageWeight', [1])[0] if br.get('stageWeight') else 1.0)
        f2 = max(0.0, r['meanKeys'] - base - f)
        bf2 = max(0.0, br['meanKeys'] - base - bf)
        a = r['completionUpperMs'] + tau * r['p2'] + first_aux * f + second_aux * f2
        c = br['completionUpperMs'] + tau * br['p2'] + first_aux * bf + second_aux * bf2
        if not (a > 0 and c > 0):
            return None
        s += w * ((a / c) ** 4)
        tot += w
    return float(10.0 * ((s / tot) ** 0.25))

records = []
for entry in page['entries']:
    if entry.get('capacity') != [21, 26] or entry.get('tone') != 'IEUAO':
        continue
    ident = entry['id']
    try:
        st = b.opt.state(entry, b.DATA)
    except Exception:
        continue
    # Check 399 unique and pure-y (mode=1: st[25]==st[26], 26 finals, maxdisp=27)
    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 26, 27, 1)
    if unique != 399:
        continue

    vowel_d = int(b.r5.vowelD(st))
    p_load = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    _, vals = b.opt.initialize(st, b.opt.PARAMS)
    factors = b.opt.metrics(vals, b.opt.PARAMS)
    v6_raw = float(10.0 * b.r5.prev.cw26(vals)) if hasattr(b.r5, 'prev') else None

    e6_formal = float(page['ensembleV6']['values'][ident]['score'])
    c4_snow = float(page['ensembleV6']['values'][ident]['outputMetrics']['C4-Snow']['choice150MsPerChar'])
    wx_snow = float(page['ensembleV6']['values'][ident]['outputMetrics']['WX-Snow-12']['choice150MsPerChar'])
    load_sum = page['r11LoadSummaries'][ident]
    daily_mx = float(page['macroxue']['values'][ident]['daily|hanzi-only']['score'])
    coll = entry.get('fourCodeCollision', {})
    top10k = coll.get('cuts', {}).get('10000', {})

    bm_native = bfast_native.score(entry['codeList'])
    bm_b1b2 = bfast_b1b2.score(entry['codeList'])
    worst_8b_vs_s005_b2b1 = max(bm_native[key] / b_baseline_b2b1[key] for key in NAMES)
    worst_8b_vs_s005_native = max(bm_native[key] / b_baseline[key] for key in NAMES)
    worst_8b_b1b2 = max(bm_b1b2[key] / b_baseline[key] for key in NAMES)

    m_v3 = v3_data.get(ident, {}).get('modes', {})
    m_v2 = v2_data.get(ident, {}).get('modes', {})
    v3_score = score_v3(m_v3, 600, 300, 300)
    v3_raw = score_v3(m_v3, 0, 0, 0)
    v3_tau150 = score_v3(m_v3, 150, 0, 0)
    v2_score = score_v2(m_v2, 600, 300, 300)

    rec = {
        'id': ident,
        'name': entry.get('name', ident),
        'subfamily': entry.get('subfamily', ''),
        'state': [int(x) for x in st],
        'M': int(memory),
        'D': int(displaced),
        'V': vowel_d,
        'unique399': int(unique),
        'ckt_v3': v3_score,
        'ckt_v3_raw': v3_raw,
        'ckt_v3_tau150': v3_tau150,
        'ckt_v2': v2_score,
        'homeS2': home,
        'homeFloor': float(load_sum['homeFloor']),
        'Pmax': p_load,
        'rightPinkyMax20': float(load_sum['rightPinkyMax20']),
        'maxFinger20': float(load_sum['maxFinger20']),
        'farMax': float(load_sum['farMax']),
        'S2ms': float(factors[0]),
        'v5': float(factors[1]),
        'v4': float(factors[2]),
        'E6': e6_formal,
        'C4_Snow': c4_snow,
        'WX_Snow': wx_snow,
        'dailyMX': daily_mx,
        'crossAffected5Cut': coll.get('fiveCutAverageCrossAffectedRate'),
        'crossLoss5Cut': coll.get('fiveCutAverageCrossFirstChoiceLossRate'),
        'crossAffected10k': top10k.get('crossAffectedRate'),
        'crossLoss10k': top10k.get('crossFirstChoiceLossRate'),
        'crossBuckets10k': top10k.get('crossBuckets'),
        'eightWorstRatioB2B1': float(worst_8b_vs_s005_b2b1),
        'eightWorstRatioVsNative': float(worst_8b_vs_s005_native),
        'eightWorstRatioB1B2': float(worst_8b_b1b2),
        'isPure8B': bool(worst_8b_vs_s005_b2b1 < 1.0),
        'v3Tracks': {
            f"{mode}_{kind}": {
                'upperMs': m_v3[mode][kind]['completionUpperMs'],
                'meanKeys': m_v3[mode][kind]['meanKeys'],
                'p0': m_v3[mode][kind]['p0'],
                'p1': m_v3[mode][kind]['p1'],
                'p2': m_v3[mode][kind]['p2'],
            }
            for mode in ('keytao', 'sanpin')
            for kind in ('character', 'word2', 'word3', 'word4')
        } if m_v3 else {}
    }
    records.append(rec)

records.sort(key=lambda r: r['ckt_v3'] if r['ckt_v3'] is not None else 999.0)
print(f'Processed {len(records)} 21x26 IEUAO 399-unique pure-y schemes from HTML.')

out_path = DATA / 'shenyun-21x26-seeds-database.json'
out_path.write_text(json.dumps({'count': len(records), 'schemes': records}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Saved database to {out_path}')

print('\n=== TOP 25 BY CKT v3 (tau=600, a1=300, a2=300) ===')
for i, r in enumerate(records[:25], 1):
    print(f"{i:2d}. {r['id']:42s} v3={r['ckt_v3']:.5f} v3_raw={r['ckt_v3_raw']:.5f} v2={r['ckt_v2']:.5f} M={r['M']:2d}/D={r['D']}/V={r['V']} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% S2={r['S2ms']:.2f} E6={r['E6']:.4f} Aff={r['crossAffected5Cut']*100:.2f}%")
