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

bfast = FastBuckets(b, first_word=True)
aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
physical = [k for k in range(26) if k not in aux]
allowed = set(physical)

text = HTML_PATH.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
page = json.loads(gzip.decompress(base64.b64decode(match.group(1))))

frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
    ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

v3_data = page.get('completionBV3', {}).get('schemes', {})
s005_v3 = v3_data.get('S005', {}).get('modes', {})

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

records = []
for entry in page['entries']:
    if entry.get('capacity') != [21, 21] or entry.get('tone') != 'IVUAO':
        continue
    ident = entry['id']
    try:
        st = b.opt.state(entry, b.DATA)
    except Exception as exc:
        continue
    
    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    p_load = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
    bm = bfast.score(entry['codeList'])
    worst_8b = max(bm[key] / b_baseline[key] for key in NAMES)
    
    # Check v3 score
    m_v3 = v3_data.get(ident, {}).get('modes', {})
    v3_score = score_v3(m_v3)
    
    rec = {
        'id': ident,
        'name': entry.get('name', ident),
        'state': [int(x) for x in st],
        'M': int(memory),
        'D': int(displaced),
        'unique399': int(unique),
        'ckt_v3': v3_score,
        'homeS2': home,
        'Pmax': p_load,
        'S2ms': float(factors[0]),
        'v5': float(factors[1]),
        'v4': float(factors[2]),
        'eightWorstRatio': float(worst_8b),
        'isPure8B': bool(worst_8b < 1.0),
        'bMetrics': {k: float(bm[k]) for k in NAMES},
        'bMetricsRatio': {k: float(bm[k] / b_baseline[k]) for k in NAMES}
    }
    records.append(rec)

print(f'Processed {len(records)} 21x21 IVUAO schemes.')
scored_v3_count = sum(1 for r in records if r['ckt_v3'] is not None)
print(f'Schemes with CKT v3: {scored_v3_count}')

out_path = DATA / 'shenyun-21x21-seeds-database.json'
out_path.write_text(json.dumps({'count': len(records), 'schemes': records}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Saved database to {out_path}')
