"""Motif-aware proposal helpers for fixed-IVUAO completion searches."""
from __future__ import annotations

from collections import Counter
import random


MOTIFS = {
    'fast': {
        'i': 'P', 'ia': 'W', 'er': 'J', 'v': 'T',
        'in': 'G', 'ou': 'F', 'ai': 'H', 'iang': 'F',
    },
    'balanced': {
        'i': 'K', 'e': 'S', 'ing': 'D', 'ia': 'Z',
        'er': 'M', 'ei': 'G', 'uo': 'L', 'iang': 'F',
    },
    # Core shared by the low-D strict load/home frontier after ablating the
    # fast assignments that independently break its gates.
    'joint': {
        'er': 'J', 'in': 'G', 'ai': 'H', 'e': 'S', 'ing': 'D',
    },
}


def choose_motif(profile: str, rng: random.Random) -> str:
    if profile == 'mixed':
        return rng.choice(('fast', 'balanced'))
    if profile not in MOTIFS:
        raise ValueError(f'Unknown motif profile: {profile}')
    return profile


def apply_soft_motif(state, finals: list[str], keys: str, allowed: set[int],
                     profile: str, minimum: int, maximum: int,
                     rng: random.Random) -> tuple[bool, list[str]]:
    """Pin a random motif subset, then repair 21-key final coverage around it."""
    original = state.copy()
    motif = MOTIFS[choose_motif(profile, rng)]
    items = list(motif.items())
    maximum = min(maximum, len(items))
    minimum = min(minimum, maximum)
    chosen = rng.sample(items, rng.randint(minimum, maximum))
    protected = set()
    labels = []
    for final, key in chosen:
        position = 27 + finals.index(final)
        state[position] = keys.index(key)
        protected.add(position)
        labels.append(f'{final}->{key}')

    counts = Counter(map(int, state[27:62]))
    missing = list(allowed - set(counts))
    rng.shuffle(missing)
    for key in missing:
        replaceable = [position for position in range(27, 62)
                       if position not in protected and counts[int(state[position])] > 1]
        if not replaceable:
            state[:] = original
            return False, labels
        position = rng.choice(replaceable)
        counts[int(state[position])] -= 1
        state[position] = key
        counts[key] += 1
    valid = set(map(int, state[27:62])) == allowed
    if not valid:
        state[:] = original
    return valid, labels


def motif_final_positions(finals: list[str]) -> list[int]:
    names = set().union(*(motif.keys() for motif in MOTIFS.values()))
    return sorted(27 + finals.index(name) for name in names)
