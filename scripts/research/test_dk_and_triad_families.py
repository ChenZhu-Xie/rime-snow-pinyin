#!/usr/bin/env python3
"""Test the newly discovered (x,f)->F + (q,W)->W + (j,AEO)->J + d->K/H/F + retroflex-to-home-row initial families."""
from __future__ import annotations

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
from stage2b_basin_descent import (
    KEY_IDX,
    VIX,
    V_FINAL_IDX,
    V_KEY_IDX,
    _sa_optimize_finals,
    build_final_compat_matrix,
)

KEYS = opt.META["keys"]


def make_init(overrides: dict[str, str], aeo_key: str, w_key: str, y_key: str = "Y") -> np.ndarray:
    st = np.zeros(27, dtype=np.int32)
    for i, h in enumerate(opt.HEADS[:21]):
        if len(h) == 1:
            st[i] = KEY_IDX[h.upper()]
    for h, k in overrides.items():
        st[opt.HEADS.index(h)] = KEY_IDX[k]
    st[21] = st[22] = st[23] = KEY_IDX[aeo_key]
    st[24] = KEY_IDX[w_key]
    st[25] = st[26] = KEY_IDX[y_key]
    return st


def main():
    engine = load_scorer()
    data_dir = WORKTREE / "research-notes" / "data"
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]

    # Collect V=0 (both v==V and v!=V) and V=1 final maps from Round 1
    v0_vlocked = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0 and r["state"][V_FINAL_IDX] == V_KEY_IDX]
    v0_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0]
    v1_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1]

    pen4 = np.zeros(4, dtype=np.float64)
    c4_ref = np.zeros(4, dtype=np.float64)
    for out_i, (mode, kind, s005_i) in enumerate((
        ("keytao", "character", 0),
        ("keytao", "word2", 1),
        ("sanpin", "character", 4),
        ("sanpin", "word2", 5),
    )):
        cs = engine.const_stats[(mode, kind)]
        pen4[out_i] = 600.0 * cs["p2"] + 300.0 * cs["f1"] + 300.0 * cs["f2"]
        b_ums, b_p2, b_f1, b_f2 = engine.s005_tracks[s005_i]
        c4_ref[out_i] = b_ums + 600.0 * b_p2 + 300.0 * b_f1 + 300.0 * b_f2

    def compute_s_w34(st: np.ndarray) -> float:
        res3, res4 = engine.eval_w3_w4_cached(st)
        s_w34 = 0.0
        for track_idx, (res, row_i, base_k) in enumerate(((res3, 0, 3.0), (res4, 0, 4.0), (res3, 1, 3.0), (res4, 1, 4.0))):
            s005_idx = [2, 3, 6, 7][track_idx]
            ums = float(res[row_i, 0])
            p2 = float(res[row_i, 4])
            f1 = float(res[row_i, 2])
            f2 = max(0.0, float(res[row_i, 1]) - base_k - f1)
            b_ums, b_p2, b_f1, b_f2 = engine.s005_tracks[s005_idx]
            a = ums + 600.0 * p2 + 300.0 * f1 + 300.0 * f2
            c = b_ums + 600.0 * b_p2 + 300.0 * b_f1 + 300.0 * b_f2
            s_w34 += (a / c) ** 4
        return s_w34

    candidates = [
        # D=2, M=35 (with lock_v=1)
        ("M35-D2-XF-QW-JAEO", 1, 1, 35, 0, 0.0339, make_init({"x": "F", "q": "W", "zh": "V", "ch": "Q", "sh": "X"}, "J", "W")),
        ("M35-D2-QF-XW-JAEO", 1, 1, 35, 0, 0.0339, make_init({"q": "F", "x": "W", "zh": "V", "ch": "X", "sh": "Q"}, "J", "W")),
        # D=3, M=36 (with lock_v=1)
        ("M36-D3-XF-QW-KX-SHK", 1, 1, 36, 0, 0.0339, make_init({"x": "F", "q": "W", "k": "X", "zh": "V", "ch": "Q", "sh": "K"}, "J", "W")),
        ("M36-D3-XF-QW-DV-SHD", 1, 1, 36, 0, 0.0339, make_init({"x": "F", "q": "W", "d": "V", "zh": "X", "ch": "Q", "sh": "D"}, "J", "W")),
        ("M36-D3-JF-QW-DF-SHD", 1, 1, 36, 0, 0.0339, make_init({"f": "J", "q": "W", "d": "F", "zh": "V", "ch": "Q", "sh": "D"}, "X", "W")),
        # D=4, M=37 (with lock_v=1)
        ("M37-D4-XF-QW-DK-KX-SHD", 1, 1, 37, 0, 0.0339, make_init({"x": "F", "q": "W", "d": "K", "k": "X", "zh": "V", "ch": "Q", "sh": "D"}, "J", "W")),
        ("M37-D4-XF-QW-DH-HV-SHD", 1, 1, 37, 0, 0.0339, make_init({"x": "F", "q": "W", "d": "H", "h": "V", "zh": "X", "ch": "Q", "sh": "D"}, "J", "W")),
        ("M37-D4-XFK-QW-KX-ZHF", 1, 1, 37, 0, 0.0285, make_init({"f": "K", "x": "K", "k": "X", "q": "W", "zh": "F", "ch": "V", "sh": "Q"}, "J", "W")),
        # D=5, M=38 (with lock_v=1) and M=39 (with lock_v=0)
        ("M38-D5-XF-QW-DK-KX-HV", 1, 1, 38, 0, 0.0339, make_init({"x": "F", "q": "W", "d": "K", "k": "X", "h": "V", "zh": "H", "ch": "Q", "sh": "D"}, "J", "W")),
        ("M39-D5-XF-QW-DK-KX-HV-uV", 1, 0, 39, 0, 0.0285, make_init({"x": "F", "q": "W", "d": "K", "k": "X", "h": "V", "zh": "H", "ch": "Q", "sh": "D"}, "J", "W")),
        ("M39-D5-JF-QW-XK-KX-DF-uV", 1, 0, 39, 0, 0.0285, make_init({"f": "J", "q": "W", "x": "K", "k": "X", "d": "F", "zh": "V", "ch": "Q", "sh": "D"}, "K", "W")),
        # D=6, M=39 (with lock_v=1)
        ("M39-D6-XF-QW-DK-KX-HV-CQ", 1, 1, 39, 0, 0.0285, make_init({"x": "F", "q": "W", "d": "K", "k": "X", "h": "V", "c": "Q", "zh": "H", "ch": "C", "sh": "D"}, "J", "W")),
        ("M39-D6-JF-QW-XK-KX-DF-HV", 1, 1, 39, 0, 0.0285, make_init({"f": "J", "q": "W", "x": "K", "k": "X", "d": "F", "h": "V", "zh": "H", "ch": "Q", "sh": "D"}, "K", "W")),
    ]

    for tag, lv, lvv, max_m, max_v, pmax_cap, init_st in candidates:
        pool = v0_vlocked if lvv else v0_all
        best_start = None
        best_v3 = 99.0
        for fin_st in pool:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin_st
            st[62:] = TONE_IEUAO
            if opt.memory(st) > max_m:
                continue
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v3:
                best_v3 = v3
                best_start = st.copy()

        if best_start is None:
            print(f"  {tag}: no valid start")
            continue

        compat = build_final_compat_matrix(best_start, engine.py_h, engine.py_f)
        s_w34 = compute_s_w34(best_start)
        best_sa = best_start.copy()
        best_sa_v3 = best_v3
        for sd in range(6):
            cand_st, _, _ = _sa_optimize_finals(
                best_sa if sd > 0 else best_start,
                compat, lv, lvv, VIX, V_FINAL_IDX, V_KEY_IDX,
                max_m, max_v, pmax_cap, s_w34, pen4, c4_ref,
                np.array([1.0, 0.002, 0.02, 0.02, 70.0, 10.1], dtype=np.float64),
                20000, 100 + sd * 17, 0.005,
                engine.py_h, engine.py_f, engine.aux,
                *engine.tables, engine.long_guard,
                engine.c_s0_py_w, engine.c_s1_py_a1_w, engine.c_s2_py_a1_a2_w,
                engine.sc1_ms_py, engine.sc1_ms_tone, engine.sc1_ms_mask, engine.sc1_ms_w, engine.char_total_w,
                engine.w2_pair_p1, engine.w2_pair_p2, engine.w2_pair_w,
                engine.w2_s0_tr, engine.w2_s0_f0, engine.w2_s0_p2, engine.w2_s0_w,
                engine.w2_s12_tr, engine.w2_s12_f0, engine.w2_s12_p2, engine.w2_s12_a1, engine.w2_s12_w,
                engine.w2_s1_tr, engine.w2_s1_p2, engine.w2_s1_a1, engine.w2_s1_w,
                engine.w2_s2_tr, engine.w2_s2_p2, engine.w2_s2_a1, engine.w2_s2_a2, engine.w2_s2_w,
                engine.w2_guard_ms, engine.word2_total_w,
                opt.PARAMS,
            )
            v3 = float(engine.score_all(cand_st)[0])
            _, pm = r5.rp(cand_st)
            if pm <= pmax_cap + 1e-9 and v3 < best_sa_v3:
                best_sa_v3 = v3
                best_sa = cand_st.copy()

        _, out = opt.initialize(best_sa, opt.PARAMS)
        m4 = opt.metrics(out, opt.PARAMS)
        desc = r5.describe(best_sa)
        print(
            f"  {tag:28s} -> M{desc['M']}/D{desc['D']}/V{desc['V']} | start={best_v3:.5f} -> SA={best_sa_v3:.5f} | "
            f"S2={float(m4[0]):.2f} E6={float(m4[1]):.4f} | Home={desc['homeS2']*100:.2f}% Pmax={desc['rpMax']*100:.2f}%"
        )


if __name__ == "__main__":
    main()
