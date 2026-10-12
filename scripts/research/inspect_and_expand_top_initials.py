#!/usr/bin/env python3
"""Inspect the new top initial topologies from Weapon 1 and perform a 2-hop initial expansion around the best seeds across all (M, D, No-DE, Pmax, Home) buckets."""
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
import search_engine as se
os.chdir(orig_cwd)

from fast_ckt_v3_21x26 import _eval_char_word2
from harvest_all_21x26_pools import TONE_IEUAO, load_scorer
from stage2b_basin_descent import KEY_IDX, V_FINAL_IDX, V_KEY_IDX

KEYS = opt.META["keys"][:26]
HEADS = opt.HEADS


def format_init(init_st: np.ndarray) -> str:
    by_k: dict[str, list[str]] = {}
    for i, h in enumerate(HEADS):
        k = KEYS[int(init_st[i])]
        by_k.setdefault(k, []).append(h)
    parts = []
    for k in sorted(by_k.keys()):
        hs = by_k[k]
        if len(hs) == 1 and hs[0].upper() == k:
            continue
        parts.append(f"{'/'.join(hs)}->{k}")
    return ", ".join(parts)


def main():
    data_dir = WORKTREE / "research-notes" / "data"
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]
    elites = json.loads((data_dir / "r2_elite_initial_topologies.json").read_text(encoding="utf-8"))["topologies"]

    print("=== Inspecting Breakthrough Initial Topologies ===")
    for m_v0 in sorted(set(r["M_v0"] for r in elites)):
        sub = sorted([r for r in elites if r["M_v0"] == m_v0], key=lambda x: x["best_v0"])
        best_all = sub[0]
        sub_lp = [r for r in sub if r["pmax"] <= 0.0340]
        best_lp = sub_lp[0] if sub_lp else None
        sub_ul = [r for r in sub if r["pmax"] <= 0.0285]
        best_ul = sub_ul[0] if sub_ul else None
        print(f"\n[M_V0={m_v0}]")
        print(f"  SPEED : {best_all['tag']:36s} D={best_all['D']} V0={best_all['best_v0']:.5f} V1={best_all['best_v1']:.5f} Home={best_all['home_s2']*100:.2f}% Pmax={best_all['pmax']*100:.2f}%")
        print(f"          {format_init(np.array(best_all['init_state']))}")
        if best_lp and best_lp["tag"] != best_all["tag"]:
            print(f"  LP3.38: {best_lp['tag']:36s} D={best_lp['D']} V0={best_lp['best_v0']:.5f} V1={best_lp['best_v1']:.5f} Home={best_lp['home_s2']*100:.2f}% Pmax={best_lp['pmax']*100:.2f}%")
            print(f"          {format_init(np.array(best_lp['init_state']))}")
        if best_ul and (not best_lp or best_ul["tag"] != best_lp["tag"]):
            print(f"  UL2.84: {best_ul['tag']:36s} D={best_ul['D']} V0={best_ul['best_v0']:.5f} V1={best_ul['best_v1']:.5f} Home={best_ul['home_s2']*100:.2f}% Pmax={best_ul['pmax']*100:.2f}%")
            print(f"          {format_init(np.array(best_ul['init_state']))}")


if __name__ == "__main__":
    main()
