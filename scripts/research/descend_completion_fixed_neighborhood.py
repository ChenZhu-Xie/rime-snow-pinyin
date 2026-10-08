#!/usr/bin/env python3
"""Steepest descent through three legal one-step fixed-IVUAO neighborhoods.

Each path keeps the starting point's M/D caps. A local minimum is only a
minimum under the moves listed below, not a global optimum.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
DEFAULT_HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--search', type=Path, required=True)
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    parser.add_argument('--ids', nargs='+', required=True)
    parser.add_argument('--objective', choices=('fixed', 'v2'), default='fixed')
    parser.add_argument('--require-eight-b', action='store_true',
                        help='Keep all eight B miss ratios below the frozen S005 baseline')
    parser.add_argument('--require-load-home', action='store_true',
                        help='Keep Pmax at or below frozen R9 and home-row share at or above 50%%')
    parser.add_argument('--max-steps', type=int, default=12)
    parser.add_argument('--escape-width', type=int, default=0,
                        help='At a local minimum, scan all second moves from this many cheapest first moves')
    parser.add_argument('--escape-rounds', type=int, default=0,
                        help='Follow this many improving two-step escapes, descending again after each')
    parser.add_argument('--include-motif-cycles', action='store_true',
                        help='Add both three-cycles over final coordinates appearing in known motifs')
    parser.add_argument('--third-width', type=int, default=0,
                        help='If no two-step exit exists, scan third moves from this many cheapest second states')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if min(args.max_steps, args.escape_width, args.escape_rounds, args.third_width) < 0:
        parser.error('step and width arguments must be nonnegative')
    args.output = args.output.resolve()
    args.html = args.html.resolve()
    source = json.loads(args.search.read_text(encoding='utf-8'))
    tau = source.get('tauMs', 600)
    first_aux = source.get('firstAuxiliaryExtraMs', 300)
    second_aux = source.get('secondAuxiliaryExtraMs', 300)
    seeds = {row['id']: row for row in source['results'] if row['id'] in args.ids}
    if set(seeds) != set(args.ids):
        raise ValueError('Requested IDs missing from saved search')
    for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
        os.environ[key] = '1'
    replay = args.replay.resolve()
    os.chdir(replay)
    sys.path[:0] = [str(replay), str(ROOT / 'scripts/research')]
    sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(replay),
                '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
    spec = importlib.util.spec_from_file_location(
        'b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
    bench = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(bench)
    import numpy as np
    from fast_completion_word2 import FastCompletion
    from completion_motifs import motif_final_positions
    if args.require_eight_b:
        from b_path_fast import FastBuckets, NAMES
        frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
        base_b = {key: frozen['S005']['modes'][mode][kind][stage]
                  for key, mode, kind, stage in (
                      ('j1', 'keytao', 'character', 'p1'), ('j2', 'keytao', 'character', 'p2'),
                      ('s1', 'sanpin', 'character', 'p1'), ('s2', 'sanpin', 'character', 'p2'),
                      ('wj1', 'keytao', 'word', 'p1'), ('wj2', 'keytao', 'word', 'p2'),
                      ('ws1', 'sanpin', 'word', 'p1'), ('ws2', 'sanpin', 'word', 'p2'))}
        buckets = FastBuckets(bench, first_word=True)

        def qualifies_b(candidate):
            codes = bench.opt.toentry(candidate, bench.DATA, 'proposal')['codeList']
            metrics = buckets.score(codes)
            return max(metrics[key] / base_b[key] for key in NAMES) < 1
    else:
        def qualifies_b(candidate):
            return True

    if args.require_load_home:
        frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
        p_cap = frozen['R9-21X21-M40-02']['rightPinkyMax']

        def qualifies_load_home(candidate):
            return (float(bench.r5.rp(candidate)[1]) <= p_cap + 1e-12
                    and float(bench.r5.home(candidate)[0]) >= .5)
    else:
        def qualifies_load_home(candidate):
            return True

    def qualifies(candidate):
        return qualifies_b(candidate) and qualifies_load_home(candidate)

    html = args.html.read_text(encoding='utf-8')
    match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', html)
    assert match
    page = json.loads(gzip.decompress(base64.b64decode(match[1])))
    reference_key = 'completionBV2' if args.objective == 'v2' else 'completionBFixed'
    reference = page[reference_key]['schemes']['S005']['modes']
    paths = (('keytao', 'character'), ('sanpin', 'character'),
             ('keytao', 'word'), ('sanpin', 'word'))
    denominators = []
    for mode, kind in paths:
        row = reference[mode][kind]
        value = row['completionUpperMs'] + tau * row['p2']
        if args.objective == 'v2':
            first_count = 1 - row['stageWeight'][0]
            value += first_aux * first_count + second_aux * (
                row['meanKeys'] - (4 if kind == 'word' else 2) - first_count)
        denominators.append(value)
    scorer = FastCompletion(bench, args.html, first_word=True,
                            v2=args.objective == 'v2')
    auxiliary = {bench.opt.META['keys'].index(key) for key in 'IVUAO'}
    physical = [key for key in range(26) if key not in auxiliary]
    cycle_positions = motif_final_positions(bench.opt.META['finals'])

    def score(state):
        if args.objective == 'v2':
            times, misses, first_counts, second_counts = scorer.score(state)
        else:
            times, misses = scorer.score(state)
            first_counts = second_counts = (0,) * 4
        return float(10 * (sum(weight * ((times[i] + tau * misses[i]
                                         + first_aux * first_counts[i]
                                         + second_aux * second_counts[i])
                                         / denominators[i])**4
                               for i, weight in enumerate((1, 1, 2, 2))) / 6)**.25)

    def neighbors(state):
        for i in range(27, 62):
            for j in range(i + 1, 62):
                new = state.copy()
                new[i], new[j] = new[j], new[i]
                yield new, f'final-slot:{i}:{j}'
        for position, left in enumerate(physical):
            for right in physical[position + 1:]:
                new = state.copy()
                bench.opt.swapkeys(new, 27, 62, left, right)
                yield new, f'final-key:{left}:{right}'
        for i in range(27):
            for key in physical:
                if key != int(state[i]):
                    new = state.copy()
                    new[i] = key
                    yield new, f'onset:{i}:{key}'
        if args.include_motif_cycles:
            for left_index, left in enumerate(cycle_positions):
                for middle_index in range(left_index + 1, len(cycle_positions)):
                    middle = cycle_positions[middle_index]
                    for right in cycle_positions[middle_index + 1:]:
                        new = state.copy()
                        new[left], new[middle], new[right] = state[right], state[left], state[middle]
                        yield new, f'final-cycle:{left}:{middle}:{right}:right'
                        new = state.copy()
                        new[left], new[middle], new[right] = state[middle], state[right], state[left]
                        yield new, f'final-cycle:{left}:{middle}:{right}:left'

    results = []
    for ident in args.ids:
        seed = seeds[ident]
        state = np.asarray(seed['state'], dtype=np.int32)
        value = score(state)
        archived = seed.get('ckt12') if args.objective == 'v2' else seed.get('fixed12', seed.get('fixedScore'))
        if archived is None or abs(value - archived) > 1e-9:
            raise ValueError(f'Archived {args.objective} score mismatch: {ident}')
        if not qualifies(state):
            raise ValueError(f'Seed fails requested diagnostic gates: {ident}')
        path = []
        escapes = []
        status = 'step_limit'
        scans = []
        barrier = None
        two_step_escape = None
        three_step_escape = None
        escape_counts = None
        while True:
            best = None
            counts = {'generated': 0, 'legal': 0, 'underCap': 0,
                      'underB': 0, 'underGates': 0, 'improving': 0}
            nearest_score = float('inf')
            first_neighbors = []
            seen = set()
            for candidate, mutation in neighbors(state):
                signature = tuple(map(int, candidate))
                if signature in seen or np.array_equal(candidate, state):
                    continue
                seen.add(signature)
                counts['generated'] += 1
                unique, memory, displaced = bench.se.stats(
                    candidate, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
                if unique < 0 or memory > 48 or displaced > 7:
                    continue
                counts['legal'] += 1
                if memory > seed['M'] or displaced > seed['D']:
                    continue
                counts['underCap'] += 1
                if not qualifies_b(candidate):
                    continue
                counts['underB'] += 1
                if not qualifies_load_home(candidate):
                    continue
                counts['underGates'] += 1
                candidate_score = score(candidate)
                nearest_score = min(nearest_score, candidate_score)
                if args.escape_width:
                    first_neighbors.append((candidate_score, candidate.copy(), mutation))
                if candidate_score + 1e-9 < value:
                    counts['improving'] += 1
                    if best is None or candidate_score < best['score']:
                        best = {'score': candidate_score, 'M': int(memory),
                                'D': int(displaced), 'mutation': mutation,
                                'state': list(signature)}
            scans.append(counts)
            if best is None:
                status = 'local_minimum'
                barrier = nearest_score - value if nearest_score < float('inf') else None
                if args.escape_width:
                    escape_counts = {'first': min(args.escape_width, len(first_neighbors)),
                                     'generated': 0, 'underCap': 0,
                                     'underB': 0, 'underGates': 0,
                                     'thirdSeeds': 0, 'thirdGenerated': 0,
                                     'thirdUnderGates': 0}
                    seen2 = set()
                    second_neighbors = []
                    for first_score, first_state, first_move in sorted(
                            first_neighbors, key=lambda item: item[0])[:args.escape_width]:
                        for second_state, second_move in neighbors(first_state):
                            signature = tuple(map(int, second_state))
                            if signature in seen2 or np.array_equal(second_state, state):
                                continue
                            seen2.add(signature)
                            escape_counts['generated'] += 1
                            unique2, memory2, displaced2 = bench.se.stats(
                                second_state, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
                            if unique2 < 0 or memory2 > seed['M'] or displaced2 > seed['D']:
                                continue
                            escape_counts['underCap'] += 1
                            if not qualifies_b(second_state):
                                continue
                            escape_counts['underB'] += 1
                            if not qualifies_load_home(second_state):
                                continue
                            escape_counts['underGates'] += 1
                            second_score = score(second_state)
                            if args.third_width:
                                second_neighbors.append((second_score, second_state.copy(),
                                                         first_move, second_move, first_score))
                            if second_score + 1e-9 < value and (
                                    two_step_escape is None or second_score < two_step_escape['score']):
                                two_step_escape = {'score': second_score,
                                                   'M': int(memory2), 'D': int(displaced2),
                                                   'firstMove': first_move,
                                                   'secondMove': second_move,
                                                   'firstScore': first_score,
                                                   'barrier': first_score - value,
                                                   'state': list(signature)}
                    if two_step_escape is None and args.third_width:
                        third_seeds = sorted(second_neighbors, key=lambda item: item[0])[:args.third_width]
                        escape_counts['thirdSeeds'] = len(third_seeds)
                        seen3 = set()
                        for second_score, second_state, first_move, second_move, first_score in third_seeds:
                            for third_state, third_move in neighbors(second_state):
                                signature = tuple(map(int, third_state))
                                if signature in seen3 or np.array_equal(third_state, state):
                                    continue
                                seen3.add(signature)
                                escape_counts['thirdGenerated'] += 1
                                unique3, memory3, displaced3 = bench.se.stats(
                                    third_state, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
                                if unique3 < 0 or memory3 > seed['M'] or displaced3 > seed['D']:
                                    continue
                                if not qualifies(third_state):
                                    continue
                                escape_counts['thirdUnderGates'] += 1
                                third_score = score(third_state)
                                if third_score + 1e-9 < value and (
                                        three_step_escape is None
                                        or third_score < three_step_escape['score']):
                                    three_step_escape = {
                                        'score': third_score, 'M': int(memory3), 'D': int(displaced3),
                                        'firstMove': first_move, 'secondMove': second_move,
                                        'thirdMove': third_move, 'firstScore': first_score,
                                        'secondScore': second_score,
                                        'barrier': max(first_score, second_score) - value,
                                        'state': list(signature)}
                chosen_escape = two_step_escape or three_step_escape
                if chosen_escape is not None and len(escapes) < args.escape_rounds:
                    escapes.append(chosen_escape)
                    state = np.asarray(chosen_escape['state'], dtype=np.int32)
                    value = chosen_escape['score']
                    print(ident, 'ESCAPE', len(escapes), f'{value:.9f}',
                          chosen_escape['M'], chosen_escape['D'],
                          chosen_escape['firstMove'], chosen_escape['secondMove'],
                          chosen_escape.get('thirdMove', ''),
                          flush=True)
                    status = 'step_limit'
                    barrier = None
                    two_step_escape = None
                    three_step_escape = None
                    escape_counts = None
                    continue
                break
            if len(path) >= args.max_steps:
                break
            state = np.asarray(best['state'], dtype=np.int32)
            value = best['score']
            path.append({key: best[key] for key in ('score', 'M', 'D', 'mutation')})
            print(ident, len(path), f'{value:.9f}', best['M'], best['D'],
                  best['mutation'], flush=True)
        unique, memory, displaced = bench.se.stats(
            state, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
        results.append({'id': ident + '-descent', 'parent': ident,
                        'state': list(map(int, state)),
                        'ckt12' if args.objective == 'v2' else 'fixedScore': value,
                        'M': int(memory), 'D': int(displaced),
                        'initialScore': archived, 'status': status,
                        'oneStepBarrier': barrier, 'twoStepEscape': two_step_escape,
                        'threeStepEscape': three_step_escape,
                        'escapeCounts': escape_counts, 'escapes': escapes,
                        'path': path, 'scans': scans})
        print('END', ident, status, f'{value:.9f}', len(path), flush=True)
    args.output.write_text(json.dumps({'source': args.search.name, 'objective': args.objective,
                                        'tauMs': tau, 'firstAuxiliaryExtraMs': first_aux,
                                        'secondAuxiliaryExtraMs': second_aux,
                                        'requireEightB': args.require_eight_b,
                                        'requireLoadHome': args.require_load_home,
                                        'maxSteps': args.max_steps,
                                        'escapeWidth': args.escape_width,
                                        'escapeRounds': args.escape_rounds,
                                        'includeMotifCycles': args.include_motif_cycles,
                                        'thirdWidth': args.third_width,
                                        'neighborhoods': ['final-slot swap',
                                                          'physical final-key swap',
                                                          'one-onset remap',
                                                          *(['motif final three-cycle']
                                                            if args.include_motif_cycles else [])],
                                        'results': results},
                                       ensure_ascii=False, separators=(',', ':')) + '\n',
                           encoding='utf-8')
    print('OUTPUT', args.output)


if __name__ == '__main__':
    main()
