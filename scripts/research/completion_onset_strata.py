"""Preserve and mutate distinct onset assignments during completion search."""

from __future__ import annotations

import random


def _rank(row: dict) -> tuple[float, float, str]:
    return (row['eightWorstRatio'], row.get('ckt12', float('inf')), row['id'])


def select_onset_representatives(
        rows: list[dict], onset_count: int = 27, limit: int = 24,
        metric_keys: tuple[str, ...] = ('eightWorstRatio',)) -> list[dict]:
    """Retain per-signature extremes and balance them across metrics."""
    strata: dict[tuple[int, ...], list[dict]] = {}
    for row in rows:
        signature = tuple(map(int, row['state'][:onset_count]))
        strata.setdefault(signature, []).append(row)
    candidates = {}
    for group in strata.values():
        for key in metric_keys:
            row = min(group, key=lambda item: (item[key], *_rank(item)))
            candidates[row['id']] = row
    ranked = [sorted(candidates.values(), key=lambda row: (row[key], *_rank(row)))
              for key in metric_keys]
    selected = {}
    for offset in range(max((len(items) for items in ranked), default=0)):
        for items in ranked:
            if offset < len(items):
                selected[items[offset]['id']] = items[offset]
                if len(selected) >= limit:
                    return list(selected.values())
    return list(selected.values())


def mutate_onsets(state, physical: list[int], minimum: int, maximum: int,
                  rng: random.Random) -> list[int]:
    """Change a requested number of onset coordinates in place."""
    count = rng.randint(minimum, maximum)
    positions = sorted(rng.sample(range(27), count))
    for position in positions:
        choices = [key for key in physical if key != int(state[position])]
        state[position] = rng.choice(choices)
    return positions


def select_stratified_beam(rows: list[dict], per_displaced: int,
                           objective_keys: tuple[str, ...]) -> list[dict]:
    """Round-robin objective extremes while reserving equal D strata."""
    selected = []
    for displaced in sorted({row['D'] for row in rows}):
        group = [row for row in rows if row['D'] == displaced]
        rankings = [sorted(group, key=lambda row: (row[key], row['id']))
                    for key in objective_keys]
        chosen = {}
        for offset in range(len(group)):
            for ranking in rankings:
                if offset < len(ranking):
                    chosen[ranking[offset]['id']] = ranking[offset]
                    if len(chosen) >= per_displaced:
                        break
            if len(chosen) >= per_displaced:
                break
        selected.extend(chosen.values())
    return selected
