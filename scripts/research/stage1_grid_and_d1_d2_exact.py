#!/usr/bin/env python3
"""Stage 1: Exhaustive D=1 / D=2 initial enumeration + Initial x Final bilinear surface sweep."""

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

from harvest_all_21x26_pools import (
    TONE_IEUAO,
    build_collision_proxy_arrays,
    collision_proxy_njit,
    is_valid_21x26_pure_y,
    load_scorer,
)

KEYS = opt.META["keys"]
KEY_IDX = {k: i for i, k in enumerate(KEYS)}
NON_TONE_KEYS = [i for i in range(26) if i not in set(TONE_IEUAO.tolist())]
ORDINARY = list(se.ORD)


def generate_d1_d2_initials() -> dict[tuple[int, ...], str]:
    """Exhaustively generate all D=1 (A=E=O) initial maps and structured D=2/D=3 initial maps."""
    results: dict[tuple[int, ...], str] = {}

    # Base home map for 0..20
    # HEADS: 0..20 consonants (3=f, 11=j, 12=q, 13=x, 14=zh, 15=ch, 16=sh), 21=A, 22=E, 23=O, 24=W, 25=Y, 26=YU
    # In any A=E=O pure-y 399-unique map:
    # {f(3), W(24), AEO(21..23)} must pair 1-to-1 with {j(11), q(12), x(13)}.
    # The 21 main groups are:
    # 17 single-letter consonants (0..20 except f=3, j=11, q=12, x=13 -> 17 items)
    # + 3 palatal groups: P_j = {j, partner_j}, P_q = {q, partner_q}, P_x = {x, partner_x}
    # + 4 free non-home groups: zh(14), ch(15), sh(16), Y(25,26)
    # Wait: 17 + 3 + 4 = 24? No! 21 consonants total - 1 (f) - 3 (j,q,x) - 3 (zh,ch,sh) = 14 single-letter non-palatal non-f consonants!
    # 14 + 3 (j,q,x) = 17 single-letter consonants excluding f!
    # Plus f (1) = 18 single-letter consonants (ORDINARY)!
    # Plus zh, ch, sh, Y = 4 groups -> 17 + 4 = 21 main groups!

    palatals = [11, 12, 13]  # j, q, x
    small_groups = ["f", "W", "AEO"]
    free_groups = [14, 15, 16, 25]  # zh, ch, sh, Y
    free_keys_base = [KEY_IDX["F"], KEY_IDX["V"], KEY_IDX["W"], KEY_IDX["Y"]]

    # 1. All D=1 initial maps (either f is displaced and all 17 other ORD stay home,
    #    OR f stays on F paired with one of j,q,x displaced to F and other 16 ORD stay home)
    for perm_small in itertools.permutations(small_groups):
        # Case A: all 17 non-f ORD stay on their home keys; f is displaced to j, q, or x's home key
        for perm_free in itertools.permutations(free_keys_base):
            st = np.zeros(27, dtype=np.int32)
            for idx in ORDINARY:
                if idx != 3:
                    st[idx] = opt.PREF[idx]
            for fg, fk in zip(free_groups, perm_free):
                if fg == 25:
                    st[25] = st[26] = fk
                else:
                    st[fg] = fk
            for pal_idx, sg in zip(palatals, perm_small):
                k = st[pal_idx]
                if sg == "f":
                    st[3] = k
                elif sg == "W":
                    st[24] = k
                else:
                    st[21] = st[22] = st[23] = k
            results[tuple(st.tolist())] = "exact_D1_caseA"

        # Case B: f stays on F, so the palatal paired with 'f' moves to F!
        pal_with_f = palatals[perm_small.index("f")]
        freed_pal_key = int(opt.PREF[pal_with_f])
        avail_for_free = [KEY_IDX["V"], KEY_IDX["W"], KEY_IDX["Y"], freed_pal_key]
        for perm_free in itertools.permutations(avail_for_free):
            st = np.zeros(27, dtype=np.int32)
            for idx in ORDINARY:
                if idx != pal_with_f:
                    st[idx] = opt.PREF[idx]
            st[pal_with_f] = KEY_IDX["F"]
            for fg, fk in zip(free_groups, perm_free):
                if fg == 25:
                    st[25] = st[26] = fk
                else:
                    st[fg] = fk
            for pal_idx, sg in zip(palatals, perm_small):
                k = st[pal_idx]
                if sg == "f":
                    st[3] = k
                elif sg == "W":
                    st[24] = k
                else:
                    st[21] = st[22] = st[23] = k
            results[tuple(st.tolist())] = "exact_D1_caseB"

    # 2. All D=2 initial maps with Y->Y (or general D=2) derived by 1 swap from D=1
    d1_list = list(results.keys())
    for init_t in d1_list:
        st0 = np.array(init_t, dtype=np.int32)
        # Swap any two of the 21 non-tone keys in st0
        for i in range(len(NON_TONE_KEYS)):
            for j in range(i + 1, len(NON_TONE_KEYS)):
                ka, kb = NON_TONE_KEYS[i], NON_TONE_KEYS[j]
                st = st0.copy()
                for t in range(27):
                    if st[t] == ka:
                        st[t] = kb
                    elif st[t] == kb:
                        st[t] = ka
                d = sum(int(st[idx] != opt.PREF[idx]) for idx in ORDINARY)
                if d <= 3:
                    key = tuple(st.tolist())
                    if key not in results:
                        results[key] = f"exact_D{d}_from_D1"

    return results


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

    hist_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-all-historical-pools-v3.json").read_text(encoding="utf-8"))["schemes"]
    print(f"Loaded {len(hist_db)} historical schemes.")

    # Collect all historical initial maps and final maps
    init_pool: dict[tuple[int, ...], str] = {}
    final_pool: dict[tuple[int, ...], str] = {}
    for r in hist_db:
        st = r["state"]
        it = tuple(st[:27])
        ft = tuple(st[27:62])
        if it not in init_pool:
            init_pool[it] = f"hist:{r['id']}"
        if ft not in final_pool:
            final_pool[ft] = f"hist:{r['id']}"

    # Add 1-key-swap neighbors of the top 25 historical initial maps (by ckt_v3 and by kw3+kw4)
    top_by_v3 = sorted(hist_db, key=lambda x: x["ckt_v3"])[:30]
    top_by_w34 = sorted(hist_db, key=lambda x: x["kw3_ms"] + x["sw3_ms"] + x["kw4_ms"] + x["sw4_ms"])[:30]
    top_by_w34_p0 = sorted(hist_db, key=lambda x: x["w3_p0"] + x["w4_p0"])[:20]
    seed_inits = {tuple(r["state"][:27]): r["id"] for r in (top_by_v3 + top_by_w34 + top_by_w34_p0)}
    for it, src_id in list(seed_inits.items()):
        st0 = np.array(it, dtype=np.int32)
        for i in range(len(NON_TONE_KEYS)):
            for j in range(i + 1, len(NON_TONE_KEYS)):
                ka, kb = NON_TONE_KEYS[i], NON_TONE_KEYS[j]
                st = st0.copy()
                for t in range(27):
                    if st[t] == ka:
                        st[t] = kb
                    elif st[t] == kb:
                        st[t] = ka
                key = tuple(st.tolist())
                if key not in init_pool:
                    init_pool[key] = f"swap1:{src_id}"

    # Add exhaustive D=1 and D=2/3 initial maps
    d12_inits = generate_d1_d2_initials()
    for it, tag in d12_inits.items():
        if it not in init_pool:
            init_pool[it] = tag

    print(f"Total unique candidate initial maps: {len(init_pool)} (historical: 196, D1/D2/swap1 added: {len(init_pool)-196})")
    print(f"Total unique candidate final maps:   {len(final_pool)}")

    # Evaluate w3/w4 on all candidate initial maps!
    # Note: w3/w4 only depends on st[:27]. We can use any valid final map to form a 67-int array.
    ref_final = list(next(iter(final_pool.keys())))
    tone_list = TONE_IEUAO.tolist()

    init_records = []
    t_w34 = time.perf_counter()
    for it, src in init_pool.items():
        st = np.array(list(it) + ref_final + tone_list, dtype=np.int32)
        res3, res4 = engine.eval_w3_w4_cached(st)
        d = sum(int(st[idx] != opt.PREF[idx]) for idx in ORDINARY)
        m_i = 3 + d + int(st[24] != opt.PREF[24]) + int(st[25] != opt.PREF[25]) + len(set(st[21:24].tolist()))
        # Partial w34 contribution to ckt_v3
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
        init_records.append({
            "init": it,
            "source": src,
            "M_I": m_i,
            "D": d,
            "aeo_keys": len(set(st[21:24].tolist())),
            "s_w34": s_w34,
            "kw3_ms": float(res3[0, 0]),
            "sw3_ms": float(res3[1, 0]),
            "kw4_ms": float(res4[0, 0]),
            "sw4_ms": float(res4[1, 0]),
            "w3_p0": float(res3[0, 2]),
            "w4_p0": float(res4[0, 2]),
        })
    print(f"Evaluated w3/w4 on {len(init_records)} initial maps in {time.perf_counter()-t_w34:.2f}s")

    # Select elite initial maps across every (M_I, D) bucket + overall top s_w34 + top w3_p0/w4_p0 + all 196 historical initial maps
    selected_inits: dict[tuple[int, ...], dict] = {}
    for rec in init_records:
        if rec["source"].startswith("hist:"):
            selected_inits[rec["init"]] = rec

    by_mid = {}
    for rec in init_records:
        by_mid.setdefault((rec["M_I"], rec["D"]), []).append(rec)
    for k, grp in by_mid.items():
        grp_s = sorted(grp, key=lambda x: x["s_w34"])
        for rec in grp_s[:25]:
            selected_inits[rec["init"]] = rec
        grp_p0 = sorted(grp, key=lambda x: x["w3_p0"] + x["w4_p0"])
        for rec in grp_p0[:10]:
            selected_inits[rec["init"]] = rec

    for rec in sorted(init_records, key=lambda x: x["s_w34"])[:80]:
        selected_inits[rec["init"]] = rec

    print(f"Selected {len(selected_inits)} elite/historical initial maps for full bilinear surface sweep.")

    # Pre-filter final_pool to top ~450 diverse finals (all 102 HTML finals + top by ckt_v3, S2ms, Home, Pmax, proxyAffected, V=0)
    html_finals = {tuple(r["state"][27:62]) for r in hist_db if r["in_html"]}
    selected_finals = set(html_finals)
    for key_fn, limit in (
        (lambda x: x["ckt_v3"], 150),
        (lambda x: x["kc1_ms"] + 3 * x["kw2_ms"] + x["sc1_ms"] + 3 * x["sw2_ms"], 150),
        (lambda x: x["S2ms"], 100),
        (lambda x: x["E6"], 100),
        (lambda x: -x["homeS2"], 80),
        (lambda x: x["Pmax"], 80),
        (lambda x: x["proxyAffected"], 100),
    ):
        for r in sorted(hist_db, key=key_fn)[:limit]:
            selected_finals.add(tuple(r["state"][27:62]))

    selected_finals_list = list(selected_finals)
    print(f"Selected {len(selected_finals_list)} diverse final maps for bilinear sweep ({len(selected_inits) * len(selected_finals_list)} grid points).")

    # Sweep the bilinear grid!
    t_grid = time.perf_counter()
    best_overall = []
    best_by_mdv: dict[tuple[int, int, int], dict] = {}
    best_by_md_low_pinky: dict[tuple[int, int], dict] = {}   # Pmax <= 0.034
    best_by_md_mid_pinky: dict[tuple[int, int], dict] = {}   # Pmax <= 0.052
    best_by_md_high_home: dict[tuple[int, int], dict] = {}   # homeS2 >= 0.43

    valid_count = 0
    for irec in selected_inits.values():
        it_list = list(irec["init"])
        for ft in selected_finals_list:
            st = np.array(it_list + list(ft) + tone_list, dtype=np.int32)
            if not is_valid_21x26_pure_y(st):
                continue
            valid_count += 1
            ckt_v3, ckt_v3_raw, ums, res3, res4 = engine.score_all(st)
            m_val = int(opt.memory(st))
            d_val = irec["D"]
            v_val = int(r5.vowelD(st))
            _, pm = r5.rp(st)
            h_s2, _, _, h_fl = r5.home(st)

            cand = {
                "ckt_v3": float(ckt_v3),
                "ckt_v3_raw": float(ckt_v3_raw),
                "M": m_val,
                "D": d_val,
                "V": v_val,
                "Pmax": float(pm),
                "homeS2": float(h_s2),
                "homeFloor": float(h_fl),
                "w3_p0": irec["w3_p0"],
                "w4_p0": irec["w4_p0"],
                "init_src": irec["source"],
                "final_src": final_pool[ft],
                "state": st.tolist(),
            }

            mdv = (m_val, d_val, v_val)
            if mdv not in best_by_mdv or ckt_v3 < best_by_mdv[mdv]["ckt_v3"]:
                best_by_mdv[mdv] = cand

            md = (m_val, d_val)
            if pm <= 0.034001:
                if md not in best_by_md_low_pinky or ckt_v3 < best_by_md_low_pinky[md]["ckt_v3"]:
                    best_by_md_low_pinky[md] = cand
            if pm <= 0.052001:
                if md not in best_by_md_mid_pinky or ckt_v3 < best_by_md_mid_pinky[md]["ckt_v3"]:
                    best_by_md_mid_pinky[md] = cand
            if h_s2 >= 0.42:
                if md not in best_by_md_high_home or ckt_v3 < best_by_md_high_home[md]["ckt_v3"]:
                    best_by_md_high_home[md] = cand

            if ckt_v3 < 9.565:
                best_overall.append(cand)

    print(f"Swept {valid_count} valid bilinear grid schemes in {time.perf_counter()-t_grid:.2f}s.")

    # Deduplicate and enrich top candidates with S2ms, E6, proxyAffected
    def enrich(c):
        st = np.array(c["state"], dtype=np.int32)
        _, vals = opt.initialize(st, opt.PARAMS)
        m = opt.metrics(vals, opt.PARAMS)
        p_aff, p_loss = eval_proxy(st)
        c["S2ms"] = float(m[0])
        c["E6"] = float(m[1])
        c["G6"] = float(m[2])
        c["V6"] = float(10.0 * r9.cw26(vals))
        c["proxyAffected"] = p_aff
        c["proxyFirstLoss"] = p_loss
        return c

    best_overall.sort(key=lambda x: x["ckt_v3"])
    dedup_top = []
    seen_st = set()
    for c in best_overall:
        t = tuple(c["state"])
        if t not in seen_st:
            seen_st.add(t)
            dedup_top.append(enrich(c))
            if len(dedup_top) >= 40:
                break

    print("\n=== STAGE 1 BILINEAR SURFACE SWEEP: TOP 25 OVERALL CKT v3 ===")
    for i, c in enumerate(dedup_top[:25], 1):
        print(f"{i:2d}. v3={c['ckt_v3']:.5f} M{c['M']}/D{c['D']}/V{c['V']} S2={c['S2ms']:.2f} E6={c['E6']:.4f} Home={c['homeS2']*100:.2f}% Pmax={c['Pmax']*100:.2f}% pAff={c['proxyAffected']*100:.2f}% w3p0={c['w3_p0']*100:.2f}% w4p0={c['w4_p0']*100:.2f}% [{c['init_src']} x {c['final_src']}]")

    print("\n=== STAGE 1 BILINEAR SURFACE SWEEP: BEST BY (M, D, V) FOR D <= 5, M <= 40 ===")
    for mdv in sorted(best_by_mdv.keys()):
        if mdv[0] <= 40 and mdv[1] <= 5:
            c = enrich(best_by_mdv[mdv])
            print(f"M{mdv[0]:2d}/D{mdv[1]}/V{mdv[2]}: v3={c['ckt_v3']:.5f} S2={c['S2ms']:.2f} E6={c['E6']:.4f} Home={c['homeS2']*100:.2f}% Pmax={c['Pmax']*100:.2f}% pAff={c['proxyAffected']*100:.2f}% [{c['init_src']} x {c['final_src']}]")

    print("\n=== STAGE 1 BILINEAR SURFACE SWEEP: BEST LOW-PINKY (Pmax <= 3.4%) BY (M, D) ===")
    for md in sorted(best_by_md_low_pinky.keys()):
        if md[0] <= 40 and md[1] <= 6:
            c = enrich(best_by_md_low_pinky[md])
            print(f"M{md[0]:2d}/D{md[1]}/V{c['V']}: v3={c['ckt_v3']:.5f} S2={c['S2ms']:.2f} E6={c['E6']:.4f} Home={c['homeS2']*100:.2f}% Pmax={c['Pmax']*100:.2f}% pAff={c['proxyAffected']*100:.2f}% [{c['init_src']} x {c['final_src']}]")

    out_payload = {
        "top_overall": dedup_top,
        "best_by_mdv": {f"M{k[0]}_D{k[1]}_V{k[2]}": enrich(v) for k, v in sorted(best_by_mdv.items())},
        "best_low_pinky": {f"M{k[0]}_D{k[1]}": enrich(v) for k, v in sorted(best_by_md_low_pinky.items())},
        "best_mid_pinky": {f"M{k[0]}_D{k[1]}": enrich(v) for k, v in sorted(best_by_md_mid_pinky.items())},
        "best_high_home": {f"M{k[0]}_D{k[1]}": enrich(v) for k, v in sorted(best_by_md_high_home.items())},
    }
    out_path = WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage1-bilinear-sweep.json"
    out_path.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved Stage 1 results -> {out_path}")


if __name__ == "__main__":
    main()
