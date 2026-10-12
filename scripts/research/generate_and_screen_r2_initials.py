#!/usr/bin/env python3
"""Weapon 1: Systematic Combinatorial Generator & Fast Screener of 21x26 (IEUAO, pure-y) Initial Topologies across D=1..8."""
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
from harvest_all_21x26_pools import TONE_IEUAO, is_valid_21x26_pure_y, load_scorer
from stage2b_basin_descent import KEY_IDX, V_FINAL_IDX, V_KEY_IDX

KEYS = opt.META["keys"][:26]
HEADS = opt.HEADS


def base_home_init() -> np.ndarray:
    st = np.zeros(27, dtype=np.int32)
    for i, h in enumerate(HEADS[:21]):
        if len(h) == 1:
            st[i] = KEY_IDX[h.upper()]
    st[25] = st[26] = KEY_IDX["Y"]
    return st


def apply_triad(st: np.ndarray, j_k: str, q_k: str, x_k: str, f_partner: str, w_partner: str, aeo_partner: str) -> None:
    pmap = {"j": KEY_IDX[j_k], "q": KEY_IDX[q_k], "x": KEY_IDX[x_k]}
    st[11] = pmap["j"]
    st[12] = pmap["q"]
    st[13] = pmap["x"]
    st[3] = pmap[f_partner]
    st[24] = pmap[w_partner]
    st[21] = st[22] = st[23] = pmap[aeo_partner]


def fill_retroflexes(st: np.ndarray, zh_k: str, ch_k: str, sh_k: str) -> None:
    st[14] = KEY_IDX[zh_k]
    st[15] = KEY_IDX[ch_k]
    st[16] = KEY_IDX[sh_k]


def generate_candidate_initials() -> list[tuple[str, np.ndarray]]:
    """Generate a rich, structured library of valid 21-key pure-y initial layouts across D=1..8."""
    cands: dict[bytes, tuple[str, np.ndarray]] = {}

    def add(tag: str, st: np.ndarray):
        b = st.tobytes()
        if b not in cands:
            # Verify 21 distinct initial keys and no tone keys
            used = set(int(x) for x in st[:27])
            if len(used) == 21 and not (used & set(int(x) for x in TONE_IEUAO)):
                cands[b] = (tag, st.copy())

    # All 6 permutations of (f, W, AEO) -> (j, q, x)
    triads = list(itertools.permutations(["j", "q", "x"]))

    # Core palatal key placements:
    # Type A: palatals on {J, F, W} (vacates {Q, V, X} at D=2!)
    for f_p, w_p, aeo_p in triads:
        # Assign keys so that j->J if possible, f->F if possible, W->W if possible
        for j_k, q_k, x_k in itertools.permutations(["J", "F", "W"]):
            base = base_home_init()
            apply_triad(base, j_k, q_k, x_k, f_p, w_p, aeo_p)
            # Now {Q, V, X} are empty!
            # 1. 0 extra displaced ORD (retroflexes on {Q, V, X})
            for zk, ck, sk in itertools.permutations(["Q", "V", "X"]):
                st = base.copy()
                fill_retroflexes(st, zk, ck, sk)
                add(f"JFW-{f_p}F_{w_p}W-z{zk}c{ck}s{sk}", st)

            # 2. 1 extra displaced ORD c1 -> {Q, V, X}, retroflexes on {C1} + 2 of {Q, V, X}
            for c1 in ["d", "k", "p", "r", "c", "z", "s", "g", "h", "t", "b", "m", "n"]:
                c1_idx = HEADS.index(c1)
                C1 = c1.upper()
                for dst in ["X", "Q", "V"]:
                    rem = [k for k in ["Q", "V", "X"] if k != dst] + [C1]
                    for zk, ck, sk in itertools.permutations(rem):
                        st = base.copy()
                        st[c1_idx] = KEY_IDX[dst]
                        fill_retroflexes(st, zk, ck, sk)
                        add(f"JFW-{f_p}F_{w_p}W-{c1}{dst}-z{zk}c{ck}s{sk}", st)

    # Type B: palatals on {J, K, W} with k -> X or Q or V (vacates {F, Q, V} or {F, X, V}!)
    for f_p, w_p, aeo_p in triads:
        for j_k, q_k, x_k in [("J", "W", "K"), ("J", "K", "W"), ("K", "W", "J")]:
            base = base_home_init()
            apply_triad(base, j_k, q_k, x_k, f_p, w_p, aeo_p)
            for k_dst in ["X", "Q", "V"]:
                base_k = base.copy()
                base_k[HEADS.index("k")] = KEY_IDX[k_dst]
                vacant = [k for k in ["F", "Q", "V", "X"] if k != k_dst]
                # 1. Retroflexes directly on the 3 vacant keys (e.g. {F, V, Q}) -> D=4!
                for zk, ck, sk in itertools.permutations(vacant):
                    st = base_k.copy()
                    fill_retroflexes(st, zk, ck, sk)
                    add(f"JKW-k{k_dst}-{f_p}F_{w_p}W-z{zk}c{ck}s{sk}", st)

                # 2. Displace 1 more consonant c1 (e.g. d, p, r, g, h, c, z, s, t, b) -> D=5!
                for c1 in ["d", "p", "r", "g", "h", "c", "z", "s", "t", "b", "m", "n"]:
                    c1_idx = HEADS.index(c1)
                    C1 = c1.upper()
                    for c1_dst in vacant:
                        rem = [k for k in vacant if k != c1_dst] + [C1]
                        for zk, ck, sk in itertools.permutations(rem):
                            st = base_k.copy()
                            st[c1_idx] = KEY_IDX[c1_dst]
                            fill_retroflexes(st, zk, ck, sk)
                            add(f"JKW-k{k_dst}-{c1}{c1_dst}-z{zk}c{ck}s{sk}", st)

                # 3. Displace 2 more consonants: d -> F AND c2 -> {Q, V}, retroflexes on {D, C2, V/Q} -> D=6!
                if "F" in vacant:
                    rem_after_d = [k for k in vacant if k != "F"]  # e.g. ["Q", "V"]
                    for c2 in ["p", "r", "g", "h", "c", "z", "s", "t", "b", "m", "n"]:
                        c2_idx = HEADS.index(c2)
                        C2 = c2.upper()
                        for c2_dst in rem_after_d:
                            other_v = [k for k in rem_after_d if k != c2_dst][0]
                            for zk, ck, sk in itertools.permutations(["D", C2, other_v]):
                                st = base_k.copy()
                                st[HEADS.index("d")] = KEY_IDX["F"]
                                st[c2_idx] = KEY_IDX[c2_dst]
                                fill_retroflexes(st, zk, ck, sk)
                                add(f"JKW-k{k_dst}-dF-{c2}{c2_dst}-z{zk}c{ck}s{sk}", st)

                    # 4. Displace 3 more consonants: d -> F, c2 -> Q, c3 -> V, retroflexes on {D, C2, C3} -> D=7!
                    if len(rem_after_d) == 2:
                        v_a, v_b = rem_after_d[0], rem_after_d[1]
                        for c2, c3 in itertools.combinations(["p", "r", "g", "h", "c", "z", "s", "t", "b"], 2):
                            C2, C3 = c2.upper(), c3.upper()
                            for zk, ck, sk in itertools.permutations(["D", C2, C3]):
                                st = base_k.copy()
                                st[HEADS.index("d")] = KEY_IDX["F"]
                                st[HEADS.index(c2)] = KEY_IDX[v_a]
                                st[HEADS.index(c3)] = KEY_IDX[v_b]
                                fill_retroflexes(st, zk, ck, sk)
                                add(f"JKW-k{k_dst}-dF-{c2}{v_a}-{c3}{v_b}-z{zk}c{ck}s{sk}", st)

    # Type C: (j,f)->J, (x,W)->W, (q,AEO)->Q or (j,f)->J, (q,W)->W, (x,AEO)->X (vacates {F, V, X} or {F, V, Q} at D=2!)
    for pal_cfg in [
        ("J", "W", "X", "j", "q", "x"),  # (j,f)->J, (q,W)->W, (x,AEO)->X
        ("J", "Q", "W", "j", "x", "q"),  # (j,f)->J, (x,W)->W, (q,AEO)->Q
        ("J", "W", "X", "x", "q", "j"),  # (j,AEO)->J, (q,W)->W, (x,f)->X
        ("J", "Q", "W", "q", "x", "j"),  # (j,AEO)->J, (x,W)->W, (q,f)->Q
    ]:
        j_k, q_k, x_k, f_p, w_p, aeo_p = pal_cfg
        base = base_home_init()
        apply_triad(base, j_k, q_k, x_k, f_p, w_p, aeo_p)
        used_now = set(KEYS[int(base[i])] for i in list(range(14)) + list(range(17, 27)))
        vacant = [k for k in KEYS if k not in used_now and KEY_IDX[k] not in TONE_IEUAO]
        for zk, ck, sk in itertools.permutations(vacant):
            st = base.copy()
            fill_retroflexes(st, zk, ck, sk)
            add(f"JW_{j_k}{q_k}{x_k}-z{zk}c{ck}s{sk}", st)
        for c1 in ["d", "k", "p", "r", "c", "z", "s", "g", "h"]:
            C1 = c1.upper()
            for dst in vacant:
                rem = [k for k in vacant if k != dst] + [C1]
                for zk, ck, sk in itertools.permutations(rem):
                    st = base.copy()
                    st[HEADS.index(c1)] = KEY_IDX[dst]
                    fill_retroflexes(st, zk, ck, sk)
                    add(f"JW_{j_k}{q_k}{x_k}-{c1}{dst}-z{zk}c{ck}s{sk}", st)

    # Type D: Round 1 High-Speed D=7..9 variations with (q,W)->W or W->Q and p/c/z/d/h/k displacements
    r1_frontier = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]
    non_tone_non_y = [k for k in range(26) if k not in TONE_IEUAO and k != KEY_IDX["Y"]]
    for r in r1_frontier:
        base_init = np.array(r["state"][:27], dtype=np.int32)
        add(f"R1-{r['id']}", base_init)
        # Also test swapping W's partner to W if W != W
        w_k = int(base_init[24])
        if w_k != KEY_IDX["W"]:
            st_w = base_init.copy()
            opt.swapkeys(st_w, 0, 27, w_k, KEY_IDX["W"])
            add(f"R1-Wfix-{r['id']}", st_w)
        # Single key swaps among active keys (zh, ch, sh, d, k, p, r, c, z, s, g, h, f, q, x, j)
        interesting_keys = [
            KEY_IDX["F"], KEY_IDX["D"], KEY_IDX["K"], KEY_IDX["J"], KEY_IDX["H"], KEY_IDX["G"],
            KEY_IDX["W"], KEY_IDX["V"], KEY_IDX["Q"], KEY_IDX["X"], KEY_IDX["P"], KEY_IDX["R"],
            KEY_IDX["C"], KEY_IDX["Z"], KEY_IDX["S"],
        ]
        for ka, kb in itertools.combinations(interesting_keys, 2):
            st_sw = base_init.copy()
            opt.swapkeys(st_sw, 0, 27, ka, kb)
            add(f"R1sw-{r['id']}-{KEYS[ka]}{KEYS[kb]}", st_sw)

    return list(cands.values())


def main():
    t0 = time.perf_counter()
    engine = load_scorer()
    data_dir = WORKTREE / "research-notes" / "data"
    r1_frontier = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))["frontier"]

    # Select 8 diverse reference final maps (4 with V=0 & v==V, 4 with V=1 & v==V)
    v0_refs = []
    v1_refs = []
    for r in sorted(r1_frontier, key=lambda x: x["ckt_v3"]):
        fin = np.array(r["state"][27:62], dtype=np.int32)
        fin_vlock = fin.copy()
        if fin_vlock[V_FINAL_IDX - 27] != V_KEY_IDX:
            # Also keep original fin
            pass
        if r["V"] == 0 and fin[V_FINAL_IDX - 27] == V_KEY_IDX and len(v0_refs) < 5:
            v0_refs.append(fin)
        elif r["V"] == 1 and len(v1_refs) < 5:
            v1_refs.append(fin)

    cands = generate_candidate_initials()
    print(f"Generated {len(cands)} unique valid 21-key pure-y initial topologies in {time.perf_counter() - t0:.2f}s")

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

    # Fast Stage-1 screen using _eval_char_word2 across v0_refs[0]
    ref_fin = v0_refs[0]
    scored = []
    t1 = time.perf_counter()
    for tag, init_st in cands:
        st = np.zeros(67, dtype=np.int32)
        st[:27] = init_st
        st[27:62] = ref_fin
        st[62:] = TONE_IEUAO
        kc1, sc1, kw2, sw2 = _eval_char_word2(
            st, engine.py_h, engine.py_f, engine.aux,
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
        m_val = int(opt.memory(st))
        d_val = int(sum(st[j] != opt.PREF[j] for j in se.ORD))
        no_de = int(st[HEADS.index("d")] != KEY_IDX["D"])
        _, pm = r5.rp(st)
        h_s2, _, _, _ = r5.home(st)
        scored.append((s12, m_val, d_val, no_de, float(pm), float(h_s2), tag, init_st))

    print(f"Fast-screened {len(cands)} initial topologies in {time.perf_counter() - t1:.2f}s")

    # Bucket by (m_val, d_val, no_de, pmax_tier) and take top 6 per bucket + top 4 high-Home per (m_val, d_val)
    buckets: dict[tuple, list] = {}
    home_buckets: dict[tuple, list] = {}
    for item in scored:
        s12, m_val, d_val, no_de, pm, h_s2, tag, init_st = item
        ptier = 0 if pm <= 0.0285 else (1 if pm <= 0.0340 else 2)
        key = (m_val, d_val, no_de, ptier)
        buckets.setdefault(key, []).append(item)
        if pm <= 0.0340:
            home_buckets.setdefault((m_val, d_val), []).append(item)

    shortlist: dict[bytes, tuple] = {}
    for key, items in buckets.items():
        items.sort(key=lambda x: x[0])
        for it in items[:6]:
            shortlist[it[7].tobytes()] = it
    for key, items in home_buckets.items():
        items.sort(key=lambda x: -x[5])
        for it in items[:5]:
            shortlist[it[7].tobytes()] = it

    print(f"Selected {len(shortlist)} elite initial topologies across {len(buckets)} (M, D, No-DE, Pmax) buckets for exact 8-track evaluation...")

    exact_rows = []
    for s12, m_val, d_val, no_de, pm, h_s2, tag, init_st in shortlist.values():
        best_v0 = 99.0
        for fin in v0_refs:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin
            st[62:] = TONE_IEUAO
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v0:
                best_v0 = v3
        best_v1 = 99.0
        for fin in v1_refs:
            st = np.zeros(67, dtype=np.int32)
            st[:27] = init_st
            st[27:62] = fin
            st[62:] = TONE_IEUAO
            v3 = float(engine.score_all(st)[0])
            if v3 < best_v1:
                best_v1 = v3
        exact_rows.append({
            "tag": tag,
            "M_v0": m_val,
            "D": d_val,
            "no_de": no_de,
            "pmax": pm,
            "home_s2": h_s2,
            "best_v0": best_v0,
            "best_v1": best_v1,
            "init_state": [int(x) for x in init_st],
        })

    out_path = data_dir / "r2_elite_initial_topologies.json"
    out_path.write_text(json.dumps({"count": len(exact_rows), "topologies": exact_rows}, indent=2), encoding="utf-8")
    print(f"Saved {len(exact_rows)} elite initial topologies to {out_path}")

    for m_v0 in sorted(set(r["M_v0"] for r in exact_rows)):
        sub = [r for r in exact_rows if r["M_v0"] == m_v0]
        sub.sort(key=lambda x: x["best_v0"])
        print(f"\n=== M(V0)={m_v0} (count={len(sub)}) Top 6 by V0 CKT v3 ===")
        for r in sub[:6]:
            print(
                f"  {r['tag']:36s} | D={r['D']} NoDE={r['no_de']} | V0={r['best_v0']:.5f} V1={r['best_v1']:.5f} | "
                f"Home={r['home_s2']*100:.2f}% Pmax={r['pmax']*100:.2f}%"
            )


if __name__ == "__main__":
    main()
