#!/usr/bin/env python3
"""Harvest and score all historical 21x26 IEUAO 399-unique pure-y states across all pools."""

from __future__ import annotations

import glob
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
from benchmark_feima_prefixes import read_words, split_pinyin
os.chdir(orig_cwd)

from fast_ckt_v3_21x26 import FastCKTv3_21x26

TONE_IEUAO = np.array([opt.META["keys"].index(k) for k in "IEUAO"], dtype=np.int32)
ORDINARY = np.array(se.ORD, dtype=np.int32)
CUTS = (500, 1000, 2000, 5000, 10000)


def build_collision_proxy_arrays():
    words = read_words([WORKTREE / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")])
    arrays = {}
    weights = {}
    for length in (2, 3, 4):
        rows = words[length][: CUTS[-1]]
        tokens = np.full((CUTS[-1], length, 2), -1, dtype=np.int16)
        mass = np.zeros(CUTS[-1], dtype=np.float64)
        for row_index, row in enumerate(rows):
            mass[row_index] = row["weight"]
            for reading in row["readings"]:
                try:
                    parsed = [split_pinyin(value) for value in reading]
                    encoded = [(opt.HEADS.index(head), opt.F.index(final)) for head, final in parsed]
                except (ValueError, IndexError):
                    continue
                tokens[row_index] = encoded
                break
        arrays[length] = tokens
        weights[length] = mass
    return arrays, weights


@njit(cache=True)
def collision_proxy_njit(
    state: np.ndarray,
    seq2: np.ndarray,
    seq3: np.ndarray,
    seq4: np.ndarray,
    w2: np.ndarray,
    w3: np.ndarray,
    w4: np.ndarray,
    stamps: np.ndarray,
    masks: np.ndarray,
    counts: np.ndarray,
    masses: np.ndarray,
    maxima: np.ndarray,
    epoch: int,
) -> np.ndarray:
    output = np.zeros((5, 4), np.float64)
    total = cross_mass = first_loss = 0.0
    maximum = cut_index = 0
    cuts = (500, 1000, 2000, 5000, 10000)
    for rank in range(10000):
        for family in range(3):
            seq = seq2 if family == 0 else seq3 if family == 1 else seq4
            weights = w2 if family == 0 else w3 if family == 1 else w4
            if seq[rank, 0, 0] < 0:
                continue
            if family == 0:
                h0, f0 = seq[rank, 0]
                h1, f1 = seq[rank, 1]
                code = (((state[h0] * 26 + state[27 + f0]) * 26 + state[h1]) * 26 + state[27 + f1])
            elif family == 1:
                h0 = seq[rank, 0, 0]
                h1 = seq[rank, 1, 0]
                h2, f2 = seq[rank, 2]
                code = (((state[h0] * 26 + state[h1]) * 26 + state[h2]) * 26 + state[27 + f2])
            else:
                h0 = seq[rank, 0, 0]
                h1 = seq[rank, 1, 0]
                h2 = seq[rank, 2, 0]
                h3 = seq[rank, 3, 0]
                code = (((state[h0] * 26 + state[h1]) * 26 + state[h2]) * 26 + state[h3])
            weight = weights[rank]
            total += weight
            if stamps[code] != epoch:
                stamps[code] = epoch
                masks[code] = 0
                counts[code] = 0
                masses[code] = 0.0
                maxima[code] = 0.0
            old_cross = masks[code] != 0 and (masks[code] & (masks[code] - 1)) != 0
            if old_cross:
                cross_mass -= masses[code]
                first_loss -= masses[code] - maxima[code]
            masks[code] |= 1 << family
            counts[code] += 1
            masses[code] += weight
            maxima[code] = max(maxima[code], weight)
            new_cross = (masks[code] & (masks[code] - 1)) != 0
            if new_cross:
                cross_mass += masses[code]
                first_loss += masses[code] - maxima[code]
                maximum = max(maximum, counts[code])
        if cut_index < 5 and rank + 1 == cuts[cut_index]:
            output[cut_index, 0] = cross_mass / total if total else 0.0
            output[cut_index, 1] = first_loss / total if total else 0.0
            output[cut_index, 2] = maximum
            output[cut_index, 3] = total
            cut_index += 1
    return output


@njit(cache=True)
def is_valid_21x26_pure_y(st: np.ndarray) -> bool:
    if len(st) != 67:
        return False
    for i in range(5):
        if st[62 + i] != TONE_IEUAO[i]:
            return False
    if st[25] != st[26]:
        return False
    ic = np.zeros(26, np.int32)
    rc = np.zeros(26, np.int32)
    for i in range(27):
        k = st[i]
        if k < 0 or k >= 26:
            return False
        ic[k] += 1
    for i in range(27, 62):
        k = st[i]
        if k < 0 or k >= 26:
            return False
        rc[k] += 1
    for k in st[62:]:
        if ic[k] > 0:
            return False
    if np.sum(ic > 0) != 21 or np.sum(rc > 0) != 26:
        return False
    seen = np.zeros(676, np.uint8)
    ei = opt.PARAMS[-2]
    er = opt.PARAMS[-1]
    for i in range(len(ei)):
        c = st[ei[i]] * 26 + st[er[i]]
        if seen[c]:
            return False
        seen[c] = 1
    return True


def load_scorer():
    import importlib.util
    html_path = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
    data_dir = WORKTREE / "research-notes" / "data"
    orig = os.getcwd()
    os.chdir(REPLAY_DIR)
    sys.argv = ["benchmark_shenyun_21x21_b_sets.py", "--replay", str(REPLAY_DIR), "--output", str(data_dir / "shenyun-21x21-b-sets-benchmark.json")]
    spec = importlib.util.spec_from_file_location("b_sets", WORKTREE / "scripts" / "research" / "benchmark_shenyun_21x21_b_sets.py")
    b = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(b)
    os.chdir(orig)
    return FastCKTv3_21x26(b, html_path, WORKTREE / "snow_pinyin.base.dict.yaml")


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

    # Collect states from all sources
    raw_states = {}  # tuple(st) -> dict(id, source, extra_collision)

    # 1. HTML seeds DB
    seeds_db = json.loads((WORKTREE / "research-notes" / "data" / "shenyun-21x26-seeds-database.json").read_text(encoding="utf-8"))
    for s in seeds_db["schemes"]:
        st = np.array(s["state"], dtype=np.int32)
        if is_valid_21x26_pure_y(st):
            raw_states[tuple(st.tolist())] = {
                "id": s["id"],
                "source": "html_r11",
                "in_html": True,
                "crossAffected5Cut": s.get("crossAffected5Cut"),
                "crossFirstLoss5Cut": s.get("crossFirstLoss5Cut"),
            }

    # 2. research-notes/data/shenyun-21x26-*.json
    for fname in (
        "shenyun-21x26-six-case-search.json",
        "shenyun-21x26-constrained-search.json",
        "shenyun-21x26-constrained-continuation.json",
        "shenyun-21x26-constrained-continuation-2.json",
        "shenyun-21x26-constrained-continuation-3.json",
        "shenyun-21x26-constrained-continuation-4.json",
        "shenyun-21x26-constrained-continuation-5.json",
    ):
        fpath = WORKTREE / "research-notes" / "data" / fname
        if not fpath.exists():
            continue
        payload = json.loads(fpath.read_text(encoding="utf-8"))
        cands = payload.get("candidates", payload if isinstance(payload, list) else [])
        for c in cands:
            if not isinstance(c, dict) or "state" not in c:
                continue
            st = np.array(c["state"], dtype=np.int32)
            if is_valid_21x26_pure_y(st):
                key = tuple(st.tolist())
                if key not in raw_states:
                    coll = c.get("collision", {})
                    raw_states[key] = {
                        "id": c.get("id", f"{fname}"),
                        "source": fname,
                        "in_html": False,
                        "crossAffected5Cut": coll.get("fiveCutAverageCrossAffectedRate", c.get("affected")),
                        "crossFirstLoss5Cut": coll.get("fiveCutAverageCrossFirstChoiceLossRate", c.get("loss")),
                    }

    # 3. REPLAY_DIR files
    for pat in ("r5_existing_states.json", "r5_search_results_*.json", "r9_search_results_*.json", "r10_search_results_*.json", "r11_search_results_*.json"):
        for fpath_str in glob.glob(str(REPLAY_DIR / pat)):
            fpath = Path(fpath_str)
            try:
                payload = json.loads(fpath.read_text(encoding="utf-8"))
            except Exception:
                continue
            items = payload.values() if isinstance(payload, dict) else payload if isinstance(payload, list) else []
            for idx, item in enumerate(items):
                st_list = item.get("state") if isinstance(item, dict) else item if isinstance(item, list) else None
                if not st_list or len(st_list) != 67:
                    continue
                st = np.array(st_list, dtype=np.int32)
                if is_valid_21x26_pure_y(st):
                    key = tuple(st.tolist())
                    if key not in raw_states:
                        cid = item.get("id") if isinstance(item, dict) else None
                        if not cid:
                            cid = f"{fpath.stem}-{idx}"
                        raw_states[key] = {
                            "id": cid,
                            "source": fpath.name,
                            "in_html": False,
                            "crossAffected5Cut": None,
                            "crossFirstLoss5Cut": None,
                        }

    print(f"Collected {len(raw_states)} unique valid 21x26 IEUAO 399-unique pure-y states across all pools.")

    # Score all states
    scored = []
    for key, meta in raw_states.items():
        st = np.array(key, dtype=np.int32)
        ckt_v3, ckt_v3_raw, ums, res3, res4 = engine.score_all(st)
        kc1_ms, kw2_ms, kw3_ms, kw4_ms, sc1_ms, sw2_ms, sw3_ms, sw4_ms = ums
        desc = r5.describe(st)
        _, vals = opt.initialize(st, opt.PARAMS)
        m = opt.metrics(vals, opt.PARAMS)
        v6 = float(10.0 * r9.cw26(vals))
        p_aff, p_loss = eval_proxy(st)
        scored.append({
            "id": meta["id"],
            "source": meta["source"],
            "in_html": meta["in_html"],
            "M": desc["M"],
            "D": desc["D"],
            "V": desc["V"],
            "aeo_keys": len(set(st[21:24].tolist())),
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
            "V6": v6,
            "homeS2": desc["homeS2"],
            "homeFloor": desc["homeFloor"],
            "Pmax": desc["rpMax"],
            "proxyAffected": p_aff,
            "proxyFirstLoss": p_loss,
            "crossAffected5Cut": meta["crossAffected5Cut"],
            "crossFirstLoss5Cut": meta["crossFirstLoss5Cut"],
            "state": list(key),
        })

    scored.sort(key=lambda x: x["ckt_v3"])
    out_path = WORKTREE / "research-notes" / "data" / "shenyun-21x26-all-historical-pools-v3.json"
    out_path.write_text(json.dumps({"count": len(scored), "schemes": scored}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Scored all {len(scored)} schemes in {time.perf_counter()-t0:.2f}s -> {out_path}")

    print("\n=== TOP 20 OVERALL BY CKT v3 ACROSS ALL HISTORICAL POOLS ===")
    for i, r in enumerate(scored[:20], 1):
        tag = "HTML" if r["in_html"] else r["source"][:18]
        print(f"{i:2d}. {r['id']:42s} [{tag:18s}] v3={r['ckt_v3']:.5f} M{r['M']}/D{r['D']}/V{r['V']} S2={r['S2ms']:.2f} E6={r['E6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}% w3p0={r['w3_p0']*100:.2f}% w4p0={r['w4_p0']*100:.2f}%")

    print("\n=== BEST CKT v3 BY (M, D) BUCKET ACROSS ALL HISTORICAL POOLS ===")
    by_md = {}
    for r in scored:
        k = (r["M"], r["D"])
        if k not in by_md or r["ckt_v3"] < by_md[k]["ckt_v3"]:
            by_md[k] = r
    for k in sorted(by_md.keys()):
        r = by_md[k]
        tag = "HTML" if r["in_html"] else r["source"][:18]
        print(f"M{k[0]:2d}/D{k[1]}: {r['id']:42s} [{tag:18s}] v3={r['ckt_v3']:.5f} V={r['V']} S2={r['S2ms']:.2f} E6={r['E6']:.4f} Home={r['homeS2']*100:.2f}% Pmax={r['Pmax']*100:.2f}% pAff={r['proxyAffected']*100:.2f}%")


if __name__ == "__main__":
    main()
