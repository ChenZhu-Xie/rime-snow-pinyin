#!/usr/bin/env python3
"""Recheck a 21x21 experiment against the frozen HTML and replay corpus."""
from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]

def load_html(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    match = re.search(r'<script id="payload"[^>]*>(.*?)</script>', text, re.DOTALL)
    if not match:
        raise ValueError('Benchmark HTML payload was not found')
    return json.loads(gzip.decompress(base64.b64decode(match.group(1))))

def near(actual: float, expected: float, label: str, tolerance: float = 1e-9) -> None:
    if not math.isclose(actual, expected, rel_tol=0, abs_tol=tolerance):
        raise AssertionError(f'{label}: {actual} != {expected}')

def check(data: dict, exact: dict, replay: Path, require_dominance: bool = True) -> dict:
    entry = exact['entry']
    assert entry['tone'] == 'IVUAO', entry['tone']
    assert entry['capacity'] == [21, 21], entry['capacity']
    assert len(entry['codeList']) == len(data['pinyin'])
    reserve = set('AVUIO')
    codes = [(entry['codeList'][p], weight) for p, weight in data['base']]
    assert len(codes) == 399 and all(code and len(code) == 2 for code, _ in codes)
    first = {code[0] for code, _ in codes}
    second = {code[1] for code, _ in codes}
    assert len(first) == len(second) == 21 and first.isdisjoint(reserve) and second.isdisjoint(reserve)
    buckets: dict[str, list[float]] = {}
    for code, weight in codes:
        buckets.setdefault(code, []).append(weight)
    miss = sum(sum(masses) - max(masses) for masses in buckets.values()) / sum(w for _, w in codes)
    near(miss, exact['tracks']['S2']['miss'], 'frequency weighted S2 nonfirst')
    assert len(buckets) == exact['fair']['unique399']
    threshold = data['ckt']['tracks']['S005']['S2']['miss']
    assert miss < threshold, (miss, threshold)
    tracks = exact['tracks']
    v5 = data['ensembleV5']
    score5 = 10 * sum(w * (tracks[t]['upperMs'] / v5['baselines'][t]) ** 4
                      for t, w in v5['trackWeights'].items()) ** .25
    near(score5, exact['scores']['ensembleV5']['score'], 'v5')
    v4 = data['ensembleV4']
    score4 = 10 * sum(w * .5 * (exact['pairs'][t][model] / v4['baselines'][t+'|'+model]) ** 4
                      for t, w in v4['trackWeights'].items() for model in ('e34','geometry')) ** .25
    near(score4, exact['scores']['ensembleV4']['score'], 'v4')
    baseline = data['ckt']['tracks']['S005']
    weights = {t: w * 1.5 for t, w in v5['trackWeights'].items() if t != 'S2'}
    score6 = 10 * sum(w * ((tracks[t]['upperMs'] + 150 * tracks[t]['miss']) /
                                (baseline[t]['upperMs'] + 150 * baseline[t]['miss'])) ** 4
                      for t, w in weights.items()) ** .25
    sys.path.insert(0, str(replay))
    import opt
    import search_engine as se
    old_cwd = Path.cwd()
    try:
        os.chdir(replay)  # The frozen replay imports source.json relative to cwd.
        import r5_search as r5
    finally:
        os.chdir(old_cwd)
    source = json.loads((replay/'source.json').read_text(encoding='utf8'))
    assert source['base'] == data['base'] and source['pinyin'] == data['pinyin']
    for baseline_id in ('S005', 'R9-21X21-M40-02'):
        assert source['ckt']['tracks'][baseline_id] == data['ckt']['tracks'][baseline_id]
    for version in ('ensembleV4', 'ensembleV5'):
        for name in ('baselines', 'trackWeights'):
            assert source[version][name] == data[version][name]
    state = opt.state(entry, source)
    unique, memory, displaced = se.stats(state, opt.PARAMS[-2], opt.PARAMS[-1], 21, 3, 1)
    assert unique == len(buckets)
    vowels = int(r5.vowelD(state))
    home = r5.home(state)
    wpeak, ypeak = r5.wy(state)
    right_peak = r5.rp(state)[1]
    from macroxue.engine import evaluate
    corpus = json.loads((replay/'R9_corpora.json').read_text(encoding='utf-8'))
    index = {p: i for i, p in enumerate(data['pinyin'])}
    mx = {}
    for name, contract in corpus.items():
        tokens = [t for t in contract['tokens'] if 'pinyin' in t]
        stroke = ''.join(entry['codeList'][index[t['pinyin']]].lower() for t in tokens)
        mx[name] = evaluate(stroke, len(tokens))['score']
    r9 = 'R9-21X21-M40-02'
    reference = data['ckt']['tracks'][r9]
    if require_dominance:
        assert tracks['S2']['upperMs'] < reference['S2']['upperMs']
        assert score5 < data['ensembleV5']['values'][r9]['score']
        assert score4 < data['ensembleV4']['values'][r9]['score']
        assert score6 < data['ensembleV6']['values'][r9]['score']
        assert mx['daily'] > data['macroxue']['values'][r9]['daily|hanzi-only']['score']
    return {'id': exact['id'], 'toneOrder': entry['tone'], 'unique':len(buckets),
            'M':int(memory),'D':int(displaced),'V':vowels,
            'S2home':float(home[0]),'C4home':float(home[1]),'WXhome':float(home[2]),
            'Wpeak20':float(wpeak),'Ypeak20':float(ypeak),'rightPinkyPeak20':float(right_peak),
            'S2miss': miss, 'S005limit': threshold, 'S2ms': tracks['S2']['upperMs'],
            'v5':score5, 'v4':score4, 'v6':score6, 'MXdailyHanzi':mx['daily'],
            'MXdefaultHanzi':mx['default'], 'charMiss':tracks['C4-Snow']['miss'],
            'wordMiss':tracks['WX-Snow-12']['miss']}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark', type=Path, required=True)
    parser.add_argument('--replay', type=Path, required=True)
    parser.add_argument('--exact', type=Path, default=HERE/'research-notes/data/shenyun-21x21-low-miss-exact.json')
    parser.add_argument('--allow-tradeoffs', action='store_true', help='Verify an exploratory candidate without requiring all five scores to beat R9')
    args = parser.parse_args()
    print(json.dumps(check(load_html(args.benchmark), json.loads(args.exact.read_text(encoding='utf8')),
                           args.replay, not args.allow_tradeoffs), ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
