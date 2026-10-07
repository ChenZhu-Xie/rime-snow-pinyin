"""Scan one-step neighbors of fixed-IVUAO 21x21 CKT frontier states.

The neighborhoods are final-slot transpositions, physical final-key
transpositions, and one-onset remaps. They do not cover the full search space.
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
    parser.add_argument('--search', type=Path, default=DATA / 'shenyun-21x21-completion-fixed-counterpole-600-search.json')
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    parser.add_argument('--ids', nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output = args.output.resolve()
    source = json.loads(args.search.read_text(encoding='utf-8'))
    selected = {r['id']: r for r in source['results'] if r['id'] in args.ids}
    if set(selected) != set(args.ids):
        raise ValueError('Some requested IDs are absent from saved results')
    for name in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
        os.environ[name] = '1'
    replay = args.replay.resolve()
    os.chdir(replay)
    sys.path[:0] = [str(replay), str(ROOT / 'scripts/research')]
    sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(replay),
                '--output', str(DATA / 'shenyun-21x21-b-sets-benchmark.json')]
    spec = importlib.util.spec_from_file_location('b_sets', ROOT / 'scripts/research/benchmark_shenyun_21x21_b_sets.py')
    bench = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(bench)
    import numpy as np
    from fast_completion_word2 import FastCompletion

    html = args.html.resolve()
    text = html.read_text(encoding='utf-8')
    match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
    assert match
    page = json.loads(gzip.decompress(base64.b64decode(match[1])))
    reference = page['completionBFixed']['schemes']['S005']['modes']
    denominators = [reference[mode][kind]['completionUpperMs'] + source['tauMs'] * reference[mode][kind]['p2']
                    for mode, kind in (('keytao', 'character'), ('sanpin', 'character'),
                                       ('keytao', 'word'), ('sanpin', 'word'))]
    scorer = FastCompletion(bench, html, first_word=True, v2=False)
    aux = {bench.opt.META['keys'].index(key) for key in 'IVUAO'}
    keys = [key for key in range(26) if key not in aux]

    def score(st):
        times, p2 = scorer.score(st)
        return float(10 * (sum(weight * ((times[i] + source['tauMs'] * p2[i]) / denominators[i])**4
                               for i, weight in enumerate((1, 1, 2, 2))) / 6)**.25)

    results = []
    for ident in args.ids:
        seed = selected[ident]
        state = np.asarray(seed['state'], np.int32)
        original = score(state)
        if abs(original - seed['fixed12']) > 1e-9:
            raise ValueError(f'Seed mismatch for {ident}: {original} vs {seed["fixed12"]}')
        counts = {'generated': 0, 'legal': 0, 'underCap': 0, 'improving': 0}
        improvements = []
        seen = set()

        def visit(candidate, mutation):
            signature = tuple(map(int, candidate))
            if signature in seen or np.array_equal(candidate, state):
                return
            seen.add(signature)
            counts['generated'] += 1
            unique, m, d = bench.se.stats(candidate, bench.opt.PARAMS[-2], bench.opt.PARAMS[-1], 21, 7, 1)
            if unique < 0 or m > 48 or d > 7:
                return
            counts['legal'] += 1
            if m > seed['M'] or d > seed['D']:
                return
            counts['underCap'] += 1
            value = score(candidate)
            if value + 1e-9 < original:
                counts['improving'] += 1
                improvements.append({'score': value, 'M': int(m), 'D': int(d), 'mutation': mutation,
                                     'state': list(signature)})

        for i in range(27, 62):
            for j in range(i + 1, 62):
                proposal = state.copy()
                proposal[i], proposal[j] = proposal[j], proposal[i]
                visit(proposal, f'final-slot:{i}:{j}')
        for position, left in enumerate(keys):
            for right in keys[position + 1:]:
                proposal = state.copy()
                bench.opt.swapkeys(proposal, 27, 62, left, right)
                visit(proposal, f'final-key:{left}:{right}')
        for i in range(27):
            for key in keys:
                if key != int(state[i]):
                    proposal = state.copy()
                    proposal[i] = key
                    visit(proposal, f'onset:{i}:{key}')
        improvements.sort(key=lambda r: r['score'])
        result = {'id': ident, 'M': seed['M'], 'D': seed['D'], 'baseline': original,
                  'counts': counts, 'best': improvements[0] if improvements else None,
                  'topImprovements': improvements[:10]}
        results.append(result)
        print(ident, counts, 'best', improvements[0]['score'] if improvements else None, flush=True)
    args.output.write_text(json.dumps({'source': args.search.name, 'neighborhoods': [
        'final-slot swap', 'global physical final-key swap', 'one-onset physical remap'],
        'results': results}, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print('OUTPUT', args.output)


if __name__ == '__main__':
    main()
