#!/usr/bin/env python3
"""Weapon 2 (Ultra-Fast Zero-Allocation Edition): Round 2 Comprehensive 2-Hop Initial Expansion + Multi-Track Basin & Ravine Excavation for 21x26 (IEUAO, 399-unique, pure-y).

Uses pre-tabulated unary tables U_kc1[35,26], U_sc1[35,26], U_w2[2,35,26] + CSR incident delta probing for w2_pair/w2_s0/w2_s12 + zero-allocation @njit home/pinky evaluation (~50x-100x faster than full-loop evaluation).
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
from numba import njit

WORKTREE = Path(__file__).resolve().parents[2]
REPLAY_DIR = Path(os.environ.get("RIME_RESEARCH_REPLAY_DIR", Path(__file__).resolve().parents[2] / ".research-cache" / "R11_integrated_replay"))
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
    build_final_compat_matrix,
)
from stage3_targeted_ravines_and_canyons import _sa_optimize_canyon

KEYS = opt.META["keys"][:26]
HEADS = opt.HEADS
LOADS_ALL = np.ascontiguousarray(r5.LOADS, dtype=np.float64)
LOADS0 = np.ascontiguousarray(r5.LOADS[0], dtype=np.float64)
HOME_MASK = np.ascontiguousarray(r5.HOME, dtype=np.int32)
PINKY_IDX = int(r5.PINKY)


def build_w2_csr(n_finals: int, f1_arr: np.ndarray, f2_arr: np.ndarray):
    """Build CSR incident lists mapping each final f in 0..34 to unique row indices where f1==f or f2==f."""
    buckets = [[] for _ in range(n_finals)]
    for idx in range(len(f1_arr)):
        fa = int(f1_arr[idx])
        fb = int(f2_arr[idx])
        buckets[fa].append(idx)
        if fb != fa:
            buckets[fb].append(idx)
    ptr = np.zeros(n_finals + 1, dtype=np.int32)
    flat = []
    for f in range(n_finals):
        ptr[f] = len(flat)
        flat.extend(buckets[f])
    ptr[n_finals] = len(flat)
    return ptr, np.array(flat, dtype=np.int32)


@njit
def _precompute_init_tables(
    st_init: np.ndarray,
    py_h: np.ndarray,
    py_f: np.ndarray,
    aux: np.ndarray,
    t2: np.ndarray,
    t31: np.ndarray,
    t32: np.ndarray,
    t41: np.ndarray,
    t42: np.ndarray,
    t43: np.ndarray,
    c_s0_py_w: np.ndarray,
    c_s1_py_a1_w: np.ndarray,
    c_s2_py_a1_a2_w: np.ndarray,
    sc1_ms_py: np.ndarray,
    sc1_ms_tone: np.ndarray,
    sc1_ms_mask: np.ndarray,
    sc1_ms_w: np.ndarray,
    char_total_w: float,
    w2_pair_p1: np.ndarray,
    w2_pair_p2: np.ndarray,
    w2_pair_w: np.ndarray,
    w2_s0_p2: np.ndarray,
    w2_s12_p2: np.ndarray,
    w2_s1_tr: np.ndarray,
    w2_s1_p2: np.ndarray,
    w2_s1_a1: np.ndarray,
    w2_s1_w: np.ndarray,
    w2_s2_tr: np.ndarray,
    w2_s2_p2: np.ndarray,
    w2_s2_a1: np.ndarray,
    w2_s2_a2: np.ndarray,
    w2_s2_w: np.ndarray,
):
    n_py = len(py_h)
    a = np.empty(n_py, dtype=np.int32)
    f_of_p = np.empty(n_py, dtype=np.int32)
    for p in range(n_py):
        if py_h[p] >= 0:
            a[p] = st_init[py_h[p]]
            f_of_p[p] = py_f[p] - 27

    u_kc1 = np.zeros((35, 26), dtype=np.float64)
    u_sc1 = np.zeros((35, 26), dtype=np.float64)

    for p in range(n_py):
        if py_h[p] < 0:
            continue
        k0 = a[p]
        f = f_of_p[p]
        w0_k = c_s0_py_w[0, p]
        w0_s = c_s0_py_w[1, p]
        for k1 in range(26):
            kc_acc = 0.0
            sc_acc = 0.0
            base2 = k0 * 34 + k1
            if w0_k > 0.0 or w0_s > 0.0:
                c2 = t2[base2]
                kc_acc += w0_k * c2
                sc_acc += w0_s * c2
            base3_prefix = base2 * 34
            for a1 in range(5):
                ak1 = aux[a1]
                at3 = base3_prefix + ak1
                w1_k = c_s1_py_a1_w[0, p, a1]
                w1_s = c_s1_py_a1_w[1, p, a1]
                if w1_k > 0.0 or w1_s > 0.0:
                    c3 = t31[at3] + t32[at3]
                    kc_acc += w1_k * c3
                    sc_acc += w1_s * c3
                c4_prefix = t41[at3]
                at4_prefix = at3 * 34
                at43_prefix = (k1 * 34 + ak1) * 34
                for a2 in range(5):
                    w2_k = c_s2_py_a1_a2_w[0, p, a1, a2]
                    w2_s = c_s2_py_a1_a2_w[1, p, a1, a2]
                    if w2_k > 0.0 or w2_s > 0.0:
                        ak2 = aux[a2]
                        c4 = c4_prefix + t42[at4_prefix + ak2] + t43[at43_prefix + ak2]
                        kc_acc += w2_k * c4
                        sc_acc += w2_s * c4
            u_kc1[f, k1] += kc_acc
            u_sc1[f, k1] += sc_acc

    for m in range(len(sc1_ms_py)):
        p = sc1_ms_py[m]
        tone = sc1_ms_tone[m]
        mask = sc1_ms_mask[m]
        k0 = a[p]
        f = f_of_p[p]
        ak1 = aux[tone]
        w_m = sc1_ms_w[m]
        for k1 in range(26):
            at3 = (k0 * 34 + k1) * 34 + ak1
            c4_prefix = t41[at3]
            at4_prefix = at3 * 34
            at43_prefix = (k1 * 34 + ak1) * 34
            best = 1e100
            for s_idx in range(5):
                if mask & (1 << s_idx):
                    ak2 = aux[s_idx]
                    c4 = c4_prefix + t42[at4_prefix + ak2] + t43[at43_prefix + ak2]
                    if c4 < best:
                        best = c4
            u_sc1[f, k1] += w_m * best

    u_kc1 /= char_total_w
    u_sc1 /= char_total_w

    u_w2 = np.zeros((2, 35, 26), dtype=np.float64)
    n_pair = len(w2_pair_p1)
    pair_k0_34 = np.empty(n_pair, dtype=np.int32)
    pair_k2 = np.empty(n_pair, dtype=np.int32)
    for idx in range(n_pair):
        p1 = w2_pair_p1[idx]
        p2 = w2_pair_p2[idx]
        k0 = a[p1]
        k2 = a[p2]
        f1 = f_of_p[p1]
        w = w2_pair_w[idx]
        pair_k0_34[idx] = k0 * 34
        pair_k2[idx] = k2
        for k1 in range(26):
            v = w * t41[(k0 * 34 + k1) * 34 + k2]
            u_w2[0, f1, k1] += v
            u_w2[1, f1, k1] += v

    for idx in range(len(w2_s1_tr)):
        tr = w2_s1_tr[idx]
        p2 = w2_s1_p2[idx]
        ak1 = aux[w2_s1_a1[idx]]
        w = w2_s1_w[idx]
        k2 = a[p2]
        f2 = f_of_p[p2]
        for k3 in range(26):
            u_w2[tr, f2, k3] += w * t43[(k2 * 34 + k3) * 34 + ak1]

    for idx in range(len(w2_s2_tr)):
        tr = w2_s2_tr[idx]
        p2 = w2_s2_p2[idx]
        ak1 = aux[w2_s2_a1[idx]]
        ak2 = aux[w2_s2_a2[idx]]
        w = w2_s2_w[idx]
        k2 = a[p2]
        f2 = f_of_p[p2]
        for k3 in range(26):
            c = t42[((k2 * 34 + k3) * 34 + ak1) * 34 + ak2] + t43[(k3 * 34 + ak1) * 34 + ak2]
            u_w2[tr, f2, k3] += w * c

    s0_k2 = np.empty(len(w2_s0_p2), dtype=np.int32)
    for idx in range(len(w2_s0_p2)):
        s0_k2[idx] = a[w2_s0_p2[idx]]

    s12_k2 = np.empty(len(w2_s12_p2), dtype=np.int32)
    for idx in range(len(w2_s12_p2)):
        s12_k2[idx] = a[w2_s12_p2[idx]]

    return u_kc1, u_sc1, u_w2, pair_k0_34, pair_k2, s0_k2, s12_k2


@njit
def _in_vix(val: int, vix: np.ndarray) -> bool:
    for i in range(len(vix)):
        if val == vix[i]:
            return True
    return False


@njit
def _fast_rp_max(st: np.ndarray, pinky_idx: int, loads_all: np.ndarray, buf20: np.ndarray) -> float:
    for t in range(20):
        buf20[t] = 0.0
    for i in range(67):
        if st[i] == pinky_idx:
            for t in range(20):
                buf20[t] += loads_all[t, i]
    mx = 0.0
    for t in range(20):
        if buf20[t] > mx:
            mx = buf20[t]
    return mx


@njit
def _fast_home_s2(st: np.ndarray, loads0: np.ndarray, home_mask: np.ndarray) -> float:
    s = 0.0
    for i in range(67):
        if home_mask[st[i]]:
            s += loads0[i]
    return s


@njit
def _propose_final_move_inplace(
    s: np.ndarray,
    q: np.ndarray,
    changed_f: np.ndarray,
    compat: np.ndarray,
    lock_vowels: int,
    lock_v: int,
    vix: np.ndarray,
    v_final_idx: int,
    v_key_idx: int,
) -> int:
    """Write proposed state into q and changed final indices (0..34) into changed_f. Return n_changed (0 if invalid)."""
    for i in range(67):
        q[i] = s[i]
    kind = np.random.randint(100)
    if kind < 40:
        ka = np.random.randint(26)
        kb = np.random.randint(26)
        if ka == kb:
            return 0
        if lock_vowels:
            for i in range(len(vix)):
                kv = s[vix[i]]
                if ka == kv or kb == kv:
                    return 0
        if lock_v:
            if ka == v_key_idx or kb == v_key_idx:
                return 0
        n_ch = 0
        for f in range(35):
            tok = 27 + f
            if q[tok] == ka:
                q[tok] = kb
                changed_f[n_ch] = f
                n_ch += 1
            elif q[tok] == kb:
                q[tok] = ka
                changed_f[n_ch] = f
                n_ch += 1
        return n_ch
    elif kind < 72:
        f = np.random.randint(35)
        tok = 27 + f
        if lock_vowels and _in_vix(tok, vix):
            return 0
        if lock_v and tok == v_final_idx:
            return 0
        k_old = q[tok]
        cnt_old = 0
        for i in range(27, 62):
            if q[i] == k_old:
                cnt_old += 1
        if cnt_old < 2:
            return 0
        k_new = np.random.randint(26)
        if k_new == k_old:
            return 0
        for i in range(27, 62):
            if q[i] == k_new:
                if not compat[f, i - 27]:
                    return 0
        q[tok] = k_new
        changed_f[0] = f
        return 1
    elif kind < 90:
        f1 = np.random.randint(35)
        f2 = np.random.randint(35)
        if f1 == f2:
            return 0
        t1 = 27 + f1
        t2 = 27 + f2
        if lock_vowels and (_in_vix(t1, vix) or _in_vix(t2, vix)):
            return 0
        if lock_v and (t1 == v_final_idx or t2 == v_final_idx):
            return 0
        k1 = q[t1]
        k2 = q[t2]
        if k1 == k2:
            return 0
        for i in range(27, 62):
            if i != t2 and q[i] == k2:
                if not compat[f1, i - 27]:
                    return 0
            if i != t1 and q[i] == k1:
                if not compat[f2, i - 27]:
                    return 0
        q[t1] = k2
        q[t2] = k1
        changed_f[0] = f1
        changed_f[1] = f2
        return 2
    else:
        f1 = np.random.randint(35)
        f2 = np.random.randint(35)
        f3 = np.random.randint(35)
        if f1 == f2 or f2 == f3 or f1 == f3:
            return 0
        t1, t2, t3 = 27 + f1, 27 + f2, 27 + f3
        if lock_vowels and (_in_vix(t1, vix) or _in_vix(t2, vix) or _in_vix(t3, vix)):
            return 0
        if lock_v and (t1 == v_final_idx or t2 == v_final_idx or t3 == v_final_idx):
            return 0
        k1, k2, k3 = q[t1], q[t2], q[t3]
        if k1 == k2 or k2 == k3 or k1 == k3:
            return 0
        q[t1] = k2
        q[t2] = k3
        q[t3] = k1
        for i in range(27, 62):
            if i != t1 and q[i] == k2 and not compat[f1, i - 27]:
                return 0
            if i != t2 and q[i] == k3 and not compat[f2, i - 27]:
                return 0
            if i != t3 and q[i] == k1 and not compat[f3, i - 27]:
                return 0
        changed_f[0] = f1
        changed_f[1] = f2
        changed_f[2] = f3
        return 3


@njit
def _sa_optimize_finals_fast(
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
    u_kc1: np.ndarray,
    u_sc1: np.ndarray,
    u_w2: np.ndarray,
    pair_f1: np.ndarray,
    pair_f2: np.ndarray,
    pair_k0_34: np.ndarray,
    pair_k2: np.ndarray,
    w2_pair_w: np.ndarray,
    pair_ptr: np.ndarray,
    pair_inc: np.ndarray,
    w2_s0_tr: np.ndarray,
    w2_s0_f0: np.ndarray,
    s0_f2: np.ndarray,
    s0_k2: np.ndarray,
    w2_s0_w: np.ndarray,
    s0_ptr: np.ndarray,
    s0_inc: np.ndarray,
    w2_s12_tr: np.ndarray,
    w2_s12_f0: np.ndarray,
    s12_f2: np.ndarray,
    s12_k2: np.ndarray,
    s12_ak1: np.ndarray,
    w2_s12_w: np.ndarray,
    s12_ptr: np.ndarray,
    s12_inc: np.ndarray,
    t42: np.ndarray,
    t43: np.ndarray,
    w2_guard_ms: np.ndarray,
    word2_total_w: float,
    opt_params,
    loads_all: np.ndarray,
    loads0: np.ndarray,
    home_mask: np.ndarray,
    pinky_idx: int,
):
    np.random.seed(seed)
    s = start_st.copy()
    q = start_st.copy()
    changed_f = np.empty(35, dtype=np.int32)
    buf20 = np.empty(20, dtype=np.float64)

    cache, vs = opt.initialize(s, opt_params)
    stamp = np.zeros(len(cache), np.int64)
    ids = np.empty(len(cache), np.int32)
    cs = np.empty(len(cache), np.float64)
    delta = np.zeros(60, np.float64)

    pair_stamp = np.zeros(len(pair_f1), np.int64)
    s0_stamp = np.zeros(len(w2_s0_tr), np.int64)
    s12_stamp = np.zeros(len(w2_s12_tr), np.int64)
    epoch = 0

    # Initial full evaluation of pairwise w2 sums
    cur_pair_sum = 0.0
    for idx in range(len(pair_f1)):
        k1 = s[27 + pair_f1[idx]]
        k3 = s[27 + pair_f2[idx]]
        at3 = (pair_k0_34[idx] + k1) * 34 + pair_k2[idx]
        cur_pair_sum += w2_pair_w[idx] * t42[at3 * 34 + k3]

    cur_extra0 = 0.0
    cur_extra1 = 0.0
    for idx in range(len(w2_s0_tr)):
        k1 = s[27 + w2_s0_f0[idx]]
        k3 = s[27 + s0_f2[idx]]
        v = w2_s0_w[idx] * t43[(k1 * 34 + s0_k2[idx]) * 34 + k3]
        if w2_s0_tr[idx] == 0:
            cur_extra0 += v
        else:
            cur_extra1 += v

    for idx in range(len(w2_s12_tr)):
        k1 = s[27 + w2_s12_f0[idx]]
        k3 = s[27 + s12_f2[idx]]
        v = w2_s12_w[idx] * t42[((k1 * 34 + s12_k2[idx]) * 34 + k3) * 34 + s12_ak1[idx]]
        if w2_s12_tr[idx] == 0:
            cur_extra0 += v
        else:
            cur_extra1 += v

    kc1 = 0.0
    sc1 = 0.0
    u_kw2 = 0.0
    u_sw2 = 0.0
    for f in range(35):
        kf = s[27 + f]
        kc1 += u_kc1[f, kf]
        sc1 += u_sc1[f, kf]
        u_kw2 += u_w2[0, f, kf]
        u_sw2 += u_w2[1, f, kf]

    kw2 = (u_kw2 + cur_pair_sum + cur_extra0) / word2_total_w + w2_guard_ms[0]
    sw2 = (u_sw2 + cur_pair_sum + cur_extra1) / word2_total_w + w2_guard_ms[1]
    s_tot = (
        s_w34
        + ((kc1 + pen4[0]) / c4_ref[0]) ** 4
        + 3.0 * ((kw2 + pen4[1]) / c4_ref[1]) ** 4
        + ((sc1 + pen4[2]) / c4_ref[2]) ** 4
        + 3.0 * ((sw2 + pen4[3]) / c4_ref[3]) ** 4
    )
    cur_v3 = 10.0 * ((s_tot / 12.0) ** 0.25)
    m_arr = opt.metrics(vs, opt_params)
    h_s2 = _fast_home_s2(s, loads0, home_mask)
    pm = _fast_rp_max(s, pinky_idx, loads_all, buf20)
    cur_obj = (
        obj_weights[0] * cur_v3
        + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0002 * m_arr[0]
        + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.002 * m_arr[1]
        - obj_weights[3] * h_s2
        + 50.0 * max(0.0, pm - pmax_cap)
    )

    best_st = s.copy()
    best_obj = cur_obj
    best_v3 = cur_v3

    for it in range(steps):
        n_ch = _propose_final_move_inplace(s, q, changed_f, compat, lock_vowels, lock_v, vix, v_final_idx, v_key_idx)
        if n_ch == 0:
            continue
        if opt.memory(q) > max_m or r5.vowelD(q) > max_v:
            continue
        pm_q = _fast_rp_max(q, pinky_idx, loads_all, buf20)
        if pmax_cap < 0.99 and pm_q > pmax_cap + 1e-12:
            continue

        epoch += 1
        n = opt.probe(s, q, cache, opt_params, stamp, epoch, ids, cs, delta)
        nv = vs + delta

        # Incremental delta on pairwise w2 sums via CSR incident lists
        d_pair = 0.0
        d_ext0 = 0.0
        d_ext1 = 0.0
        for ci in range(n_ch):
            f = changed_f[ci]
            for p_i in range(pair_ptr[f], pair_ptr[f + 1]):
                idx = pair_inc[p_i]
                if pair_stamp[idx] == epoch:
                    continue
                pair_stamp[idx] = epoch
                f1 = pair_f1[idx]
                f2 = pair_f2[idx]
                k0_34 = pair_k0_34[idx]
                k2 = pair_k2[idx]
                old_at3 = (k0_34 + s[27 + f1]) * 34 + k2
                new_at3 = (k0_34 + q[27 + f1]) * 34 + k2
                d_pair += w2_pair_w[idx] * (t42[new_at3 * 34 + q[27 + f2]] - t42[old_at3 * 34 + s[27 + f2]])

            for s_i in range(s0_ptr[f], s0_ptr[f + 1]):
                idx = s0_inc[s_i]
                if s0_stamp[idx] == epoch:
                    continue
                s0_stamp[idx] = epoch
                f0 = w2_s0_f0[idx]
                f2 = s0_f2[idx]
                k2 = s0_k2[idx]
                dv = w2_s0_w[idx] * (
                    t43[(q[27 + f0] * 34 + k2) * 34 + q[27 + f2]]
                    - t43[(s[27 + f0] * 34 + k2) * 34 + s[27 + f2]]
                )
                if w2_s0_tr[idx] == 0:
                    d_ext0 += dv
                else:
                    d_ext1 += dv

            for s_i in range(s12_ptr[f], s12_ptr[f + 1]):
                idx = s12_inc[s_i]
                if s12_stamp[idx] == epoch:
                    continue
                s12_stamp[idx] = epoch
                f0 = w2_s12_f0[idx]
                f2 = s12_f2[idx]
                k2 = s12_k2[idx]
                ak1 = s12_ak1[idx]
                dv = w2_s12_w[idx] * (
                    t42[((q[27 + f0] * 34 + k2) * 34 + q[27 + f2]) * 34 + ak1]
                    - t42[((s[27 + f0] * 34 + k2) * 34 + s[27 + f2]) * 34 + ak1]
                )
                if w2_s12_tr[idx] == 0:
                    d_ext0 += dv
                else:
                    d_ext1 += dv

        q_pair_sum = cur_pair_sum + d_pair
        q_extra0 = cur_extra0 + d_ext0
        q_extra1 = cur_extra1 + d_ext1

        kc1 = 0.0
        sc1 = 0.0
        u_kw2 = 0.0
        u_sw2 = 0.0
        for f in range(35):
            kf = q[27 + f]
            kc1 += u_kc1[f, kf]
            sc1 += u_sc1[f, kf]
            u_kw2 += u_w2[0, f, kf]
            u_sw2 += u_w2[1, f, kf]

        kw2 = (u_kw2 + q_pair_sum + q_extra0) / word2_total_w + w2_guard_ms[0]
        sw2 = (u_sw2 + q_pair_sum + q_extra1) / word2_total_w + w2_guard_ms[1]
        s_tot = (
            s_w34
            + ((kc1 + pen4[0]) / c4_ref[0]) ** 4
            + 3.0 * ((kw2 + pen4[1]) / c4_ref[1]) ** 4
            + ((sc1 + pen4[2]) / c4_ref[2]) ** 4
            + 3.0 * ((sw2 + pen4[3]) / c4_ref[3]) ** 4
        )
        q_v3 = 10.0 * ((s_tot / 12.0) ** 0.25)
        m_arr = opt.metrics(nv, opt_params)
        h_s2 = _fast_home_s2(q, loads0, home_mask)
        q_obj = (
            obj_weights[0] * q_v3
            + obj_weights[1] * max(0.0, m_arr[0] - obj_weights[4]) + 0.0002 * m_arr[0]
            + obj_weights[2] * max(0.0, m_arr[1] - obj_weights[5]) + 0.002 * m_arr[1]
            - obj_weights[3] * h_s2
            + 50.0 * max(0.0, pm_q - pmax_cap)
        )
        temp = temp0 * ((1.0 - it / max(1, steps)) ** 2) + 1e-9
        if q_obj < cur_obj or np.random.random() < np.exp(min(0.0, (cur_obj - q_obj) / temp)):
            for i in range(67):
                s[i] = q[i]
            vs = nv
            cur_obj = q_obj
            cur_v3 = q_v3
            cur_pair_sum = q_pair_sum
            cur_extra0 = q_extra0
            cur_extra1 = q_extra1
            for k in range(n):
                cache[ids[k]] = cs[k]
            if q_obj < best_obj - 1e-12:
                best_obj = q_obj
                best_v3 = q_v3
                for i in range(67):
                    best_st[i] = q[i]

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
    c_epoch = 0

    def eval_proxy(st: np.ndarray):
        nonlocal c_epoch
        c_epoch += 1
        m = collision_proxy_njit(
            st,
            corpus_seq[2], corpus_seq[3], corpus_seq[4],
            corpus_w[2], corpus_w[3], corpus_w[4],
            stamps, masks, counts, masses, maxima, c_epoch,
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

    # Prebuild static CSR incident indices for w2_pair, w2_s0, w2_s12
    f_of_p_static = engine.py_f - 27
    pair_f1 = np.ascontiguousarray(f_of_p_static[engine.w2_pair_p1], dtype=np.int32)
    pair_f2 = np.ascontiguousarray(f_of_p_static[engine.w2_pair_p2], dtype=np.int32)
    pair_ptr, pair_inc = build_w2_csr(35, pair_f1, pair_f2)

    s0_f2 = np.ascontiguousarray(f_of_p_static[engine.w2_s0_p2], dtype=np.int32)
    s0_ptr, s0_inc = build_w2_csr(35, engine.w2_s0_f0, s0_f2)

    s12_f2 = np.ascontiguousarray(f_of_p_static[engine.w2_s12_p2], dtype=np.int32)
    s12_ak1 = np.ascontiguousarray(engine.aux[engine.w2_s12_a1], dtype=np.int32)
    s12_ptr, s12_inc = build_w2_csr(35, engine.w2_s12_f0, s12_f2)

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

    init_tables_cache: dict[bytes, tuple] = {}

    def get_init_tables(st_init: np.ndarray):
        b = st_init[:27].tobytes()
        res = init_tables_cache.get(b)
        if res is None:
            compat = build_final_compat_matrix(st_init, engine.py_h, engine.py_f)
            s_w34 = compute_s_w34(st_init)
            u_kc1, u_sc1, u_w2, pair_k0_34, pair_k2, s0_k2, s12_k2 = _precompute_init_tables(
                st_init, engine.py_h, engine.py_f, engine.aux,
                *engine.tables,
                engine.c_s0_py_w, engine.c_s1_py_a1_w, engine.c_s2_py_a1_a2_w,
                engine.sc1_ms_py, engine.sc1_ms_tone, engine.sc1_ms_mask, engine.sc1_ms_w, engine.char_total_w,
                engine.w2_pair_p1, engine.w2_pair_p2, engine.w2_pair_w,
                engine.w2_s0_p2, engine.w2_s12_p2,
                engine.w2_s1_tr, engine.w2_s1_p2, engine.w2_s1_a1, engine.w2_s1_w,
                engine.w2_s2_tr, engine.w2_s2_p2, engine.w2_s2_a1, engine.w2_s2_a2, engine.w2_s2_w,
            )
            res = (compat, s_w34, u_kc1, u_sc1, u_w2, pair_k0_34, pair_k2, s0_k2, s12_k2)
            init_tables_cache[b] = res
        return res

    def run_sa(st_init, lv, lvv, max_m, max_v, pmax_cap, obj_weights, steps=30000, seed=42, temp0=0.0055):
        compat, s_w34, u_kc1, u_sc1, u_w2, pair_k0_34, pair_k2, s0_k2, s12_k2 = get_init_tables(st_init)
        best_st, best_v3, _ = _sa_optimize_finals_fast(
            st_init, compat, lv, lvv, VIX, V_FINAL_IDX, V_KEY_IDX,
            max_m, max_v, pmax_cap, s_w34, pen4, c4_ref,
            np.array(obj_weights, dtype=np.float64), steps, seed, temp0,
            u_kc1, u_sc1, u_w2,
            pair_f1, pair_f2, pair_k0_34, pair_k2, engine.w2_pair_w, pair_ptr, pair_inc,
            engine.w2_s0_tr, engine.w2_s0_f0, s0_f2, s0_k2, engine.w2_s0_w, s0_ptr, s0_inc,
            engine.w2_s12_tr, engine.w2_s12_f0, s12_f2, s12_k2, s12_ak1, engine.w2_s12_w, s12_ptr, s12_inc,
            engine.tables[4], engine.tables[5],
            engine.w2_guard_ms, engine.word2_total_w,
            opt.PARAMS,
            LOADS_ALL, LOADS0, HOME_MASK, PINKY_IDX,
        )
        return best_st, float(best_v3)

    data_dir = WORKTREE / "research-notes" / "data"
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]
    elites = json.loads((data_dir / "r2_elite_initial_topologies.json").read_text(encoding="utf-8"))["topologies"]

    # Self-test & speed benchmark on 1 run
    t_bench = time.perf_counter()
    st_test = np.array(r1_frontier[0]["state"], dtype=np.int32)
    cand_test, fast_v3 = run_sa(st_test, 1, 0, r1_frontier[0]["M"], r1_frontier[0]["V"], 0.99, [1.0, 0.001, 0.01, 0.01, 70.0, 10.1], steps=1000, seed=1)
    exact_v3 = float(engine.score_all(cand_test)[0])
    t_bench2 = time.perf_counter()
    _, _ = run_sa(st_test, 1, 0, r1_frontier[0]["M"], r1_frontier[0]["V"], 0.99, [1.0, 0.001, 0.01, 0.01, 70.0, 10.1], steps=30000, seed=2)
    print(f"Fast SA JIT compiled & verified: |fast - exact| = {abs(fast_v3 - exact_v3):.3e}, 30,000 steps in {(time.perf_counter() - t_bench2)*1000:.1f}ms!", flush=True)

    # Collect diverse final maps from Round 1
    v0_vlocked = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0 and r["state"][V_FINAL_IDX] == V_KEY_IDX]
    v0_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 0]
    v1_vlocked = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1 and r["state"][V_FINAL_IDX] == V_KEY_IDX]
    v1_all = [np.array(r["state"][27:62], dtype=np.int32) for r in r1_frontier if r["V"] == 1]

    # Phase A: Expand 2-hop initial swaps around the top elites
    print("=== Phase A: Expanding 2-Hop Initial Neighborhood around Top Breakthrough Seeds ===", flush=True)
    top_elites = sorted(elites, key=lambda x: x["best_v0"])[:35] + sorted([e for e in elites if e["pmax"] <= 0.0340], key=lambda x: x["best_v0"])[:25]
    expanded_inits: dict[bytes, tuple[str, np.ndarray]] = {}
    for e in elites:
        arr = np.array(e["init_state"], dtype=np.int32)
        expanded_inits[arr.tobytes()] = (e["tag"], arr)

    swap_keys = [
        KEY_IDX["F"], KEY_IDX["D"], KEY_IDX["K"], KEY_IDX["J"], KEY_IDX["H"], KEY_IDX["G"],
        KEY_IDX["W"], KEY_IDX["V"], KEY_IDX["Q"], KEY_IDX["X"], KEY_IDX["P"], KEY_IDX["R"],
        KEY_IDX["C"], KEY_IDX["Z"], KEY_IDX["S"],
    ]
    for e in top_elites:
        base_init = np.array(e["init_state"], dtype=np.int32)
        for ka, kb in itertools.combinations(swap_keys, 2):
            sw = base_init.copy()
            opt.swapkeys(sw, 0, 27, ka, kb)
            b = sw.tobytes()
            if b not in expanded_inits:
                expanded_inits[b] = (f"{e['tag']}+{KEYS[ka]}{KEYS[kb]}", sw)

    print(f"Total expanded initial pool: {len(expanded_inits)} topologies", flush=True)
    ref_fin0 = v0_vlocked[0]
    init_records = []
    for tag, init_st in expanded_inits.values():
        st0 = np.zeros(67, dtype=np.int32)
        st0[:27] = init_st
        st0[27:62] = ref_fin0
        st0[62:] = TONE_IEUAO
        kc1, sc1, kw2, sw2 = _eval_char_word2(
            st0, engine.py_h, engine.py_f, engine.aux,
            *engine.tables, engine.long_guard,
            engine.c_s0_py_w, engine.c_s1_py_a1_w, engine.c_s2_py_a1_a2_w,
            engine.sc1_ms_py, engine.sc1_ms_tone, engine.sc1_ms_mask, engine.sc1_ms_w, engine.char_total_w,
            engine.w2_pair_p1, engine.w2_pair_p2, engine.w2_pair_w,
            engine.w2_s0_tr, engine.w2_s0_f0, engine.w2_s0_p2, engine.w2_s0_w,
            engine.w2_s12_tr, engine.w2_s12_f0, engine.w2_s12_p2, engine.w2_s12_a1, engine.w2_s12_w,
            engine.w2_s1_tr, engine.w2_s1_p2, engine.w2_s1_a1, engine.w2_s1_w,
            engine.w2_s2_tr, engine.w2_s2_p2, engine.w2_s2_a1, engine.w2_s2_a2, engine.w2_s2_w,
            engine.w2_guard_ms, engine.word2_total_w,
        )
        s12 = (
            ((kc1 + pen4[0]) / c4_ref[0]) ** 4
            + 3.0 * ((kw2 + pen4[1]) / c4_ref[1]) ** 4
            + ((sc1 + pen4[2]) / c4_ref[2]) ** 4
            + 3.0 * ((sw2 + pen4[3]) / c4_ref[3]) ** 4
        )
        m0 = int(opt.memory(st0))
        d0 = int(sum(st0[j] != opt.PREF[j] for j in se.ORD))
        no_de = int(st0[HEADS.index("d")] != KEY_IDX["D"])
        _, pm = r5.rp(st0)
        h_s2, _, _, _ = r5.home(st0)
        init_records.append((s12, m0, d0, no_de, float(pm), float(h_s2), tag, init_st))

    discovered: dict[bytes, dict] = {}
    out_file = data_dir / "r2_discovered_candidates.json"
    resume_stage = ""
    if out_file.exists():
        saved_data = json.loads(out_file.read_text(encoding="utf-8"))
        resume_stage = saved_data.get("stage", "")
        for rec in saved_data.get("candidates", []):
            b = np.array(rec["state"], dtype=np.int32).tobytes()
            discovered[b] = rec
        print(f"Loaded {len(discovered)} existing candidates from checkpoint stage [{resume_stage}]", flush=True)

    def save_checkpoint(stage_name: str):
        out_list = sorted(discovered.values(), key=lambda x: x["ckt_v3"])
        out_file.write_text(json.dumps({"stage": stage_name, "count": len(out_list), "candidates": out_list}, indent=2), encoding="utf-8")
        print(f"  --> Checkpoint saved [{stage_name}]: {len(out_list)} unique candidates ({time.perf_counter() - t0:.1f}s elapsed)", flush=True)

    def record_candidate(st: np.ndarray, track: str, tag: str) -> dict | None:
        if not is_valid_21x26_pure_y(st):
            return None
        b = st.tobytes()
        v3, v3_raw, _, _, _ = engine.score_all(st)
        _, out = opt.initialize(st, opt.PARAMS)
        m4 = opt.metrics(out, opt.PARAMS)
        desc = r5.describe(st)
        p_aff, p_amb = eval_proxy(st)
        rec = {
            "track": track,
            "tag": tag,
            "state": [int(x) for x in st],
            "M": int(desc["M"]),
            "D": int(desc["D"]),
            "V": int(desc["V"]),
            "ckt_v3": float(v3),
            "ckt_v3_raw": float(v3_raw),
            "s2_ms": float(m4[0]),
            "e6": float(m4[1]),
            "g6": float(m4[2]),
            "home_s2": float(desc["homeS2"]),
            "rp_s2": float(desc["rpS2"]),
            "rp_max": float(desc["rpMax"]),
            "no_de": int(st[HEADS.index("d")] != KEY_IDX["D"]),
            "proxy_affected": float(p_aff),
            "proxy_ambig": float(p_amb),
        }
        prev = discovered.get(b)
        if prev is None or rec["ckt_v3"] < prev["ckt_v3"]:
            discovered[b] = rec
        return rec

    def best_start_for_init(init_st: np.ndarray, pool: list[np.ndarray], max_m: int, pmax_cap: float) -> np.ndarray | None:
        best_st = None
        best_v3 = 99.0
        for fin in pool:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin
            st[62:] = TONE_IEUAO
            if opt.memory(st) > max_m:
                continue
            _, pm = r5.rp(st)
            if pm > pmax_cap + 1e-9:
                continue
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v3:
                best_v3 = v3
                best_st = st.copy()
        return best_st

    if resume_stage not in ("Track3_M42", "Track4_HighHome", "Completed_All_5_Tracks"):
        # =========================================================================
        # TRACK 1: Global Ultimate Speed & M39..M44 Pareto Frontier
        # =========================================================================
        print("\n=== TRACK 1: Global Ultimate Speed & M39..M44 Pareto Frontier ===", flush=True)
        for m_target in [39, 40, 41, 42, 43, 44]:
            sub_vlock = sorted([r for r in init_records if r[1] == m_target], key=lambda x: x[0])[:8]
            sub_vfree = sorted([r for r in init_records if r[1] == m_target - 1], key=lambda x: x[0])[:6]
            best_m_v3 = 99.0
            for mode_label, lvv, sub, pool in [
                ("vLock", 1, sub_vlock, v0_vlocked),
                ("vFree", 0, sub_vfree, v0_all),
            ]:
                for idx, (_, m0, d0, no_de, pm, h_s2, tag, init_st) in enumerate(sub):
                    st_start = best_start_for_init(init_st, pool, m_target, 0.99)
                    if st_start is None:
                        continue
                    cur = st_start.copy()
                    cur_v3 = float(engine.score_all(cur)[0])
                    for sd in range(5):
                        cand, cand_v3 = run_sa(
                            cur, 1, lvv, m_target, 0, 0.99,
                            [1.0, 0.001, 0.01, 0.01, 70.0, 10.1],
                            steps=32000, seed=1000 + m_target * 100 + idx * 10 + sd, temp0=0.0055 if sd < 3 else 0.0025,
                        )
                        rec = record_candidate(cand, "track1_speed", f"T1-M{m_target}-{mode_label}-{tag}")
                        if rec and rec["ckt_v3"] < cur_v3:
                            cur = cand.copy()
                            cur_v3 = rec["ckt_v3"]
                            if rec["ckt_v3"] < best_m_v3:
                                best_m_v3 = rec["ckt_v3"]
                                print(
                                    f"  [NEW BEST M{m_target}] {rec['tag'][:42]:42s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                                    f"v3={rec['ckt_v3']:.5f} | S2={rec['s2_ms']:.2f} E6={rec['e6']:.4f} | "
                                    f"Home={rec['home_s2']*100:.2f}% Pmax={rec['rp_max']*100:.2f}%",
                                    flush=True,
                                )
            save_checkpoint(f"Track1_M{m_target}")

        # =========================================================================
        # TRACK 2: Low-Memory & Palatal Triad Ravines (M35..M38 Speed + No-DE + Low-Pinky)
        # =========================================================================
        print("\n=== TRACK 2: Low-Memory & Palatal Triad Ravines (M35..M38) ===", flush=True)
        for m_target in [35, 36, 37, 38]:
            configs = [
                ("V0-LP", 1, 1, 0, m_target, -1, 0.0339, v0_vlocked, [1.0, 0.002, 0.02, 0.02, 70.0, 10.1]),
                ("V0-ULP", 1, 1, 0, m_target, -1, 0.0285, v0_vlocked, [1.0, 0.002, 0.02, 0.02, 70.0, 10.1]),
                ("V0-NODE-LP", 1, 1, 0, m_target, 1, 0.0339, v0_vlocked, [1.0, 0.015, 0.08, 0.03, 68.5, 10.0]),
                ("V0-SPEED", 1, 1, 0, m_target, -1, 0.99, v0_vlocked, [1.0, 0.001, 0.01, 0.01, 70.0, 10.1]),
                ("V1-SPEED", 0, 1, 1, m_target - 1, -1, 0.99, v1_vlocked, [1.0, 0.002, 0.02, 0.01, 68.5, 10.0]),
                ("V1-LP", 0, 1, 1, m_target - 1, -1, 0.0339, v1_vlocked, [1.0, 0.003, 0.03, 0.02, 68.5, 10.0]),
            ]
            for label, lv, lvv, max_v, m0_req, no_de_req, pmax_cap, pool, obj_w in configs:
                sub = [
                    r for r in init_records
                    if r[1] == m0_req
                    and (no_de_req == -1 or r[3] == no_de_req)
                    and r[4] <= pmax_cap + 0.006
                ]
                sub.sort(key=lambda x: x[0])
                best_cfg_v3 = 99.0
                for idx, (_, m0, d0, no_de, pm, h_s2, tag, init_st) in enumerate(sub[:6]):
                    st_start = best_start_for_init(init_st, pool, m_target, pmax_cap)
                    if st_start is None:
                        continue
                    cur = st_start.copy()
                    cur_v3 = float(engine.score_all(cur)[0])
                    for sd in range(4):
                        cand, _ = run_sa(
                            cur, lv, lvv, m_target, max_v, pmax_cap, obj_w,
                            steps=28000, seed=2000 + m_target * 100 + idx * 10 + sd, temp0=0.0055 if sd < 2 else 0.0025,
                        )
                        rec = record_candidate(cand, "track2_low_m", f"T2-M{m_target}-{label}-{tag}")
                        if rec and rec["rp_max"] <= pmax_cap + 1e-9 and rec["ckt_v3"] < cur_v3:
                            cur = cand.copy()
                            cur_v3 = rec["ckt_v3"]
                            if rec["ckt_v3"] < best_cfg_v3:
                                best_cfg_v3 = rec["ckt_v3"]
                                print(
                                    f"  [M{m_target}-{label:10s}] {rec['tag'][:40]:40s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                                    f"v3={rec['ckt_v3']:.5f} | S2={rec['s2_ms']:.2f} E6={rec['e6']:.4f} | "
                                    f"Home={rec['home_s2']*100:.2f}% Pmax={rec['rp_max']*100:.2f}%",
                                    flush=True,
                                )
            save_checkpoint(f"Track2_M{m_target}")

        # =========================================================================
        # TRACK 3: Closing the M39..M42 Low-Pinky & Ultra-Low-Pinky Cliff
        # =========================================================================
        print("\n=== TRACK 3: Closing the M39..M42 Low-Pinky & Ultra-Low-Pinky Cliff ===", flush=True)
        for m_target in [39, 40, 41, 42]:
            for p_label, pmax_cap in [("LP3.38", 0.0339), ("ULP2.84", 0.0285)]:
                sub_v0_lock = sorted([r for r in init_records if r[1] == m_target and r[4] <= pmax_cap + 0.006], key=lambda x: x[0])[:6]
                sub_v0_free = sorted([r for r in init_records if r[1] == m_target - 1 and r[4] <= pmax_cap + 0.006], key=lambda x: x[0])[:5]
                sub_v1_lock = sorted([r for r in init_records if r[1] == m_target - 1 and r[4] <= pmax_cap + 0.006], key=lambda x: x[0])[:5]
                best_lp_v3 = 99.0
                for mode_tag, lv, lvv, max_v, sub, pool in [
                    ("V0L", 1, 1, 0, sub_v0_lock, v0_vlocked),
                    ("V0F", 1, 0, 0, sub_v0_free, v0_all),
                    ("V1L", 0, 1, 1, sub_v1_lock, v1_vlocked),
                ]:
                    for idx, (_, m0, d0, no_de, pm, h_s2, tag, init_st) in enumerate(sub):
                        st_start = best_start_for_init(init_st, pool, m_target, pmax_cap)
                        if st_start is None:
                            continue
                        cur = st_start.copy()
                        cur_v3 = float(engine.score_all(cur)[0])
                        for sd in range(4):
                            cand, _ = run_sa(
                                cur, lv, lvv, m_target, max_v, pmax_cap,
                                [1.0, 0.003, 0.03, 0.03, 69.0, 10.05],
                                steps=28000, seed=3000 + m_target * 100 + idx * 10 + sd, temp0=0.0055 if sd < 2 else 0.0025,
                            )
                            rec = record_candidate(cand, "track3_low_pinky", f"T3-M{m_target}-{p_label}-{mode_tag}-{tag}")
                            if rec and rec["rp_max"] <= pmax_cap + 1e-9 and rec["ckt_v3"] < cur_v3:
                                cur = cand.copy()
                                cur_v3 = rec["ckt_v3"]
                                if rec["ckt_v3"] < best_lp_v3:
                                    best_lp_v3 = rec["ckt_v3"]
                                    print(
                                        f"  [M{m_target}-{p_label:7s}-{mode_tag}] {rec['tag'][:38]:38s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                                        f"v3={rec['ckt_v3']:.5f} | S2={rec['s2_ms']:.2f} E6={rec['e6']:.4f} | "
                                        f"Home={rec['home_s2']*100:.2f}% Pmax={rec['rp_max']*100:.2f}%",
                                        flush=True,
                                    )
            save_checkpoint(f"Track3_M{m_target}")

    # =========================================================================
    # TRACK 4: High-Home (Home 46%..55%) + Low-Pinky Ergonomic Basin
    # =========================================================================
    print("\n=== TRACK 4: High-Home + Low-Pinky Dual-Gated Ergonomic Basin ===", flush=True)
    high_home_inits = sorted([r for r in init_records if r[4] <= 0.0340 and r[5] >= 0.405], key=lambda x: (-x[5], x[0]))[:18]
    for idx, (_, m0, d0, no_de, pm, h_s2, tag, init_st) in enumerate(high_home_inits):
        for max_v, pool, m_add in [(0, v0_all, 1), (1, v1_all, 2), (2, v1_all, 3)]:
            m_cap = m0 + m_add
            st_start = best_start_for_init(init_st, pool, m_cap, 0.0339)
            if st_start is None:
                continue
            cur = st_start.copy()
            for w_home in [0.25, 0.65]:
                cand, _ = run_sa(
                    cur, 1 if max_v == 0 else 0, 0, m_cap, max_v, 0.0339,
                    [1.0, 0.002, 0.02, w_home, 70.0, 10.1],
                    steps=28000, seed=4000 + idx * 20 + int(w_home * 100), temp0=0.006,
                )
                rec = record_candidate(cand, "track4_high_home", f"T4-H{int(w_home*100)}-V{max_v}-{tag}")
                if rec and rec["home_s2"] >= 0.455 and rec["rp_max"] <= 0.0340:
                    print(
                        f"  [HIGH-HOME] {rec['tag'][:40]:40s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                        f"v3={rec['ckt_v3']:.5f} | Home={rec['home_s2']*100:.2f}% Pmax={rec['rp_max']*100:.2f}%",
                        flush=True,
                    )

    for r in [x for x in r1_frontier if x["homeS2"] >= 0.48]:
        st_r = np.array(r["state"], dtype=np.int32)
        for sd, w_home in enumerate([0.15, 0.45, 0.85]):
            cand, _ = run_sa(
                st_r, 0, 0, r["M"], r["V"], 0.0339,
                [1.0, 0.002, 0.02, w_home, 70.0, 10.1],
                steps=30000, seed=4500 + sd * 31, temp0=0.005,
            )
            rec = record_candidate(cand, "track4_high_home", f"T4-R1Pol-{r['id']}-w{int(w_home*100)}")
            if rec and (rec["ckt_v3"] < r["ckt_v3"] - 0.001 or rec["home_s2"] > r["homeS2"] + 0.002):
                print(
                    f"  [R1-HOME-IMP] {rec['tag'][:40]:40s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                    f"v3={rec['ckt_v3']:.5f} (was {r['ckt_v3']:.5f}) | Home={rec['home_s2']*100:.2f}% (was {r['homeS2']*100:.2f}%) Pmax={rec['rp_max']*100:.2f}%",
                    flush=True,
                )
    save_checkpoint("Track4_HighHome")

    # =========================================================================
    # TRACK 5: 4-Code Cross-Family Collision Canyon
    # =========================================================================
    print("\n=== TRACK 5: 4-Code Cross-Family Collision Canyon ===", flush=True)
    canyon_seeds = [r for r in r1_frontier if r["proxyAffected"] <= 0.042]
    best_coll_fin = np.array(min(r1_frontier, key=lambda x: x["proxyAffected"])["state"][27:62], dtype=np.int32)
    for tag_i, init_st in [
        ("JKW-kX-xF_qW-zFcVsQ", next(r[7] for r in init_records if r[6] == "JKW-kX-xF_qW-zFcVsQ")),
        ("JW_JWX-zFcVsQ", next(r[7] for r in init_records if r[6] == "JW_JWX-zFcVsQ")),
        ("ULTIMATE-01-XS", next(r[7] for r in init_records if r[6] == "R1sw-SY26-V3-M42-D8-ULTIMATE-01-XS")),
    ]:
        st_c = np.zeros(67, dtype=np.int32)
        st_c[:27] = init_st
        st_c[27:62] = best_coll_fin
        st_c[62:] = TONE_IEUAO
        canyon_seeds.append({"id": tag_i, "state": st_c.tolist(), "M": int(opt.memory(st_c)), "V": int(r5.vowelD(st_c))})

    for idx, r in enumerate(canyon_seeds):
        st_r = np.array(r["state"], dtype=np.int32)
        compat = build_final_compat_matrix(st_r, engine.py_h, engine.py_f)
        s_w34 = compute_s_w34(st_r)
        for sd, w_coll in enumerate([25.0, 45.0, 75.0]):
            cand_st, _, _ = _sa_optimize_canyon(
                st_r, compat, 1 if r["V"] == 0 else 0, 0, VIX, V_FINAL_IDX, V_KEY_IDX,
                int(r["M"]), int(r["V"]), 0.99, s_w34, pen4, c4_ref,
                np.array([1.0, 0.002, 0.02, w_coll, 70.0, 10.1], dtype=np.float64),
                20000, 5000 + idx * 20 + sd, 0.005,
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
            c_epoch += 25000
            rec = record_candidate(cand_st, "track5_collision_canyon", f"T5-Canyon-{r['id']}-w{int(w_coll)}")
            if rec and rec["proxy_affected"] <= 0.0410:
                print(
                    f"  [CANYON] {rec['tag'][:42]:42s} -> M{rec['M']}/D{rec['D']}/V{rec['V']} | "
                    f"v3={rec['ckt_v3']:.5f} | CollProxy={rec['proxy_affected']*100:.2f}% | "
                    f"Home={rec['home_s2']*100:.2f}% Pmax={rec['rp_max']*100:.2f}%",
                    flush=True,
                )
    save_checkpoint("Completed_All_5_Tracks")
    print(f"\nCompleted Round 2 excavation in {time.perf_counter() - t0:.1f}s!", flush=True)


if __name__ == "__main__":
    main()
