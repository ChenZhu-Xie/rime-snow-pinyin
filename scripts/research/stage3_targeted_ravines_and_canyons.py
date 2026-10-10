#!/usr/bin/env python3
"""Stage 3: Targeted Excavation of Unexplored Ravines & Canyons in 21x26 IEUAO 399-unique pure-y.

1. Low-D / Low-M Ravine (D=1, 2, 3, 4; M=35, 36, 37, 38; solving the 'de' same-finger bottleneck
   via (x,f)->F home-key sharing, d->F/H/V, and V=1 e->W/S).
2. High-Home + Ultra-Low-Pinky Ravine (Home 44%..55%, Pmax <= 2.6%..3.39%, D=1..3).
3. 4-Code Cross-Family Collision Canyon (co-optimizing exact CKT v3 + 5-cut collision proxy + S2/E6).
4. Ultimate Speed Frontier Polish (pushing M40..M42 toward the 9.400 barrier and Pmax <= 3.39% under 9.45).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[k] = "1"

import numpy as np
from numba import njit

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

from fast_ckt_v3_21x26 import _eval_char_word2
from harvest_all_21x26_pools import (
    TONE_IEUAO,
    build_collision_proxy_arrays,
    collision_proxy_njit,
    is_valid_21x26_pure_y,
    load_scorer,
)
from stage2b_basin_descent import (
    KEY_IDX,
    ORDINARY,
    VIX,
    V_FINAL_IDX,
    V_KEY_IDX,
    _propose_final_move,
    _sa_optimize_finals,
    build_final_compat_matrix,
)


@njit
def _sa_optimize_canyon(
    start_st: np.ndarray,
    compat: np.ndarray,
    lock_vowels: int,
    lock_v: int,
    vix: np.ndarray,
    v_final_idx: int,
    v_key_idx: int,
    max_m: int,
    max_v: int,
    pmax_cap: float,
    s_w34: float,
    pen4: np.ndarray,
    c4_ref: np.ndarray,
    # [w_v3, w_s2, w_e6, w_coll, s2_target, e6_target]
    obj_weights: np.ndarray,
    steps: int,
    seed: int,
    temp0: float,
    py_h, py_f, aux, t2, t31, t32, t41, t42, t43, long_guard,
    c_s0_py_w, c_s1_py_a1_w, c_s2_py_a1_a2_w,
    sc1_ms_py, sc1_ms_tone, sc1_ms_mask, sc1_ms_w, char_total_w,
    w2_pair_p1, w2_pair_p2, w2_pair_w,
    w2_s0_tr, w2_s0_f0, w2_s0_p2, w2_s0_w,
    w2_s12_tr, w2_s12_f0, w2_s12_p2, w2_s12_a1, w2_s12_w,
    w2_s1_tr, w2_s1_p2, w2_s1_a1, w2_s1_w,
    w2_s2_tr, w2_s2_p2, w2_s2_a1, w2_s2_a2, w2_s2_w,
    w2_guard_ms, word2_total_w,
    opt_params,
    seq2, seq3, seq4, cw2, cw3, cw4,
    c_stamps, c_masks, c_counts, c_masses, c_maxima,
):
    np.random.seed(seed)
    s = start_st.copy()
    cache, vs = opt.initialize(s, opt_params)
    stamp = np.zeros(len(cache), np.int64)
    ids = np.empty(len(cache), np.int32)
    cs = np.empty(len(cache), np.float64)
    delta = np.zeros(60, np.float64)
    epoch = 0
    c_epoch = 1

    kc1, sc1, kw2, sw2 = _eval_char_word2(
        s, py_h, py_f, aux, t2, t31, t32, t41, t42, t43, long_guard,
        c_s0_py_w, c_s1_py_a1_w, c_s2_py_a1_a2_w,
        sc1_ms_py, sc1_ms_tone, sc1_ms_mask, sc1_ms_w, char_total_w,
        w2_pair_p1, w2_pair_p2, w2_pair_w,
        w2_s0_tr, w2_s0_f0, w2_s0_p2, w2_s0_w,
        w2_s12_tr, w2_s12_f0, w2_s12_p2, w2_s12_a1, w2_s12_w,
        w2_s1_tr, w2_s1_p2, w2_s1_a1, w2_s1_w,
        w2_s2_tr, w2_s2_p2, w2_s2_a1, w2_s2_a2, w2_s2_w,
        w2_guard_ms, word2_total_w,
    )
    s_tot = (
        s_w34
        + ((kc1 + pen4[0]) / c4_ref[0]) ** 4
        + 3.0 * ((kw2 + pen4[1]) / c4_ref[1]) ** 4
        + ((sc1 + pen4[2]) / c4_ref[2]) ** 4
        + 3.0 * ((sw2 + pen4[3]) / c4_ref[3]) ** 4
    )
    cur_v3 = 10.0 * ((s_tot / 12.0) ** 0.25)
    m_arr = opt.metrics(vs, opt_params)
    _, pm = r5.rp(s)
    cm = collision_proxy_njit(s, seq2, seq3, seq4, cw2, cw3, cw4, c_stamps, c_masks, c_counts, c_masses, c_maxima, c_epoch)
    p_aff = np.mean(cm[:, 0])
    cur_obj = (
        obj_weights[0] * cur_v3
        + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0005 * m_arr[0]
        + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.005 * m_arr[1]
        + obj_weights[3] * p_aff
        + 50.0 * max(0.0, pm - pmax_cap)
    )

    best_st = s.copy()
    best_obj = cur_obj
    best_v3 = cur_v3

    for it in range(steps):
        q, ok = _propose_final_move(s, compat, lock_vowels, lock_v, vix, v_final_idx, v_key_idx)
        if not ok:
            continue
        if opt.memory(q) > max_m or r5.vowelD(q) > max_v:
            continue
        _, pm_q = r5.rp(q)
        if pmax_cap < 0.99 and pm_q > pmax_cap + 1e-12:
            continue
        epoch += 1
        c_epoch += 1
        n = opt.probe(s, q, cache, opt_params, stamp, epoch, ids, cs, delta)
        nv = vs + delta
        kc1, sc1, kw2, sw2 = _eval_char_word2(
            q, py_h, py_f, aux, t2, t31, t32, t41, t42, t43, long_guard,
            c_s0_py_w, c_s1_py_a1_w, c_s2_py_a1_a2_w,
            sc1_ms_py, sc1_ms_tone, sc1_ms_mask, sc1_ms_w, char_total_w,
            w2_pair_p1, w2_pair_p2, w2_pair_w,
            w2_s0_tr, w2_s0_f0, w2_s0_p2, w2_s0_w,
            w2_s12_tr, w2_s12_f0, w2_s12_p2, w2_s12_a1, w2_s12_w,
            w2_s1_tr, w2_s1_p2, w2_s1_a1, w2_s1_w,
            w2_s2_tr, w2_s2_p2, w2_s2_a1, w2_s2_a2, w2_s2_w,
            w2_guard_ms, word2_total_w,
        )
        s_tot = (
            s_w34
            + ((kc1 + pen4[0]) / c4_ref[0]) ** 4
            + 3.0 * ((kw2 + pen4[1]) / c4_ref[1]) ** 4
            + ((sc1 + pen4[2]) / c4_ref[2]) ** 4
            + 3.0 * ((sw2 + pen4[3]) / c4_ref[3]) ** 4
        )
        q_v3 = 10.0 * ((s_tot / 12.0) ** 0.25)
        m_arr = opt.metrics(nv, opt_params)
        cm = collision_proxy_njit(q, seq2, seq3, seq4, cw2, cw3, cw4, c_stamps, c_masks, c_counts, c_masses, c_maxima, c_epoch)
        q_aff = np.mean(cm[:, 0])
        q_obj = (
            obj_weights[0] * q_v3
            + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0005 * m_arr[0]
            + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.005 * m_arr[1]
            + obj_weights[3] * q_aff
            + 50.0 * max(0.0, pm_q - pmax_cap)
        )
        temp = temp0 * ((1.0 - it / max(1, steps)) ** 2) + 1e-9
        if q_obj < cur_obj or np.random.random() < np.exp(min(0.0, (cur_obj - q_obj) / temp)):
            s = q
            vs = nv
            cur_obj = q_obj
            cur_v3 = q_v3
            for k in range(n):
                cache[ids[k]] = cs[k]
            if q_obj < best_obj - 1e-12:
                best_obj = q_obj
                best_v3 = q_v3
                best_st = q.copy()

    return best_st, best_v3, best_obj


def main():
    t0 = time.perf_counter()
    engine = load_scorer()
    corpus_seq, corpus_w = build_collision_proxy_arrays()
    stamps = np.zeros(26**4, np.int32)
    masks = np.zeros(26**4, np.uint8)
    counts = np.zeros(26**4, np.int16)
    masses = np.zeros(26**4, np.float64)
    maxima = np.zeros(26**4, np.float64)
    epoch = 0

    def eval_proxy(st: np.ndarray):
        nonlocal epoch
        epoch += 1
        m = collision_proxy_njit(
            st,
            corpus_seq[2], corpus_seq[3], corpus_seq[4],
            corpus_w[2], corpus_w[3], corpus_w[4],
            stamps, masks, counts, masses, maxima, epoch,
        )
        return float(np.mean(m[:, 0])), float(np.mean(m[:, 1]))

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

    def run_sa(st_init, lv, lvv, max_m, max_v, pmax_cap, obj_weights, steps=20000, seed=42, temp0=0.006):
        compat = build_final_compat_matrix(st_init, engine.py_h, engine.py_f)
        s_w34 = compute_s_w34(st_init)
        best_st, _, _ = _sa_optimize_finals(
            st_init, compat, lv, lvv, VIX, V_FINAL_IDX, V_KEY_IDX,
            max_m, max_v, pmax_cap, s_w34, pen4, c4_ref,
            np.array(obj_weights, dtype=np.float64), steps, seed, temp0,
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
        return best_st

    def run_canyon_sa(st_init, lv, lvv, max_m, max_v, pmax_cap, obj_weights, steps=4500, seed=42, temp0=0.006):
        compat = build_final_compat_matrix(st_init, engine.py_h, engine.py_f)
        s_w34 = compute_s_w34(st_init)
        stamps.fill(0)
        best_st, _, _ = _sa_optimize_canyon(
            st_init, compat, lv, lvv, VIX, V_FINAL_IDX, V_KEY_IDX,
            max_m, max_v, pmax_cap, s_w34, pen4, c4_ref,
            np.array(obj_weights, dtype=np.float64), steps, seed, temp0,
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
            corpus_seq[2], corpus_seq[3], corpus_seq[4],
            corpus_w[2], corpus_w[3], corpus_w[4],
            stamps, masks, counts, masses, maxima,
        )
        return best_st

    hist_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-all-historical-pools-v3.json").read_text(encoding="utf-8"))["schemes"]
    s2b_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage2b-basin-descent.json").read_text(encoding="utf-8"))["schemes"]
    by_id = {r["id"]: r for r in hist_db}
    def find_s2b(prefix: str) -> dict:
        for r in s2b_db:
            if r["tag"].startswith(prefix):
                return r
        raise KeyError(prefix)

    ref_mr29 = by_id["R10-21X26-M37-03"]["state"][27:62]
    ref_v1_e_w = by_id["R3-21X26-M36-11"]["state"][27:62]
    ref_v1_e_s = by_id["R6-21X26-M37-C19"]["state"][27:62]
    ref_v3_home = by_id["R7-21X26-M39-10"]["state"][27:62]
    ref_v4_home = by_id["R7-21X26-M40-11"]["state"][27:62]
    ref_v5_home = by_id["R6-21X26-M42-13"]["state"][27:62]
    ref_canyon = by_id["S21X26-CONT5-F06-M40-PURE-Y-CANYON-01"]["state"][27:62]
    ref_canyon_v0 = by_id["S21X26-CONT5-F08-M40-PURE-Y-PERFORMANCE-11"]["state"][27:62]
    tone_list = TONE_IEUAO.tolist()

    def make_init(overrides: dict[str, str], aeo_key: str = "J", w_key: str = "W", y_key: str = "Y") -> list[int]:
        st = [0] * 27
        for idx in ORDINARY:
            st[idx] = int(opt.PREF[idx])
        for h, k in overrides.items():
            st[opt.HEADS.index(h)] = KEY_IDX[k]
        st[21] = st[22] = st[23] = KEY_IDX[aeo_key]
        st[24] = KEY_IDX[w_key]
        st[25] = st[26] = KEY_IDX[y_key]
        return st

    # Part 1: Solving the 'de' (DE) bottleneck in D=1, 2, 3, 4 and High-Home Ravine
    ravine_seeds = [
        # D=1, V=1 (M=36): (x,f)->F so BOTH F and J are home-row index keys, and e->W or e->S eliminates 'DE'
        ("RAV-M36-D1-V1-XF-EW", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v1_e_w, 0, 1, 36, 1, 0.0339),
        ("RAV-M36-D1-V1-XF-ES", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v1_e_s, 0, 1, 36, 1, 0.0280),
        # D=2, V=0 (M=36): d moves off D -> 'de' is FE/HE/VE while V=0!
        ("RAV-M36-D2-V0-DF-FX", make_init({"d": "F", "f": "X", "zh": "V", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
        ("RAV-M36-D2-V0-XF-DV", make_init({"f": "F", "x": "F", "d": "V", "zh": "X", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
        ("RAV-M36-D2-V0-XF-DW", make_init({"f": "F", "x": "F", "d": "W", "zh": "V", "ch": "X", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
        # D=2, V=1 (M=36): (x,f)->F, q->W (W->W), e->W or e->S -> M=36, D=2, V=1 with S2~68ms!
        ("RAV-M36-D2-V1-XF-QW-EW", make_init({"f": "F", "x": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_v1_e_w, 0, 1, 36, 1, 0.0339),
        ("RAV-M36-D2-V1-XF-QW-ES", make_init({"f": "F", "x": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_v1_e_s, 0, 1, 36, 1, 0.0260),
        # D=3, V=0 (M=36): (x,f)->F, d->V/H, q->W (W->W), sh->D -> M=36, D=3, V=0 with S2~68ms and (x,f) on home F!
        ("RAV-M36-D3-V0-XF-DV-QW", make_init({"f": "F", "x": "F", "d": "V", "q": "W", "zh": "Q", "ch": "X", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
        ("RAV-M36-D3-V0-XF-DQ-QW", make_init({"f": "F", "x": "F", "d": "Q", "q": "W", "zh": "V", "ch": "X", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
        # D=3, V=0 (M=37): (x,f)->F, d->H, h->P, sh->D -> M=37, D=3, V=0 with S2~67ms!
        ("RAV-M37-D3-V0-XF-DH-HP", make_init({"f": "F", "x": "F", "d": "H", "h": "P", "p": "X", "zh": "V", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 38, 0, 0.0520),
        ("RAV-M37-D3-V0-XF-DH-HV", make_init({"f": "F", "x": "F", "d": "H", "h": "V", "zh": "X", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 37, 0, 0.0339),
        ("RAV-M37-D3-V0-XF-DR-RV", make_init({"f": "F", "x": "F", "d": "R", "r": "V", "zh": "X", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 37, 0, 0.0339),
        # D=3, V=1 (M=38): (x,f)->K, k->X + e->W (V=1) so BOTH v3~9.47 AND S2~67.5ms!
        ("RAV-M38-D3-V1-XFK-EW-LP", make_init({"f": "K", "x": "K", "k": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v1_e_w, 0, 1, 38, 1, 0.0339),
        ("RAV-M38-D3-V1-XFK-EW-52", make_init({"f": "K", "x": "K", "k": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v1_e_w, 0, 1, 38, 1, 0.0520),
        # D=4, V=0 (M=37): (x,f)->F, d->H, h->V, q->W (W->W), sh->D -> M=37, D=4, V=0, Pmax<=3.39%, S2~67.5ms!
        ("RAV-M37-D4-V0-XF-DH-HV-QW", make_init({"f": "F", "x": "F", "d": "H", "h": "V", "q": "W", "zh": "Q", "ch": "X", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29, 1, 1, 37, 0, 0.0339),
        ("RAV-M37-D4-V0-XF-DR-RV-QW", make_init({"f": "F", "x": "F", "d": "R", "r": "V", "q": "W", "zh": "Q", "ch": "X", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29, 1, 1, 37, 0, 0.0339),
        # D=4, V=0 (M=38): (x,f)->K, k->X, d->F, sh->D -> M=38, D=4, V=0, Pmax<=3.39%, S2~68.5ms, v3~9.49!
        ("RAV-M38-D4-V0-XFK-DF-LP", make_init({"f": "K", "x": "K", "k": "X", "d": "F", "zh": "V", "ch": "W", "sh": "D"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29, 1, 1, 38, 0, 0.0339),
        # High-Home Ravine: (x,f)->F or (x,f)->K with V=3, 4, 5 high-home finals
        ("HOM-M38-D1-V3-XF", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v3_home, 0, 1, 38, 3, 0.0339),
        ("HOM-M39-D1-V4-XF", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v4_home, 0, 1, 39, 4, 0.0339),
        ("HOM-M40-D1-V5-XF", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v5_home, 0, 1, 40, 5, 0.0310),
        ("HOM-M40-D3-V3-XFK", make_init({"f": "K", "x": "K", "k": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_v3_home, 0, 1, 40, 3, 0.0339),
        # Ultimate Speed Frontier Polish (40,000 steps from Stage 2B bests)
        ("ULT-M42-D8-V0-POLISH", find_s2b("D8-M42-TOP1-52")["state"][:27], find_s2b("D8-M42-TOP1-52")["state"][27:62], 1, 0, 42, 0, 0.0520),
        ("ULT-M41-D8-V0-POLISH", find_s2b("D8-M41-TOP1-M41-52")["state"][:27], find_s2b("D8-M41-TOP1-M41-52")["state"][27:62], 1, 1, 41, 0, 0.0520),
        ("ULT-M40-D7-V0-POLISH", find_s2b("D7-M40-XFK-M38-04-M40")["state"][:27], find_s2b("D7-M40-XFK-M38-04-M40")["state"][27:62], 1, 1, 40, 0, 0.0520),
        ("ULT-M40-D7-V0-LP-POLISH", find_s2b("D7-M40-XFK-R10-08-LP")["state"][:27], find_s2b("D7-M40-XFK-R10-08-LP")["state"][27:62], 1, 1, 40, 0, 0.0339),
    ]

    # Warmup
    st_warm = np.array(ravine_seeds[0][1] + ravine_seeds[0][2] + tone_list, dtype=np.int32)
    run_sa(st_warm, 0, 0, 45, 5, 0.99, [1.0, 0.01, 0.05, 0.0, 67.5, 9.95], steps=20, seed=1)
    run_canyon_sa(st_warm, 0, 0, 45, 5, 0.99, [1.0, 0.01, 0.05, 5.0, 68.5, 10.05], steps=20, seed=1)
    print(f"JIT warmup complete in {time.perf_counter()-t0:.2f}s. Running Stage 3 Ravine & Canyon excavation...", flush=True)

    discovered = []

    def record_state(st: np.ndarray, tag: str):
        if not is_valid_21x26_pure_y(st):
            return None
        ckt_v3, ckt_v3_raw, ums, res3, res4 = engine.score_all(st)
        kc1_ms, kw2_ms, kw3_ms, kw4_ms, sc1_ms, sw2_ms, sw3_ms, sw4_ms = ums
        desc = r5.describe(st)
        _, vals = opt.initialize(st, opt.PARAMS)
        m = opt.metrics(vals, opt.PARAMS)
        p_aff, p_loss = eval_proxy(st)
        rec = {
            "tag": tag,
            "M": desc["M"],
            "D": desc["D"],
            "V": desc["V"],
            "ckt_v3": float(ckt_v3),
            "ckt_v3_raw": float(ckt_v3_raw),
            "kc1_ms": float(kc1_ms),
            "sc1_ms": float(sc1_ms),
            "kw2_ms": float(kw2_ms),
            "sw2_ms": float(sw2_ms),
            "kw3_ms": float(kw3_ms),
            "sw3_ms": float(sw3_ms),
            "kw4_ms": float(kw4_ms),
            "sw4_ms": float(sw4_ms),
            "w3_p0": float(res3[0, 2]),
            "w4_p0": float(res4[0, 2]),
            "S2ms": float(m[0]),
            "E6": float(m[1]),
            "G6": float(m[2]),
            "V6": float(10.0 * r9.cw26(vals)),
            "homeS2": desc["homeS2"],
            "homeFloor": desc["homeFloor"],
            "Pmax": desc["rpMax"],
            "proxyAffected": p_aff,
            "proxyFirstLoss": p_loss,
            "state": st.tolist(),
        }
        discovered.append(rec)
        return rec

    for idx, (name, init_27, fin_35, lv, lvv, max_m, max_v, pmax_cap) in enumerate(ravine_seeds, 1):
        st0 = np.array(list(init_27) + list(fin_35) + tone_list, dtype=np.int32)
        if lvv == 1 and st0[V_FINAL_IDX] != V_KEY_IDX:
            ka = int(st0[V_FINAL_IDX])
            kb = V_KEY_IDX
            for i in range(27, 62):
                if st0[i] == ka:
                    st0[i] = kb
                elif st0[i] == kb:
                    st0[i] = ka

        is_hom = name.startswith("HOM-")
        is_ult = name.startswith("ULT-")
        profiles = (
            [
                ("HOM1", [1.0, 0.015, 0.08, 1.20, 68.5, 10.05], 22000, 500 + idx * 10),
                ("HOM2", [1.0, 0.010, 0.05, 0.60, 68.0, 10.00], 22000, 600 + idx * 10),
            ]
            if is_hom
            else [
                ("DEEP1", [1.0, 0.002, 0.015, 0.0, 67.2, 9.90], 35000, 700 + idx * 10),
                ("DEEP2", [1.0, 0.010, 0.080, 0.05, 66.8, 9.86], 35000, 800 + idx * 10),
            ]
            if is_ult
            else [
                ("BAL1", [1.0, 0.020, 0.15, 0.05, 67.5, 9.95], 22000, 100 + idx * 10),
                ("SPD1", [1.0, 0.006, 0.04, 0.02, 68.2, 10.02], 22000, 200 + idx * 10),
            ]
        )
        best_r = None
        cur_st = st0.copy()
        for p_name, weights, steps, rseed in profiles:
            out_st = run_sa(cur_st, lv, lvv, max_m, max_v, pmax_cap, weights, steps=steps, seed=rseed, temp0=0.006)
            rec = record_state(out_st, f"{name}-{p_name}")
            if rec and (best_r is None or rec["ckt_v3"] < best_r["ckt_v3"]):
                best_r = rec
                cur_st = out_st.copy()
        if best_r:
            r = best_r
            print(f"[Ravine {idx:2d}/{len(ravine_seeds)}] {name:26s} -> v3={r['ckt_v3']:.5f} M{r['M']}/D{r['D']}/V{r['V']} S2={r['S2ms']:.2f} E6={r['E6']:.4f} V6={r['V6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}%", flush=True)

    # Part 2: 4-Code Cross-Family Collision Canyon Optimization
    canyon_seeds = [
        ("CAN-F06-M40-V1", by_id["S21X26-CONT5-F06-M40-PURE-Y-CANYON-01"]["state"][:27], ref_canyon, 0, 0, 40, 1, 0.0339),
        ("CAN-F08-M39-V0", by_id["S21X26-CONT5-F08-M40-PURE-Y-PERFORMANCE-11"]["state"][:27], ref_canyon_v0, 1, 0, 39, 0, 0.0339),
        ("CAN-R10-M39-V0", by_id["R10-21X26-M39-08"]["state"][:27], ref_canyon_v0, 1, 0, 39, 0, 0.0339),
        ("CAN-XFK-M38-D5-V0", find_s2b("D4-M38-XFK-SHD-QW-52")["state"][:27], ref_mr29, 1, 1, 38, 0, 0.0339),
        ("CAN-XFK-M40-D7-V0", find_s2b("D7-M40-XFK-R10-08-LP")["state"][:27], ref_mr29, 1, 1, 40, 0, 0.0339),
        ("CAN-XF-M36-D3-V0", make_init({"f": "F", "x": "F", "d": "V", "q": "W", "zh": "Q", "ch": "X", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29, 1, 1, 36, 0, 0.0339),
    ]

    for idx, (name, init_27, fin_35, lv, lvv, max_m, max_v, pmax_cap) in enumerate(canyon_seeds, 1):
        st0 = np.array(list(init_27) + list(fin_35) + tone_list, dtype=np.int32)
        if lvv == 1 and st0[V_FINAL_IDX] != V_KEY_IDX:
            ka = int(st0[V_FINAL_IDX])
            kb = V_KEY_IDX
            for i in range(27, 62):
                if st0[i] == ka:
                    st0[i] = kb
                elif st0[i] == kb:
                    st0[i] = ka

        cur_st = st0.copy()
        for p_name, w_coll, rseed in (("COLL1", 12.0, 900 + idx), ("COLL2", 25.0, 950 + idx)):
            out_st = run_canyon_sa(cur_st, lv, lvv, max_m, max_v, pmax_cap, [1.0, 0.012, 0.08, w_coll, 68.5, 10.05], steps=5000, seed=rseed, temp0=0.005)
            rec = record_state(out_st, f"{name}-{p_name}")
            if rec:
                r = rec
                print(f"[Canyon {idx:2d}/{len(canyon_seeds)}] {name:20s}-{p_name} -> v3={r['ckt_v3']:.5f} M{r['M']}/D{r['D']}/V{r['V']} S2={r['S2ms']:.2f} E6={r['E6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}%", flush=True)
                cur_st = out_st.copy()

    dedup = {}
    for r in discovered:
        t = tuple(r["state"])
        if t not in dedup or r["ckt_v3"] < dedup[t]["ckt_v3"]:
            dedup[t] = r
    all_recs = sorted(dedup.values(), key=lambda x: x["ckt_v3"])

    out_path = WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage3-ravines-and-canyons.json"
    out_path.write_text(json.dumps({"count": len(all_recs), "schemes": all_recs}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCompleted Stage 3 in {time.perf_counter()-t0:.2f}s ({len(all_recs)} unique discoveries) -> {out_path}", flush=True)


if __name__ == "__main__":
    main()
