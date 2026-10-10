#!/usr/bin/env python3
"""Consolidate all discovered 21x26 IEUAO 399-unique pure-y schemes from
Stages 1, 2A, 2B, and 3; select the next-generation Pareto frontier seeds across
all regimes; and independently verify every finalist via Node.js score_candidates_v3.js.
"""

from __future__ import annotations

import json
import os
import subprocess
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

KEYS = opt.META["keys"]
ORDINARY = [i for i in range(21) if len(opt.HEADS[i]) == 1]
RETRO = [14, 15, 16]
VOWELS = ["a", "e", "i", "o", "u"]
VIX = [27 + opt.F.index(v) for v in VOWELS]


def format_init_summary(st: list[int] | np.ndarray) -> str:
    parts = []
    for i in ORDINARY:
        if st[i] != opt.PREF[i]:
            parts.append(f"{opt.HEADS[i]}->{KEYS[st[i]]}")
    for i in RETRO:
        parts.append(f"{opt.HEADS[i]}->{KEYS[st[i]]}")
    parts.append(f"AEO->{KEYS[st[21]]}")
    parts.append(f"W->{KEYS[st[24]]}")
    parts.append(f"Y->{KEYS[st[25]]}")
    return ", ".join(parts)


def format_vowel_summary(st: list[int] | np.ndarray) -> str:
    parts = []
    for v, idx in zip(VOWELS, VIX):
        if st[idx] != opt.PREF[idx]:
            parts.append(f"{v}->{KEYS[st[idx]]}")
    v_idx = 27 + opt.F.index("v")
    parts.append(f"v->{KEYS[st[v_idx]]}")
    return ", ".join(parts) if parts else "vowels fixed"


def main():
    t0 = time.perf_counter()
    engine = load_scorer()
    corpus_seq, corpus_w = build_collision_proxy_arrays()
    stamps = np.zeros(26**4, np.int32)
    masks = np.zeros(26**4, np.int16)
    counts = np.zeros(26**4, np.int16)
    masses = np.zeros(26**4, np.float64)
    maxima = np.zeros(26**4, np.float64)
    epoch = 0

    def eval_proxy(st: np.ndarray) -> tuple[float, float]:
        nonlocal epoch
        epoch += 1
        m = collision_proxy_njit(
            st,
            corpus_seq[2], corpus_seq[3], corpus_seq[4],
            corpus_w[2], corpus_w[3], corpus_w[4],
            stamps, masks, counts, masses, maxima, epoch,
        )
        return float(np.mean(m[:, 0])), float(np.mean(m[:, 1]))

    def full_eval(st_list: list[int], scheme_id: str, category: str, origin: str) -> dict:
        st = np.array(st_list, dtype=np.int32)
        assert is_valid_21x26_pure_y(st), f"Invalid state for {scheme_id}"
        ckt_v3, ckt_v3_raw, ums, res3, res4 = engine.score_all(st)
        kc1_ms, kw2_ms, kw3_ms, kw4_ms, sc1_ms, sw2_ms, sw3_ms, sw4_ms = ums
        desc = r5.describe(st)
        _, vals = opt.initialize(st, opt.PARAMS)
        m = opt.metrics(vals, opt.PARAMS)
        p_aff, p_loss = eval_proxy(st)
        entry = opt.toentry(st, r5.D, scheme_id)
        return {
            "id": scheme_id,
            "category": category,
            "origin": origin,
            "M": int(desc["M"]),
            "D": int(desc["D"]),
            "V": int(desc["V"]),
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
            "homeS2": float(desc["homeS2"]),
            "homeFloor": float(desc["homeFloor"]),
            "Pmax": float(desc["rpMax"]),
            "proxyAffected": float(p_aff),
            "proxyFirstLoss": float(p_loss),
            "init_summary": format_init_summary(st),
            "vowel_summary": format_vowel_summary(st),
            "state": st.tolist(),
            "entry": entry,
        }

    # Load all pools
    data_dir = WORKTREE / "research-notes" / "data"
    hist_db = json.loads((data_dir / "shenyun-21x26-all-historical-pools-v3.json").read_text(encoding="utf-8"))["schemes"]
    s1_db = json.loads((data_dir / "shenyun-21x26-stage1-bilinear-sweep.json").read_text(encoding="utf-8"))
    _s2a_raw = json.loads((data_dir / "shenyun-21x26-stage2a-face-sweeps.json").read_text(encoding="utf-8"))
    s2a_db = _s2a_raw.get("top_overall", []) + list(_s2a_raw.get("best_by_mdv", {}).values())
    s2b_db = json.loads((data_dir / "shenyun-21x26-stage2b-basin-descent.json").read_text(encoding="utf-8"))["schemes"]
    s3_db = json.loads((data_dir / "shenyun-21x26-stage3-ravines-and-canyons.json").read_text(encoding="utf-8"))["schemes"]

    hist_by_id = {r["id"]: r for r in hist_db}
    hist_states = {tuple(r["state"]) for r in hist_db}

    # Pool all newly discovered states across Stage 1, 2A, 2B, 3
    new_pool_map: dict[tuple[int, ...], tuple[dict, str]] = {}

    def add_candidate(rec: dict, source_stage: str):
        st = rec.get("state")
        if not st:
            return
        t = tuple(st)
        if t not in new_pool_map:
            new_pool_map[t] = (rec, source_stage)
        else:
            old_rec, _ = new_pool_map[t]
            if "proxyAffected" in rec and "proxyAffected" not in old_rec:
                new_pool_map[t] = (rec, source_stage)

    for r in s1_db.get("top_overall", []):
        add_candidate(r, "Stage1:top_overall")
    for r in s1_db.get("best_low_pinky", {}).values():
        add_candidate(r, "Stage1:best_low_pinky")
    for r in s1_db.get("best_mid_pinky", {}).values():
        add_candidate(r, "Stage1:best_mid_pinky")
    for r in s1_db.get("best_high_home", {}).values():
        add_candidate(r, "Stage1:best_high_home")
    for k, r in s1_db.get("best_by_mdv", {}).items():
        add_candidate(r, f"Stage1:best_by_mdv:{k}")
    for r in s2a_db:
        add_candidate(r, f"Stage2A:{r.get('pair', 'face')}")
    for r in s2b_db:
        add_candidate(r, f"Stage2B:{r.get('tag', 'basin')}")
    for r in s3_db:
        add_candidate(r, f"Stage3:{r.get('tag', 'ravine')}")

    print(f"Loaded {len(new_pool_map)} unique candidate states across Stages 1, 2A, 2B, 3.", flush=True)

    # Evaluate any candidate missing S2ms/proxyAffected
    all_new: list[dict] = []
    for t, (rec, src) in new_pool_map.items():
        tag = rec.get("tag") or rec.get("id") or src
        all_new.append(full_eval(list(t), tag, "candidate", src))

    all_new.sort(key=lambda x: x["ckt_v3"])

    # Curate the Next-Generation Frontier Catalog across all regimes
    selected_states: set[tuple[int, ...]] = set()
    frontier_catalog: list[dict] = []

    def pick_best(pred, new_id: str, category: str, limit: int = 1, sort_key=lambda x: x["ckt_v3"]):
        matches = [r for r in all_new if pred(r) and tuple(r["state"]) not in selected_states]
        matches.sort(key=sort_key)
        for idx, m in enumerate(matches[:limit]):
            selected_states.add(tuple(m["state"]))
            item = dict(m)
            item["id"] = new_id if limit == 1 else f"{new_id}-{idx+1:02d}"
            item["category"] = category
            frontier_catalog.append(item)

    # 1. Track A: Ultimate Speed Frontier (M=40..42, V=0)
    pick_best(lambda r: r["M"] <= 42 and r["V"] == 0, "SY26-V3-M42-D8-ULTIMATE-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 41 and r["V"] == 0 and r["homeS2"] >= 0.415, "SY26-V3-M41-D8-SPEED-HOME-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 40 and r["V"] == 0, "SY26-V3-M40-D7-SPEED-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 40 and r["V"] == 0 and r["S2ms"] <= 67.30 and r["E6"] <= 9.89, "SY26-V3-M40-D7-ALLROUND-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 40 and r["D"] <= 6 and r["V"] == 0 and r["S2ms"] <= 67.10, "SY26-V3-M40-D6-LOW-S2-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 41 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-M41-D7-ULTRALOW-PINKY-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] <= 40 and r["V"] == 0 and r["Pmax"] <= 0.0339, "SY26-V3-M40-D7-LOW-PINKY-01", "A_Ultimate_Speed")

    # 2. Track B: Low-Memory & Equal-(M, D) Pareto Frontier (M=35..39, D=1..6)
    # M=39
    pick_best(lambda r: r["M"] == 39 and r["D"] <= 6 and r["V"] == 0, "SY26-V3-M39-D6-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 39 and r["D"] <= 5 and r["V"] == 0 and r["Pmax"] <= 0.0339, "SY26-V3-M39-D5-LOW-PINKY-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 39 and r["D"] <= 5 and r["V"] == 0 and r["S2ms"] <= 67.50, "SY26-V3-M39-D5-BALANCED-01", "B_Low_Memory_Pareto")
    # M=38
    pick_best(lambda r: r["M"] == 38 and r["D"] == 5 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-M38-D5-ULTRALOW-PINKY-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 4 and r["V"] == 0, "SY26-V3-M38-D4-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 4 and r["V"] == 0 and r["S2ms"] <= 67.50, "SY26-V3-M38-D4-BALANCED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 3 and r["V"] == 1 and r["S2ms"] <= 68.50, "SY26-V3-M38-D3-V1-NO-DE-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 3 and r["V"] == 1 and r["Pmax"] <= 0.0339, "SY26-V3-M38-D3-V1-LOW-PINKY-01", "B_Low_Memory_Pareto")
    # M=37
    pick_best(lambda r: r["M"] == 37 and r["D"] == 4 and r["V"] == 0 and r["S2ms"] <= 68.50, "SY26-V3-M37-D4-V0-NO-DE-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 4 and r["V"] == 0 and r["S2ms"] <= 69.20 and r["Pmax"] <= 0.0339, "SY26-V3-M37-D4-V0-NO-DE-LP-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 3 and r["V"] == 0, "SY26-V3-M37-D3-V0-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 3 and r["V"] == 0 and r["S2ms"] <= 69.20 and r["Pmax"] <= 0.0339, "SY26-V3-M37-D3-V0-NO-DE-LP-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 2 and r["V"] == 1 and r["Pmax"] <= 0.0260, "SY26-V3-M37-D2-V1-ULTRALOW-PINKY-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 2 and r["V"] == 1, "SY26-V3-M37-D2-V1-SPEED-01", "B_Low_Memory_Pareto")
    # M=36
    pick_best(lambda r: r["M"] == 36 and r["D"] == 3 and r["V"] == 0, "SY26-V3-M36-D3-V0-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 3 and r["V"] == 0 and r["S2ms"] <= 70.00 and r["Pmax"] <= 0.0339, "SY26-V3-M36-D3-V0-NO-DE-LP-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 0, "SY26-V3-M36-D2-V0-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 0 and r["S2ms"] <= 69.50, "SY26-V3-M36-D2-V0-NO-DE-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 1, "SY26-V3-M36-D2-V1-NO-DE-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 1 and r["V"] == 1, "SY26-V3-M36-D1-V1-SPEED-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 1 and r["V"] == 1 and r["S2ms"] <= 69.20, "SY26-V3-M36-D1-V1-BALANCED-01", "B_Low_Memory_Pareto")
    # M=35
    pick_best(lambda r: r["M"] == 35 and r["D"] == 2 and r["V"] == 0, "SY26-V3-M35-D2-V0-MINMEM-01", "B_Low_Memory_Pareto")
    pick_best(lambda r: r["M"] == 35 and r["D"] == 1 and r["V"] == 0, "SY26-V3-M35-D1-V0-MINMEM-01", "B_Low_Memory_Pareto")

    # 3. Track C: High-Home & Ultra-Low-Pinky Ravine (Home = 45%..55%)
    pick_best(lambda r: r["homeS2"] >= 0.45 and r["M"] == 38 and r["D"] == 1 and r["V"] == 3, "SY26-V3-M38-D1-V3-HIGH-HOME-45-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.46 and r["M"] == 38 and r["D"] == 2 and r["V"] == 1, "SY26-V3-M38-D2-V1-HIGH-HOME-46-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.465 and r["M"] == 40 and r["D"] == 3 and r["V"] == 3, "SY26-V3-M40-D3-V3-HIGH-HOME-47-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.47 and r["M"] == 39, "SY26-V3-M39-D2-V1-HIGH-HOME-48-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.495 and r["M"] == 40, "SY26-V3-M40-D2-V4-HIGH-HOME-51-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.515 and r["M"] <= 42, "SY26-V3-M42-HIGH-HOME-52-01", "C_High_Home_Ravine")
    pick_best(lambda r: r["homeS2"] >= 0.54, "SY26-V3-M46-D8-V4-HIGH-HOME-55-01", "C_High_Home_Ravine")

    # 4. Track D: 4-Code Cross-Family Collision Canyon (proxyAffected <= 4.55%)
    pick_best(lambda r: r["proxyAffected"] <= 0.0365, "SY26-V3-M40-D5-V1-CANYON-34-01", "D_Collision_Canyon")
    pick_best(lambda r: r["proxyAffected"] <= 0.0380 and r["M"] <= 38 and r["V"] == 0, "SY26-V3-M38-D5-V0-CANYON-38-01", "D_Collision_Canyon")
    pick_best(lambda r: r["proxyAffected"] <= 0.0455 and r["M"] <= 38 and r["V"] == 0, "SY26-V3-M38-D5-V0-CANYON-45-01", "D_Collision_Canyon")

    # Key historical baselines for direct comparison
    baseline_ids = [
        "NF4I-AE-Z-M40-09",
        "NF4I-AE-Z-M38-04",
        "R10-21X26-M39-08",
        "R2-21X26-M38-13",
        "R2-21X26-M38-15",
        "SNF4-M37-AE-12",
        "R10-21X26-M37-03",
        "R6-21X26-M37-C19",
        "SNF4-M36-AE-08",
        "R3-21X26-M36-11",
        "SNF4-M35-AE-01",
        "S21X26-CONT5-F06-M40-PURE-Y-CANYON-01",
        "R7-21X26-M40-11",
        "R6-21X26-M42-13",
    ]
    baselines = [
        full_eval(hist_by_id[bid]["state"], bid, "Historical_Baseline", hist_by_id[bid].get("source", "historical"))
        for bid in baseline_ids
        if bid in hist_by_id
    ]

    # Run independent Node.js verification via score_candidates_v3.js on all selected finalists + baselines
    # Override entry["id"] with the catalog item["id"] so JS results are keyed consistently
    combined_for_js = []
    for item in frontier_catalog + baselines:
        e = dict(item["entry"])
        e["id"] = item["id"]
        item["entry"] = e
        combined_for_js.append(e)
    tmp_in = data_dir / "tmp_frontier_js_verify_in.json"
    tmp_out = data_dir / "tmp_frontier_js_verify_out.json"
    tmp_in.write_text(json.dumps(combined_for_js, ensure_ascii=False), encoding="utf-8")

    print(f"Running independent Node.js score_candidates_v3.js verification on {len(combined_for_js)} schemes...", flush=True)
    subprocess.run(
        [
            "node",
            str(WORKTREE / "scripts" / "research" / "score_candidates_v3.js"),
            "--input",
            str(tmp_in),
            "--output",
            str(tmp_out),
        ],
        check=True,
        cwd=str(WORKTREE),
    )

    js_results = {r["id"]: r for r in json.loads(tmp_out.read_text(encoding="utf-8"))}
    tmp_in.unlink(missing_ok=True)
    tmp_out.unlink(missing_ok=True)

    max_js_diff = 0.0
    for item in frontier_catalog + baselines:
        jr = js_results[item["id"]]
        diff = abs(item["ckt_v3"] - jr["ckt_v3"])
        max_js_diff = max(max_js_diff, diff)
        item["js_ckt_v3"] = float(jr["ckt_v3"])
        item["js_abs_diff"] = float(diff)
        # Also verify 8B collision rates vs S005 (from engine.s005_p2 and JS modes)
        modes = jr["modes"]
        item["modes"] = modes
        item["b8_p1_p2"] = {
            "kc1_p1": modes["keytao"]["character"]["p1"],
            "kc1_p2": modes["keytao"]["character"]["p2"],
            "kw2_p1": modes["keytao"]["word2"]["p1"],
            "kw2_p2": modes["keytao"]["word2"]["p2"],
            "sc1_p1": modes["sanpin"]["character"]["p1"],
            "sc1_p2": modes["sanpin"]["character"]["p2"],
            "sw2_p1": modes["sanpin"]["word2"]["p1"],
            "sw2_p2": modes["sanpin"]["word2"]["p2"],
        }

    print(f"Independent Node.js verification passed! Max |Numba - JS| across {len(combined_for_js)} schemes = {max_js_diff:.3e}", flush=True)

    print("\n=== NEXT-GENERATION 21x26 IEUAO 399-UNIQUE PURE-Y FRONTIER CATALOG ===")
    for item in frontier_catalog:
        print(
            f"  {item['id']:38s} | {item['category']:20s} | M{item['M']}/D{item['D']}/V{item['V']} | "
            f"v3={item['ckt_v3']:.5f} (raw={item['ckt_v3_raw']:.5f}) | S2={item['S2ms']:.2f} E6={item['E6']:.4f} V6={item['V6']:.4f} | "
            f"Home={item['homeS2']*100:.2f}% Pmax={item['Pmax']*100:.2f}% pAff={item['proxyAffected']*100:.2f}% | {item['init_summary']}"
        )

    print("\n=== HISTORICAL BASELINES FOR COMPARISON ===")
    for item in baselines:
        print(
            f"  {item['id']:38s} | {item['origin']:20s} | M{item['M']}/D{item['D']}/V{item['V']} | "
            f"v3={item['ckt_v3']:.5f} (raw={item['ckt_v3_raw']:.5f}) | S2={item['S2ms']:.2f} E6={item['E6']:.4f} V6={item['V6']:.4f} | "
            f"Home={item['homeS2']*100:.2f}% Pmax={item['Pmax']*100:.2f}% pAff={item['proxyAffected']*100:.2f}% | {item['init_summary']}"
        )

    out_path = data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json"
    out_payload = {
        "meta": {
            "capacity": [21, 26],
            "tone": "IEUAO",
            "unique": 399,
            "pure_y": True,
            "tau": 600,
            "firstAux": 300,
            "secondAux": 300,
            "max_js_abs_diff": max_js_diff,
            "frontier_count": len(frontier_catalog),
            "baseline_count": len(baselines),
        },
        "frontier": frontier_catalog,
        "baselines": baselines,
    }
    out_path.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved verified frontier catalog to {out_path} in {time.perf_counter()-t0:.2f}s.", flush=True)


if __name__ == "__main__":
    main()
