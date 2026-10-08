"""Select deliberately slow fixed-IVUAO poles and cross them with frontiers."""
from __future__ import annotations

import random


def fixed_composite(modes: dict, reference: dict, tau: float) -> float:
    total = 0.0
    for mode in ('keytao', 'sanpin'):
        for kind in ('character', 'word'):
            row, base = modes[mode][kind], reference[mode][kind]
            weight = 2 if kind == 'word' else 1
            actual = row['completionUpperMs'] + tau * row['p2']
            denominator = base['completionUpperMs'] + tau * base['p2']
            total += weight * (actual / denominator)**4
    return 10 * (total / 6)**.25


def select_counterpoles(rows: list[dict], quantile: float = .65,
                        per_axis: int = 3) -> tuple[float, list[dict]]:
    eligible = [row for row in rows if row.get('oldFixed12') is not None]
    if not eligible:
        raise ValueError('No old fixed-IVUAO scores for pole selection')
    scores = sorted(row['oldFixed12'] for row in eligible)
    threshold = scores[min(len(scores) - 1, int(len(scores) * quantile))]
    slow = [row for row in eligible if row['oldFixed12'] >= threshold]
    axes = (
        lambda row: -row['homeS2'],
        lambda row: row['Pmax'],
        lambda row: row['M'],
        lambda row: row['D'],
        lambda row: row['eightWorstRatio'],
    )
    selected = {}
    for axis in axes:
        for row in sorted(slow, key=lambda row: (axis(row), row['oldFixed12']))[:per_axis]:
            selected[row['id']] = row
    return threshold, list(selected.values())


ATTRIBUTE_AXES = (
    ('home', 'homeS2', -1), ('pinky', 'Pmax', 1),
    ('eight', 'eightWorstRatio', 1), ('memory', 'M', 1),
    ('v4', 'v4', 1), ('v5', 'v5', 1), ('S2', 'S2ms', 1),
    ('v2-no-selection', 'ckt12tau0', 1),
    ('j1', 'j1', 1), ('j2', 'j2', 1),
    ('s1', 's1', 1), ('s2', 's2', 1),
    ('wj1', 'wj1', 1), ('wj2', 'wj2', 1),
    ('ws1', 'ws1', 1), ('ws2', 'ws2', 1),
)


def state_distance(left: dict, right: dict) -> int:
    return sum(a != b for a, b in zip(left['state'][:62], right['state'][:62]))


def resolve_endpoint_rows(rows: list[dict], requested: list[str]) -> list[dict]:
    """Resolve explicit endpoint IDs while preserving request order."""
    lookup = {}
    for row in rows:
        lookup[row['id']] = row
        if row.get('atlasId'):
            lookup[row['atlasId']] = row
    missing = [ident for ident in requested if ident not in lookup]
    if missing:
        raise ValueError('Missing endpoint IDs: ' + ', '.join(missing))
    selected = []
    seen = set()
    for ident in requested:
        row = lookup[ident]
        if row['id'] not in seen:
            selected.append(row)
            seen.add(row['id'])
    return selected


def select_attribute_poles(rows: list[dict], excluded: set[str] | None = None,
                           top_share: float = .08, min_distance: int = 8,
                           limit: int = 18, score_key: str = 'fixed12') -> tuple[list[dict], list[dict]]:
    """Choose strong but mutually distant points across secondary attributes."""
    excluded = excluded or set()
    eligible = [row for row in rows if row.get(score_key) is not None
                and row.get('atlasId', row['id']) not in excluded]
    if not eligible:
        raise ValueError('No eligible attribute poles')
    width = min(len(eligible), max(12, round(len(eligible) * top_share)))
    selected: list[dict] = []
    provenance: list[dict] = []
    for label, key, direction in ATTRIBUTE_AXES:
        candidates = sorted(eligible, key=lambda row: (direction * row[key], row[score_key]))[:width]
        distinct = [row for row in candidates if all(state_distance(row, old) >= min_distance
                                                     for old in selected)]
        if not distinct:
            continue
        chosen = max(distinct, key=lambda row: (
            min((state_distance(row, old) for old in selected), default=62)
            - .3 * candidates.index(row), -row[score_key]))
        selected.append(chosen)
        provenance.append({'axis': label, 'id': chosen['id'], 'value': chosen[key],
                           'scoreKey': score_key, 'score': chosen[score_key], 'M': chosen['M'], 'D': chosen['D']})
        if len(selected) >= limit:
            break
    return selected, provenance


def choose_cross_parents(kind: str, pole: dict, elite: list[dict],
                         bridges: list[dict], rng: random.Random) -> list[dict]:
    frontier = [row for row in elite if row['id'] != pole['id']]
    if not frontier:
        raise ValueError('A distinct frontier parent is required')
    speed = rng.choice(frontier)
    if kind == 'line':
        return [pole, speed]
    bridge_pool = [row for row in bridges if row['id'] not in (pole['id'], speed['id'])]
    if not bridge_pool:
        raise ValueError('A distinct bridge parent is required')
    bridge = rng.choice(bridge_pool)
    if kind == 'face':
        extras = [row for row in frontier if row['id'] not in (speed['id'], bridge['id'])]
        return [pole, speed, bridge, rng.choice(extras)] if extras else [pole, speed, bridge]
    if kind == 'mutate':
        return [speed, pole, bridge]
    raise ValueError(f'Unknown proposal kind: {kind}')


def choose_attribute_parents(kind: str, pole: dict, poles: list[dict],
                             elite: list[dict], bridges: list[dict],
                             rng: random.Random) -> list[dict]:
    """Connect distinct attribute poles directly and through a fast parent."""
    others = [row for row in poles if row['id'] != pole['id']]
    fast = [row for row in elite if row['id'] != pole['id']]
    if not others or not fast:
        raise ValueError('Two poles and a distinct frontier point are required')
    second = rng.choice(others)
    speed = rng.choice([row for row in fast if row['id'] != second['id']] or fast)
    if kind == 'line':
        return [pole, second] if rng.random() < .5 else [pole, speed]
    bridge_pool = [row for row in bridges if row['id'] not in
                   {pole['id'], second['id'], speed['id']}]
    if kind == 'face':
        return [pole, second, speed, rng.choice(bridge_pool)] if bridge_pool else [pole, second, speed]
    if kind == 'mutate':
        return [pole, second, speed] if rng.random() < .5 else [speed, pole, second]
    raise ValueError(f'Unknown proposal kind: {kind}')


def choose_anchored_parents(kind: str, endpoint: dict, endpoints: list[dict],
                            low_md: list[dict], bridges: list[dict],
                            rng: random.Random, low_md_share: float = .7) -> list[dict]:
    """Cross an explicit high-dimensional endpoint with low-M/D basins."""
    others = [row for row in endpoints if row['id'] != endpoint['id']]
    compact = [row for row in low_md if row['id'] != endpoint['id']]
    if not others or not compact:
        raise ValueError('Distinct endpoint and low-M/D parents are required')
    if kind == 'line':
        second = rng.choice(compact if rng.random() < low_md_share else others)
        return [endpoint, second]
    if kind == 'face':
        second = rng.choice(others)
        compact_pool = [row for row in compact if row['id'] != second['id']]
        if not compact_pool:
            raise ValueError('A low-M/D parent distinct from both endpoints is required')
        low = rng.choice(compact_pool)
        parents = [endpoint, second, low]
        bridge_pool = [row for row in bridges if row['id'] not in
                       {parent['id'] for parent in parents}]
        if bridge_pool:
            parents.append(rng.choice(bridge_pool))
        return parents
    raise ValueError(f'Unknown anchored proposal kind: {kind}')
