#!/usr/bin/env python3
"""Search short D1/D0 paths while preserving complementary B-metric poles."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'


def resolve_output_path(path: Path) -> Path:
    """Resolve CLI output before the scorer changes its working directory."""
    return path.resolve()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--search', type=Path, required=True)
    parser.add_argument('--ids', nargs='+', required=True)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    parser.add_argument('--depth', type=int, default=4)
    parser.add_argument('--beam-per-d', type=int, default=8)
    parser.add_argument('--max-m', type=int, default=42)
    parser.add_argument('--max-d', type=int, default=1)
    parser.add_argument('--include-motif-cycles', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if min(args.depth, args.beam_per_d, args.max_m) < 1 or args.max_d < 0:
        parser.error('depth, beam width and caps must be positive')
    args.output = resolve_output_path(args.output)

    source = json.loads(args.search.read_text(encoding='utf-8'))
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
    from b_path_fast import FastBuckets, NAMES
    from completion_motifs import motif_final_positions
    from completion_onset_strata import select_stratified_beam

    frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(
        encoding='utf-8'))['schemes']
    baseline = {key: frozen['S005']['modes'][mode][kind][stage]
                for key, mode, kind, stage in (
                    ('j1', 'keytao', 'character', 'p1'),
                    ('j2', 'keytao', 'character', 'p2'),
                    ('s1', 'sanpin', 'character', 'p1'),
                    ('s2', 'sanpin', 'character', 'p2'),
                    ('wj1', 'keytao', 'word', 'p1'),
                    ('wj2', 'keytao', 'word', 'p2'),
                    ('ws1', 'sanpin', 'word', 'p1'),
                    ('ws2', 'sanpin', 'word', 'p2'))}
    buckets = FastBuckets(bench, first_word=True)
    auxiliary = {bench.opt.META['keys'].index(key) for key in 'IVUAO'}
    physical = [key for key in range(26) if key not in auxiliary]
    cycle_positions = motif_final_positions(bench.opt.META['finals'])
    objective_keys = ('eightWorstRatio', 'wordExcess',
                      'wj1Ratio', 'wj2Ratio', 'ws1Ratio', 'ws2Ratio')

    def neighbors(state):
        for i in range(27, 62):
            for j in range(i + 1, 62):
                candidate = state.copy()
                candidate[i], candidate[j] = candidate[j], candidate[i]
                yield candidate, f'final-slot:{i}:{j}'
        for offset, left in enumerate(physical):
            for right in physical[offset + 1:]:
                candidate = state.copy()
                bench.opt.swapkeys(candidate, 27, 62, left, right)
                yield candidate, f'final-key:{left}:{right}'
        for position in range(27):
            for key in physical:
                if key != int(state[position]):
                    candidate = state.copy()
                    candidate[position] = key
                    yield candidate, f'onset:{position}:{key}'
        if args.include_motif_cycles:
            for left_index, left in enumerate(cycle_positions):
                for middle_index in range(left_index + 1, len(cycle_positions)):
                    middle = cycle_positions[middle_index]
                    for right in cycle_positions[middle_index + 1:]:
                        candidate = state.copy()
                        candidate[left], candidate[middle], candidate[right] = (
                            state[right], state[left], state[middle])
                        yield candidate, f'final-cycle:{left}:{middle}:{right}:right'
                        candidate = state.copy()
                        candidate[left], candidate[middle], candidate[right] = (
                            state[middle], state[right], state[left])
                        yield candidate, f'final-cycle:{left}:{middle}:{right}:left'

    visited = set()
    all_rows = {}

    def score(state, parent, move, depth, counts):
        signature = tuple(map(int, state))
        if signature in visited:
            counts['duplicate'] += 1
            return None
        visited.add(signature)
        counts['generated'] += 1
        unique, memory, displaced = bench.se.stats(
            state, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
        if unique < 0 or memory > args.max_m or displaced > args.max_d:
            counts['outsideCap'] += 1
            return None
        counts['legal'] += 1
        codes = bench.opt.toentry(state, bench.DATA, 'proposal')['codeList']
        metrics = buckets.score(codes)
        ratios = {key: metrics[key] / baseline[key] for key in NAMES}
        worst = max(ratios.values())
        word_excess = sum(max(0, ratios[key] - 1)
                          for key in ('wj1', 'wj2', 'ws1', 'ws2'))
        ident = 'BCW-' + hashlib.sha256(state.tobytes()).hexdigest()[:12]
        row = {'id': ident, 'parent': parent, 'move': move, 'depth': depth,
               'state': list(signature), 'M': int(memory), 'D': int(displaced),
               'unique399': int(unique), 'eightWorstRatio': worst,
               'wordExcess': word_excess,
               **{key + 'Ratio': ratios[key] for key in NAMES}, **metrics}
        all_rows[signature] = row
        if worst < 1:
            counts['allEight'] += 1
        return row

    beam = []
    for ident in args.ids:
        seed = dict(seeds[ident])
        ratios = {key: seed[key] / baseline[key] for key in NAMES}
        seed.update({'depth': 0, 'parent': None, 'move': None,
                     'eightWorstRatio': max(ratios.values()),
                     'wordExcess': sum(max(0, ratios[key] - 1)
                                       for key in ('wj1', 'wj2', 'ws1', 'ws2')),
                     **{key + 'Ratio': ratios[key] for key in NAMES}})
        signature = tuple(seed['state'])
        visited.add(signature)
        all_rows[signature] = seed
        beam.append(seed)

    layers = []
    for depth in range(1, args.depth + 1):
        counts = Counter()
        candidates = []
        for parent in beam:
            state = np.asarray(parent['state'], dtype=np.int32)
            for candidate, move in neighbors(state):
                row = score(candidate, parent['id'], move, depth, counts)
                if row is not None:
                    candidates.append(row)
        beam = select_stratified_beam(candidates, args.beam_per_d, objective_keys)
        best_by_d = {}
        for displaced in range(args.max_d + 1):
            subset = [row for row in candidates if row['D'] == displaced]
            if subset:
                best = min(subset, key=lambda row: row['eightWorstRatio'])
                best_by_d[str(displaced)] = {
                    'id': best['id'], 'ratio': best['eightWorstRatio'],
                    'M': best['M'], 'wordExcess': best['wordExcess']}
        summary = {'depth': depth, 'parents': len(set(row['parent'] for row in candidates)),
                   'candidates': len(candidates), 'beam': len(beam),
                   'counts': dict(counts), 'bestByD': best_by_d}
        layers.append(summary)
        print('LAYER', json.dumps(summary, separators=(',', ':')), flush=True)
        if not beam:
            break

    results = select_stratified_beam(list(all_rows.values()), 100, objective_keys)
    for seed in seeds.values():
        if seed['id'] not in {row['id'] for row in results}:
            results.append(all_rows[tuple(seed['state'])])
    payload = {'source': args.search.name, 'seedIds': args.ids,
               'depth': args.depth, 'beamPerD': args.beam_per_d,
               'maxM': args.max_m, 'maxD': args.max_d,
               'includeMotifCycles': args.include_motif_cycles,
               'objectiveKeys': objective_keys, 'layers': layers,
               'visited': len(visited), 'scored': len(all_rows), 'results': results}
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('OUTPUT', args.output, len(results), flush=True)


if __name__ == '__main__':
    main()
