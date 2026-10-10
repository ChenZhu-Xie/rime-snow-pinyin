#!/usr/bin/env python3
"""Stage 2A: High-Dimensional Geodesic Line & Coordinate-Face Sweeps between Extreme 21x26 Seeds.

Connects extreme seeds across 9 dimensions into geodesic lines (via cycle decomposition
in both initial space I and final space R) and sweeps 2D coordinate faces (I(t) x R(s))
to excavate unexplored basins in the 21x26 IEUAO 399-unique pure-y manifold.
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

from harvest_all_21x26_pools import (
    TONE_IEUAO,
    build_collision_proxy_arrays,
    collision_proxy_njit,
    is_valid_21x26_pure_y,
    load_scorer,
)

ORDINARY = list(se.ORD)


def decompose_perm_cycles(perm: dict[int, int]) -> list[list[int]]:
    """Decompose a bijection perm: K -> K into disjoint non-trivial cycles."""
    visited = set()
    cycles = []
    for k in sorted(perm.keys()):
        if k in visited or perm[k] == k:
            visited.add(k)
            continue
        cyc = []
        cur = k
        while cur not in visited:
            visited.add(cur)
            cyc.append(cur)
            cur = perm[cur]
        if len(cyc) > 1:
            cycles.append(cyc)
    return cycles


def generate_initial_geodesic_points(init_a: tuple[int, ...], init_b: tuple[int, ...]) -> list[tuple[int, ...]]:
    """Generate intermediate valid 27-int initial states along cycle & transposition paths from init_a to init_b."""
    pts: dict[tuple[int, ...], None] = {init_a: None, init_b: None}
    a = np.array(init_a, dtype=np.int32)
    b = np.array(init_b, dtype=np.int32)

    # First, align {f(3), W(24), AEO(21..23)} with {j(11), q(12), x(13)} as in init_b
    # Using the 21 main tokens: 0..20 except 3, plus 25 (Y)
    main_tokens = [i for i in range(21) if i != 3] + [25]
    # Map key in a -> key in b via main_tokens
    perm = {int(a[t]): int(b[t]) for t in main_tokens}
    if len(set(perm.values())) == 21:
        cycles = decompose_perm_cycles(perm)
        # 1. Cycle-subset hypercube corners (up to 2^6 = 64 subsets)
        use_cycles = cycles[:6]
        for r in range(1, len(use_cycles) + 1):
            for subset in itertools.combinations(range(len(use_cycles)), r):
                sub_map = {k: k for k in perm}
                for c_idx in subset:
                    cyc = use_cycles[c_idx]
                    for idx in range(len(cyc)):
                        sub_map[cyc[idx]] = cyc[(idx + 1) % len(cyc)]
                cand = np.array([sub_map.get(int(x), int(x)) for x in a], dtype=np.int32)
                pts[tuple(cand.tolist())] = None
                # Also version with init_b's small-group pairing onto {j, q, x}
                cand2 = cand.copy()
                for sg in [3, 21, 22, 23, 24]:
                    # Find which palatal (11,12,13) sg shares with in b
                    for pal in (11, 12, 13):
                        if b[sg] == b[pal]:
                            cand2[sg] = cand2[pal]
                            break
                pts[tuple(cand2.tolist())] = None

        # 2. Step-by-step transposition path along each cycle
        cur = a.copy()
        for cyc in cycles:
            # Apply (cyc[0], cyc[1]), (cyc[1], cyc[2]), ...
            for idx in range(len(cyc) - 1):
                ka, kb = cyc[idx], cyc[idx + 1]
                nxt = cur.copy()
                for t in range(27):
                    if cur[t] == ka:
                        nxt[t] = kb
                    elif cur[t] == kb:
                        nxt[t] = ka
                cur = nxt
                pts[tuple(cur.tolist())] = None

    return list(pts.keys())


def generate_final_geodesic_points(final_a: tuple[int, ...], final_b: tuple[int, ...]) -> list[tuple[int, ...]]:
    """Generate intermediate 35-int final states between final_a and final_b via key-cycle decomposition and re-pairing."""
    pts: dict[tuple[int, ...], None] = {final_a: None, final_b: None}
    fa = np.array(final_a, dtype=np.int32)
    fb = np.array(final_b, dtype=np.int32)

    # For each key k in 0..25, pick a representative final f on k in fa (prefer single-letter vowel, then first final)
    rep_f = {}
    for f_idx in range(35):
        k = int(fa[f_idx])
        if k not in rep_f or len(opt.F[f_idx]) == 1:
            rep_f[k] = f_idx

    # Build key map k -> fb[rep_f[k]]. Make it a valid bijection on 0..25 by greedy completion
    used_targets = set()
    perm = {}
    # Lock keys where fa[rep_f[k]] == fb[rep_f[k]] first
    for k in range(26):
        t = int(fb[rep_f[k]])
        if t == k:
            perm[k] = k
            used_targets.add(k)
    for k in range(26):
        if k in perm:
            continue
        t = int(fb[rep_f[k]])
        if t not in used_targets:
            perm[k] = t
            used_targets.add(t)
    rem_src = [k for k in range(26) if k not in perm]
    rem_dst = [k for k in range(26) if k not in used_targets]
    for s, d in zip(rem_src, rem_dst):
        perm[s] = d

    cycles = decompose_perm_cycles(perm)
    use_cycles = cycles[:6]
    # 1. Cycle-subset hypercube on fa
    for r in range(1, len(use_cycles) + 1):
        for subset in itertools.combinations(range(len(use_cycles)), r):
            sub_map = {k: k for k in range(26)}
            for c_idx in subset:
                cyc = use_cycles[c_idx]
                for idx in range(len(cyc)):
                    sub_map[cyc[idx]] = cyc[(idx + 1) % len(cyc)]
            cand = np.array([sub_map[int(x)] for x in fa], dtype=np.int32)
            pts[tuple(cand.tolist())] = None

    # 2. Stepwise transposition path from fa toward fb
    cur = fa.copy()
    for cyc in cycles:
        for idx in range(len(cyc) - 1):
            ka, kb = cyc[idx], cyc[idx + 1]
            nxt = cur.copy()
            for f_i in range(35):
                if cur[f_i] == ka:
                    nxt[f_i] = kb
                elif cur[f_i] == kb:
                    nxt[f_i] = ka
            cur = nxt
            pts[tuple(cur.tolist())] = None

    # 3. Direct coordinate-relocation steps from cur (or fa) toward fb for finals on multi-final keys
    for start_f in (fa, cur):
        w = start_f.copy()
        for f_i in range(35):
            if w[f_i] != fb[f_i]:
                # Check if w[f_i] has at least 2 finals so moving f_i doesn't empty a key
                if np.sum(w == w[f_i]) >= 2:
                    w2 = w.copy()
                    w2[f_i] = fb[f_i]
                    pts[tuple(w2.tolist())] = None
                    w = w2

    return list(pts.keys())


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
    s1_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage1-bilinear-sweep.json").read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in hist_db}

    # Add Stage 1 breakthroughs to by_id as virtual pole seeds
    by_id["S1-TOP1-M42-D8"] = s1_db["top_overall"][0]
    by_id["S1-M37-D3-V0"] = s1_db["best_by_mdv"]["M37_D3_V0"]
    by_id["S1-M37-D3-V0-LP"] = s1_db["best_low_pinky"]["M37_D3"]
    by_id["S1-M38-D3-V1-LP"] = s1_db["best_low_pinky"]["M38_D3"]
    by_id["S1-M36-D1-V1-LP"] = s1_db["best_low_pinky"]["M36_D1"]
    by_id["S1-M35-D1-V0-LP"] = s1_db["best_low_pinky"]["M35_D1"]

    # Define 28 high-value seed pairs spanning all 9 extreme dimensions
    seed_pairs = [
        # 1. Speed x Speed & Stage-1 Breakthroughs
        ("NF4I-AE-Z-M40-09", "R2-21X26-M38-13"),
        ("NF4I-AE-Z-M40-09", "R2-21X26-M38-15"),
        ("NF4I-AE-Z-M40-09", "S21X26-PURE-Y-CANYON-03"),
        ("NF4I-AE-Z-M40-09", "SNF4-M37-AE-12"),
        ("NF4I-AE-Z-M40-09", "NF4I-AE-Z-M38-04"),
        ("NF4I-AE-Z-M40-09", "R10-21X26-M39-08"),
        ("S1-TOP1-M42-D8", "R10-21X26-M39-08"),
        ("S1-TOP1-M42-D8", "R2-21X26-M38-15"),
        ("S1-TOP1-M42-D8", "S21X26-PURE-Y-CANYON-03"),
        # 2. Speed x D=1 / Low-M (M35..M36)
        ("NF4I-AE-Z-M40-09", "SNF4-M35-AE-01"),
        ("NF4I-AE-Z-M40-09", "R3-21X26-M36-11"),
        ("R10-21X26-M39-08", "SNF4-M35-AE-01"),
        ("R10-21X26-M39-08", "R3-21X26-M36-11"),
        ("R2-21X26-M38-13", "SNF4-M35-AE-01"),
        ("S1-M37-D3-V0-LP", "SNF4-M35-AE-01"),
        ("S1-M37-D3-V0-LP", "R10-21X26-M39-08"),
        ("S1-M37-D3-V0-LP", "NF4I-AE-Z-M40-09"),
        # 3. Speed x D=2 / D=3 / Ultra-Low-Pinky
        ("NF4I-AE-Z-M40-09", "R6-21X26-M37-C19"),
        ("R10-21X26-M39-08", "R6-21X26-M37-C19"),
        ("S1-M37-D3-V0-LP", "R6-21X26-M37-C19"),
        ("NF4I-AE-Z-M40-09", "SNF4-M36-AE-08"),
        ("NF4I-AE-Z-M40-09", "R9-21X26-M37-06"),
        # 4. Speed x High Home Row
        ("S1-TOP1-M42-D8", "R6-21X26-M42-14"),
        ("NF4I-AE-Z-M40-09", "R7-21X26-M40-11"),
        ("R10-21X26-M39-08", "R7-21X26-M39-10"),
        # 5. Speed x Raw S2ms & Low 4-Code Cross-Collision Canyon
        ("S1-TOP1-M42-D8", "NF4I-AE-AEO-M40-23"),
        ("NF4I-AE-Z-M40-09", "S21X26-CONT5-F06-M40-PURE-Y-CANYON-01"),
        ("R10-21X26-M39-08", "S21X26-CONT5-F06-M40-PURE-Y-CANYON-01"),
        ("S1-M37-D3-V0-LP", "S21X26-CONT5-F06-M40-PURE-Y-CANYON-01"),
        ("S1-TOP1-M42-D8", "S21X26-CONT5-F08-M40-PURE-Y-PERFORMANCE-11"),
    ]

    tone_list = TONE_IEUAO.tolist()
    evaluated_states: dict[tuple[int, ...], dict] = {}
    pair_summaries = []

    for pair_idx, (id_a, id_b) in enumerate(seed_pairs, 1):
        sa = by_id[id_a]["state"]
        sb = by_id[id_b]["state"]
        inits = generate_initial_geodesic_points(tuple(sa[:27]), tuple(sb[:27]))
        finals = generate_final_geodesic_points(tuple(sa[27:62]), tuple(sb[27:62]))

        best_on_face = None
        valid_on_face = 0
        for it in inits:
            for ft in finals:
                st_tuple = it + ft + tuple(tone_list)
                if st_tuple in evaluated_states:
                    cand = evaluated_states[st_tuple]
                    valid_on_face += 1
                    if best_on_face is None or cand["ckt_v3"] < best_on_face["ckt_v3"]:
                        best_on_face = cand
                    continue
                st = np.array(st_tuple, dtype=np.int32)
                if not is_valid_21x26_pure_y(st):
                    continue
                valid_on_face += 1
                ckt_v3, ckt_v3_raw, ums, res3, res4 = engine.score_all(st)
                m_val = int(opt.memory(st))
                d_val = sum(int(st[idx] != opt.PREF[idx]) for idx in ORDINARY)
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
                    "w3_p0": float(res3[0, 2]),
                    "w4_p0": float(res4[0, 2]),
                    "face_pair": f"{id_a} <-> {id_b}",
                    "state": list(st_tuple),
                }
                evaluated_states[st_tuple] = cand
                if best_on_face is None or ckt_v3 < best_on_face["ckt_v3"]:
                    best_on_face = cand

        v3_a = by_id[id_a]["ckt_v3"]
        v3_b = by_id[id_b]["ckt_v3"]
        pair_summaries.append({
            "pair": f"{id_a} <-> {id_b}",
            "grid_size": len(inits) * len(finals),
            "valid_points": valid_on_face,
            "endpoint_min_v3": min(v3_a, v3_b),
            "face_min_v3": best_on_face["ckt_v3"] if best_on_face else None,
            "best_M_D_V": f"M{best_on_face['M']}/D{best_on_face['D']}/V{best_on_face['V']}" if best_on_face else None,
        })
        print(f"[{pair_idx:2d}/{len(seed_pairs)}] {id_a:26s} <-> {id_b:26s} | grid={len(inits):3d}x{len(finals):3d} valid={valid_on_face:5d} | end_min={min(v3_a,v3_b):.5f} -> face_min={best_on_face['ckt_v3']:.5f} (M{best_on_face['M']}/D{best_on_face['D']}/V{best_on_face['V']})")

    print(f"\nTotal unique valid states evaluated across 30 coordinate faces: {len(evaluated_states)} in {time.perf_counter()-t0:.2f}s")

    # Enrich top discoveries across buckets
    def enrich(c):
        if "S2ms" in c:
            return c
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

    all_cands = list(evaluated_states.values())
    all_cands.sort(key=lambda x: x["ckt_v3"])
    top_overall = [enrich(c) for c in all_cands[:35]]

    best_by_mdv = {}
    for c in all_cands:
        k = (c["M"], c["D"], c["V"])
        if k not in best_by_mdv or c["ckt_v3"] < best_by_mdv[k]["ckt_v3"]:
            best_by_mdv[k] = c

    out_path = WORKTREE / "research-notes" / "data" / "shenyun-21x26-stage2a-face-sweeps.json"
    out_path.write_text(json.dumps({
        "pair_summaries": pair_summaries,
        "top_overall": top_overall,
        "best_by_mdv": {f"M{k[0]}_D{k[1]}_V{k[2]}": enrich(v) for k, v in sorted(best_by_mdv.items())},
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved Stage 2A face sweep results -> {out_path}")


if __name__ == "__main__":
    main()
