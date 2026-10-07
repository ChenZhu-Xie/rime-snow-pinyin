"""Exact integer-bucket evaluator for the frozen character and word B paths.

The caller supplies the imported benchmark module so that source, shape, and
stroke mappings are shared with the independently checked reference evaluator.
"""
from __future__ import annotations

import numpy as np
from numba import njit

NAMES = ('j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
TABLE_SIZE = 1 << 17


@njit(cache=True)
def _score(codes, chars, words, char_stamps, char_max, stroke_stamps,
           stroke_winners, word_stamps, word_keys, word_max, epoch, first_word):
    char_mass = 0
    char_wins = np.zeros(3, np.int64)
    missed_stroke = 0
    for i in range(len(chars)):
        py, tone, weight, shape1, shape2, stroke_bits = chars[i]
        base = codes[py]
        if base < 0:
            continue
        char_mass += weight
        paths = (base * 5 + shape1, base * 36 + shape1 * 6 + shape2,
                 base * 5 + tone)
        for track in range(3):
            path = paths[track]
            if char_stamps[track, path] != epoch:
                char_stamps[track, path] = epoch
                char_max[track, path] = weight
                char_wins[track] += weight
            elif weight > char_max[track, path]:
                char_wins[track] += weight - char_max[track, path]
                char_max[track, path] = weight
        for stroke in range(5):
            if stroke_bits & (1 << stroke):
                path = base * 25 + tone * 5 + stroke
                if stroke_stamps[path] != epoch:
                    stroke_stamps[path] = epoch
                    stroke_winners[path] = i
    for i in range(len(chars)):
        py, tone, weight, shape1, shape2, stroke_bits = chars[i]
        base = codes[py]
        if base < 0:
            continue
        won = False
        for stroke in range(5):
            if stroke_bits & (1 << stroke):
                path = base * 25 + tone * 5 + stroke
                if stroke_winners[path] == i:
                    won = True
                    break
        if not won:
            missed_stroke += weight

    word_mass = 0
    word_wins = np.zeros(4, np.int64)
    mask = TABLE_SIZE - 1
    for i in range(len(words)):
        py1, py2, tone1, tone2, weight, shape1, shape2 = words[i]
        c1, c2 = codes[py1], codes[py2]
        if c1 < 0 or c2 < 0:
            continue
        word_mass += weight
        base = c1 * 676 + c2
        first_shape = shape1 if first_word else shape2
        second_shape = shape2 if first_word else shape1
        paths = (base * 5 + first_shape, base * 25 + first_shape * 5 + second_shape,
                 base * 5 + tone2, base * 25 + tone2 * 5 + tone1)
        for track in range(4):
            path = paths[track]
            slot = (path * 2654435761) & mask
            while word_stamps[track, slot] == epoch and word_keys[track, slot] != path:
                slot = (slot + 1) & mask
            if word_stamps[track, slot] != epoch:
                word_stamps[track, slot] = epoch
                word_keys[track, slot] = path
                word_max[track, slot] = weight
                word_wins[track] += weight
            elif weight > word_max[track, slot]:
                word_wins[track] += weight - word_max[track, slot]
                word_max[track, slot] = weight
    out = np.empty(8, np.float64)
    for i in range(3):
        out[i] = (char_mass - char_wins[i]) / char_mass
    out[3] = missed_stroke / char_mass
    for i in range(4):
        out[i + 4] = (word_mass - word_wins[i]) / word_mass
    return out


class FastBuckets:
    def __init__(self, benchmark, first_word: bool = False):
        self.b = benchmark
        self.first_word = first_word
        aux = 'IVUAO'
        char_rows = []
        for char, py, tone, weight, common in sorted(
                (r for r in benchmark.COMMON if r[3] > 0),
                key=lambda r: (-r[3], r[0])):
            shape = benchmark.SHAPE[char].translate(benchmark.KEYTAO_SHAPE)
            stroke_bits = sum(1 << aux.index(stroke)
                              for stroke in benchmark.STROKE_OPTIONS[char])
            char_rows.append((py, tone - 1, weight, aux.index(shape[0]),
                              aux.index(shape[1]) if len(shape) > 1 else 5, stroke_bits))
        self.chars = np.array(char_rows, dtype=np.int32)
        word_rows = []
        for word, p1, p2, t1, t2, weight, lexicon, common in benchmark.WORDS:
            if weight <= 0:
                continue
            shape1 = benchmark.SHAPE[word[0]].translate(benchmark.KEYTAO_SHAPE)[0]
            shape2 = benchmark.SHAPE[word[1]].translate(benchmark.KEYTAO_SHAPE)[0]
            word_rows.append((p1, p2, t1 - 1, t2 - 1, weight,
                              aux.index(shape1), aux.index(shape2)))
        self.words = np.array(word_rows, dtype=np.int32)
        self.char_stamps = np.zeros((3, 24336), np.int32)
        self.char_max = np.zeros((3, 24336), np.int32)
        self.stroke_stamps = np.zeros(16900, np.int32)
        self.stroke_winners = np.zeros(16900, np.int32)
        self.word_stamps = np.zeros((4, TABLE_SIZE), np.int32)
        self.word_keys = np.zeros((4, TABLE_SIZE), np.int32)
        self.word_max = np.zeros((4, TABLE_SIZE), np.int32)
        self.epoch = 0

    def score(self, code_list):
        code_ids = np.array([ord(code[0]) * 26 + ord(code[1]) - 65 * 27
                             if code else -1 for code in code_list], np.int32)
        self.epoch += 1
        values = _score(code_ids, self.chars, self.words,
                        self.char_stamps, self.char_max, self.stroke_stamps,
                        self.stroke_winners, self.word_stamps, self.word_keys,
                        self.word_max, self.epoch, self.first_word)
        return dict(zip(NAMES, map(float, values)))
