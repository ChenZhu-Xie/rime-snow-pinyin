#!/usr/bin/env python3
"""Stage 2B: Ultra-fast Numba Joint & Final-Space Basin Optimizer for 21x26 IEUAO 399-unique pure-y.

Executes exact CKT v3 + R11 factor model (S2ms, E6, G6) + Home + Right-Pinky + 4-code Collision
simulated annealing and steepest coordinate descent across all (M, D, V) and multi-objective basins.
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

KEYS = opt.META["keys"]
KEY_IDX = {k: i for i, k in enumerate(KEYS)}
ORDINARY = np.array(se.ORD, dtype=np.int32)
VIX = np.array([27 + opt.F.index(v) for v in "aeiou"], dtype=np.int32)
V_FINAL_IDX = 27 + opt.F.index("v")
V_KEY_IDX = KEY_IDX["V"]


def build_final_compat_matrix(st_init: np.ndarray, base_py_h: np.ndarray, base_py_f: np.ndarray) -> np.ndarray:
    """Return (35, 35) uint8 matrix where compat[f1, f2] == 1 iff f1 != f2 and they never co-occur on the same initial key."""
    incompat = np.zeros((35, 35), dtype=np.uint8)
    for f in range(35):
        incompat[f, f] = 1
    by_key = [[] for _ in range(26)]
    for p in range(len(base_py_h)):
        h = base_py_h[p]
        if h < 0:
            continue
        f = base_py_f[p] - 27
        k = st_init[h]
        by_key[k].append(f)
    for k in range(26):
        fs = by_key[k]
        for i in range(len(fs)):
            fi = fs[i]
            for j in range(len(fs)):
                incompat[fi, fs[j]] = 1
    return (1 - incompat).astype(np.uint8)


@njit
def _in_vix(val: int, vix: np.ndarray) -> bool:
    for i in range(len(vix)):
        if val == vix[i]:
            return True
    return False


@njit
def _propose_final_move(
    st: np.ndarray,
    compat: np.ndarray,
    lock_vowels: int,
    lock_v: int,
    vix: np.ndarray,
    v_final_idx: int,
    v_key_idx: int,
) -> tuple[np.ndarray, bool]:
    """Propose a 100% 399-unique move in st[27:62]."""
    q = st.copy()
    kind = np.random.randint(100)
    if kind < 45:
        ka = np.random.randint(26)
        kb = np.random.randint(26)
        if ka == kb:
            return q, False
        if lock_vowels:
            for i in range(len(vix)):
                kv = st[vix[i]]
                if ka == kv or kb == kv:
                    return q, False
        if lock_v:
            if ka == v_key_idx or kb == v_key_idx:
                return q, False
        for i in range(27, 62):
            if q[i] == ka:
                q[i] = kb
            elif q[i] == kb:
                q[i] = ka
        return q, True
    elif kind < 80:
        f = np.random.randint(35)
        tok = 27 + f
        if lock_vowels and _in_vix(tok, vix):
            return q, False
        if lock_v and tok == v_final_idx:
            return q, False
        k_old = q[tok]
        cnt_old = 0
        for i in range(27, 62):
            if q[i] == k_old:
                cnt_old += 1
        if cnt_old < 2:
            return q, False
        k_new = np.random.randint(26)
        if k_new == k_old:
            return q, False
        for i in range(27, 62):
            if q[i] == k_new:
                if not compat[f, i - 27]:
                    return q, False
        q[tok] = k_new
        return q, True
    else:
        f1 = np.random.randint(35)
        f2 = np.random.randint(35)
        if f1 == f2:
            return q, False
        t1 = 27 + f1
        t2 = 27 + f2
        if lock_vowels and (_in_vix(t1, vix) or _in_vix(t2, vix)):
            return q, False
        if lock_v and (t1 == v_final_idx or t2 == v_final_idx):
            return q, False
        k1 = q[t1]
        k2 = q[t2]
        if k1 == k2:
            return q, False
        for i in range(27, 62):
            if i != t2 and q[i] == k2:
                if not compat[f1, i - 27]:
                    return q, False
            if i != t1 and q[i] == k1:
                if not compat[f2, i - 27]:
                    return q, False
        q[t1] = k2
        q[t2] = k1
        return q, True


@njit
def _sa_optimize_finals(
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
):
    np.random.seed(seed)
    s = start_st.copy()
    cache, vs = opt.initialize(s, opt_params)
    stamp = np.zeros(len(cache), np.int64)
    ids = np.empty(len(cache), np.int32)
    cs = np.empty(len(cache), np.float64)
    delta = np.zeros(60, np.float64)
    epoch = 0

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
    h_s2, _, _, _ = r5.home(s)
    _, pm = r5.rp(s)
    cur_obj = (
        obj_weights[0] * cur_v3
        + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0005 * m_arr[0]
        + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.005 * m_arr[1]
        - obj_weights[3] * h_s2
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
        h_s2, _, _, _ = r5.home(q)
        q_obj = (
            obj_weights[0] * q_v3
            + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0005 * m_arr[0]
            + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.005 * m_arr[1]
            - obj_weights[3] * h_s2
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

    # Precompute pen4 and c4_ref for kc1 (0), kw2 (1), sc1 (4), sw2 (5)
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

    def run_sa(
        st_init: np.ndarray,
        lock_vowels: int,
        lock_v: int,
        max_m: int,
        max_v: int,
        pmax_cap: float,
        obj_weights: list[float],
        steps: int = 12000,
        seed: int = 42,
        temp0: float = 0.008,
    ) -> np.ndarray:
        compat = build_final_compat_matrix(st_init, engine.py_h, engine.py_f)
        s_w34 = compute_s_w34(st_init)
        best_st, _, _ = _sa_optimize_finals(
            st_init,
            compat,
            lock_vowels,
            lock_v,
            VIX,
            V_FINAL_IDX,
            V_KEY_IDX,
            max_m,
            max_v,
            pmax_cap,
            s_w34,
            pen4,
            c4_ref,
            np.array(obj_weights, dtype=np.float64),
            steps,
            seed,
            temp0,
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

    hist_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-all-historical-pools-v3.json").read_text(encoding="utf-8"))["schemes"]
    s1_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage1-bilinear-sweep.json").read_text(encoding="utf-8"))
    s2a_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage2a-face-sweeps.json").read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in hist_db}

    # Reference M_R = 29 (V=0, v->V, Pmax=3.39%) final map from SNF4-M35-AE-01 and R10-21X26-M37-03
    ref_mr29_final_1 = by_id["SNF4-M35-AE-01"]["state"][27:62]
    ref_mr29_final_2 = by_id["R10-21X26-M37-03"]["state"][27:62]
    # Fast M_R = 30 (V=0, v!=V, Pmax=3.39%) final map from R10-21X26-M39-08
    ref_mr30_lp_final = by_id["R10-21X26-M39-08"]["state"][27:62]
    # Fast M_R = 30 (V=0, v!=V, Pmax=5.19%) final map from NF4I-AE-Z-M40-09
    ref_mr30_fast_final = by_id["NF4I-AE-Z-M40-09"]["state"][27:62]
    tone_list = TONE_IEUAO.tolist()

    # Construct structured low-D / low-M initial layouts including the new (x,f)->F and (x,f)->K families
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

    special_seeds = [
        # --- Campaign 2: D=1 (M=35, M=36) ---
        ("D1-M35-FX-1", make_init({"f": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_1, 1, 1, 35, 0, 0.0339),
        ("D1-M35-FX-2", make_init({"f": "X", "zh": "V", "ch": "F", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_2, 1, 1, 35, 0, 0.0339),
        ("D1-M35-FX-3", make_init({"f": "X", "zh": "W", "ch": "V", "sh": "F"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_1, 1, 1, 35, 0, 0.0339),
        ("D1-M35-XF-1", make_init({"f": "F", "x": "F", "zh": "X", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_1, 1, 1, 35, 0, 0.0339),
        ("D1-M35-XF-2", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_2, 1, 1, 35, 0, 0.0339),
        ("D1-M35-XF-3", make_init({"f": "F", "x": "F", "zh": "W", "ch": "V", "sh": "X"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_1, 1, 1, 35, 0, 0.0339),
        ("D1-M36-FX-V0", make_init({"f": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr30_lp_final, 1, 0, 36, 0, 0.0339),
        ("D1-M36-XF-V0", make_init({"f": "F", "x": "F", "zh": "V", "ch": "X", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr30_lp_final, 1, 0, 36, 0, 0.0339),
        ("D1-M36-FX-V1", s1_db["best_low_pinky"]["M36_D1"]["state"][:27], s1_db["best_low_pinky"]["M36_D1"]["state"][27:62], 0, 1, 36, 1, 0.0339),

        # --- Campaign 3: D=2 (M=35, M=36, M=37) ---
        ("D2-M35-XF-QW-1", make_init({"f": "F", "x": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_1, 1, 1, 35, 0, 0.0339),
        ("D2-M35-XF-QW-2", make_init({"f": "F", "x": "F", "q": "W", "zh": "Q", "ch": "V", "sh": "X"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_2, 1, 1, 35, 0, 0.0339),
        ("D2-M36-XF-QW-V0", make_init({"f": "F", "x": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr30_lp_final, 1, 0, 36, 0, 0.0339),
        ("D2-M36-XF-QW-V1", by_id["R6-21X26-M37-C19"]["state"][:27], ref_mr29_final_1, 0, 1, 36, 1, 0.0339),
        ("D2-M37-C19-LP", by_id["R6-21X26-M37-C19"]["state"][:27], by_id["R6-21X26-M37-C19"]["state"][27:62], 0, 0, 37, 1, 0.0260),
        ("D2-M37-C19-FAST", by_id["R6-21X26-M37-C19"]["state"][:27], ref_mr30_lp_final, 1, 0, 36, 0, 0.0339),

        # --- Campaign 3: D=3 (M=36, M=37, M=38) ---
        ("D3-M36-DF-QW-V0", by_id["SNF4-M36-AE-08"]["state"][:27], ref_mr29_final_2, 1, 1, 36, 0, 0.0339),
        ("D3-M36-XFK-QW-V0", make_init({"f": "K", "x": "K", "k": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_1, 1, 1, 36, 0, 0.0339),
        ("D3-M36-XFD-QW-V0", make_init({"f": "D", "x": "D", "d": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_2, 1, 1, 36, 0, 0.0339),
        ("D3-M37-XFK-LP-V0", s1_db["best_low_pinky"]["M37_D3"]["state"][:27], ref_mr29_final_2, 1, 1, 37, 0, 0.0339),
        ("D3-M37-XFK-QW-V0", make_init({"f": "K", "x": "K", "k": "F", "q": "W", "zh": "V", "ch": "X", "sh": "Q"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr30_lp_final, 1, 0, 37, 0, 0.0339),
        ("D3-M37-XFK-SHD-V0", make_init({"f": "K", "x": "K", "k": "X", "zh": "F", "ch": "V", "sh": "W"}, aeo_key="J", w_key="Q", y_key="Y"), ref_mr29_final_2, 1, 1, 37, 0, 0.0339),
        ("D3-M38-XFK-LP-V0", s1_db["best_low_pinky"]["M37_D3"]["state"][:27], ref_mr30_lp_final, 1, 0, 38, 0, 0.0339),
        ("D3-M38-XFK-FAST-V0", s1_db["best_low_pinky"]["M37_D3"]["state"][:27], ref_mr30_fast_final, 1, 0, 38, 0, 0.0520),
        ("D3-M38-XFP-FAST-V0", s1_db["best_by_mdv"]["M37_D3_V0"]["state"][:27], ref_mr30_fast_final, 1, 0, 38, 0, 0.0850),

        # --- Campaign 1 & 4: D=4, 5, 6, 7, 8 Speed & Balanced ---
        ("D4-M37-R2-12-FAST", by_id["SNF4-M37-AE-12"]["state"][:27], by_id["SNF4-M37-AE-12"]["state"][27:62], 1, 1, 37, 0, 0.0990),
        ("D4-M37-XFK-SHD-QW", make_init({"f": "K", "x": "K", "k": "X", "d": "F", "q": "W", "zh": "V", "ch": "Q", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_2, 1, 1, 37, 0, 0.0339),
        ("D4-M38-XFK-SHD-QW-LP", make_init({"f": "K", "x": "K", "k": "X", "d": "F", "q": "W", "zh": "V", "ch": "Q", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr30_lp_final, 1, 0, 38, 0, 0.0339),
        ("D4-M38-XFK-SHD-QW-52", make_init({"f": "K", "x": "K", "k": "X", "d": "F", "q": "W", "zh": "V", "ch": "Q", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr30_fast_final, 1, 0, 38, 0, 0.0520),
        ("D4-M38-R2-15-FAST", by_id["R2-21X26-M38-15"]["state"][:27], by_id["R2-21X26-M38-15"]["state"][27:62], 1, 0, 38, 0, 0.0990),
        ("D5-M38-NF4I-04-52", by_id["NF4I-AE-Z-M38-04"]["state"][:27], by_id["NF4I-AE-Z-M38-04"]["state"][27:62], 1, 1, 38, 0, 0.0520),
        ("D5-M38-XFK-DH-HP-QW-38", make_init({"f": "K", "x": "K", "k": "X", "d": "H", "h": "P", "p": "Q", "q": "W", "zh": "F", "ch": "V", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_2, 1, 1, 39, 0, 0.0520),
        ("D5-M39-FACE-02", s2a_db["pair_summaries"][1] and by_id["NF4I-AE-Z-M40-09"]["state"][:27], by_id["R2-21X26-M38-15"]["state"][27:62], 1, 1, 39, 0, 0.0520),
        ("D5-M39-R10-08-LP", by_id["R10-21X26-M39-08"]["state"][:27], by_id["R10-21X26-M39-08"]["state"][27:62], 1, 0, 39, 0, 0.0339),
        ("D6-M39-NF4I-09-M39", by_id["NF4I-AE-Z-M40-09"]["state"][:27], ref_mr29_final_2, 1, 1, 39, 0, 0.0520),
        ("D6-M40-NF4I-09-52", by_id["NF4I-AE-Z-M40-09"]["state"][:27], by_id["NF4I-AE-Z-M40-09"]["state"][27:62], 1, 0, 40, 0, 0.0520),
        ("D6-M40-NF4I-09-LP", by_id["NF4I-AE-Z-M40-09"]["state"][:27], ref_mr30_lp_final, 1, 0, 40, 0, 0.0339),
        ("D7-M40-XFK-M38-04-M40", s1_db["top_overall"][9]["state"][:27], ref_mr29_final_2, 1, 1, 40, 0, 0.0520),
        ("D7-M40-XFK-M38-04-LP", s1_db["top_overall"][9]["state"][:27], ref_mr29_final_2, 1, 1, 40, 0, 0.0339),
        ("D7-M41-XFK-M38-04-52", s1_db["top_overall"][9]["state"][:27], by_id["NF4I-AE-Z-M40-09"]["state"][27:62], 1, 0, 41, 0, 0.0520),
        ("D7-M41-XFK-R10-08-LP", make_init({"f": "K", "x": "K", "k": "X", "d": "R", "q": "W", "r": "Z", "z": "Q", "zh": "F", "ch": "V", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr30_lp_final, 1, 0, 41, 0, 0.0339),
        ("D7-M40-XFK-R10-08-LP", make_init({"f": "K", "x": "K", "k": "X", "d": "R", "q": "W", "r": "Z", "z": "Q", "zh": "F", "ch": "V", "sh": "D"}, aeo_key="J", w_key="W", y_key="Y"), ref_mr29_final_2, 1, 1, 40, 0, 0.0339),
        ("D8-M41-TOP1-M41-52", s1_db["top_overall"][0]["state"][:27], ref_mr29_final_2, 1, 1, 41, 0, 0.0520),
        ("D8-M41-TOP1-M41-LP", s1_db["top_overall"][0]["state"][:27], ref_mr29_final_2, 1, 1, 41, 0, 0.0339),
        ("D8-M42-TOP1-52", s1_db["top_overall"][0]["state"][:27], s1_db["top_overall"][0]["state"][27:62], 1, 0, 42, 0, 0.0520),
        ("D8-M42-TOP1-LP", s1_db["top_overall"][0]["state"][:27], ref_mr30_lp_final, 1, 0, 42, 0, 0.0339),
        ("D9-M42-CANYON03-52", by_id["S21X26-PURE-Y-CANYON-03"]["state"][:27], by_id["NF4I-AE-Z-M40-09"]["state"][27:62], 1, 0, 42, 0, 0.0520),
    ]

    # Warmup JIT
    st_warm = np.array(special_seeds[0][1] + special_seeds[0][2] + tone_list, dtype=np.int32)
    run_sa(st_warm, 1, 1, 45, 5, 0.99, [1.0, 0.005, 0.02, 0.0, 67.5, 9.95], steps=50, seed=1)
    print(f"JIT warmup complete in {time.perf_counter()-t0:.2f}s. Launching multi-basin optimization...", flush=True)

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

    for idx, (name, init_27, fin_35, lv, lvv, max_m, max_v, pmax_cap) in enumerate(special_seeds, 1):
        st0 = np.array(list(init_27) + list(fin_35) + tone_list, dtype=np.int32)
        if lvv == 1 and st0[V_FINAL_IDX] != V_KEY_IDX:
            ka = int(st0[V_FINAL_IDX])
            kb = V_KEY_IDX
            for i in range(27, 62):
                if st0[i] == ka:
                    st0[i] = kb
                elif st0[i] == kb:
                    st0[i] = ka

        profiles = [
            ("SPEED", [1.0, 0.003, 0.02, 0.0, 67.2, 9.92], 18000, 100 + idx * 10),
            ("BAL",   [1.0, 0.015, 0.12, 0.05, 66.8, 9.88], 18000, 200 + idx * 10),
            ("HOME",  [1.0, 0.008, 0.05, 0.45, 67.8, 9.98], 15000, 300 + idx * 10),
        ]
        best_for_seed = None
        cur_st = st0.copy()
        for p_name, weights, steps, rseed in profiles:
            out_st = run_sa(cur_st, lv, lvv, max_m, max_v, pmax_cap, weights, steps=steps, seed=rseed, temp0=0.006)
            rec = record_state(out_st, f"{name}-{p_name}")
            if rec and (best_for_seed is None or rec["ckt_v3"] < best_for_seed["ckt_v3"]):
                best_for_seed = rec
                if p_name == "SPEED":
                    cur_st = out_st.copy()

        if best_for_seed:
            r = best_for_seed
            print(f"[{idx:2d}/{len(special_seeds)}] {name:24s} -> v3={r['ckt_v3']:.5f} M{r['M']}/D{r['D']}/V{r['V']} S2={r['S2ms']:.2f} E6={r['E6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}%", flush=True)

    dedup = {}
    for r in discovered:
        t = tuple(r["state"])
        if t not in dedup or r["ckt_v3"] < dedup[t]["ckt_v3"]:
            dedup[t] = r
    all_recs = sorted(dedup.values(), key=lambda x: x["ckt_v3"])

    out_path = WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage2b-basin-descent.json"
    out_path.write_text(json.dumps({"count": len(all_recs), "schemes": all_recs}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCompleted Stage 2B in {time.perf_counter()-t0:.2f}s ({len(all_recs)} unique basin optima) -> {out_path}", flush=True)

    print("\n=== STAGE 2B: BEST BY (M, D, V) ===", flush=True)
    by_mdv = {}
    for r in all_recs:
        k = (r["M"], r["D"], r["V"])
        if k not in by_mdv or r["ckt_v3"] < by_mdv[k]["ckt_v3"]:
            by_mdv[k] = r
    for k in sorted(by_mdv.keys()):
        r = by_mdv[k]
        print(f"M{k[0]:2d}/D{k[1]}/V{k[2]}: v3={r['ckt_v3']:.5f} S2={r['S2ms']:.2f} E6={r['E6']:.4f} V6={r['V6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}% [{r['tag']}]", flush=True)


if __name__ == "__main__":
    main()
