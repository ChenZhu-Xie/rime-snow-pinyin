"""Exact fast four-path B completion CKT scorer for IVUAO-locked 21x21 states.

The frozen R11 CKT role tensors and the same ranked Common8095/Snow rows are
used as in score_shenyun_completion_ckt.js. Numba stores the first candidate
for each stage code, then scores the shortest successful prefix.
"""
from __future__ import annotations

import base64
import gzip
import json
import re
from pathlib import Path

import numpy as np
from numba import njit

CHAR_SIZE = 34 * 34 * 36
WORD_SIZE = 1 << 17
WORD_MASK = WORD_SIZE - 1


@njit(cache=True)
def _slot(track, key, stamp, keys, epoch):
    pos = (key * 2654435761) & WORD_MASK
    while stamp[track, pos] == epoch and keys[track, pos] != key:
        pos = (pos + 1) & WORD_MASK
    return pos


@njit(cache=True)
def _cost(n, k0, k1, k2, k3, k4, k5, t2, t31, t32, t41, t42, t43, long_guard):
    if n == 2:
        return t2[k0 * 34 + k1]
    if n == 3:
        at = (k0 * 34 + k1) * 34 + k2
        return t31[at] + t32[at]
    at = (k0 * 34 + k1) * 34 + k2
    total = t41[at]
    at = at * 34 + k3
    total += t42[at]
    if n >= 5:
        at = ((k1 * 34 + k2) * 34 + k3) * 34 + k4
        total += t42[at]
    if n == 6:
        at = ((k2 * 34 + k3) * 34 + k4) * 34 + k5
        total += t42[at]
    if n == 4:
        at = (k1 * 34 + k2) * 34 + k3
    elif n == 5:
        at = (k2 * 34 + k3) * 34 + k4
    else:
        at = (k3 * 34 + k4) * 34 + k5
    return total + t43[at] + (n - 4) * long_guard


@njit(cache=True)
def _evaluate(st, char_rows, word_rows, pinyin_heads, pinyin_finals,
              cstamp, cwinner, wstamp, wkeys, wwinner, epoch, aux,
              t2, t31, t32, t41, t42, t43, long_guard):
    a = np.full(len(pinyin_heads), -1, np.int32)
    z = np.full(len(pinyin_heads), -1, np.int32)
    code = np.full(len(pinyin_heads), -1, np.int32)
    for p in range(len(a)):
        if pinyin_heads[p] >= 0:
            a[p] = st[pinyin_heads[p]]
            z[p] = st[pinyin_finals[p]]
            code[p] = (a[p] - 0) * 34 + z[p]
    for i in range(len(char_rows)):
        py, tone, weight, shape1, shape2, bits = char_rows[i]
        x = code[py]
        if x < 0:
            continue
        # The collision ID only needs to be unique for each pair; 34^2 is safe.
        paths = np.empty(4, np.int64)
        paths[0] = x
        paths[1] = x * 5 + shape1
        paths[2] = x * 36 + shape1 * 6 + shape2
        paths[3] = x * 5 + tone
        for track in range(4):
            key = paths[track]
            if cstamp[track, key] != epoch:
                cstamp[track, key] = epoch
                cwinner[track, key] = i
        for stroke in range(5):
            if bits & (1 << stroke):
                key = x * 25 + tone * 5 + stroke
                if cstamp[4, key] != epoch:
                    cstamp[4, key] = epoch
                    cwinner[4, key] = i
    for i in range(len(word_rows)):
        p1, p2, t1, t2_index, weight, sh1, sh2 = word_rows[i]
        if code[p1] < 0 or code[p2] < 0:
            continue
        base = code[p1] * 1156 + code[p2]
        paths = np.empty(5, np.int64)
        paths[0] = base
        paths[1] = base * 5 + sh2
        paths[2] = base * 25 + sh2 * 5 + sh1
        paths[3] = base * 5 + t2_index
        paths[4] = base * 25 + t2_index * 5 + t1
        for track in range(5):
            key = paths[track]
            pos = _slot(track, key, wstamp, wkeys, epoch)
            if wstamp[track, pos] != epoch:
                wstamp[track, pos] = epoch
                wkeys[track, pos] = key
                wwinner[track, pos] = i
    total = np.zeros(4, np.float64)
    missed = np.zeros(4, np.float64)
    mass_char = 0.0
    mass_word = 0.0
    for i in range(len(char_rows)):
        py, tone, weight, sh1, sh2, bits = char_rows[i]
        if code[py] < 0:
            continue
        mass_char += weight
        x = code[py]
        k0, k1 = a[py], z[py]
        won_k2 = cwinner[2, x * 36 + sh1 * 6 + sh2] == i
        if not won_k2:
            missed[0] += weight
        won_s2 = False
        for stroke in range(5):
            if bits & (1 << stroke) and cwinner[4, x * 25 + tone * 5 + stroke] == i:
                won_s2 = True
        if not won_s2:
            missed[1] += weight
        if cwinner[0, x] == i:
            value = _cost(2, k0, k1, 0, 0, 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
            total[0] += weight * value
            total[1] += weight * value
        else:
            if cwinner[1, x * 5 + sh1] == i:
                value = _cost(3, k0, k1, aux[sh1], 0, 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
            else:
                if sh2 == 5:
                    value = _cost(3, k0, k1, aux[sh1], 0, 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
                else:
                    value = _cost(4, k0, k1, aux[sh1], aux[sh2], 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
            total[0] += weight * value
            if cwinner[3, x * 5 + tone] == i:
                value = _cost(3, k0, k1, aux[tone], 0, 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
            else:
                best_all = 1e100
                best_win = 1e100
                for stroke in range(5):
                    if bits & (1 << stroke):
                        value = _cost(4, k0, k1, aux[tone], aux[stroke], 0, 0,
                                      t2, t31, t32, t41, t42, t43, long_guard)
                        best_all = min(best_all, value)
                        if cwinner[4, x * 25 + tone * 5 + stroke] == i:
                            best_win = min(best_win, value)
                if best_win == 1e100:
                    value = best_all
                else:
                    value = best_win
            total[1] += weight * value
    for i in range(len(word_rows)):
        p1, p2, tone1, tone2, weight, sh1, sh2 = word_rows[i]
        if code[p1] < 0 or code[p2] < 0:
            continue
        mass_word += weight
        k0, k1, k2, k3 = a[p1], z[p1], a[p2], z[p2]
        base = code[p1] * 1156 + code[p2]
        pos = _slot(2, base * 25 + sh2 * 5 + sh1, wstamp, wkeys, epoch)
        if wwinner[2, pos] != i:
            missed[2] += weight
        pos = _slot(4, base * 25 + tone2 * 5 + tone1, wstamp, wkeys, epoch)
        if wwinner[4, pos] != i:
            missed[3] += weight
        pos = _slot(0, base, wstamp, wkeys, epoch)
        if wwinner[0, pos] == i:
            value = _cost(4, k0, k1, k2, k3, 0, 0, t2, t31, t32, t41, t42, t43, long_guard)
            total[2] += weight * value
            total[3] += weight * value
        else:
            pos = _slot(1, base * 5 + sh2, wstamp, wkeys, epoch)
            if wwinner[1, pos] == i:
                value = _cost(5, k0, k1, k2, k3, aux[sh2], 0, t2, t31, t32, t41, t42, t43, long_guard)
            else:
                pos = _slot(2, base * 25 + sh2 * 5 + sh1, wstamp, wkeys, epoch)
                value = _cost(6, k0, k1, k2, k3, aux[sh2], aux[sh1], t2, t31, t32, t41, t42, t43, long_guard)
            total[2] += weight * value
            pos = _slot(3, base * 5 + tone2, wstamp, wkeys, epoch)
            if wwinner[3, pos] == i:
                value = _cost(5, k0, k1, k2, k3, aux[tone2], 0, t2, t31, t32, t41, t42, t43, long_guard)
            else:
                pos = _slot(4, base * 25 + tone2 * 5 + tone1, wstamp, wkeys, epoch)
                value = _cost(6, k0, k1, k2, k3, aux[tone2], aux[tone1], t2, t31, t32, t41, t42, t43, long_guard)
            total[3] += weight * value
    for track in range(2):
        total[track] /= mass_char
        missed[track] /= mass_char
    for track in range(2, 4):
        total[track] /= mass_word
        missed[track] /= mass_word
    return total, missed


class FastCompletion:
    def __init__(self, benchmark, html: Path):
        self.b = benchmark
        text = html.read_text(encoding='utf-8')
        match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
        if not match:
            raise ValueError('R11 payload missing')
        data = json.loads(gzip.decompress(base64.b64decode(match[1])))
        ckt = data['ckt']
        self.tables = [np.frombuffer(base64.b64decode(ckt['tables'][key]), dtype='<f8')
                       for key in ('L2i1', 'L3i1', 'L3i2', 'L4i1', 'L4i2', 'L4i3')]
        self.long_guard = ckt['calibration']['long_code']['guard_per_extra_segment_ms']
        self.aux = np.array([ckt['keys'].index(k) for k in 'IVUAO'], dtype=np.int32)
        from b_path_fast import FastBuckets
        fast = FastBuckets(benchmark)
        self.char_rows = fast.chars
        source_words = [(i, row) for i, row in enumerate(benchmark.WORDS) if row[5] > 0]
        order = [i for i, _ in sorted(source_words, key=lambda pair: (-pair[1][5], pair[1][0]))]
        self.word_rows = fast.words[np.array(order, dtype=np.int32)]
        from audit import split
        heads = {name: i for i, name in enumerate(benchmark.opt.HEADS)}
        finals = {name: i + 27 for i, name in enumerate(benchmark.opt.F)}
        self.heads = np.full(len(benchmark.DATA['pinyin']), -1, np.int32)
        self.finals = np.full(len(benchmark.DATA['pinyin']), -1, np.int32)
        for p, _ in benchmark.DATA['base']:
            h, f = split(benchmark.DATA['pinyin'][p])
            self.heads[p] = heads[h]
            self.finals[p] = finals[f]
        self.cstamp = np.zeros((5, CHAR_SIZE), np.int32)
        self.cwinner = np.zeros((5, CHAR_SIZE), np.int32)
        self.wstamp = np.zeros((5, WORD_SIZE), np.int32)
        self.wkeys = np.zeros((5, WORD_SIZE), np.int64)
        self.wwinner = np.zeros((5, WORD_SIZE), np.int32)
        self.epoch = 0

    def score(self, state):
        self.epoch += 1
        return _evaluate(np.asarray(state, dtype=np.int32), self.char_rows, self.word_rows,
                         self.heads, self.finals, self.cstamp, self.cwinner,
                         self.wstamp, self.wkeys, self.wwinner, self.epoch, self.aux,
                         *self.tables, self.long_guard)
