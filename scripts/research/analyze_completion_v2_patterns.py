#!/usr/bin/env python3
"""Summarize structural patterns among saved 21x21 completion-v2 states."""
from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
DEFAULT_REPLAY = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'


def rank(values: list[float]) -> np.ndarray:
    order = sorted(range(len(values)), key=values.__getitem__)
    result = np.empty(len(values), dtype=float)
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and values[order[end]] == values[order[start]]:
            end += 1
        result[order[start:end]] = (start + end - 1) / 2
        start = end
    return result


def spearman(left: list[float], right: list[float]) -> float:
    a, b = rank(left), rank(right)
    if np.std(a) == 0 or np.std(b) == 0:
        return float('nan')
    return float(np.corrcoef(a, b)[0, 1])


def summary(rows: list[dict], key: str) -> dict:
    values = sorted(float(row[key]) for row in rows)
    if not values:
        return {'n': 0, 'mean': None, 'median': None, 'min': None, 'max': None}
    return {'n': len(values), 'mean': float(np.mean(values)),
            'median': float(np.median(values)), 'min': values[0], 'max': values[-1]}


def pair_enrichment(rows: list[dict], selected: set[int], finals: list[str], keys: str,
                    limit: int = 18) -> list[dict]:
    other = set(range(len(rows))) - selected
    counts = defaultdict(lambda: [0, 0])
    for index, row in enumerate(rows):
        side = 0 if index in selected else 1
        for final_index, key_index in enumerate(row['state'][27:62]):
            counts[(final_index, int(key_index))][side] += 1
    output = []
    for (final_index, key_index), (yes, no) in counts.items():
        if yes + no < 12:
            continue
        yes_rate = yes / len(selected)
        no_rate = no / len(other)
        output.append({'final': finals[final_index], 'key': keys[key_index],
                       'selectedCount': yes, 'otherCount': no,
                       'selectedRate': yes_rate, 'otherRate': no_rate,
                       'rateDelta': yes_rate - no_rate,
                       'rateRatio': (yes_rate + 1e-9) / (no_rate + 1e-9)})
    return sorted(output, key=lambda row: (-row['rateDelta'], -row['selectedCount']))[:limit]


def correlations(rows: list[dict], metrics: tuple[str, ...]) -> dict:
    return {key: spearman([float(row[key]) for row in rows],
                          [float(row['ckt12']) for row in rows])
            for key in metrics}


def split_summary(rows: list[dict], i_offset: int, p_index: int) -> dict:
    groups = {
        'iOnP': [row for row in rows if int(row['state'][i_offset]) == p_index],
        'iNotOnP': [row for row in rows if int(row['state'][i_offset]) != p_index],
    }
    return {
        name: {key: summary(group, key)
               for key in ('ckt12', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v4', 'v5')}
        for name, group in groups.items()
    }


def matched_i_on_p(rows: list[dict], i_offset: int, p_index: int) -> dict:
    """Compare i→P within identical M/D and 8B-pass strata."""
    strata = defaultdict(lambda: [[], []])
    for row in rows:
        group = int(int(row['state'][i_offset]) != p_index)
        strata[(int(row['M']), int(row['D']), row['eightWorstRatio'] < 1)][group].append(row)
    comparable = [(key, groups) for key, groups in strata.items()
                  if len(groups[0]) >= 5 and len(groups[1]) >= 5]
    output = {'strata': len(comparable), 'rows': sum(len(a) + len(b) for _, (a, b) in comparable)}
    for metric in ('ckt12', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v4', 'v5'):
        differences, weights = [], []
        for _, (on_p, off_p) in comparable:
            differences.append(float(np.median([r[metric] for r in on_p]))
                               - float(np.median([r[metric] for r in off_p])))
            weights.append(min(len(on_p), len(off_p)))
        output[metric + 'MedianDeltaIOnPMinusOffP'] = (
            float(np.average(differences, weights=weights)) if differences else None)
    return output


def representative_rows(rows: list[dict], i_offset: int, p_index: int, keys: str) -> list[dict]:
    definitions = (
        ('fastest', lambda r: True, lambda r: r['ckt12']),
        ('fastestEight', lambda r: r['eightWorstRatio'] < 1, lambda r: r['ckt12']),
        ('fastestEightIOnP', lambda r: r['eightWorstRatio'] < 1 and int(r['state'][i_offset]) == p_index,
         lambda r: r['ckt12']),
        ('fastestEightINotOnP', lambda r: r['eightWorstRatio'] < 1 and int(r['state'][i_offset]) != p_index,
         lambda r: r['ckt12']),
        ('highHomeUnder9_65', lambda r: r['ckt12'] <= 9.65, lambda r: -r['homeS2']),
        ('lowPmaxUnder9_65', lambda r: r['ckt12'] <= 9.65, lambda r: r['Pmax']),
        ('fastestCompactEight', lambda r: r['M'] <= 44 and r['D'] <= 3 and r['eightWorstRatio'] < 1,
         lambda r: r['ckt12']),
    )
    output = []
    for label, predicate, objective in definitions:
        eligible = [row for row in rows if predicate(row)]
        if not eligible:
            continue
        row = min(eligible, key=objective)
        output.append({'role': label, **{key: row[key] for key in
                      ('id', 'M', 'D', 'ckt12', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v4', 'v5')},
                       'iKey': keys[int(row['state'][i_offset])]})
    return output


def analyze_population(rows: list[dict], finals: list[str], keys: str) -> dict:
    """Return compact structural diagnostics for one consistently scored population."""
    if not rows:
        return {'conditionalAnalyses': {}, 'matchedIOnP': {'strata': 0, 'rows': 0},
                'quartileSizes': {}, 'pairEnrichments': {}, 'representatives': []}
    metrics = ('M', 'D', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v4', 'v5')
    i_offset = 27 + finals.index('i')
    p_index = keys.index('P')
    subsets = {
        'all': rows,
        'eightB': [row for row in rows if row['eightWorstRatio'] < 1],
        'compact': [row for row in rows if row['M'] <= 44 and row['D'] <= 3],
        'compactEightB': [row for row in rows if row['M'] <= 44 and row['D'] <= 3
                          and row['eightWorstRatio'] < 1],
    }
    conditional = {name: {'n': len(group), 'spearmanWithCkt12': correlations(group, metrics),
                          'iOnPComparison': split_summary(group, i_offset, p_index)}
                   for name, group in subsets.items() if len(group) >= 20}

    def quartile(pool: list[dict], key: str, high: bool) -> set[int]:
        ordered = sorted(range(len(pool)), key=lambda index: float(pool[index][key]), reverse=high)
        return set(ordered[:max(1, len(pool) // 4)])

    cohorts = {
        'bestCkt': quartile(rows, 'ckt12', False),
        'highHome': quartile(rows, 'homeS2', True),
        'lowPmax': quartile(rows, 'Pmax', False),
        'bestEight': quartile(rows, 'eightWorstRatio', False),
    }
    enrichments = {name: pair_enrichment(rows, selected, finals, keys)
                   for name, selected in cohorts.items()}
    compact_eight = subsets['compactEightB']
    if len(compact_eight) >= 20:
        selected = quartile(compact_eight, 'ckt12', False)
        enrichments['bestCktWithinCompactEightB'] = pair_enrichment(
            compact_eight, selected, finals, keys)
    return {
        'conditionalAnalyses': conditional,
        'matchedIOnP': matched_i_on_p(rows, i_offset, p_index),
        'quartileSizes': {name: len(indices) for name, indices in cohorts.items()},
        'pairEnrichments': enrichments,
        'representatives': representative_rows(rows, i_offset, p_index, keys),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--replay', type=Path, default=DEFAULT_REPLAY)
    parser.add_argument('--output', type=Path,
                        default=DATA / 'shenyun-21x21-completion-v2-patterns.json')
    args = parser.parse_args()
    meta = json.loads((args.replay / 'model_meta.json').read_text(encoding='utf-8'))
    keys, finals = meta['keys'], meta['finals']

    by_state: dict[tuple[int, ...], dict] = {}
    sources = []
    # Restrict the pool to results scored under the current CKT-v2 model.  The
    # older fixed/word2 files use predecessor objectives whose similarly named
    # fields are not directly comparable.
    for path in sorted(DATA.glob('shenyun-21x21-completion-v2*.json')):
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if (payload.get('tauMs'), payload.get('firstAuxiliaryExtraMs'),
                payload.get('secondAuxiliaryExtraMs')) != (600, 300, 300):
            continue
        accepted = 0
        for row in payload.get('results', []):
            state = row.get('state')
            if len(state or []) != 67 or row.get('ckt12') is None:
                continue
            required = ('M', 'D', 'eightWorstRatio', 'Pmax', 'homeS2', 'S2ms', 'v4', 'v5')
            if any(row.get(key) is None for key in required):
                continue
            signature = tuple(map(int, state))
            by_state.setdefault(signature, row)
            accepted += 1
        if accepted:
            sources.append({'file': path.name, 'rows': accepted})
    rows = list(by_state.values())
    if len(rows) < 100:
        raise ValueError(f'Insufficient saved states: {len(rows)}')

    analysis = analyze_population(rows, finals, keys)

    output = {'purpose': __doc__, 'sources': sources, 'uniqueStates': len(rows),
              'selectionBias': ('Saved search outputs emphasize speed, attribute extremes, '
                                'and diverse elites; they are not a uniform sample.'),
              **analysis}
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(args.output.resolve()), 'uniqueStates': len(rows),
                      'sourceFiles': len(sources),
                      'iOnP': analysis['conditionalAnalyses']['all']['iOnPComparison']['iOnP']['ckt12']['n']},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
