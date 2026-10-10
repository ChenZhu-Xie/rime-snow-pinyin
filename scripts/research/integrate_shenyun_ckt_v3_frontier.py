#!/usr/bin/env python3
"""Integrate the 7 reviewed CKT v3 breakthrough frontier schemes into the offline R11 atlas."""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
DEFAULT_REPLAY = Path(os.environ.get('TEMP', '')) / 'rime-21x21-search/R11_integrated_replay'
SCORER = ROOT / 'scripts/research/score_shenyun_completion_ckt.js'

TARGET_IDS = [
    'BCW-52efebf27ff1',
    'BCW-45ead2c51d37',
    'BCW-d976864e1f53',
    'BCW-b77e2d88ac94',
    'BCW-511d69ea162d',
    'BCW-72a9341d2fdc',
    'BCW-5ec69bbb9ec9'
]

META_CONFIG = {
    'BCW-52efebf27ff1': ('21×21 CKT-v3前沿·极速高主行·M46/D3·52efebf27ff1', '高主行极速面突破'),
    'BCW-45ead2c51d37': ('21×21 CKT-v3前沿·高主行均衡·M45/D3·45ead2c51d37', '帕累托支配旗舰'),
    'BCW-d976864e1f53': ('21×21 CKT-v3前沿·极速低小指·M46/D3·d976864e1f53', '极速与低小指联合前沿'),
    'BCW-b77e2d88ac94': ('21×21 CKT-v3前沿·D0极速新纪录·M41/D0·b77e2d88ac94', '零移位新速度纪录'),
    'BCW-511d69ea162d': ('21×21 CKT-v3前沿·M40/D0零移位纪录·M40/D0·511d69ea162d', 'M40/D0零移位心智纪录'),
    'BCW-72a9341d2fdc': ('21×21 CKT-v3前沿·M40/D0高主行·M40/D0·72a9341d2fdc', 'M40/D0深沟壑高主行'),
    'BCW-5ec69bbb9ec9': ('21×21 CKT-v3前沿·M41纯8B破界·M41/D1·5ec69bbb9ec9', 'M41纯8B破界'),
}

from integrate_shenyun_21x21_b_paths import load_benchmark, load_module, new_entry, score_missing_exact
from integrate_shenyun_21x21_completion_fixed_frontier import pack, ensemble, write_payload
from correct_shenyun_completion_word_order import PATHS

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    args = parser.parse_args()

    html_path = args.html.resolve()
    html = html_path.read_text(encoding='utf-8')

    old = load_module('old_21x21_integrator', ROOT / 'scripts/research/integrate_shenyun_21x21_low_miss.py')
    helper = old.load_helper(html_path)
    data, body, end = helper.extract_payload(html)
    existing = {e['id'] for e in data['entries']}

    summary = json.loads((DATA / 'shenyun-21x21-ckt-v3-frontiers-summary.json').read_text(encoding='utf-8'))
    summary_map = {r['id']: r for r in summary}

    elites_scored = json.loads((DATA / 'shenyun-21x21-explored-elites-scored.json').read_text(encoding='utf-8'))
    elites_scored_map = {r['id']: r for r in elites_scored}

    chosen_ids = [i for i in TARGET_IDS if i not in existing]
    if not chosen_ids:
        print(json.dumps({'alreadyIntegrated': True, 'catalogue': len(existing)}))
        return

    print(f'Integrating {len(chosen_ids)} schemes: {chosen_ids}')
    chosen = [summary_map[i] for i in chosen_ids]

    before = helper.preservation_snapshot(data, existing)
    benchmark, historical_fast = load_benchmark(args.replay.resolve())
    from b_path_fast import FastBuckets, NAMES
    current_fast = FastBuckets(benchmark, first_word=True)

    missing = [i for i in chosen_ids if not (args.replay / 'exact' / (i + '.json')).exists()]
    if missing:
        print(f'Scoring missing exact replay files: {missing}')
        score_missing_exact(args.replay, benchmark, {r['id']: (r, '') for r in chosen}, missing)

    frozen = json.loads((DATA / 'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf-8'))['schemes']
    b_baseline = {key: frozen['S005']['modes'][mode][kind][stage] for key, mode, kind, stage in (
        ('j1','keytao','character','p1'),('j2','keytao','character','p2'),
        ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
        ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
        ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))}

    entries, exact = [], {}
    for r in chosen:
        ident = r['id']
        scored = json.loads((args.replay / 'exact' / (ident + '.json')).read_text(encoding='utf-8'))
        expected = benchmark.opt.toentry(np.asarray(r['state'], dtype=np.int32), benchmark.DATA, ident)
        if scored['entry']['codeList'] != expected['codeList']:
            raise ValueError('Code mismatch ' + ident)
        
        name, cohort = META_CONFIG[ident]
        prepared = {**r, 'S2ms': scored['tracks']['S2']['upperMs'], 'v5': scored['scores']['ensembleV5']['score']}
        entry = new_entry(helper, scored, prepared, cohort)
        entry['name'] = name
        entry['subfamily'] = 'AVUIO 锁定·CKT v3 前沿探索'
        entry['source'] = f'Snow Shenyun 21x21 CKT v3 exploration; {cohort}; 4-track closed-loop [1, 3, 1, 1]'
        entry['notes'].append(f'CKT v3 = {r["ckt_v3"]:.5f}; Home = {r["homeS2"]*100:.2f}%; Pmax = {r["Pmax"]*100:.2f}%; 8B worst ratio = {r["eightWorstRatio"]:.4f}.')
        entry['bPathMetrics'] = historical_fast.score(entry['codeList'])
        entry['bPathMetricsNative'] = current_fast.score(entry['codeList'])

        # Check 8B ratios consistency
        for key in NAMES:
            ratio = entry['bPathMetricsNative'][key] / b_baseline[key]
            if abs(ratio - r['bMetricsRatio'][key]) > 1e-6:
                raise ValueError(f'Eight-path ratio mismatch {ident} {key}: {ratio} vs {r["bMetricsRatio"][key]}')

        entries.append(entry)
        exact[ident] = scored

    print('Integrating colliding tracks and load summaries...')
    data = old.integrate_colliding(helper, data, entries, exact, args.replay)
    print('Integrating macroxue...')
    helper.integrate_macroxue(data, entries, args.replay)

    if before != helper.preservation_snapshot(data, existing):
        raise ValueError('Original catalogue changed')

    data['r11Research']['counts']['postR11ResearchExtensions'] += len(entries)
    data['r11Research']['scopeRows'].append([
        'Snow Shenyun fixed IVUAO 21x21 CKT v3 frontier',
        f'{len(entries)} verified CKT v3 breakthrough representatives from 4-campaign high-dimensional exploration'
    ])
    data['fourCodeCollisionBenchmark']['catalogueCount'] = len(data['entries'])
    data['bPathBenchmark']['schemeCount'] = len(data['entries'])

    print('Scoring completion tracks (native, fixed, v2)...')
    with tempfile.TemporaryDirectory(prefix='ckt-v3-integration-') as location:
        temp = Path(location)
        staged = temp / 'scored.html'
        staged.write_text(html[:body] + pack(data) + html[end:], encoding='utf-8')
        result = {}
        for mapping in ('native', 'fixed', 'v2'):
            target = temp / (mapping + '.json')
            cmd = ['node', str(SCORER), '--html', str(staged), '--output', str(target), '--ids', ','.join(chosen_ids), '--mapping', 'fixed' if mapping == 'v2' else mapping]
            if mapping == 'v2':
                cmd.extend(['--model', 'v2'])
            subprocess.run(cmd, check=True, cwd=ROOT)
            result[mapping] = json.loads(target.read_text(encoding='utf-8'))['schemes']

        for r in chosen:
            ident = r['id']
            v2 = result['v2'][ident]
            data['completionBV2']['schemes'][ident] = v2

            for mapping in ('native', 'fixed'):
                block = data['completionB' if mapping == 'native' else 'completionBFixed']
                item = result[mapping][ident]
                block['schemes'][ident] = item
                base = block['schemes']['S005']['modes']
                block['ensembleScores'][ident] = {
                    'equal': {str(t): ensemble(item['modes'], base, t, 1) for t in (0, 150, 300, 600)},
                    'word2': {str(t): ensemble(item['modes'], base, t, 2) for t in (0, 150, 300, 600)},
                }

            # Populate completionBV3
            if 'completionBV3' in data:
                r_v3 = elites_scored_map[ident]
                data['completionBV3']['schemes'][ident] = {
                    'capacity': [21, 21],
                    'tone': 'IVUAO',
                    'modes': r_v3['modes']
                }

        all_ids = {e['id'] for e in data['entries']}
        if len(all_ids) != len(existing) + len(chosen_ids):
            raise ValueError('Catalogue mismatch')
        for name in ('completionB', 'completionBFixed', 'completionBV2', 'completionBV3'):
            if set(data[name]['schemes']) != all_ids:
                raise ValueError(f'Catalogue mismatch in {name}')

        print(f'Writing updated payload with {len(data["entries"])} schemes to {html_path}...')
        write_payload(html_path, html, body, end, data)

    print('Integration completed successfully!')
    print(json.dumps({'added': chosen_ids, 'catalogue': len(data['entries'])}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
