#!/usr/bin/env python3
"""Diagnose Round 2 opportunities in 21x26 IEUAO 399-unique pure-y:
1. Check whether D=0 is mathematically possible in 21x26 pure-y (with A=E=O or split A/E/O).
2. Check which of the 6 Palatal Triad permutations ((j,q,x) matched with (f,W,AEO))
   exist in the historical + Round 1 pools, and evaluate the new Palatal Triad families!
3. Identify all (M, D, V) and (Pmax, Home, Collision) pareto gaps from Round 1.
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
ORDINARY = [i for i in range(21) if len(opt.HEADS[i]) == 1]


def main():
    t0 = time.perf_counter()
    engine = load_scorer()
    data_dir = WORKTREE / "research-notes" / "data"
    hist_db = json.loads((data_dir / "shenyun-21x26-all-historical-pools-v3.json").read_text(encoding="utf-8"))["schemes"]
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]

    # 1. Check finals per head in 21x26 pure-y
    head_finals: dict[int, set[int]] = {i: set() for i in range(27)}
    for p in range(len(engine.py_h)):
        h = int(engine.py_h[p])
        f = int(engine.py_f[p])
        if h >= 0:
            head_finals[h].add(f)
    # Merge Y (25) and YU (26) for pure-y
    y_finals = head_finals[25] | head_finals[26]
    head_finals[25] = y_finals
    head_finals[26] = y_finals

    print("=== Disjoint Initial Pairs (can share an initial key without ANY final split) ===")
    disjoint_pairs = []
    active_heads = list(range(25)) + [25]
    for i, a in enumerate(active_heads):
        for b in active_heads[i + 1:]:
            if not (head_finals[a] & head_finals[b]):
                disjoint_pairs.append((opt.HEADS[a], opt.HEADS[b]))
    print("Disjoint pairs:", disjoint_pairs)

    # Check if D=0 is possible in 21x26 pure-y (even with split A/E/O)
    # At D=0, all 18 ordinary initials are fixed on their 18 keys.
    # Remaining 8 groups: zh(14), ch(15), sh(16), A(21), E(22), O(23), W(24), Y=YU(25,26).
    # Can zh, ch, sh, or Y share a key with ANY other head?
    for h_idx in [14, 15, 16, 25]:
        compat = [opt.HEADS[b] for b in active_heads if b != h_idx and not (head_finals[h_idx] & head_finals[b])]
        print(f"  Head {opt.HEADS[h_idx]} compatible with: {compat}")

    # 2. Analyze Palatal Triad pairings in Historical + Round 1
    j_idx = opt.HEADS.index("j")
    q_idx = opt.HEADS.index("q")
    x_idx = opt.HEADS.index("x")
    f_idx = opt.HEADS.index("f")
    w_idx = 24
    aeo_idx = 21

    def triad_signature(st):
        # Which of (j, q, x) shares with f, W, AEO?
        pal_map = {st[j_idx]: "j", st[q_idx]: "q", st[x_idx]: "x"}
        return (
            pal_map.get(st[f_idx], "none"),
            pal_map.get(st[w_idx], "none"),
            pal_map.get(st[aeo_idx], "none"),
        )

    from collections import Counter
    hist_sigs = Counter(triad_signature(r["state"]) for r in hist_db)
    r1_sigs = Counter(triad_signature(r["state"]) for r in r1_frontier)
    print("\n=== Palatal Triad Signatures (who shares with f, W, AEO) ===")
    print("  Historical 1,628 schemes:", dict(hist_sigs))
    print("  Round 1 40 frontier schemes:", dict(r1_sigs))

    # 3. Also check if ANY two of {f, W, A, E, O} are mutually disjoint!
    for a in [f_idx, w_idx, 21, 22, 23]:
        for b in [f_idx, w_idx, 21, 22, 23]:
            if a < b and not (head_finals[a] & head_finals[b]):
                print(f"  Mutual disjoint inside partner set: {opt.HEADS[a]} and {opt.HEADS[b]}!")

    print(f"\nDiagnosis completed in {time.perf_counter()-t0:.2f}s.")


if __name__ == "__main__":
    main()
