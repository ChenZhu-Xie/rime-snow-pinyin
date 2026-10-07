#!/usr/bin/env python3
"""Add three reviewed fixed-IVUAO completion-frontier layouts to the R11 atlas."""
from __future__ import annotations

import argparse
import base64
import copy
import gzip
import json
import math
import subprocess
import tempfile
from pathlib import Path

from integrate_shenyun_21x21_b_paths import (
    DATA, DEFAULT_HTML, DEFAULT_REPLAY, load_benchmark, load_module,
    new_entry, score_missing_exact,
)
from integrate_shenyun_21x21_completion_word2_representatives import ensemble
from correct_shenyun_completion_word_order import PATHS

IDS = ('BCW-553dbe07fc7c', 'BCL-0b818d71385f', 'BCL-cff9677af1ba')
FILES = ('shenyun-21x21-completion-fixed-face-search-r2.json',
         'shenyun-21x21-completion-fixed-local-polish.json')
SCORE = Path(__file__).with_name('score_shenyun_completion_ckt.js')
EXTENSION = {'ids': list(IDS), 'source': list(FILES),
             'contract': '21x21 Keytao first-character-first; IVUAO; word weight 2'}


def pack(data):
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/').encode('utf-8')
    return base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode('ascii')


def record_extension(data):
    changed = False
    for name in ('completionB', 'completionBFixed'):
        extensions = data[name]['source'].setdefault('extensions', [])
        if not any(item.get('ids') == list(IDS) for item in extensions):
            extensions.append(EXTENSION)
            changed = True
    return changed


def write_payload(path, html, body, end, data):
    staged = path.with_name(path.name + '.tmp')
    staged.write_text(html[:body] + pack(data) + html[end:], encoding='utf-8')
    staged.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    args = parser.parse_args()
    html_path, replay = args.html.resolve(), args.replay.resolve()
    html = html_path.read_text(encoding='utf-8')
    old = load_module('old_21x21_integrator', Path(__file__).with_name('integrate_shenyun_21x21_low_miss.py'))
    helper = old.load_helper(html_path)
    data, body, end = helper.extract_payload(html)
    existing = {entry['id'] for entry in data['entries']}
    if set(IDS) <= existing:
        if record_extension(data):
            write_payload(html_path, html, body, end, data)
        print(json.dumps({'alreadyIntegrated': list(IDS), 'catalogue': len(existing)}))
        return
    if set(IDS) & existing:
        raise ValueError('Partial integration requires review')
    if data['completionB']['version'] != 'B-completion-CKT-native-v2' or data['completionBFixed']['version'] != 'B-completion-CKT-fixed-v1':
        raise ValueError('Expected corrected native and fixed scoring contracts')
    if set(data['completionB']['schemes']) != existing or set(data['completionBFixed']['schemes']) != existing:
        raise ValueError('Completion catalogue coverage differs from entries')
    rows = {}
    for name in FILES:
        for row in json.loads((DATA / name).read_text(encoding='utf-8'))['results']:
            if row['id'] in IDS:
                rows[row['id']] = row
    if set(rows) != set(IDS):
        raise ValueError('Missing frontier states')
    before = helper.preservation_snapshot(data, existing)
    benchmark, historical_fast = load_benchmark(replay)
    from b_path_fast import FastBuckets
    current_fast = FastBuckets(benchmark, first_word=True)
    missing = [ident for ident in IDS if not (replay / 'exact' / (ident + '.json')).exists()]
    if missing:
        score_missing_exact(replay, benchmark, {ident: (rows[ident], '') for ident in IDS}, missing)
    import numpy as np
    entries, exact = [], {}
    for ident in IDS:
        row = rows[ident]
        scored = json.loads((replay / 'exact' / (ident + '.json')).read_text(encoding='utf-8'))
        expected = benchmark.opt.toentry(np.array(row['state'], dtype=np.int32), benchmark.DATA, ident)
        if scored['entry']['codeList'] != expected['codeList']:
            raise ValueError('Exact replay code mismatch: ' + ident)
        prepared = {**row, 'S2ms': scored['tracks']['S2']['upperMs'],
                    'v5': scored['scores']['ensembleV5']['score']}
        entry = new_entry(helper, scored, prepared, '固定 IVUAO 字词 1:2 补全前沿')
        entry['subfamily'] = 'AVUIO 锁定·固定 IVUAO 补全前沿'
        entry['source'] = 'fixed IVUAO 21x21 completion multibasin search; frozen R11 original 20-track replay'
        entry['notes'].append('Current 21x21 Keytao word B order: first character, then second.')
        historical = historical_fast.score(entry['codeList'])
        entry['bPathMetrics'] = historical
        current = current_fast.score(entry['codeList'])
        for key, mode, kind, stage in PATHS:
            if abs(current[key] - row[key]) > 1e-12:
                raise ValueError(f'Current eight-path mismatch: {ident} {key}')
        entry['bPathMetricsNative'] = current
        entries.append(entry)
        exact[ident] = scored
    data = old.integrate_colliding(helper, data, entries, exact, replay)
    helper.integrate_macroxue(data, entries, replay)
    if before != helper.preservation_snapshot(data, existing):
        raise ValueError('Existing catalogue metrics changed')
    data['r11Research']['counts']['postR11ResearchExtensions'] += len(entries)
    data['r11Research']['scopeRows'].append([
        'Snow Shenyun AVUIO-locked 21x21 fixed-IVUAO completion frontier',
        'three M39–45/D0–3 representatives; corrected word B order and original 20-track replay',
    ])
    data['fourCodeCollisionBenchmark']['catalogueCount'] = len(data['entries'])
    data['bPathBenchmark']['schemeCount'] = len(data['entries'])
    data['bPathBenchmark']['selectedSources'].extend(FILES)
    with tempfile.TemporaryDirectory(prefix='r11-fixed-frontier-') as location:
        temp = Path(location)
        staged_html = temp / 'scored.html'
        staged_html.write_text(html[:body] + pack(data) + html[end:], encoding='utf-8')
        scored = {}
        for mapping in ('native', 'fixed'):
            output = temp / (mapping + '.json')
            subprocess.run(['node', str(SCORE), '--html', str(staged_html), '--output', str(output),
                            '--ids', ','.join(IDS), '--mapping', mapping], check=True, cwd=Path(__file__).resolve().parents[2])
            scored[mapping] = json.loads(output.read_text(encoding='utf-8'))
        for ident in IDS:
            row = rows[ident]
            native = scored['native']['schemes'][ident]
            fixed = scored['fixed']['schemes'][ident]
            if native['modes'] != fixed['modes']:
                raise ValueError('Native/fixed mismatch for IVUAO: ' + ident)
            parts = [native['modes'][mode][kind] for mode, kind in
                     (('keytao', 'character'), ('sanpin', 'character'), ('keytao', 'word'), ('sanpin', 'word'))]
            if max(abs(row['times'][i] - parts[i]['completionUpperMs']) for i in range(4)) > 1e-8:
                raise ValueError('Completion time mismatch: ' + ident)
            if max(abs(row['p2'][i] - parts[i]['p2']) for i in range(4)) > 1e-12:
                raise ValueError('Completion p2 mismatch: ' + ident)
            for key, mode, kind, stage in PATHS:
                if abs(row[key] - native['modes'][mode][kind][stage]) > 1e-12:
                    raise ValueError(f'Eight-path mismatch: {ident} {key}')
            for mapping, block in (('native', data['completionB']), ('fixed', data['completionBFixed'])):
                result = scored[mapping]['schemes'][ident]
                block['schemes'][ident] = result
                base = block['schemes']['S005']['modes']
                block['ensembleScores'][ident] = {
                    'equal': {str(t): ensemble(result['modes'], base, t, 1) for t in (0, 150, 300, 600)},
                    'word2': {str(t): ensemble(result['modes'], base, t, 2) for t in (0, 150, 300, 600)},
                }
                if abs(block['ensembleScores'][ident]['word2']['150'] - row['ckt12']) > 1e-9:
                    raise ValueError('Composite score mismatch: ' + ident)
        ids = {entry['id'] for entry in data['entries']}
        if len(ids) != len(existing) + len(IDS):
            raise ValueError('Catalogue count mismatch')
        for block in (data['completionB'], data['completionBFixed']):
            if set(block['schemes']) != ids or set(block['ensembleScores']) != ids:
                raise ValueError('Completion coverage incomplete')
        record_extension(data)
        write_payload(html_path, html, body, end, data)
    print(json.dumps({'html': str(html_path), 'catalogue': len(data['entries']), 'added': IDS}, ensure_ascii=False))


if __name__ == '__main__':
    main()
