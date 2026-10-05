#!/usr/bin/env python3
"""Compare 21x21 layouts on character and two-character word B paths.

Keytao: IR+shape1, IR+shape1+shape2 (R11 snowshape).
Sanpin: IR+tone, IR+tone+first pure stroke (runtime shape_filter.lua).
The sanpin two-B path accepts every first stroke allowed by shape_filter.lua.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'NUMBA_NUM_THREADS'):
    os.environ[key] = '1'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--replay', type=Path, required=True)
parser.add_argument('--prior', type=Path, default=HERE / 'research-notes/data/shenyun-21x21-low-miss-search.json')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
output = args.output.resolve()
replay = args.replay.resolve()
sys.path.insert(0, str(replay))
os.chdir(replay)

import numpy as np
import opt
import r5_search as r5
import search_engine as se

DATA = r5.D
COMMON = [row for row in DATA['characters'] if row[4]]
WORDS = [row for row in DATA['words'] if row[6] & 1 and row[7]]
SHAPE = DATA['shapes']['snowshape']
TONE = 'IVUAO'
# Shape filter's runtime stroke mapping: 一=v, 丨=i, 丿=u, 丶=o, 乙=a.
RUNTIME_STROKE = str.maketrans('hspnz', 'VIUOA')
# The frozen shape source is written in abstract IEUAO keys; E is the horizontal
# abstract key and is placed on V by the locked IVUAO tone order.
KEYTAO_SHAPE = str.maketrans('IEUAO', 'IVUAO')


def verify_keytao_shape_source() -> None:
    radicals = dict(line.rstrip('\n').split('\t', 1)
                    for line in (HERE / 'lua/snow/radical_jiandao.txt').open(encoding='utf-8')
                    if '\t' in line)
    local = {}
    started = False
    for line in (HERE / 'snow_jiandao_chaifen.dict.yaml').open(encoding='utf-8'):
        if not started:
            started = line.strip() == '...'
            continue
        fields = line.rstrip('\n').split('\t')
        if len(fields) >= 2 and fields[0] not in local:
            local[fields[0]] = ''.join(radicals.get(symbol, '') for symbol in fields[1]).upper()
    for character, *_ in COMMON:
        assert SHAPE[character].translate(KEYTAO_SHAPE) == local[character], character


verify_keytao_shape_source()


def strokes() -> tuple[dict[str, str], dict[str, set[str]]]:
    path = HERE / 'rime-stroke/stroke.dict.yaml'
    primary: dict[str, str] = {}
    alternatives: dict[str, set[str]] = defaultdict(set)
    started = False
    for line in path.open(encoding='utf-8'):
        if not started:
            started = line.strip() == '...'
            continue
        fields = line.rstrip('\n').split('\t')
        if len(fields) < 2 or not fields[1] or set(fields[1]) - set('hspnz'):
            continue
        character, stroke = fields[:2]
        first = stroke[0].translate(RUNTIME_STROKE)
        primary.setdefault(character, first)
        alternatives[character].add(first)
    return primary, alternatives


STROKE, STROKE_OPTIONS = strokes()
assert all(row[0] in STROKE for row in COMMON if row[3] > 0)
TOTAL = sum(row[3] for row in COMMON)


def losses(codes: list[str | None], alternate: bool = True) -> dict[str, float]:
    """Frequency weighted rank >1; duplicate codes keep one maximal weight."""
    buckets: dict[str, dict[str, int]] = {name: {} for name in ('j1', 'j2', 's1', 's2')}
    masses = {name: 0 for name in buckets}
    alternative_rows = []
    for row_index, (character, pinyin, tone, weight, _common) in enumerate(COMMON):
        code = codes[pinyin]
        if code is None or weight <= 0:
            continue
        shape = SHAPE[character].translate(KEYTAO_SHAPE)
        partial = {
            'j1': (code + shape[:1],),
            'j2': (code + shape[:2],),
            's1': (code + TONE[tone - 1],),
            's2': tuple(code + TONE[tone - 1] + stroke for stroke in
                        (STROKE_OPTIONS[character] if alternate else (STROKE[character],))),
        }
        for name, paths in partial.items():
            if not paths or any(not path for path in paths):
                continue
            if name == 's2' and alternate:
                alternative_rows.append((row_index, character, weight, paths))
                continue
            path = paths[0]
            slot = buckets[name]
            slot[path] = max(slot.get(path, 0), weight)
            masses[name] += weight
    result = {name: (masses[name] - sum(buckets[name].values())) / masses[name]
              for name in buckets if name != 's2' or not alternate}
    if alternate:
        winners = {}
        for row_index, character, weight, paths in alternative_rows:
            for path in paths:
                old = winners.get(path)
                if old is None or weight > old[2] or (weight == old[2] and character < old[1]):
                    winners[path] = row_index, character, weight
        numerator = sum(weight for index, character, weight, paths in alternative_rows
                        if all(winners[path][0] != index for path in paths))
        result['s2'] = numerator / sum(row[2] for row in alternative_rows)
    return result


def word_losses(codes: list[str | None]) -> dict[str, float]:
    """Snow common words; match CKT's cohort filtering before ranking."""
    names = ('wj1', 'wj2', 'ws1', 'ws2')
    winners: dict[str, dict[str, tuple[int, str]]] = {name: {} for name in names}
    masses = {name: 0 for name in names}
    for word, p1, p2, t1, t2, weight, _lexicon, common in WORDS:
        if weight <= 0 or len(word) != 2:
            continue
        a, b = codes[p1], codes[p2]
        if a is None or b is None:
            continue
        x1 = SHAPE.get(word[0], '').translate(KEYTAO_SHAPE)[:1]
        x2 = SHAPE.get(word[1], '').translate(KEYTAO_SHAPE)[:1]
        base = a + b
        paths = (base + x2 if x1 and x2 else None,
                 base + x2 + x1 if x1 and x2 else None,
                 base + TONE[t2 - 1], base + TONE[t2 - 1] + TONE[t1 - 1])
        for name, path in zip(names, paths):
            if path is None:
                continue
            old = winners[name].get(path)
            if old is None or weight > old[0] or (weight == old[0] and word < old[1]):
                winners[name][path] = (weight, word)
            if common:
                masses[name] += weight
    return {name: 1 - sum(weight for weight, word in winners[name].values()) / masses[name]
            for name in names}


def state_codes(state: np.ndarray) -> list[str | None]:
    return opt.toentry(state, DATA, 'audit')['codeList']


def report(entry: dict, source: str, state: np.ndarray | None = None) -> dict:
    codes = entry['codeList']
    result = {'id': source, **losses(codes), **word_losses(codes)}
    if state is not None:
        unique, memory, displaced = se.stats(state, opt.PARAMS[-2], opt.PARAMS[-1], 21, 10, 1)
        factors = opt.metrics(opt.initialize(state, opt.PARAMS)[1], opt.PARAMS)
        result.update({'M': int(memory), 'D': int(displaced), 'unique399': int(unique),
                       'S2ms': float(factors[0]), 'v5': float(factors[1]),
                       'v4': float(factors[2]), 'state': state.tolist()})
    return result


def main() -> None:
    entries = {entry['id']: entry for entry in DATA['entries']}
    s005 = report(entries['S005'], 'S005')
    r9state = opt.state(entries['R9-21X21-M40-02'], DATA)
    r9 = report(entries['R9-21X21-M40-02'], 'R9-21X21-M40-02', r9state)
    for item, track in (('j2', 'C4-Snow'), ('s1', 'C3'),
                        ('wj2', 'WX-Snow-21'), ('ws2', 'W6-21')):
        reference = DATA['ckt']['tracks']['S005'][track]['miss']
        assert abs(s005[item] - reference) < 1e-12, (item, s005[item], reference)
        baseline = DATA['ckt']['tracks']['R9-21X21-M40-02'][track]['miss']
        assert abs(r9[item] - baseline) < 1e-12, (item, r9[item], baseline)

    prior = json.loads(args.prior.read_text(encoding='utf-8'))['recordedStates']
    states = {tuple(row['state']): row.get('parent', 'prior') for row in prior}
    for entry in entries.values():
        if entry.get('capacity') != [21, 21] or entry.get('tone') != TONE:
            continue
        try:
            state = opt.state(entry, DATA)
        except (KeyError, ValueError):
            continue
        states[tuple(state)] = entry['id']
    results = []
    for sequence, label in states.items():
        state = np.array(sequence, dtype=np.int32)
        state_id = hashlib.sha256(np.array(sequence, np.int32).tobytes()).hexdigest()[:12]
        row = report({'codeList': state_codes(state)}, f'B21-{state_id}', state)
        row['origin'] = label
        row['passesKeytaoB'] = row['j1'] < s005['j1'] and row['j2'] < s005['j2']
        row['passesAllFour'] = row['passesKeytaoB'] and row['s1'] < s005['s1'] and row['s2'] < s005['s2']
        row['passesAllEight'] = all(row[name] < s005[name] for name in ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2'))
        results.append(row)
    results.sort(key=lambda row: (not row['passesAllFour'],
                                  max(row[k] / s005[k] for k in ('j1', 'j2', 's1', 's2')),
                                  row['S2ms']))
    sensitivity = {'S005': losses(entries['S005']['codeList'], alternate=False)['s2'],
                   'R9': losses(entries['R9-21X21-M40-02']['codeList'], alternate=False)['s2']}
    counts = {'recorded': len(results), 'passesKeytaoB': sum(r['passesKeytaoB'] for r in results),
              'passesAllFour': sum(r['passesAllFour'] for r in results),
              'passesAllEight': sum(r['passesAllEight'] for r in results)}
    payload = {'standard': {'cohort': 'R11 Common8095', 'mass': TOTAL,
                            'sanpinStrokeSource': 'rime-stroke/stroke.dict.yaml all accepted first strokes',
                            'sanpinRuntimeMap': 'hspnz -> viuoa (shape_filter.lua)',
                            'sanpinSecondBStatus': 'formal frozen frequency-ranked gate; live Rime ordering is a separate integration check',
                            'strict': 'four character paths are formal gates; each nonfirst rate < corresponding S005 rate; word paths are optimization objectives'},
               'counts': counts, 'reference': {'S005': s005, 'R9': r9},
               'firstDictionaryEntryStrokeSensitivity': sensitivity, 'results': results}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'counts': counts, 'reference': {'S005': s005,
                                                     'R9': {k: v for k, v in r9.items() if k != 'state'}},
                      'sensitivity': sensitivity,
                      'best': [{k: row[k] for k in ('id', 'M', 'D', 'unique399', 'j1', 'j2', 's1', 's2',
                                                    'S2ms', 'v5')} for row in results[:6]]},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
