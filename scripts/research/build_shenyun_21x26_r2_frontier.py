#!/usr/bin/env python3
"""Consolidate all 789+ Round 2 discovered 21x26 IEUAO 399-unique pure-y candidates,
test O->n split variants, curate the Round 2 Next-Generation Pareto Frontier & Seeds Catalog,
and independently verify every finalist via Node.js score_candidates_v3.js.
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

from harvest_all_21x26_pools import (
    TONE_IEUAO,
    build_collision_proxy_arrays,
    collision_proxy_njit,
    is_valid_21x26_pure_y,
    load_scorer,
)

KEYS = opt.META["keys"][:26]
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
    if st[21] == st[22] == st[23]:
        parts.append(f"AEO->{KEYS[st[21]]}")
    else:
        parts.append(f"A->{KEYS[st[21]]}, E->{KEYS[st[22]]}, O->{KEYS[st[23]]}")
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
    masks = np.zeros(26**4, np.uint8)
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
            "no_de": int(st[opt.HEADS.index("d")] != opt.META["keys"].index("D")),
            "proxyAffected": float(p_aff),
            "proxyFirstLoss": float(p_loss),
            "init_summary": format_init_summary(st),
            "vowel_summary": format_vowel_summary(st),
            "state": st.tolist(),
            "entry": entry,
        }

    data_dir = WORKTREE / "research-notes" / "data"
    r1_data = json.loads((data_dir / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))
    r1_frontier = r1_data["frontier"]
    r1_states = {tuple(r["state"]) for r in r1_frontier}

    r2_raw = json.loads((data_dir / "r2_discovered_candidates.json").read_text(encoding="utf-8"))["candidates"]
    print(f"Loaded {len(r2_raw)} Round 2 candidates from r2_discovered_candidates.json", flush=True)

    # Also test O->n split on top 50 Round 2 candidates (mode=4 allows split A/E/O) to quantify split AEO impact
    o_split_deltas = []
    for c in r2_raw[:50]:
        st = np.array(c["state"], dtype=np.int32)
        st_split = st.copy()
        st_split[23] = st[opt.HEADS.index("n")]  # O -> n's key
        if opt.valid(st_split, 99, opt.PARAMS[-2], opt.PARAMS[-1], 4):
            v3_split = float(engine.score_all(st_split)[0])
            o_split_deltas.append(v3_split - c["ckt_v3"])
    if o_split_deltas:
        print(f"Tested O->n split ({len(o_split_deltas)} valid): min delta={min(o_split_deltas):+.5f}, mean delta={np.mean(o_split_deltas):+.5f} (costs +1M)", flush=True)
    else:
        print("Tested O->n split: 0 valid on existing final maps without re-packing (o/ou paired on n's final key)", flush=True)

    all_r2: list[dict] = []
    for c in r2_raw:
        if tuple(c["state"]) in r1_states:
            continue
        all_r2.append(full_eval(c["state"], c["tag"], c["track"], c["tag"]))

    all_r2.sort(key=lambda x: x["ckt_v3"])
    print(f"Evaluated {len(all_r2)} strictly new Round 2 candidates.", flush=True)

    selected_states: set[tuple[int, ...]] = set()
    frontier_catalog: list[dict] = []

    def pick_best(pred, new_id: str, category: str, limit: int = 1, sort_key=lambda x: x["ckt_v3"]):
        matches = [r for r in all_r2 if pred(r) and tuple(r["state"]) not in selected_states]
        matches.sort(key=sort_key)
        for idx, m in enumerate(matches[:limit]):
            selected_states.add(tuple(m["state"]))
            item = dict(m)
            item["id"] = new_id if limit == 1 else f"{new_id}-{idx+1:02d}"
            item["entry"]["id"] = item["id"]
            item["entry"]["name"] = item["id"]
            item["category"] = category
            frontier_catalog.append(item)

    # =========================================================================
    # Category A: Global Ultimate Speed & M39..M44 Pareto Frontier (Sub-9.40 Breakthroughs)
    # =========================================================================
    pick_best(lambda r: r["M"] == 44 and r["V"] == 0, "SY26-V3-R2-M44-D9-ULTIMATE-384", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 44 and r["V"] == 0 and r["Pmax"] <= 0.0485 and r["homeS2"] >= 0.435, "SY26-V3-R2-M44-D9-HOME-SPEED", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 43 and r["V"] == 0, "SY26-V3-R2-M43-D9-ULTIMATE-387", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 43 and r["V"] == 0 and r["Pmax"] <= 0.0485 and r["homeS2"] >= 0.435, "SY26-V3-R2-M43-D9-HOME-SPEED", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 42 and r["V"] == 0, "SY26-V3-R2-M42-D9-SUB940-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 42 and r["D"] <= 8 and r["V"] == 0, "SY26-V3-R2-M42-D8-SUB940-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 41 and r["D"] == 7 and r["V"] == 0, "SY26-V3-R2-M41-D7-SPEED-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 41 and r["D"] == 8 and r["V"] == 0, "SY26-V3-R2-M41-D8-SPEED-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 40 and r["D"] == 7 and r["V"] == 0, "SY26-V3-R2-M40-D7-SPEED-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 40 and r["D"] == 7 and r["V"] == 0 and r["S2ms"] <= 67.25, "SY26-V3-R2-M40-D7-BALANCED-01", "A_Ultimate_Speed")
    pick_best(lambda r: r["M"] == 39 and r["D"] == 6 and r["V"] == 0, "SY26-V3-R2-M39-D6-SPEED-01", "A_Ultimate_Speed")

    # =========================================================================
    # Category B: Low-Pinky & Ultra-Low-Pinky Cliff Breakthroughs (M39..M42)
    # =========================================================================
    pick_best(lambda r: r["M"] == 42 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M42-D7-V1-LP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 42 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M42-D7-V0-ULP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 42 and r["D"] == 8 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M42-D8-V0-ULP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 41 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M41-D6-V1-ULP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 41 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M41-D6-V0-ULP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 40 and r["V"] == 0 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M40-D6-V0-LP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 40 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M40-D6-V0-ULP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 39 and r["V"] == 0 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M39-D6-V0-LP-01", "B_Low_Pinky_Breakthrough")
    pick_best(lambda r: r["M"] == 39 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M39-D6-V0-ULP-01", "B_Low_Pinky_Breakthrough")

    # =========================================================================
    # Category C: Low-Memory & Palatal Triad Ravines (M35..M38)
    # =========================================================================
    # M=38
    pick_best(lambda r: r["M"] == 38 and r["D"] == 3 and r["V"] == 1, "SY26-V3-R2-M38-D3-V1-SPEED-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 4 and r["V"] == 1 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M38-D4-V1-ULP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 5 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M38-D5-V0-ULP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 38 and r["D"] == 4 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M38-D4-V0-ULP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 38 and r["V"] == 0 and r["no_de"] == 1 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M38-D4-V0-NODE-LP-01", "C_Low_Memory_Ravine")
    # M=37
    pick_best(lambda r: r["M"] == 37 and r["D"] == 3 and r["V"] == 0, "SY26-V3-R2-M37-D3-V0-SPEED-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 3 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M37-D3-V0-ULP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 37 and r["D"] == 3 and r["V"] == 0 and r["no_de"] == 1 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M37-D3-V0-NODE-LP-01", "C_Low_Memory_Ravine")
    # M=36
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 1 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M36-D2-V1-TRIAD-LP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 1 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M36-D2-V1-TRIAD-ULP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 1 and r["V"] == 1, "SY26-V3-R2-M36-D1-V1-SPEED-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 3 and r["V"] == 0, "SY26-V3-R2-M36-D3-V0-TRIAD-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 3 and r["V"] == 0 and r["Pmax"] <= 0.0295, "SY26-V3-R2-M36-D3-V0-TRIAD-LP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 3 and r["V"] == 0 and r["Pmax"] <= 0.0250, "SY26-V3-R2-M36-D3-V0-TRIAD-P244-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 36 and r["D"] == 2 and r["V"] == 0 and r["no_de"] == 1 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M36-D2-V0-NODE-LP-01", "C_Low_Memory_Ravine")
    # M=35
    pick_best(lambda r: r["M"] == 35 and r["D"] == 1 and r["V"] == 0, "SY26-V3-R2-M35-D1-V0-SPEED-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 35 and r["D"] == 1 and r["V"] == 0 and r["Pmax"] <= 0.0339, "SY26-V3-R2-M35-D1-V0-LP-01", "C_Low_Memory_Ravine")
    pick_best(lambda r: r["M"] == 35 and r["D"] == 1 and r["V"] == 0 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M35-D1-V0-ULP-01", "C_Low_Memory_Ravine")

    # =========================================================================
    # Category D: High-Home + Ultra-Low-Pinky Dual-Gated Ergonomic Basin
    # =========================================================================
    pick_best(lambda r: r["homeS2"] >= 0.490 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M44-D7-V2-HOME49-ULP-01", "D_High_Home_Basin")
    pick_best(lambda r: r["homeS2"] >= 0.495 and r["Pmax"] <= 0.0285 and r["M"] <= 43, "SY26-V3-R2-M43-D7-V1-HOME50-ULP-01", "D_High_Home_Basin")
    pick_best(lambda r: r["homeS2"] >= 0.540 and r["Pmax"] <= 0.0285 and r["M"] <= 42, "SY26-V3-R2-M42-D3-V4-HOME54-ULP-01", "D_High_Home_Basin")
    pick_best(lambda r: r["homeS2"] >= 0.500 and r["Pmax"] <= 0.0285 and r["M"] <= 42 and r["V"] <= 2, "SY26-V3-R2-M42-D5-V2-HOME50-ULP-01", "D_High_Home_Basin")
    pick_best(lambda r: r["homeS2"] >= 0.555 and r["Pmax"] <= 0.0285, "SY26-V3-R2-M42-D5-V2-HOME56-ULP-01", "D_High_Home_Basin")
    pick_best(lambda r: r["homeS2"] >= 0.560, "SY26-V3-R2-M44-D7-V2-HOME56-MAX-01", "D_High_Home_Basin", sort_key=lambda x: -x["homeS2"])

    # =========================================================================
    # Category E: 4-Code Cross-Family Collision Canyon (Sub-3.00% Breakthroughs)
    # =========================================================================
    pick_best(lambda r: r["proxyAffected"] <= 0.0300, "SY26-V3-R2-M38-D4-V1-CANYON-292-01", "E_Collision_Canyon", sort_key=lambda x: x["proxyAffected"])
    pick_best(lambda r: r["proxyAffected"] <= 0.0295 and r["ckt_v3"] <= 9.66, "SY26-V3-R2-M43-D9-V1-CANYON-293-01", "E_Collision_Canyon")
    pick_best(lambda r: r["proxyAffected"] <= 0.0300 and r["M"] <= 36, "SY26-V3-R2-M36-D2-V1-CANYON-299-01", "E_Collision_Canyon", sort_key=lambda x: x["proxyAffected"])
    pick_best(lambda r: r["proxyAffected"] <= 0.0338 and r["ckt_v3"] <= 9.54, "SY26-V3-R2-M43-D9-V1-CANYON-FAST-01", "E_Collision_Canyon")
    pick_best(lambda r: r["proxyAffected"] <= 0.0332 and r["M"] <= 38 and r["V"] == 0, "SY26-V3-R2-M38-D5-V0-CANYON-331-01", "E_Collision_Canyon")
    pick_best(lambda r: r["proxyAffected"] <= 0.0327 and r["M"] <= 38 and r["homeS2"] >= 0.40, "SY26-V3-R2-M38-D4-V1-CANYON-326-01", "E_Collision_Canyon")

    print(f"\nCurated {len(frontier_catalog)} Round 2 Frontier & Seed schemes across Categories A..E.", flush=True)

    # Independent Node.js verification via score_candidates_v3.js
    tmp_in = data_dir / "_tmp_r2_verify_in.json"
    tmp_out = data_dir / "_tmp_r2_verify_out.json"
    tmp_in.write_text(json.dumps([r["entry"] for r in frontier_catalog], ensure_ascii=False), encoding="utf-8")

    js_script = WORKTREE / "scripts" / "research" / "score_candidates_v3.js"
    html_path = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
    if not tmp_out.exists():
        subprocess.run(
            [
                "node",
                str(js_script),
                "--html", str(html_path),
                "--input", str(tmp_in),
                "--output", str(tmp_out),
            ],
            check=True,
        )
    raw_js = json.loads(tmp_out.read_text(encoding="utf-8"))
    js_list = raw_js["schemes"] if isinstance(raw_js, dict) else raw_js
    js_res = {r["id"]: r for r in js_list}
    tmp_in.unlink(missing_ok=True)
    tmp_out.unlink(missing_ok=True)

    max_diff = 0.0
    for item in frontier_catalog:
        jr = js_res[item["id"]]
        diff = abs(item["ckt_v3"] - float(jr["ckt_v3"]))
        if diff > max_diff:
            max_diff = diff
        item["js_ckt_v3"] = float(jr["ckt_v3"])
        item["js_abs_diff"] = float(diff)
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
        del item["entry"]

    print(f"Verified all {len(frontier_catalog)} Round 2 frontier schemes via Node.js: max |Numba - JS| = {max_diff:.3e}", flush=True)
    assert max_diff < 1e-11, f"JS verification mismatch: {max_diff}"

    out_json = data_dir / "shenyun-21x26-ckt-v3-round2-frontier.json"
    out_json.write_text(
        json.dumps(
            {
                "meta": {
                    "round": 2,
                    "capacity": [21, 26],
                    "tone": "IEUAO",
                    "unique": 399,
                    "pure_y": True,
                    "tau": 600,
                    "firstAux": 300,
                    "secondAux": 300,
                    "max_js_abs_diff": max_diff,
                    "frontier_count": len(frontier_catalog),
                    "total_r2_candidates_evaluated": len(all_r2),
                },
                "frontier": frontier_catalog,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Saved Round 2 frontier catalog to {out_json} in {time.perf_counter() - t0:.1f}s!\n", flush=True)

    for cat in sorted(set(r["category"] for r in frontier_catalog)):
        print(f"=== {cat} ===")
        for r in [x for x in frontier_catalog if x["category"] == cat]:
            print(
                f"  {r['id']:36s} | M{r['M']}/D{r['D']}/V{r['V']} | v3={r['ckt_v3']:.5f} (raw={r['ckt_v3_raw']:.5f}) | "
                f"S2={r['S2ms']:.2f} E6={r['E6']:.4f} | Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% | "
                f"Coll={r['proxyAffected']*100:.2f}% | {r['init_summary']}"
            )


if __name__ == "__main__":
    main()
