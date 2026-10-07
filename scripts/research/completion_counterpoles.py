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
