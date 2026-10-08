"""Enumerate the discrete coordinate face spanned by a few endpoint states."""
from __future__ import annotations

from itertools import product


def coordinate_face_spec(states, maximum: int):
    """Return the base, varying coordinate values, and combination count."""
    if len(states) < 2:
        raise ValueError('At least two endpoint states are required')
    width = len(states[0])
    if any(len(state) != width for state in states):
        raise ValueError('Endpoint states must have equal length')
    values = []
    for position in range(width):
        choices = tuple(dict.fromkeys(int(state[position]) for state in states))
        if len(choices) > 1:
            values.append((position, choices))
    combinations = 1
    for _, choices in values:
        combinations *= len(choices)
    if combinations > maximum:
        raise ValueError(f'Coordinate face has {combinations} combinations; maximum is {maximum}')
    return states[0].copy(), values, combinations


def iter_coordinate_face(base, values):
    """Yield coordinate-wise endpoint combinations without retaining the face."""
    for choice in product(*(choices for _, choices in values)):
        state = base.copy()
        for (position, _), value in zip(values, choice):
            state[position] = value
        yield state


def coordinate_face(states, maximum: int):
    """Return varying positions and all coordinate-wise endpoint combinations."""
    base, values, _ = coordinate_face_spec(states, maximum)
    return values, list(iter_coordinate_face(base, values))
