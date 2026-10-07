#!/usr/bin/env python3
"""Search IVUAO-locked 21x21 line/face basins by exact word-2 completion CKT.

The broad stage seeks raw τ=150 performance. Subsequent stages tighten M/D.
Eight B miss rates, Pmax, and home-row share remain independent diagnostics.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
import os
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
DEFAULT_HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
p.add_argument('--html', type=Path, default=DEFAULT_HTML)
p.add_argument('--output', type=Path, default=DATA / 'shenyun-21x21-completion-word2-face-search.json')
p.add_argument('--trials', type=int, nargs=5, default=[5000, 3500, 3500, 3500, 5000],
               metavar=('BROAD', 'D3', 'D2', 'D1', 'D0'))
p.add_argument('--seed', type=int, default=20261007)
p.add_argument('--prior', type=Path, nargs='*', default=[])
args = p.parse_args()
args.output = args.output.resolve()
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'
os.chdir(args.replay.resolve())
sys.path[:0] = [str(args.replay.resolve()), str(ROOT / 'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(args.replay.resolve()),
            '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
import numpy as np
from b_path_fast import FastBuckets, NAMES
from fast_completion_word2 import FastCompletion

rng = random.Random(args.seed)
np.random.seed(args.seed)
text = args.html.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
assert match
page = json.loads(gzip.decompress(base64.b64decode(match[1])))
frozen = json.loads((DATA / 'shenyun-completion-ckt-r11.json').read_text(encoding='utf-8'))['schemes']
baseline = frozen['S005']['modes']
b_baseline = json.loads((DATA / 'shenyun-21x21-b-sets-benchmark.json').read_text(encoding='utf-8'))['reference']['S005']
ckt = FastCompletion(b, args.html)
bfast = FastBuckets(b)
aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
physical = [k for k in range(26) if k not in aux]
allowed = set(physical)
p_cap = frozen['R9-21X21-M40-02']['rightPinkyMax']


def ensemble(times, misses, tau=150, word_weight=2):
    norm = 0.0
    for index, (mode, kind) in enumerate((('keytao', 'character'), ('sanpin', 'character'),
                                         ('keytao', 'word'), ('sanpin', 'word'))):
        row = baseline[mode][kind]
        denom = row['completionUpperMs'] + tau * row['p2']
        weight = word_weight if kind == 'word' else 1
        norm += weight * ((times[index] + tau * misses[index]) / denom) ** 4
    return float(10 * (norm / (2 + 2 * word_weight)) ** .25)


def bmetrics(st):
    entry = b.opt.toentry(st, b.DATA, 'proposal')
    return bfast.score(entry['codeList'])


def score_state(st, origin, phase):
    sig = tuple(map(int, st))
    if sig in visited:
        counts[phase]['duplicate'] += 1
        return None
    visited.add(sig)
    if not np.array_equal(st[62:], aux) or set(map(int, st[27:62])) != allowed:
        counts[phase]['invalidDomain'] += 1
        return None
    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > 48 or displaced > 7:
        counts[phase]['invalidStructure'] += 1
        return None
    counts[phase]['legal'] += 1
    times, misses = ckt.score(st)
    score2 = ensemble(times, misses, 150, 2)
    score1 = ensemble(times, misses, 150, 1)
    score0 = ensemble(times, misses, 0, 2)
    score600 = ensemble(times, misses, 600, 2)
    bm = bmetrics(st)
    worst = max(bm[key] / b_baseline[key] for key in NAMES)
    p_load = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
    ident = 'BCW-' + hashlib.sha256(st.tobytes()).hexdigest()[:12]
    row = {'id': ident, 'origin': origin, 'phase': phase, 'state': list(sig),
           'M': int(memory), 'D': int(displaced), 'unique399': int(unique),
           'ckt12': score2, 'ckt11': score1, 'ckt12tau0': score0, 'ckt12tau600': score600,
           'times': list(map(float, times)), 'p2': list(map(float, misses)),
           'Pmax': p_load, 'homeS2': home, 'eightWorstRatio': worst,
           'S2ms': float(factors[0]), 'v5': float(factors[1]), 'v4': float(factors[2]),
           **bm}
    if worst < 1:
        counts[phase]['allEight'] += 1
        if p_load <= p_cap + 1e-12 and home >= .5:
            counts[phase]['allEightLoad'] += 1
    rows[sig] = row
    counts[phase]['scored'] += 1
    return row


def repair_finals(st, anchor):
    counts_local = Counter(map(int, st[27:62]))
    missing = list(allowed - set(map(int, st[27:62])))
    rng.shuffle(missing)
    for key in missing:
        duplicate = [i for i in range(27, 62) if counts_local[int(st[i])] > 1]
        if not duplicate:
            break
        preferred = [i for i in duplicate if int(anchor[i]) == key]
        pos = rng.choice(preferred or duplicate)
        counts_local[int(st[pos])] -= 1
        st[pos] = key
        counts_local[key] += 1


def proposal(parents, kind):
    anchor = parents[0]
    st = anchor.copy()
    if kind in ('line', 'face'):
        onset = rng.choice(parents)
        st[:27] = onset[:27]
        if rng.random() < .25:
            donor = rng.choice(parents)
            for i in rng.sample(range(27), rng.randint(1, 4)):
                st[i] = donor[i]
        cuts = sorted(rng.sample(range(28, 62), rng.randint(1, 3 if kind == 'line' else 6)))
        for lo, hi in zip([27, *cuts], [*cuts, 62]):
            st[lo:hi] = rng.choice(parents)[lo:hi]
        if kind == 'face' and rng.random() < .45:
            for i in rng.sample(range(27, 62), rng.randint(1, 4)):
                st[i] = rng.choice(parents)[i]
        repair_finals(st, anchor)
    else:
        move = rng.randrange(5)
        if move == 0:
            i, j = rng.sample(range(27, 62), 2)
            st[i], st[j] = st[j], st[i]
        elif move == 1:
            a, z = rng.sample(physical, 2)
            b.opt.swapkeys(st, 27, 62, a, z)
        elif move == 2:
            donor = rng.choice(parents)
            for i in rng.sample(range(27, 62), rng.randint(2, 5)):
                st[i] = donor[i]
            repair_finals(st, anchor)
        elif move == 3:
            i = rng.randrange(27)
            st[i] = b.opt.PREF[i] if b.opt.PREF[i] in physical else rng.choice(parents)[i]
        else:
            donor = rng.choice(parents)
            st[:27] = donor[:27]
            i, j = rng.sample(range(27, 62), 2)
            st[i], st[j] = st[j], st[i]
    return st


rows = {}
visited = set()
counts = defaultdict(Counter)
seeds = []
for entry in page['entries']:
    ident = entry['id']
    if entry.get('capacity') != [21, 21] or entry.get('tone') != 'IVUAO' or ident not in frozen:
        continue
    try:
        st = b.opt.state(entry, b.DATA)
    except ValueError:
        continue
    if set(map(int, st[27:62])) != allowed:
        continue
    row = score_state(st, 'atlas:' + ident, 'seed')
    if row is None:
        continue
    expected = frozen[ident]['modes']
    for j, (mode, kind) in enumerate((('keytao', 'character'), ('sanpin', 'character'),
                                      ('keytao', 'word'), ('sanpin', 'word'))):
        assert abs(row['times'][j] - expected[mode][kind]['completionUpperMs']) < 1e-8
        assert abs(row['p2'][j] - expected[mode][kind]['p2']) < 1e-12
    row['atlasId'] = ident
    seeds.append(row)
assert len(seeds) >= 60, len(seeds)
for path in args.prior:
    payload = json.loads(path.read_text(encoding='utf-8'))
    for prior_row in payload['results']:
        st = np.asarray(prior_row['state'], np.int32)
        row = score_state(st, 'prior:' + path.name + ':' + prior_row['id'], 'prior')
        if row is not None and 'ckt12' in prior_row:
            assert abs(row['ckt12'] - prior_row['ckt12']) < 1e-9


def diverse_elites(pool, cap_m, cap_d, limit=60):
    pool = [row for row in pool if row['M'] <= cap_m and row['D'] <= cap_d]
    if not pool:
        return []
    selected = {}
    objectives = (
        lambda r: r['ckt12'],
        lambda r: r['ckt12'] + .6 * max(0, r['eightWorstRatio'] - 1),
        lambda r: r['ckt12'] + 1.2 * max(0, r['Pmax'] - p_cap) + .3 * max(0, .5 - r['homeS2']),
        lambda r: r['ckt12'] + .08 * (r['M'] - 40) + .03 * r['D'],
        lambda r: r['ckt12tau600'],
        lambda r: r['eightWorstRatio'],
    )
    for objective in objectives:
        for row in sorted(pool, key=objective)[:12]:
            selected[tuple(row['state'])] = row
    for subset in ([r for r in pool if r['eightWorstRatio'] < 1],
                   [r for r in pool if r['eightWorstRatio'] < 1 and r['Pmax'] <= p_cap and r['homeS2'] >= .5]):
        for row in sorted(subset, key=lambda r: r['ckt12'])[:12]:
            selected[tuple(row['state'])] = row
    for prefix in ('EXPERIMENT', 'LOWM', 'BPW', 'R9', 'R8', 'BPC', 'BPK', 'NF3'):
        group = [row for row in pool if row.get('atlasId', '').startswith(prefix)]
        for row in sorted(group, key=lambda r: r['ckt12'])[:2]:
            selected[tuple(row['state'])] = row
    for memory in range(40, cap_m + 1):
        group = [row for row in pool if row['M'] == memory]
        for row in sorted(group, key=lambda r: r['ckt12'])[:2]:
            selected[tuple(row['state'])] = row
    for displaced in range(cap_d + 1):
        group = [row for row in pool if row['D'] == displaced]
        for row in sorted(group, key=lambda r: r['ckt12'])[:3]:
            selected[tuple(row['state'])] = row
    return sorted(selected.values(), key=lambda r: r['ckt12'])[:limit]


stages = [('broad', 48, 7), ('D3', 44, 3), ('D2', 43, 2), ('D1', 42, 1), ('D0', 41, 0)]
stage_summaries = {}
for (phase, cap_m, cap_d), trials in zip(stages, args.trials):
    stage_rows = [row for row in rows.values() if row['M'] <= cap_m and row['D'] <= cap_d]
    assert stage_rows, phase
    start_count = len(stage_rows)
    for trial in range(trials):
        if trial % 250 == 0:
            elite = diverse_elites(list(rows.values()), cap_m, cap_d, 90)
            bridges = diverse_elites(list(rows.values()), min(48, cap_m + 2),
                                     min(7, cap_d + 2), 90)
        draw = rng.random()
        kind = 'line' if draw < .32 else 'face' if draw < .68 else 'mutate'
        if kind == 'face':
            source = bridges if rng.random() < .3 else elite
            parents = rng.sample(source, min(len(source), rng.randint(3, 5)))
        elif kind == 'line':
            source = bridges if rng.random() < .3 else elite
            parents = rng.sample(source, 2)
        else:
            anchor = rng.choice(elite[:min(25, len(elite))])
            parents = [anchor, *rng.sample(bridges, min(3, len(bridges)))]
        st = proposal([np.array(row['state'], np.int32) for row in parents], kind)
        counts[phase]['proposals'] += 1
        # A broad line/face crossing may propose a high-D bridge; preserve it
        # for the next trial even if it does not yet pass this stage's cap.
        row = score_state(st, kind + ':' + ','.join(r['id'] for r in parents), phase)
        if row and row['M'] <= cap_m and row['D'] <= cap_d:
            counts[phase]['withinCap'] += 1
        if (trial + 1) % 1000 == 0:
            valid = [r for r in rows.values() if r['M'] <= cap_m and r['D'] <= cap_d]
            best = min(valid, key=lambda r: r['ckt12'])
            print(phase, trial + 1, dict(counts[phase]), 'best', best['id'],
                  round(best['ckt12'], 7), 'M/D', best['M'], best['D'], flush=True)
    valid = [r for r in rows.values() if r['M'] <= cap_m and r['D'] <= cap_d]
    best = min(valid, key=lambda r: r['ckt12'])
    gated = [r for r in valid if r['eightWorstRatio'] < 1]
    gated_load = [r for r in gated if r['Pmax'] <= p_cap + 1e-12 and r['homeS2'] >= .5]
    stage_summaries[phase] = {'maxM': cap_m, 'maxD': cap_d, 'trials': trials,
                              'initial': start_count, 'pool': len(valid),
                              'best': best['id'], 'bestScore': best['ckt12'],
                              'bestEight': min((r['ckt12'] for r in gated), default=None),
                              'bestEightLoad': min((r['ckt12'] for r in gated_load), default=None),
                              'eightCount': len(gated), 'eightLoadCount': len(gated_load),
                              'counts': dict(counts[phase])}
    print('STAGE', phase, stage_summaries[phase], flush=True)

selected = {}
for phase, cap_m, cap_d in stages:
    pool = [r for r in rows.values() if r['M'] <= cap_m and r['D'] <= cap_d]
    for row in diverse_elites(pool, cap_m, cap_d, 100):
        selected[tuple(row['state'])] = row
    for subset in (pool, [r for r in pool if r['eightWorstRatio'] < 1],
                   [r for r in pool if r['eightWorstRatio'] < 1 and r['Pmax'] <= p_cap and r['homeS2'] >= .5]):
        for row in sorted(subset, key=lambda r: r['ckt12'])[:15]:
            selected[tuple(row['state'])] = row
for row in seeds:
    selected[tuple(row['state'])] = row
output = {'purpose': __doc__, 'seed': args.seed, 'tauMs': 150,
          'wordWeight': 2, 'characterWeight': 1, 'baselineId': 'S005',
          'pCap': p_cap, 'homeFloor': .5, 'trials': args.trials,
          'seedCount': len(seeds), 'scoredTotal': len(rows), 'stages': stage_summaries,
          'results': list(selected.values())}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'output': str(args.output), 'scored': len(rows),
                  'saved': len(selected), 'stages': stage_summaries}, ensure_ascii=False))
