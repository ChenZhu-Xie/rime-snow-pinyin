#!/usr/bin/env python3
"""Integrate Round 4 (4A+4B+4C) high-value seeds, frontier, basin, and canyon schemes into the offline R11 atlas."""
from __future__ import annotations
import argparse
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
    # 1. Global Speed Pinnacle & Key Seeds (D=4)
    'BCW-f420619c19db',  # 9.57109 M45/D4 Global Speed Pinnacle & Primary Seed (8B=1.0042)
    'BCW-d18a30c7ca84',  # 9.57431 M45/D4 High-Home Speed Runner-Up (Home=43.74%, 8B=1.0043)
    'BCW-ee2924bf75d6',  # 9.57461 M45/D4 Secondary Speed Seed (S2ms=68.34ms)
    'BCW-e20b131daf85',  # 9.57568 M45/D4 Ultra-Fast S2ms (68.17ms) Speed Flagship
    # 2. Pure 8B (< 1.0000) Speed Pinnacle (D=4 & D=3)
    'BCW-4f7b475cca86',  # 9.57392 M45/D4 Global Pure 8B (< 1.0000) Speed Pinnacle
    'BCW-af71075edb2d',  # 9.57447 M45/D4 Pure 8B Speed Runner-Up (S2ms=69.33ms)
    'BCW-34dd9890bd1b',  # 9.57798 M45/D4 Pure 8B Fastest Single-Char S2ms (68.83ms)
    'BCW-1e7bff4b6512',  # 9.60110 M44/D3 D<=3 Pure 8B (< 1.0000) Speed Champion
    'BCW-cb37113b38ff',  # 9.60112 M44/D3 D<=3 Pure 8B High-Home Runner-Up (Home=40.39%)
    # 3. D<=3 Speed Frontier
    'BCW-865b326cd700',  # 9.58403 M44/D3 D<=3 Speed Pinnacle
    'BCW-618ed33d99d7',  # 9.58448 M44/D3 D<=3 Speed Runner-Up
    'BCW-5cc76bebb7e9',  # 9.58705 M44/D3 D<=3 High-Home (43.74%) & Fast S2ms (68.47ms) Graft
    # 4. Low-Pinky (Pmax <= 5.1%) & Dual-Gated Ergonomic (Home >= 50% & Pmax <= 5.1%) Basin
    'BCW-695b434e897f',  # 9.58898 M45/D4 Low-Pinky (Pmax=4.15%) Speed Pinnacle
    'BCW-0612e4476c25',  # 9.59082 M45/D4 Dual-Gated Ergonomic (Home=52.87%, Pmax=4.15%) Pinnacle
    'BCW-6b1cc27a7754',  # 9.61373 M44/D3 D<=3 Dual-Gated Ergonomic (Home=52.87%, Pmax=4.56%) Champion
    'BCW-d632acb6efb5',  # 9.62002 M45/D4 Ultra-High Home Row (Home=53.43%, Pmax=4.56%) Champion
    'BCW-cf5b93b6f0f2',  # 9.62408 M43/D2 D=2 Low-Pinky (Pmax=4.03%, Home=46.01%) Speed Champion
    'BCW-1b52baf9e888',  # 9.64504 M44/D3 D<=3 Ultra-Low-Pinky Dual-Gated (Pmax=3.42%, Home=50.54%, 8B=1.0078)
    'BCW-6b733a54e711',  # 9.66555 M43/D2 D=2 Ultra-Low-Pinky (Pmax=3.13%, Home=46.94%, 8B=1.0079) Champion
    'BCW-9a856552678a',  # 9.66771 M43/D2 D=2 Ultra-Low-Pinky Primary Seed (Pmax=3.13%, 8B=1.0078)
    'BCW-233a0ea09076',  # 9.66826 M43/D2 D<=2 Dual-Gated Ergonomic (Home=50.86%, Pmax=3.42%) Seed & Champion
    # 5. D=1 Canyon Bridge & D=0 Zero-Displacement / Low-M Frontier
    'BCW-9bb794f486aa',  # 9.66837 M41/D1 D=1 Canyon Bridge Speed Champion (M=41)
    'BCW-135c591af5a3',  # 9.66909 M42/D1 D=1 Canyon Bridge Primary Seed (Home=40.63%)
    'BCW-f7538fe6f956',  # 9.71007 M41/D0 D=0 Zero-Displacement Speed Pinnacle
    'BCW-2dd583d61844',  # 9.71203 M41/D0 D=0 Zero-Displacement Fast S2ms (70.24ms) Runner-Up
    'BCW-1a11061c8293',  # 9.72004 M40/D0 M<=40 D=0 Ultra-Low Memory Speed Champion
    'BCW-2662bd325b7d',  # 9.77384 M39/D0 M<=39 D=0 Ultra-Low Memory New Seed
]

META_CONFIG = {
    'BCW-f420619c19db': ('21×21 CKT-v3前沿·全域极速新巅峰·M45/D4·f420619c19db', '全域极速新巅峰·破9.572大关'),
    'BCW-d18a30c7ca84': ('21×21 CKT-v3前沿·极速高主行亚军·M45/D4·d18a30c7ca84', '全域极速亚军·Home=43.74%'),
    'BCW-ee2924bf75d6': ('21×21 CKT-v3前沿·极速核心种子·M45/D4·ee2924bf75d6', 'D4极速声母核心种子·S2ms=68.34ms'),
    'BCW-e20b131daf85': ('21×21 CKT-v3前沿·单字极速双优旗舰·M45/D4·e20b131daf85', 'S2ms=68.17ms单字+综合双极速'),
    'BCW-4f7b475cca86': ('21×21 CKT-v3前沿·全绿8B极速新巅峰·M45/D4·4f7b475cca86', '全绿Pure-8B极速新巅峰·9.5739'),
    'BCW-af71075edb2d': ('21×21 CKT-v3前沿·全绿8B极速亚军·M45/D4·af71075edb2d', '全绿Pure-8B极速亚军·9.5745'),
    'BCW-34dd9890bd1b': ('21×21 CKT-v3前沿·全绿8B单字极速冠·M45/D4·34dd9890bd1b', '全绿Pure-8B单字S2ms=68.83ms冠军'),
    'BCW-1e7bff4b6512': ('21×21 CKT-v3前沿·D3全绿8B新冠军·M44/D3·1e7bff4b6512', 'D≤3全绿Pure-8B速度新冠军'),
    'BCW-cb37113b38ff': ('21×21 CKT-v3前沿·D3全绿8B均衡冠·M44/D3·cb37113b38ff', 'D≤3全绿Pure-8B高主行亚军'),
    'BCW-865b326cd700': ('21×21 CKT-v3前沿·D3极速新纪录·M44/D3·865b326cd700', 'D≤3极速新纪录·9.5840'),
    'BCW-618ed33d99d7': ('21×21 CKT-v3前沿·D3极速亚军·M44/D3·618ed33d99d7', 'D≤3极速亚军·9.5845'),
    'BCW-5cc76bebb7e9': ('21×21 CKT-v3前沿·D3单字极速旗舰·M44/D3·5cc76bebb7e9', 'D≤3单字S2ms=68.47ms+Home=43.74%'),
    'BCW-695b434e897f': ('21×21 CKT-v3前沿·低小指极速巅峰·M45/D4·695b434e897f', '低小指(Pmax=4.15%)破9.59极速巅峰'),
    'BCW-0612e4476c25': ('21×21 CKT-v3前沿·双门限工学极速冠·M45/D4·0612e4476c25', 'Home=52.87%+Pmax=4.15%工学极速巅峰'),
    'BCW-6b1cc27a7754': ('21×21 CKT-v3前沿·D3双门限工学旗舰·M44/D3·6b1cc27a7754', 'D≤3高主行(52.87%)低小指旗舰'),
    'BCW-d632acb6efb5': ('21×21 CKT-v3前沿·超高主行工学冠·M45/D4·d632acb6efb5', 'Home=53.43%+Pmax=4.56%超高主行冠'),
    'BCW-cf5b93b6f0f2': ('21×21 CKT-v3前沿·D2低小指速度冠·M43/D2·cf5b93b6f0f2', 'D=2低小指(Pmax=4.03%)速度新冠'),
    'BCW-1b52baf9e888': ('21×21 CKT-v3前沿·D3超低小指工学冠·M44/D3·1b52baf9e888', 'D≤3超低小指(Pmax=3.42%,Home=50.54%)'),
    'BCW-6b733a54e711': ('21×21 CKT-v3前沿·D2超低小指冠军·M43/D2·6b733a54e711', 'D=2超低小指(Pmax=3.13%)速度冠军'),
    'BCW-9a856552678a': ('21×21 CKT-v3前沿·超低小指母本种子·M43/D2·9a856552678a', 'Pmax=3.13%低小指核心韵母母本种子'),
    'BCW-233a0ea09076': ('21×21 CKT-v3前沿·D2双门限工学冠·M43/D2·233a0ea09076', 'D≤2双门限工学(Home=50.86%,Pmax=3.42%)母本'),
    'BCW-9bb794f486aa': ('21×21 CKT-v3前沿·D1沟壑跨越新冠·M41/D1·9bb794f486aa', 'D=1断层沟壑跨越新纪录·M41/D1'),
    'BCW-135c591af5a3': ('21×21 CKT-v3前沿·D1沟壑桥接母本·M42/D1·135c591af5a3', 'D=1声母桥接核心种子·Home=40.63%'),
    'BCW-f7538fe6f956': ('21×21 CKT-v3前沿·D0零位移新巅峰·M41/D0·f7538fe6f956', 'D=0零声母位移速度新巅峰·9.7101'),
    'BCW-2dd583d61844': ('21×21 CKT-v3前沿·D0零位移亚军·M41/D0·2dd583d61844', 'D=0零声母位移亚军·S2ms=70.24ms'),
    'BCW-1a11061c8293': ('21×21 CKT-v3前沿·M40/D0破9.72新冠·M40/D0·1a11061c8293', 'M≤40/D=0极低心智新纪录·9.7200'),
    'BCW-2662bd325b7d': ('21×21 CKT-v3前沿·M39/D0超低心智新种·M39/D0·2662bd325b7d', 'M=39/D=0超低心智负担新种子'),
}

from integrate_shenyun_21x21_b_paths import load_benchmark, load_module, new_entry, score_missing_exact
from integrate_shenyun_21x21_completion_fixed_frontier import pack, ensemble, write_payload

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

    summary = json.loads((DATA / 'shenyun-21x21-round4-summary.json').read_text(encoding='utf-8'))
    summary_map = {r['id']: r for r in summary}

    chosen_ids = [i for i in TARGET_IDS if i not in existing]
    if not chosen_ids:
        print(json.dumps({'alreadyIntegrated': True, 'catalogue': len(existing)}))
        return

    print(f'Integrating {len(chosen_ids)} additional Round 4 schemes: {chosen_ids}')
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
        entry['source'] = f'Snow Shenyun 21x21 CKT v3 Round 4; {cohort}; 4-track closed-loop [1, 3, 1, 1]'
        entry['notes'].append(f'CKT v3 = {r["ckt_v3"]:.5f}; Home = {r["homeS2"]*100:.2f}%; Pmax = {r["Pmax"]*100:.2f}%; 8B worst ratio = {r["eightWorstRatio"]:.4f}.')
        entry['bPathMetrics'] = historical_fast.score(entry['codeList'])
        entry['bPathMetricsNative'] = current_fast.score(entry['codeList'])

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
    data['fourCodeCollisionBenchmark']['catalogueCount'] = len(data['entries'])
    data['bPathBenchmark']['schemeCount'] = len(data['entries'])

    print('Scoring completion tracks (native, fixed, v2)...')
    with tempfile.TemporaryDirectory(prefix='ckt-v3-round4-') as location:
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

            if 'completionBV3' in data:
                data['completionBV3']['schemes'][ident] = {
                    'capacity': [21, 21],
                    'tone': 'IVUAO',
                    'modes': r['modes']
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
