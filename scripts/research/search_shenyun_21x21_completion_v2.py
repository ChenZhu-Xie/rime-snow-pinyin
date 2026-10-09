#!/usr/bin/env python3
"""Search IVUAO-locked 21x21 line/face basins under fixed or v2 CKT.

The broad stage seeks the selected scoring scenario. Subsequent stages
tighten M/D while diverse parents preserve home-row and pinky poles.
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
from itertools import islice
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
DEFAULT_HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
p.add_argument('--html', type=Path, default=DEFAULT_HTML)
p.add_argument('--cohort', type=Path, help='Precomputed fixed-IVUAO CKT v2 scores (may contain only 21x21 seeds)')
p.add_argument('--output', type=Path, default=DATA / 'shenyun-21x21-completion-v2-face-search.json')
p.add_argument('--trials', type=int, nargs=5, default=[25000, 20000, 20000, 20000, 25000],
               metavar=('BROAD', 'D3', 'D2', 'D1', 'D0'))
p.add_argument('--tau', type=float, default=600)
p.add_argument('--first-aux', type=float, default=300)
p.add_argument('--second-aux', type=float, default=300)
p.add_argument('--seed', type=int, default=20261007)
p.add_argument('--d3-max-m', type=int, default=44, choices=range(40, 45),
               help='M ceiling for the D3 stage (default: 44)')
p.add_argument('--d2-max-m', type=int, default=43, choices=range(40, 44),
               help='M ceiling for the D2 stage (default: 43)')
p.add_argument('--d1-max-m', type=int, default=42, choices=range(39, 43),
               help='M ceiling for the D1 stage (default: 42)')
p.add_argument('--d0-max-m', type=int, default=41, choices=range(38, 43))
p.add_argument('--prior', type=Path, nargs='*', default=[])
p.add_argument('--objective', choices=('v2', 'fixed'), default='v2')
p.add_argument('--counterpole-share', type=float, default=0,
               help='Fraction of proposals that explicitly cross a slow fixed-CKT pole with frontier points')
p.add_argument('--pole-strategy', choices=('slow', 'attribute'), default='slow')
p.add_argument('--pole-exclude-from', type=Path, nargs='*', default=[],
               help='Saved searches whose pole IDs should be excluded from attribute selection')
p.add_argument('--anchor-ids', nargs='*', default=[],
               help='Explicit new/frontier endpoints to cross with attribute and low-M/D parents')
p.add_argument('--anchor-low-md-share', type=float, default=.7,
               help='For anchored lines, fraction that directly connect to a low-M/D parent')
p.add_argument('--motif-profile', choices=('none', 'fast', 'balanced', 'joint', 'mixed'), default='none',
               help='Soft-pin a random subset of an observed final-key motif after proposal crossover')
p.add_argument('--motif-share', type=float, default=0,
               help='Fraction of proposals receiving motif soft pins')
p.add_argument('--motif-locks', type=int, nargs=2, default=[5, 7],
               metavar=('MIN', 'MAX'), help='Number of motif assignments retained per guided proposal')
p.add_argument('--onset-mutation-share', type=float, default=0,
               help='Fraction of proposals receiving forced onset-coordinate mutations')
p.add_argument('--onset-mutation-count', type=int, nargs=2, default=[1, 3],
               metavar=('MIN', 'MAX'), help='Number of onset coordinates changed per forced mutation')
p.add_argument('--selection-focus', choices=('none', 'eight', 'load-buffer'), default='none',
               help='Prefer gate-feasible rows when retaining parents; reporting still uses raw CKT')
p.add_argument('--buffer-pmax', type=float, default=.065,
               help='Pmax ceiling used by load-buffer parent selection')
p.add_argument('--buffer-home', type=float, default=.48,
               help='Home-row floor used by load-buffer parent selection')
p.add_argument('--checkpoint-every', type=int, default=5000,
               help='Write a reusable elite snapshot every N proposals; zero disables checkpoints')
p.add_argument('--coordinate-face-ids', nargs='*', default=[],
               help='Exhaustively combine coordinate values observed in these endpoint IDs')
p.add_argument('--coordinate-face-max', type=int, default=100000,
               help='Reject coordinate faces larger than this many combinations')
p.add_argument('--coordinate-face-cap', type=int, nargs=2, metavar=('M', 'D'),
               help='Before full scoring, discard face states above these M/D caps')
p.add_argument('--coordinate-face-progress', type=int, default=100000,
               help='Print face enumeration progress every N combinations; zero disables it')
p.add_argument('--coordinate-face-eight-max', type=float,
               help='Before full CKT scoring, discard face states above this worst 8B ratio')
p.add_argument('--coordinate-face-range', type=int, nargs=2, metavar=('START', 'STOP'),
               help='Enumerate only the zero-based half-open slice [START, STOP)')
args = p.parse_args()
if not 0 <= args.counterpole_share <= 1:
    p.error('--counterpole-share must be between 0 and 1')
if not 0 <= args.anchor_low_md_share <= 1:
    p.error('--anchor-low-md-share must be between 0 and 1')
if not 0 <= args.motif_share <= 1:
    p.error('--motif-share must be between 0 and 1')
if not 0 <= args.onset_mutation_share <= 1:
    p.error('--onset-mutation-share must be between 0 and 1')
if not 0 <= args.motif_locks[0] <= args.motif_locks[1]:
    p.error('--motif-locks must be nonnegative and ordered')
if not 1 <= args.onset_mutation_count[0] <= args.onset_mutation_count[1] <= 27:
    p.error('--onset-mutation-count must be between 1 and 27 and ordered')
if not 0 <= args.buffer_pmax <= 1 or not 0 <= args.buffer_home <= 1:
    p.error('--buffer-pmax and --buffer-home must be between 0 and 1')
if args.checkpoint_every < 0:
    p.error('--checkpoint-every must be nonnegative')
if args.coordinate_face_ids and len(args.coordinate_face_ids) < 2:
    p.error('--coordinate-face-ids requires at least two IDs')
if args.coordinate_face_max < 1:
    p.error('--coordinate-face-max must be positive')
if args.coordinate_face_cap and min(args.coordinate_face_cap) < 0:
    p.error('--coordinate-face-cap must be nonnegative')
if args.coordinate_face_progress < 0:
    p.error('--coordinate-face-progress must be nonnegative')
if args.coordinate_face_eight_max is not None and args.coordinate_face_eight_max <= 0:
    p.error('--coordinate-face-eight-max must be positive')
if (args.coordinate_face_range
        and not 0 <= args.coordinate_face_range[0] < args.coordinate_face_range[1]):
    p.error('--coordinate-face-range must be nonnegative and ordered')
args.output = args.output.resolve()
args.cohort = args.cohort.resolve() if args.cohort else None
args.prior = [path.resolve() for path in args.prior]
args.pole_exclude_from = [path.resolve() for path in args.pole_exclude_from]
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
from completion_counterpoles import (choose_anchored_parents, choose_attribute_parents,
                                     choose_cross_parents, fixed_composite,
                                     resolve_endpoint_rows, select_attribute_poles,
                                     select_counterpoles)
from analyze_completion_v2_patterns import analyze_population
from completion_motifs import apply_soft_motif
from completion_coordinate_faces import coordinate_face_spec, iter_coordinate_face
from completion_onset_strata import mutate_onsets, select_onset_representatives

rng = random.Random(args.seed)
np.random.seed(args.seed)
text = args.html.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
assert match
page = json.loads(gzip.decompress(base64.b64decode(match[1])))
cohort = json.loads(args.cohort.read_text(encoding='utf-8')) if args.cohort else page['completionBV2']
old_cohort = page['completionBFixed']['schemes']
frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
baseline = cohort['schemes']['S005']['modes']
old_baseline = old_cohort['S005']['modes']
b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (('j1','keytao','character','p1'),('j2','keytao','character','p2'),('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}
ckt = FastCompletion(b, args.html, first_word=True, v2=True)
ckt_old = FastCompletion(b, args.html, first_word=True, v2=False) if args.objective == 'fixed' else None
bfast = FastBuckets(b, first_word=True)
aux = np.array([b.opt.META['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
physical = [k for k in range(26) if k not in aux]
allowed = set(physical)
p_cap = frozen['R9-21X21-M40-02']['rightPinkyMax']
old_denominators = [old_baseline[mode][kind]['completionUpperMs'] + args.tau * old_baseline[mode][kind]['p2']
                    for mode, kind in (('keytao', 'character'), ('sanpin', 'character'),
                                       ('keytao', 'word'), ('sanpin', 'word'))]


def objective_score(row):
    return row['fixed12'] if args.objective == 'fixed' else row['ckt12']


def selection_penalty(row):
    """Distance outside the requested parent-retention gate."""
    if args.selection_focus == 'none':
        return 0.0
    penalty = 5 * max(0, row['eightWorstRatio'] - 1)
    if args.selection_focus == 'load-buffer':
        penalty += 8 * max(0, row['Pmax'] - args.buffer_pmax)
        penalty += 2 * max(0, args.buffer_home - row['homeS2'])
    return penalty


def selection_key(row):
    if args.selection_focus == 'none':
        return (0, objective_score(row))
    feasible = row['eightWorstRatio'] < 1
    if args.selection_focus == 'load-buffer':
        feasible = feasible and row['Pmax'] <= args.buffer_pmax and row['homeS2'] >= args.buffer_home
    return (0 if feasible else 1, selection_penalty(row), objective_score(row))


def ensemble(times, misses, first_counts, second_counts, tau=600, first_aux=300, second_aux=300, word_weight=2):
    norm = 0.0
    for index, (mode, kind) in enumerate((('keytao', 'character'), ('sanpin', 'character'),
                                         ('keytao', 'word'), ('sanpin', 'word'))):
        row = baseline[mode][kind]
        denom = row['completionUpperMs'] + tau * row['p2'] + first_aux * (1 - row['stageWeight'][0]) + second_aux * (row['meanKeys'] - (4 if kind == 'word' else 2) - (1 - row['stageWeight'][0]))
        weight = word_weight if kind == 'word' else 1
        norm += weight * ((times[index] + tau * misses[index] + first_aux * first_counts[index] + second_aux * second_counts[index]) / denom) ** 4
    return float(10 * (norm / (2 + 2 * word_weight)) ** .25)


def bmetrics(st):
    entry = b.opt.toentry(st, b.DATA, 'proposal')
    return bfast.score(entry['codeList'])


def score_state(st, origin, phase, pre_score_cap=None, track_visited=True,
                pre_score_eight_max=None):
    sig = tuple(map(int, st))
    if sig in visited or (not track_visited and sig in rows):
        counts[phase]['duplicate'] += 1
        return None
    if track_visited:
        visited.add(sig)
    if not np.array_equal(st[62:], aux) or set(map(int, st[27:62])) != allowed:
        counts[phase]['invalidDomain'] += 1
        return None
    unique, memory, displaced = b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or memory > 48 or displaced > 7:
        counts[phase]['invalidStructure'] += 1
        return None
    counts[phase]['legal'] += 1
    if pre_score_cap and (memory > pre_score_cap[0] or displaced > pre_score_cap[1]):
        counts[phase]['outsidePreScoreCap'] += 1
        return None
    bm = None
    worst = None
    if pre_score_eight_max is not None:
        bm = bmetrics(st)
        worst = max(bm[key] / b_baseline[key] for key in NAMES)
        counts[phase]['preScoredEight'] += 1
        if worst > pre_score_eight_max:
            counts[phase]['outsidePreScoreEight'] += 1
            return None
    times, misses, first_counts, second_counts = ckt.score(st)
    score2 = ensemble(times, misses, first_counts, second_counts, args.tau, args.first_aux, args.second_aux, 2)
    score1 = ensemble(times, misses, first_counts, second_counts, args.tau, args.first_aux, args.second_aux, 1)
    score0 = ensemble(times, misses, first_counts, second_counts, 0, args.first_aux, args.second_aux, 2)
    score600 = ensemble(times, misses, first_counts, second_counts, args.tau, 0, 0, 2)
    fixed_score = None
    if ckt_old is not None:
        old_times, old_misses = ckt_old.score(st)
        if not np.allclose(misses, old_misses, rtol=0, atol=1e-12):
            raise ValueError('Old/new completion miss rates diverged')
        fixed_score = float(10 * (sum(weight * ((old_times[i] + args.tau * old_misses[i]) / old_denominators[i])**4
                                      for i, weight in enumerate((1, 1, 2, 2))) / 6)**.25)
    if bm is None:
        bm = bmetrics(st)
        worst = max(bm[key] / b_baseline[key] for key in NAMES)
    p_load = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
    ident = 'BCW-' + hashlib.sha256(st.tobytes()).hexdigest()[:12]
    row = {'id': ident, 'origin': origin, 'phase': phase, 'state': list(sig),
           'M': int(memory), 'D': int(displaced), 'unique399': int(unique),
           'ckt12': score2, 'ckt11': score1, 'ckt12tau0': score0, 'ckt12tau600': score600,
           'fixed12': fixed_score,
           'times': list(map(float, times)), 'p2': list(map(float, misses)),
           'firstAuxCounts': list(map(float, first_counts)), 'secondAuxCounts': list(map(float, second_counts)),
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
    if entry.get('capacity') != [21, 21] or entry.get('tone') != 'IVUAO' or ident not in cohort['schemes']:
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
    expected = cohort['schemes'][ident]['modes']
    for j, (mode, kind) in enumerate((('keytao', 'character'), ('sanpin', 'character'),
                                      ('keytao', 'word'), ('sanpin', 'word'))):
        assert abs(row['times'][j] - expected[mode][kind]['completionUpperMs']) < 1e-8
        assert abs(row['p2'][j] - expected[mode][kind]['p2']) < 1e-12
        assert abs(row['firstAuxCounts'][j] - (1 - expected[mode][kind]['stageWeight'][0])) < 1e-12
        assert abs(row['secondAuxCounts'][j] - (expected[mode][kind]['meanKeys'] - (4 if kind == 'word' else 2) - (1 - expected[mode][kind]['stageWeight'][0]))) < 1e-12
    if ident in frozen:
        for key, mode, kind, stage in (('j1','keytao','character','p1'),('j2','keytao','character','p2'),('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2')):
            assert abs(row[key] - expected[mode][kind][stage]) < 1e-12, (ident, key, row[key], expected[mode][kind][stage])
    row['atlasId'] = ident
    if ident in old_cohort:
        row['oldFixed12'] = fixed_composite(old_cohort[ident]['modes'], old_baseline, args.tau)
        if row['fixed12'] is not None and abs(row['fixed12'] - row['oldFixed12']) > 1e-8:
            raise ValueError('Fast/archived fixed-CKT mismatch '+ident)
    seeds.append(row)
assert len(seeds) >= 60, len(seeds)
for path in args.prior:
    payload = json.loads(path.read_text(encoding='utf-8'))
    for prior_row in payload['results']:
        st = np.asarray(prior_row['state'], np.int32)
        row = score_state(st, 'prior:' + path.name + ':' + prior_row['id'], 'prior')
        # Historical records used second-character-first Keytao words; only
        # compare archived scores from runs declaring the corrected contract.
        # Prior rows were scored under a different model and penalty policy.

face_metadata = None
if args.coordinate_face_ids:
    endpoints = resolve_endpoint_rows(list(rows.values()), args.coordinate_face_ids)
    base, varying, face_combinations = coordinate_face_spec(
        [np.asarray(row['state'], np.int32) for row in endpoints], args.coordinate_face_max)
    face_start, face_stop = args.coordinate_face_range or (0, face_combinations)
    if face_stop > face_combinations:
        p.error('--coordinate-face-range STOP exceeds the face size')
    before = len(rows)
    face_iterator = islice(iter_coordinate_face(base, varying), face_start, face_stop)
    for index, state in enumerate(face_iterator, face_start + 1):
        score_state(state, 'coordinate-face:' + ','.join(args.coordinate_face_ids), 'face',
                    args.coordinate_face_cap, track_visited=False,
                    pre_score_eight_max=args.coordinate_face_eight_max)
        if (args.coordinate_face_progress and index % args.coordinate_face_progress == 0):
            print('COORDINATE_FACE_PROGRESS', index, '/', face_stop,
                  dict(counts['face']), flush=True)
    face_metadata = {
        'endpointIds': args.coordinate_face_ids,
        'varying': [{'position': position, 'values': list(values)}
                    for position, values in varying],
        'combinations': face_combinations, 'newScored': len(rows) - before,
        'range': [face_start, face_stop],
        'preScoreCap': args.coordinate_face_cap,
        'preScoreEightMax': args.coordinate_face_eight_max,
        'counts': dict(counts['face']),
    }
    print('COORDINATE_FACE', face_metadata, flush=True)

if args.pole_strategy == 'attribute':
    excluded = set()
    for path in args.pole_exclude_from:
        excluded.update(json.loads(path.read_text(encoding='utf-8')).get('counterpoleIds', []))
    counterpoles, pole_provenance = select_attribute_poles(list(rows.values()), excluded,
                                                        score_key='ckt12' if args.objective == 'v2' else 'fixed12')
    counterpole_threshold = None
else:
    counterpole_threshold, counterpoles = select_counterpoles(seeds)
    pole_provenance = []
print('COUNTERPOLES', {'strategy': args.pole_strategy, 'threshold': counterpole_threshold,
                       'axes': pole_provenance,
                       'ids': [row.get('atlasId', row['id']) for row in counterpoles]}, flush=True)
explicit_endpoints = resolve_endpoint_rows(list(rows.values()), args.anchor_ids)
anchored_endpoints = {row['id']: row for row in [*explicit_endpoints, *counterpoles]}
print('ENDPOINTS', {'explicit': args.anchor_ids,
                    'combined': [row.get('atlasId', row['id'])
                                 for row in anchored_endpoints.values()]}, flush=True)


def diverse_elites(pool, cap_m, cap_d, limit=60):
    pool = [row for row in pool if row['M'] <= cap_m and row['D'] <= cap_d]
    if not pool:
        return []
    selected = {}
    objectives = (
        lambda r: objective_score(r) + selection_penalty(r),
        objective_score,
        lambda r: objective_score(r) + .6 * max(0, r['eightWorstRatio'] - 1),
        lambda r: objective_score(r) + 1.2 * max(0, r['Pmax'] - p_cap) + .3 * max(0, .5 - r['homeS2']),
        lambda r: objective_score(r) + .08 * (r['M'] - 40) + .03 * r['D'],
        lambda r: r['ckt12tau600'],
        lambda r: r['eightWorstRatio'],
        lambda r: -r['homeS2'],
        lambda r: r['Pmax'],
    )
    for objective in objectives:
        for row in sorted(pool, key=objective)[:12]:
            selected[tuple(row['state'])] = row
    if args.onset_mutation_share:
        for row in select_onset_representatives(
                pool, limit=min(30, limit),
                metric_keys=('eightWorstRatio', 'wj1', 'wj2', 'ws1', 'ws2')):
            selected[tuple(row['state'])] = row
    for subset in ([r for r in pool if r['eightWorstRatio'] < 1],
                   [r for r in pool if r['eightWorstRatio'] < 1 and r['Pmax'] <= p_cap and r['homeS2'] >= .5]):
        for row in sorted(subset, key=objective_score)[:12]:
            selected[tuple(row['state'])] = row
    for prefix in ('EXPERIMENT', 'LOWM', 'BPW', 'R9', 'R8', 'BPC', 'BPK', 'NF3'):
        group = [row for row in pool if row.get('atlasId', '').startswith(prefix)]
        for row in sorted(group, key=objective_score)[:2]:
            selected[tuple(row['state'])] = row
    for memory in range(40, cap_m + 1):
        group = [row for row in pool if row['M'] == memory]
        for row in sorted(group, key=objective_score)[:2]:
            selected[tuple(row['state'])] = row
    for displaced in range(cap_d + 1):
        group = [row for row in pool if row['D'] == displaced]
        for row in sorted(group, key=objective_score)[:3]:
            selected[tuple(row['state'])] = row
    # Preserve high-home/low-pinky and low-M/D poles even when their raw CKT
    # is slower than the high-speed basin. They serve as face/line parents.
    poles = {}
    for objective in objectives:
        for row in sorted(pool, key=objective)[:min(5, max(1, limit // 12))]:
            poles[tuple(row['state'])] = row
    for memory in sorted({r['M'] for r in pool}):
        group = [r for r in pool if r['M'] == memory]
        for row in sorted(group, key=objective_score)[:2]:
            poles[tuple(row['state'])] = row
    for displaced in sorted({r['D'] for r in pool}):
        group = [r for r in pool if r['D'] == displaced]
        for row in sorted(group, key=objective_score)[:2]:
            poles[tuple(row['state'])] = row
    retained = list(poles.values())
    retained.extend(r for r in sorted(selected.values(), key=selection_key)
                    if tuple(r['state']) not in poles)
    if args.selection_focus == 'none':
        return retained[:limit]
    return sorted(retained, key=selection_key)[:limit]


def write_checkpoint(phase, completed, cap_m, cap_d):
    """Persist enough frontier rows to resume a long stage after interruption."""
    pool = [row for row in rows.values() if row['M'] <= cap_m and row['D'] <= cap_d]
    chosen = {tuple(row['state']): row for row in diverse_elites(pool, cap_m, cap_d, 120)}
    for subset in (pool, [row for row in pool if row['eightWorstRatio'] < 1],
                   [row for row in pool if row['eightWorstRatio'] < 1
                    and row['Pmax'] <= p_cap and row['homeS2'] >= .5]):
        for row in sorted(subset, key=objective_score)[:20]:
            chosen[tuple(row['state'])] = row
    for row in seeds:
        chosen[tuple(row['state'])] = row
    payload = {
        'partial': True, 'seed': args.seed, 'phase': phase, 'completedTrials': completed,
        'trials': args.trials, 'objective': args.objective,
        'tauMs': args.tau, 'firstAuxiliaryExtraMs': args.first_aux,
        'secondAuxiliaryExtraMs': args.second_aux,
        'motifProfile': args.motif_profile, 'motifShare': args.motif_share,
        'motifLocks': args.motif_locks, 'selectionFocus': args.selection_focus,
        'bufferPmax': args.buffer_pmax, 'bufferHome': args.buffer_home,
        'd3MaxM': args.d3_max_m, 'd2MaxM': args.d2_max_m,
        'd1MaxM': args.d1_max_m, 'd0MaxM': args.d0_max_m,
        'counts': dict(counts[phase]), 'scoredTotal': len(rows),
        'results': list(chosen.values()),
    }
    checkpoint = args.output.with_name(args.output.stem + '.partial' + args.output.suffix)
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    checkpoint.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n',
                          encoding='utf-8')
    print('CHECKPOINT', checkpoint, len(chosen), flush=True)


stages = [('broad', 48, 7), ('D3', args.d3_max_m, 3),
          ('D2', args.d2_max_m, 2), ('D1', args.d1_max_m, 1),
          ('D0', args.d0_max_m, 0)]
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
        if rng.random() < args.counterpole_share:
            if args.anchor_ids and kind in ('line', 'face'):
                endpoint = rng.choice(list(anchored_endpoints.values()))
                low_md = sorted(elite, key=lambda row: (row['M'], row['D'],
                                                        objective_score(row)))[:24]
                parents = choose_anchored_parents(
                    kind, endpoint, list(anchored_endpoints.values()), low_md,
                    bridges, rng, args.anchor_low_md_share)
                counts[phase]['anchoredCrosses'] += 1
            else:
                pole = rng.choice(counterpoles)
                parents = (choose_attribute_parents(kind, pole, counterpoles, elite, bridges, rng)
                           if args.pole_strategy == 'attribute'
                           else choose_cross_parents(kind, pole, elite, bridges, rng))
            counts[phase]['counterpoleCrosses'] += 1
        elif kind == 'face':
            source = bridges if rng.random() < .3 else elite
            parents = rng.sample(source, min(len(source), rng.randint(3, 5)))
        elif kind == 'line':
            source = bridges if rng.random() < .3 else elite
            parents = rng.sample(source, 2)
        else:
            anchor = rng.choice(elite[:min(25, len(elite))])
            parents = [anchor, *rng.sample(bridges, min(3, len(bridges)))]
        st = proposal([np.array(row['state'], np.int32) for row in parents], kind)
        if args.onset_mutation_share and rng.random() < args.onset_mutation_share:
            positions = mutate_onsets(st, physical, *args.onset_mutation_count, rng)
            counts[phase]['onsetMutationProposals'] += 1
            counts[phase]['onsetMutations'] += len(positions)
        if args.motif_profile != 'none' and rng.random() < args.motif_share:
            applied, labels = apply_soft_motif(
                st, b.opt.META['finals'], b.opt.META['keys'], allowed,
                args.motif_profile, *args.motif_locks, rng)
            if applied:
                counts[phase]['motifProposals'] += 1
                counts[phase]['motifPins'] += len(labels)
            else:
                counts[phase]['motifRepairFailed'] += 1
        counts[phase]['proposals'] += 1
        # A broad line/face crossing may propose a high-D bridge; preserve it
        # for the next trial even if it does not yet pass this stage's cap.
        row = score_state(st, kind + ':' + ','.join(r['id'] for r in parents), phase)
        if row and row['M'] <= cap_m and row['D'] <= cap_d:
            counts[phase]['withinCap'] += 1
        if (trial + 1) % 1000 == 0:
            valid = [r for r in rows.values() if r['M'] <= cap_m and r['D'] <= cap_d]
            best = min(valid, key=objective_score)
            gated = [r for r in valid if r['eightWorstRatio'] < 1]
            best_gated = min(gated, key=objective_score) if gated else None
            print(phase, trial + 1, dict(counts[phase]), 'best', best['id'],
                  round(objective_score(best), 7), 'M/D', best['M'], best['D'],
                  'best8', (best_gated['id'], round(objective_score(best_gated), 7),
                            best_gated['M'], best_gated['D']) if best_gated else None,
                  flush=True)
        if args.checkpoint_every and (trial + 1) % args.checkpoint_every == 0:
            write_checkpoint(phase, trial + 1, cap_m, cap_d)
    valid = [r for r in rows.values() if r['M'] <= cap_m and r['D'] <= cap_d]
    best = min(valid, key=objective_score)
    gated = [r for r in valid if r['eightWorstRatio'] < 1]
    gated_load = [r for r in gated if r['Pmax'] <= p_cap + 1e-12 and r['homeS2'] >= .5]
    stage_summaries[phase] = {'maxM': cap_m, 'maxD': cap_d, 'trials': trials,
                              'initial': start_count, 'pool': len(valid),
                              'best': best['id'], 'bestScore': objective_score(best),
                              'bestEight': min((objective_score(r) for r in gated), default=None),
                              'bestEightLoad': min((objective_score(r) for r in gated_load), default=None),
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
        for row in sorted(subset, key=objective_score)[:15]:
            selected[tuple(row['state'])] = row
for row in seeds:
    selected[tuple(row['state'])] = row
proposal_rows = [row for row in rows.values()
                 if row['phase'] in {phase for phase, _, _ in stages}]
pattern_analysis = analyze_population(proposal_rows, b.opt.META['finals'], b.opt.META['keys'])
output = {'purpose': __doc__, 'seed': args.seed, 'tauMs': args.tau,
          'objective': args.objective, 'counterpoleShare': args.counterpole_share,
          'poleStrategy': args.pole_strategy, 'poleProvenance': pole_provenance,
          'counterpoleThreshold': counterpole_threshold,
          'counterpoleIds': [row.get('atlasId', row['id']) for row in counterpoles],
          'anchorIds': args.anchor_ids,
          'anchorEndpointIds': [row.get('atlasId', row['id'])
                                for row in anchored_endpoints.values()],
          'anchorLowMdShare': args.anchor_low_md_share,
          'motifProfile': args.motif_profile, 'motifShare': args.motif_share,
          'motifLocks': args.motif_locks,
          'onsetMutationShare': args.onset_mutation_share,
          'onsetMutationCount': args.onset_mutation_count,
          'selectionFocus': args.selection_focus, 'bufferPmax': args.buffer_pmax,
          'bufferHome': args.buffer_home,
          'coordinateFace': face_metadata,
          'firstAuxiliaryExtraMs': args.first_aux, 'secondAuxiliaryExtraMs': args.second_aux,
          'wordWeight': 2, 'characterWeight': 1, 'baselineId': 'S005',
          'wordBOrder': '21x21 Keytao first character, then second; Sanpin second, then first',
          'pCap': p_cap, 'homeFloor': .5, 'trials': args.trials,
          'seedCount': len(seeds), 'scoredTotal': len(rows), 'stages': stage_summaries,
          'proposalPatternAnalysis': pattern_analysis,
          'd3MaxM': args.d3_max_m, 'd2MaxM': args.d2_max_m,
          'd1MaxM': args.d1_max_m,
          'd0MaxM': args.d0_max_m,
          'results': list(selected.values())}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'output': str(args.output), 'scored': len(rows),
                  'saved': len(selected), 'stages': stage_summaries}, ensure_ascii=False))
