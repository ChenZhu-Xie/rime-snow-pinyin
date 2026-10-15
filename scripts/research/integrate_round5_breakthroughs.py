#!/usr/bin/env python3
"""Integrate Round 5 (5A+5B+5C+5D) high-value seeds, super-initial basins, Triple-Crown schemes, and frontier champions into a7_CKT_R11.html."""
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
DEFAULT_REPLAY = Path(os.environ.get("RIME_RESEARCH_REPLAY_DIR", Path(__file__).resolve().parents[2] / ".research-cache" / "R11_integrated_replay"))
SCORER = ROOT / 'scripts/research/score_shenyun_completion_ckt.js'

TARGET_IDS = [
    # 1. Global Speed Pinnacle (< 9.559) & Super-Initial Speed Seeds (D=5)
    'BCW-c006bc0bcfc0',  # 9.55465 M46/D5 Global #1 Speed Pinnacle & High-Home (Home=47.09%, 8B=1.0039)
    'BCW-cdf451dbb5af',  # 9.55477 M46/D5 Global #2 Speed & First Sub-68ms S2ms (67.96ms)
    'BCW-2992c2dd117a',  # 9.55503 M46/D5 Round 5B Sub-9.555 Primary Speed Seed (S2ms=67.97ms)
    'BCW-de550fbc54f2',  # 9.55539 M46/D5 High-Home Speed Runner-Up (Home=47.09%, 8B=1.0039)
    'BCW-2183a74ed802',  # 9.55542 M46/D5 47.46% Home Row Sub-9.556 Flagship (8B=1.0043)
    'BCW-6437d508508e',  # 9.55844 M46/D5 Round 5B High-Home Speed Seed (Home=47.46%, 8B=1.0043)
    'BCW-25fd28a07cb2',  # 9.55845 M46/D5 Round 5A First Sub-9.560 Primary Initial Seed
    'BCW-a091aefd7c62',  # 9.55898 M46/D5 Round 5A High-Home Initial/Final Seed (Home=47.46%)
    # 2. Global Pure 8B (< 1.0000) Speed Pinnacle (D=5)
    'BCW-d47f52c1935a',  # 9.55821 M46/D5 Global Pure 8B #1 Speed Pinnacle (Home=46.89%, Pure 8B)
    'BCW-ef5f9e313e42',  # 9.55869 M46/D5 Global Pure 8B #2 Cross-Graft Seed (Home=46.89%, Pure 8B)
    'BCW-ccf01e81bdff',  # 9.55950 M46/D5 k<->z (D<->U) Super-Initial Pure 8B Seed (Home=47.26%, Pure 8B)
    'BCW-9072021c0d2e',  # 9.56214 M46/D5 Round 5B Pure 8B Parent Seed (Home=47.26%, Pure 8B)
    # 3. D<=3 Speed & Pure 8B Pinnacle (k<->ch Super-Initial Basin)
    'BCW-ef1f08e90cbf',  # 9.57885 M44/D3 D<=3 Global #1 Speed Pinnacle (First Sub-9.580 at D<=3, Home=44.14%, 8B=1.0039)
    'BCW-4111530f86f1',  # 9.58026 M44/D3 D<=3 High-Home Speed Runner-Up (Home=44.51%, 8B=1.0043)
    'BCW-b14ed148fe1a',  # 9.58167 M44/D3 D<=3 Pure 8B #1 Speed Pinnacle (Home=43.93%, Pure 8B)
    'BCW-07a2469133f4',  # 9.58264 M44/D3 D<=3 Pure 8B High-Home Runner-Up (Home=44.29%, Pure 8B)
    'BCW-f52619067db6',  # 9.58290 M44/D3 k<->ch (D<->U) D=3 Super-Initial Seed (Home=43.93%, Pure 8B)
    'BCW-6e3d331b343c',  # 9.59798 M44/D3 Round 5B D=3 Pure 8B Parent Seed (Home=43.93%, Pure 8B)
    'BCW-03a5dd877fec',  # 9.59873 M44/D3 Round 5A D=3 Pure 8B Ancestor Seed (Home=44.30%, Pure 8B)
    # 4. The "Triple-Crown" Basin (Pure 8B < 1.0000 + Home >= 50% + Pmax <= 5.1%)
    'BCW-183af75dd6ef',  # 9.59960 M45/D4 Triple-Crown Dual-Gated #1 Pinnacle (Home=52.87%, Pmax=4.01%, Pure 8B)
    'BCW-46888b0ed91c',  # 9.60006 M45/D4 Triple-Crown 53.00% Home Row Flagship (Home=53.00%, Pmax=4.01%, Pure 8B)
    'BCW-ac815a99a0f2',  # 9.60065 M45/D4 Round 5B Triple-Crown Dual-Gated Seed (Home=52.87%, Pmax=4.01%, Pure 8B)
    'BCW-16b0d2563e9d',  # 9.60153 M45/D4 Round 5A Triple-Crown Ancestor Seed (Home=52.87%, Pmax=4.01%, Pure 8B)
    'BCW-1c10aa7eb448',  # 9.60887 M45/D4 Triple-Crown Ultra-Low-Pinky Champion (Home=52.86%, Pmax=3.67%, Pure 8B)
    'BCW-a589dc815187',  # 9.59531 M45/D4 Triple-Crown Low-Pinky Speed Pinnacle (Home=48.73%, Pmax=4.15%, Pure 8B)
    'BCW-2076db7bcc07',  # 9.59940 M45/D4 Round 5A Triple-Crown Low-Pinky Ancestor Seed (Home=48.95%, Pmax=4.15%, Pure 8B)
    # 5. Low-Displacement (D=2, D=1, D=0) Speed, Ergonomic & Canyon Bridge Champions
    'BCW-342a964e819b',  # 9.61253 M43/D2 D=2 Speed Runner-Up & Seed (S2ms=68.64ms)
    'BCW-f54b4fba49fa',  # 9.61527 M43/D2 D=2 Low-8B Initial Seed (8B=1.0082)
    'BCW-1a040659d24b',  # 9.62180 M43/D2 D=2 Low-Pinky #1 Speed Pinnacle (Pmax=4.03%, Home=46.00%, 8B=1.0095)
    'BCW-930ec5a423bf',  # 9.62283 M43/D2 D=2 Ultra-Low-Pinky (3.77%) Champion (Home=46.68%)
    'BCW-2d7139ba68aa',  # 9.63574 M43/D2 D=2 Dual-Gated Ergonomic #1 Champion (Home=50.04%, Pmax=4.56%)
    'BCW-504b91337b40',  # 9.63259 M43/D2 D=2 Lowest-8B (1.0075) Low-Pinky Bridge (Pmax=4.07%)
    'BCW-ac739660ba29',  # 9.65469 M42/D1 D=1 Speed #1 Pinnacle (New M=42, D=1 Basin!)
    'BCW-2278a7a6d745',  # 9.65525 M42/D1 D=1 Speed #2 Runner-Up
    'BCW-b51182f30d14',  # 9.66722 M41/D1 M=41, D=1 Speed #1 Champion
    'BCW-ed7d5ba01a64',  # 9.71450 M42/D1 D=1 Low-Pinky #1 Speed Champion & Initial Donor Seed (Pmax=3.89%)
    'BCW-46ff90c789bf',  # 9.70661 M41/D0 D=0 Zero-Displacement #1 Speed Pinnacle
    'BCW-8a3bc6ddb1fe',  # 9.70707 M41/D0 D=0 Zero-Displacement High-Home Speed Seed (Home=41.24%)
    'BCW-6a2c3cb77e53',  # 9.75080 M39/D0 M=39, D=0 Ultra-Low-Memory #1 Speed Champion
    'BCW-3f9c225a709d',  # 9.77502 M41/D0 D=0 Dual-Gated Ergonomic Canyon-Bridge Champion (Home=50.01%, Pmax=3.13%)
]

META_CONFIG = {
    'BCW-c006bc0bcfc0': ('21×21 CKT-v3前沿·全域极速新巅峰·M46/D5·c006bc0bcfc0', '全域极速总冠军·9.55465·Home=47.09%'),
    'BCW-cdf451dbb5af': ('21×21 CKT-v3前沿·Sub68ms极速亚军·M46/D5·cdf451dbb5af', '首破68ms单字键时(67.96ms)·9.55477'),
    'BCW-2992c2dd117a': ('21×21 CKT-v3前沿·R5B极速母本种子·M46/D5·2992c2dd117a', '破9.555极速核心母本·S2ms=67.97ms'),
    'BCW-de550fbc54f2': ('21×21 CKT-v3前沿·高主行极速亚军·M46/D5·de550fbc54f2', 'Home=47.09%+8B=1.0039极速亚军'),
    'BCW-2183a74ed802': ('21×21 CKT-v3前沿·47.5%主行极速旗舰·M46/D5·2183a74ed802', 'Home=47.46%破9.556极速旗舰'),
    'BCW-6437d508508e': ('21×21 CKT-v3前沿·R5B高主行极速种·M46/D5·6437d508508e', 'Home=47.46%高主行极速过渡母本'),
    'BCW-25fd28a07cb2': ('21×21 CKT-v3前沿·R5A首破9.56声母种·M46/D5·25fd28a07cb2', '首破9.560极速声母核心母本'),
    'BCW-a091aefd7c62': ('21×21 CKT-v3前沿·R5A高主行声韵种·M46/D5·a091aefd7c62', 'Home=47.46%高主行极速始祖种子'),
    'BCW-d47f52c1935a': ('21×21 CKT-v3前沿·全绿8B极速总冠·M46/D5·d47f52c1935a', '全绿Pure-8B破9.559总冠军·Home=46.89%'),
    'BCW-ef5f9e313e42': ('21×21 CKT-v3前沿·全绿8B嫁接亚军·M46/D5·ef5f9e313e42', '全绿Pure-8B跨盆地嫁接核心母本'),
    'BCW-ccf01e81bdff': ('21×21 CKT-v3前沿·k↔z超级声母种子·M46/D5·ccf01e81bdff', 'k↔z(D↔U)全绿Pure-8B超级声母种子'),
    'BCW-9072021c0d2e': ('21×21 CKT-v3前沿·R5B全绿8B母本·M46/D5·9072021c0d2e', 'R5B全绿Pure-8B核心母本·9.5621'),
    'BCW-ef1f08e90cbf': ('21×21 CKT-v3前沿·D3首破9.58总冠·M44/D3·ef1f08e90cbf', 'D≤3首破9.580极速总冠军·Home=44.14%'),
    'BCW-4111530f86f1': ('21×21 CKT-v3前沿·D3高主行极速亚军·M44/D3·4111530f86f1', 'D≤3极速亚军·Home=44.51%'),
    'BCW-b14ed148fe1a': ('21×21 CKT-v3前沿·D3全绿8B新巅峰·M44/D3·b14ed148fe1a', 'D≤3全绿Pure-8B总冠军·9.58167'),
    'BCW-07a2469133f4': ('21×21 CKT-v3前沿·D3全绿8B高主行冠·M44/D3·07a2469133f4', 'D≤3全绿Pure-8B亚军·Home=44.29%'),
    'BCW-f52619067db6': ('21×21 CKT-v3前沿·k↔ch超级声母种·M44/D3·f52619067db6', 'k↔ch(D↔U)D≤3全绿Pure-8B超级声母种子'),
    'BCW-6e3d331b343c': ('21×21 CKT-v3前沿·R5B-D3全绿母本·M44/D3·6e3d331b343c', 'D≤3全绿Pure-8B破9.598过渡母本'),
    'BCW-03a5dd877fec': ('21×21 CKT-v3前沿·R5A-D3全绿始祖·M44/D3·03a5dd877fec', 'D≤3全绿Pure-8B首破9.60始祖种子'),
    'BCW-183af75dd6ef': ('21×21 CKT-v3前沿·三冠王首破9.60总冠·M45/D4·183af75dd6ef', '三冠王(Pure8B+Home=52.87%+Pmax=4.01%)首破9.60'),
    'BCW-46888b0ed91c': ('21×21 CKT-v3前沿·53%主行三冠王旗舰·M45/D4·46888b0ed91c', '三冠王(Pure8B+Home=53.00%+Pmax=4.01%)旗舰'),
    'BCW-ac815a99a0f2': ('21×21 CKT-v3前沿·R5B三冠王跳板种·M45/D4·ac815a99a0f2', '三冠王双门限核心跳板种子·9.60065'),
    'BCW-16b0d2563e9d': ('21×21 CKT-v3前沿·R5A三冠王始祖种·M45/D4·16b0d2563e9d', '三冠王盆地破壁始祖种子·9.60153'),
    'BCW-1c10aa7eb448': ('21×21 CKT-v3前沿·3.67%超低小指三冠王·M45/D4·1c10aa7eb448', '三冠王超低小指(Pmax=3.67%,Home=52.86%)冠军'),
    'BCW-a589dc815187': ('21×21 CKT-v3前沿·三冠王低小指极速冠·M45/D4·a589dc815187', 'Pure8B+Pmax=4.15%+Home=48.73%极速冠军'),
    'BCW-2076db7bcc07': ('21×21 CKT-v3前沿·R5A低小指全绿始祖·M45/D4·2076db7bcc07', '首破9.60全绿Pure8B低小指始祖种子'),
    'BCW-342a964e819b': ('21×21 CKT-v3前沿·D2极速核心种子·M43/D2·342a964e819b', 'D=2极速韵母核心种子·9.6125'),
    'BCW-f54b4fba49fa': ('21×21 CKT-v3前沿·D2准全绿声母种·M43/D2·f54b4fba49fa', 'D=2低8B(1.0082)声母核心种子'),
    'BCW-1a040659d24b': ('21×21 CKT-v3前沿·D2低小指极速总冠·M43/D2·1a040659d24b', 'D=2低小指(Pmax=4.03%)极速总冠·9.6218'),
    'BCW-930ec5a423bf': ('21×21 CKT-v3前沿·D2-3.77%小指旗舰·M43/D2·930ec5a423bf', 'D=2超低小指(Pmax=3.77%,Home=46.68%)旗舰'),
    'BCW-2d7139ba68aa': ('21×21 CKT-v3前沿·D2双门限工学新巅峰·M43/D2·2d7139ba68aa', 'D=2双门限(Home=50.04%,Pmax=4.56%)新纪录'),
    'BCW-504b91337b40': ('21×21 CKT-v3前沿·D2最低8B低小指桥·M43/D2·504b91337b40', 'D=2最低8B(1.0075)+Pmax=4.07%桥接方案'),
    'BCW-ac739660ba29': ('21×21 CKT-v3前沿·D1极速新盆地总冠·M42/D1·ac739660ba29', 'M42/D1跨盆地嫁接极速新纪录·9.65469'),
    'BCW-2278a7a6d745': ('21×21 CKT-v3前沿·D1极速新盆地亚军·M42/D1·2278a7a6d745', 'M42/D1极速新盆地亚军·9.65525'),
    'BCW-b51182f30d14': ('21×21 CKT-v3前沿·M41/D1极速新冠军·M41/D1·b51182f30d14', 'M=41/D=1低心智极速新纪录·9.66722'),
    'BCW-ed7d5ba01a64': ('21×21 CKT-v3前沿·D1低小指新冠暨母本·M42/D1·ed7d5ba01a64', 'D=1低小指(Pmax=3.89%)冠军暨M42/D1声母母本'),
    'BCW-46ff90c789bf': ('21×21 CKT-v3前沿·D0零位移极速总冠·M41/D0·46ff90c789bf', 'D=0零声母位移极速新巅峰·9.70661'),
    'BCW-8a3bc6ddb1fe': ('21×21 CKT-v3前沿·D0零位移高主行种·M41/D0·8a3bc6ddb1fe', 'D=0零声母位移高主行(41.24%)韵母母本'),
    'BCW-6a2c3cb77e53': ('21×21 CKT-v3前沿·M39/D0超低心智总冠·M39/D0·6a2c3cb77e53', 'M=39/D=0超低心智极速新纪录·9.75080'),
    'BCW-3f9c225a709d': ('21×21 CKT-v3前沿·D0双门限断崖跨越冠·M41/D0·3f9c225a709d', 'D=0双门限(Home=50.01%,Pmax=3.13%)断崖跨越冠'),
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

    summary = json.loads((DATA / 'shenyun-21x21-round5-summary.json').read_text(encoding='utf-8'))
    summary_map = {r['id']: r for r in summary}

    chosen_ids = [i for i in TARGET_IDS if i not in existing]
    if not chosen_ids:
        print(json.dumps({'alreadyIntegrated': True, 'catalogue': len(existing)}))
        return

    print(f'Integrating {len(chosen_ids)} additional Round 5 schemes: {chosen_ids}')
    chosen = [summary_map[i] for i in chosen_ids]

    before = helper.preservation_snapshot(data, existing)
    benchmark, historical_fast = load_benchmark(args.replay.resolve())
    from b_path_fast import FastBuckets, NAMES
    current_fast = FastBuckets(benchmark, first_word=True)

    missing = [i for i in chosen_ids if not (args.replay / 'exact' / (i + '.json')).exists()]
    if missing:
        print(f'Scoring missing exact replay files ({len(missing)}): {missing}')
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
        entry['source'] = f'Snow Shenyun 21x21 CKT v3 Round 5; {cohort}; Exact-4-track surrogate [1, 1, 3, 3]'
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
    with tempfile.TemporaryDirectory(prefix='ckt-v3-round5-') as location:
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

    # Also synchronize research-notes/data/shenyun-21x21-seeds-database.json
    seeds_db_path = DATA / 'shenyun-21x21-seeds-database.json'
    if seeds_db_path.exists():
        seeds_db = json.loads(seeds_db_path.read_text(encoding='utf-8'))
        existing_seed_ids = {s['id'] for s in seeds_db.get('schemes', [])}
        added_to_db = 0
        for r in chosen:
            if r['id'] not in existing_seed_ids:
                name, cohort = META_CONFIG[r['id']]
                seeds_db['schemes'].append({
                    **r,
                    'name': name,
                    'cohort': cohort,
                    'round': 'R5',
                })
                added_to_db += 1
        seeds_db['totalSchemes'] = len(seeds_db['schemes'])
        seeds_db_path.write_text(json.dumps(seeds_db, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Updated {seeds_db_path} (+{added_to_db} schemes, total {seeds_db["totalSchemes"]}).')

    print('Integration completed successfully!')
    print(json.dumps({'added': chosen_ids, 'catalogue': len(data['entries'])}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
