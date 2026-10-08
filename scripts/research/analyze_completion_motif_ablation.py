#!/usr/bin/env python3
"""Measure single-swap effects of observed final-key motifs around frontier rows."""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
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
    parser.add_argument('--ids', nargs='+', required=True)
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.search = args.search.resolve()
    args.html = args.html.resolve()
    args.replay = args.replay.resolve()
    args.output = args.output.resolve()

    source = json.loads(args.search.read_text(encoding='utf-8'))
    lookup = {row['id']: row for row in source['results']}
    missing = [ident for ident in args.ids if ident not in lookup]
    if missing:
        parser.error('missing IDs: ' + ', '.join(missing))
    for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
        os.environ[key] = '1'
    replay = args.replay
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
    from completion_motifs import MOTIFS
    from fast_completion_word2 import FastCompletion

    html = args.html.read_text(encoding='utf-8')
    match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', html)
    assert match
    page = json.loads(gzip.decompress(base64.b64decode(match[1])))
    baseline = page['completionBV2']['schemes']['S005']['modes']
    frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(
        encoding='utf-8'))['schemes']
    b_baseline = {key: frozen['S005']['modes'][mode][kind][stage]
                  for key, mode, kind, stage in (
                      ('j1', 'keytao', 'character', 'p1'),
                      ('j2', 'keytao', 'character', 'p2'),
                      ('s1', 'sanpin', 'character', 'p1'),
                      ('s2', 'sanpin', 'character', 'p2'),
                      ('wj1', 'keytao', 'word', 'p1'),
                      ('wj2', 'keytao', 'word', 'p2'),
                      ('ws1', 'sanpin', 'word', 'p1'),
                      ('ws2', 'sanpin', 'word', 'p2'))}
    p_cap = frozen['R9-21X21-M40-02']['rightPinkyMax']
    tau = source.get('tauMs', 600)
    first_aux = source.get('firstAuxiliaryExtraMs', 300)
    second_aux = source.get('secondAuxiliaryExtraMs', 300)
    scorer = FastCompletion(bench, args.html.resolve(), first_word=True, v2=True)
    buckets = FastBuckets(bench, first_word=True)
    finals = bench.opt.META['finals']
    keys = bench.opt.META['keys']

    denominators = []
    for mode, kind in (('keytao', 'character'), ('sanpin', 'character'),
                       ('keytao', 'word'), ('sanpin', 'word')):
        row = baseline[mode][kind]
        first = 1 - row['stageWeight'][0]
        second = row['meanKeys'] - (4 if kind == 'word' else 2) - first
        denominators.append(row['completionUpperMs'] + tau * row['p2']
                            + first_aux * first + second_aux * second)

    def metrics(state):
        times, misses, first_counts, second_counts = scorer.score(state)
        ckt = float(10 * (sum(weight * ((times[i] + tau * misses[i]
                                         + first_aux * first_counts[i]
                                         + second_aux * second_counts[i])
                                        / denominators[i]) ** 4
                              for i, weight in enumerate((1, 1, 2, 2))) / 6) ** .25)
        unique, memory, displaced = bench.se.stats(
            state, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
        bm = buckets.score(bench.opt.toentry(state, bench.DATA, 'ablation')['codeList'])
        factors = bench.opt.metrics(bench.opt.initialize(state, bench.opt.PARAMS)[1],
                                    bench.opt.PARAMS)
        worst = max(bm[key] / b_baseline[key] for key in NAMES)
        pmax = float(bench.r5.rp(state)[1])
        home = float(bench.r5.home(state)[0])
        return {
            'id': 'BCW-' + hashlib.sha256(state.tobytes()).hexdigest()[:12],
            'ckt12': ckt, 'M': int(memory), 'D': int(displaced),
            'unique399': int(unique), 'eightWorstRatio': worst,
            'Pmax': pmax, 'homeS2': home, 'S2ms': float(factors[0]),
            'v5': float(factors[1]), 'v4': float(factors[2]), **bm,
            'allEight': worst < 1,
            'strictLoadHome': worst < 1 and pmax <= p_cap + 1e-12 and home >= .5,
        }

    results = []
    for ident in args.ids:
        seed = lookup[ident]
        state = np.asarray(seed['state'], dtype=np.int32)
        base = metrics(state)
        if abs(base['ckt12'] - seed['ckt12']) > 1e-9:
            raise ValueError(f'Archived score mismatch: {ident}')
        variants = []
        for profile, motif in MOTIFS.items():
            for final, target_key in motif.items():
                final_position = 27 + finals.index(final)
                target = keys.index(target_key)
                candidates = []
                if int(state[final_position]) == target:
                    candidate = state.copy()
                    row = metrics(candidate)
                    row.update({'profile': profile, 'final': final, 'targetKey': target_key,
                                'swapFinal': final, 'alreadyPresent': True})
                    candidates.append(row)
                else:
                    for position in range(27, 62):
                        if int(state[position]) != target:
                            continue
                        candidate = state.copy()
                        candidate[final_position], candidate[position] = (
                            candidate[position], candidate[final_position])
                        row = metrics(candidate)
                        row.update({'profile': profile, 'final': final, 'targetKey': target_key,
                                    'swapFinal': finals[position - 27],
                                    'alreadyPresent': False})
                        candidates.append(row)
                for row in candidates:
                    row['underSeedCap'] = row['M'] <= seed['M'] and row['D'] <= seed['D']
                    for field in ('ckt12', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v5', 'v4'):
                        row['delta' + field[0].upper() + field[1:]] = row[field] - base[field]
                variants.extend(candidates)
        results.append({'id': ident, 'base': base, 'variants': variants})

    output = {
        'purpose': __doc__, 'source': str(args.search), 'tauMs': tau,
        'firstAuxiliaryExtraMs': first_aux, 'secondAuxiliaryExtraMs': second_aux,
        'pCap': p_cap, 'results': results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n',
                           encoding='utf-8')
    print(json.dumps({'output': str(args.output.resolve()),
                      'seeds': len(results),
                      'variants': sum(len(row['variants']) for row in results)},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
