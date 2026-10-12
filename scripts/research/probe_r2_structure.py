#!/usr/bin/env python3
"""Deep structural probe for Round 2 of 21x26 IEUAO 399-unique pure-y:
1. Can {j,q,x} share initial keys with {g,k,h} and still pack 35 finals into 26 keys?
2. What happens when we split A, E, O across {j, q, x} (or O->N)?
3. What are the 6 permutations of {f, W, AEO} paired with {j, q, x}, and how much faster
   can they make D=1..8 schemes when combined with joint Initial+Final SA?
"""
from __future__ import annotations

import itertools
import json
import os
import sys
import time
from pathlib import Path

for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[k] = "1"

import numpy as np

WORKTREE = Path(__file__).resolve().parents[2]
REPLAY_DIR = Path(os.environ.get("TEMP", "/tmp")) / "rime-21x21-search" / "R11_integrated_replay"
sys.path.insert(0, str(REPLAY_DIR))
sys.path.insert(0, str(WORKTREE / "scripts" / "research"))

orig_cwd = os.getcwd()
os.chdir(REPLAY_DIR)
import opt
import r5_search as r5
import r9_search as r9
import search_engine as se
os.chdir(orig_cwd)

from harvest_all_21x26_pools import TONE_IEUAO, is_valid_21x26_pure_y, load_scorer

KEYS = opt.META["keys"]
KEY_IDX = {k: i for i, k in enumerate(KEYS)}


def check_final_packability(init_groups: list[list[int]]) -> tuple[bool, list[tuple[int, int]]]:
    """Given a partition of the 26 active heads (0..25 with 25=26) into 21 initial keys,
    two finals f1, f2 can share a final key iff no initial key group contains both a head
    taking f1 and a head taking f2.
    """
    ei = opt.PARAMS[15]
    er = opt.PARAMS[16]
    head_finals: dict[int, set[int]] = {i: set() for i in range(27)}
    for h_raw, r_raw in zip(ei, er):
        h = int(h_raw)
        f = int(r_raw) - 27
        head_finals[h].add(f)
    head_finals[25] |= head_finals[26]
    head_finals[26] = head_finals[25]

    group_finals = []
    for g in init_groups:
        gf = set()
        for h in g:
            if gf & head_finals[h]:
                return False, []
            gf |= head_finals[h]
        group_finals.append(gf)

    compat_final_pairs = []
    for f1 in range(35):
        for f2 in range(f1 + 1, 35):
            ok = True
            for gf in group_finals:
                if (f1 in gf) and (f2 in gf):
                    ok = False
                    break
            if ok:
                compat_final_pairs.append((f1, f2))
    return True, compat_final_pairs


def main():
    ei = opt.PARAMS[15]
    er = opt.PARAMS[16]
    j_i, q_i, x_i = opt.HEADS.index("j"), opt.HEADS.index("q"), opt.HEADS.index("x")
    f_i, g_i, k_i, h_i, n_i = (
        opt.HEADS.index("f"),
        opt.HEADS.index("g"),
        opt.HEADS.index("k"),
        opt.HEADS.index("h"),
        opt.HEADS.index("n"),
    )

    def make_partition(merged_sets: list[list[int]]) -> list[list[int]]:
        used = {h for s in merged_sets for h in s}
        part = [list(s) for s in merged_sets]
        for h in range(26):
            if h not in used:
                part.append([h])
        return part

    p_std = make_partition([[j_i, 21, 22, 23], [q_i, 24], [x_i, f_i]])
    ok, pairs_std = check_final_packability(p_std)
    print(f"Standard (j+AEO, q+W, x+f): len(groups)={len(p_std)}, valid={ok}, compat_final_pairs={len(pairs_std)}")

    p_k = make_partition([[j_i, 21, 22, 23], [q_i, f_i], [x_i, k_i]])
    ok_k, pairs_k = check_final_packability(p_k)
    print(f"Velar-k (j+AEO, q+f, x+k): len(groups)={len(p_k)}, valid={ok_k}, compat_final_pairs={len(pairs_k)}")
    for f1, f2 in pairs_k[:20]:
        print(f"   compat: ({opt.F[f1]}, {opt.F[f2]})")

    p_no = make_partition([[j_i, 21, 22], [q_i, 24], [x_i, f_i], [n_i, 23]])
    ok_no, pairs_no = check_final_packability(p_no)
    print(f"Split O->n (j+AE, q+W, x+f, n+O): valid={ok_no}, compat_final_pairs={len(pairs_no)}")

    # Also test splitting A, E, O across j, q, x when n+O or f+W?
    # What if (j+A, q+E+W? No, E&W overlap), what if (j+A+O, q+W, x+E) + where does f go?
    # Check all valid 21-group partitions of the 26 active heads (0..25)!
    head_finals: dict[int, set[int]] = {i: set() for i in range(27)}
    for h_raw, r_raw in zip(ei, er):
        head_finals[int(h_raw)].add(int(r_raw) - 27)
    head_finals[25] |= head_finals[26]
    head_finals[26] = head_finals[25]
    for z in range(26):
        compat = [opt.HEADS[b] for b in range(26) if b != z and not (head_finals[z] & head_finals[b])]
        if compat:
            print(f"  Head {opt.HEADS[z]:3s} disjoint from: {compat}")


if __name__ == "__main__":
    main()
