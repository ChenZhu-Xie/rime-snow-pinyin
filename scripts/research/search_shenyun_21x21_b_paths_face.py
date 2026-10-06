#!/usr/bin/env python3
"""Search faces between five M41/D1 extrema, then expand from new extrema.

All proposals keep the common 21x21 onset map and IVUAO auxiliary order.
Only endpoints passing the eight frozen B-path rates are reported as feasible.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "research-notes/data"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--replay", type=Path, default=Path(os.environ.get("TEMP", "")) / "rime-21x21-search/R11_integrated_replay")
parser.add_argument("--output", type=Path, default=DATA / "shenyun-21x21-b-paths-face-search-round1.json")
parser.add_argument("--phase1", type=int, default=25000)
parser.add_argument("--phase2", type=int, default=25000)
parser.add_argument("--prior", type=Path)
parser.add_argument("--seed", type=int, default=20261007)
args = parser.parse_args()
args.output = args.output.resolve()
if args.prior:
    args.prior = args.prior.resolve()
for key in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[key] = "1"
os.chdir(args.replay.resolve())
sys.path.insert(0, str(args.replay.resolve()))
import numpy as np
import opt
import r5_search as r5
import r9_search as r9
import search_engine as se

sys.argv = ["benchmark_shenyun_21x21_b_sets.py", "--replay", str(args.replay), "--output", str(DATA / "shenyun-21x21-b-sets-benchmark.json")]
spec = importlib.util.spec_from_file_location("b_sets", ROOT / "scripts/research/benchmark_shenyun_21x21_b_sets.py")
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
sys.path.insert(0, str(ROOT / "scripts/research"))
from b_path_fast import FastBuckets, NAMES

rng = random.Random(args.seed)
fast = FastBuckets(b)
payload = json.loads((DATA / "shenyun-21x21-b-paths-between-finalists.json").read_text(encoding="utf-8"))
seeds = payload["results"]
S = {r["id"]: np.array(r["state"], np.int32) for r in seeds}
focus_id = "BPK-6e41384de9ef"
focus = next(r for r in seeds if r["id"] == focus_id)
baseline = json.loads((DATA / "shenyun-21x21-b-sets-benchmark.json").read_text(encoding="utf-8"))["reference"]["S005"]
assert len(S) == 5 and all(np.array_equal(st[:27], S[focus_id][:27]) and np.array_equal(st[62:], S[focus_id][62:]) for st in S.values())
allowed = set(map(int, S[focus_id][27:62]))
assert len(allowed) == 21


def repair(st: np.ndarray, anchor: np.ndarray) -> None:
    """Restore the 21 physical final keys after coordinate crossover."""
    missing = list(allowed - set(map(int, st[27:62])))
    if not missing:
        return
    counts = Counter(map(int, st[27:62]))
    duplicates = [i for i in range(27, 62) if counts[int(st[i])] > 1]
    rng.shuffle(duplicates)
    for key in missing:
        options = [i for i in duplicates if counts[int(st[i])] > 1]
        if not options:
            return
        # Prefer the donor coordinate that recovers a known extreme.
        matching = [i for i in options if int(anchor[i]) == key]
        i = rng.choice(matching or options)
        counts[int(st[i])] -= 1
        st[i] = key
        counts[key] += 1
        duplicates.remove(i)


def cross(parents: list[np.ndarray]) -> np.ndarray:
    anchor = parents[0]
    st = anchor.copy()
    boundaries = sorted(rng.sample(range(28, 62), rng.choice((2, 3, 4, 5))))
    cuts = [27, *boundaries, 62]
    for a, z in zip(cuts, cuts[1:]):
        donor = rng.choice(parents)
        st[a:z] = donor[a:z]
    if rng.random() < .5:
        for _ in range(rng.randint(1, 5)):
            i = rng.randrange(27, 62)
            st[i] = rng.choice(parents)[i]
    repair(st, anchor)
    return st


def mutate(parent: np.ndarray, donors: list[np.ndarray]) -> np.ndarray:
    st = parent.copy()
    kind = rng.randrange(4)
    if kind == 0:
        i, j = rng.sample(range(27, 62), 2)
        st[i], st[j] = st[j], st[i]
    elif kind == 1:
        a, z = sorted(rng.sample(range(27, 63), 2))
        st[a:z] = rng.choice(donors)[a:z]
        repair(st, parent)
    elif kind == 2:
        for _ in range(rng.randint(2, 6)):
            i = rng.randrange(27, 62)
            st[i] = rng.choice(donors)[i]
        repair(st, parent)
    else:
        used = list(allowed)
        a, z = rng.sample(used, 2)
        opt.swapkeys(st, 27, 62, a, z)
    return st


def margin(row: dict) -> float:
    return min(100 * (baseline[k] - row[k]) for k in NAMES)


def objective(row: dict, label: str) -> float:
    # Lower values are better. Scores are only search preferences.
    if label == "v4":
        return row["v4"] + .12 * max(0, row["S2ms"] - 72.8)
    if label == "v5":
        return row["v5"] + .12 * max(0, row["S2ms"] - 72.8)
    if label == "v6":
        return row["v6Proxy"] + .12 * max(0, row["S2ms"] - 72.8)
    if label == "joint":
        return row["v4"] / focus["v4"] + row["v5"] / focus["v5"] + row["v6Proxy"] / focus_proxy + .05 * max(0, row["S2ms"] - 72.8)
    if label == "margin":
        return -margin(row) + .01 * max(0, row["S2ms"] - 72.8)
    if label == "home":
        return -row["homeS2"]
    if label == "load":
        return row["Pmax"]
    return row["S2ms"]


focus_proxy = float(10 * r9.cw26(opt.initialize(S[focus_id], opt.PARAMS)[1]))
counts = Counter()
seen = set()
all_pass = {}


def evaluate(st: np.ndarray, phase: int, origin: str) -> dict | None:
    counts["proposals"] += 1
    signature = st.tobytes()
    if signature in seen:
        return None
    seen.add(signature)
    unique, mem, displaced = se.stats(st, opt.PARAMS[-2], opt.PARAMS[-1], 21, 1, 1)
    if unique < 0 or mem > 41 or displaced > 1:
        return None
    counts["structural"] += 1
    p = float(r5.rp(st)[1])
    home = float(r5.home(st)[0])
    if p > focus["Pmax"] + 1e-12 or home < .50 - 1e-12:
        return None
    counts["load"] += 1
    eight = fast.score(b.state_codes(st))
    if any(eight[k] >= baseline[k] for k in NAMES):
        return None
    counts["eight"] += 1
    vs = opt.initialize(st, opt.PARAMS)[1]
    f = opt.metrics(vs, opt.PARAMS)
    if f[0] > 73.5:
        return None
    counts["endpoint"] += 1
    ident = "BPF-" + hashlib.sha256(signature).hexdigest()[:12]
    row = {"id": ident, "state": st.tolist(), "phase": phase, "origin": origin,
           "M": int(mem), "D": int(displaced), "unique399": int(unique),
           "Pmax": p, "homeS2": home, "S2ms": float(f[0]),
           "v5": float(f[1]), "v4": float(f[2]), "v6Proxy": float(10 * r9.cw26(vs)), **eight}
    all_pass[ident] = row
    return row


for seed in seeds:
    evaluate(S[seed["id"]], 0, seed["id"])
assert any(r["origin"] == focus_id for r in all_pass.values())
if args.prior:
    for row in json.loads(args.prior.read_text(encoding="utf-8"))["results"]:
        if row["id"] not in all_pass:
            all_pass[row["id"]] = row
            seen.add(np.array(row["state"], np.int32).tobytes())


def extrema(rows: list[dict], per_goal: int = 6) -> list[dict]:
    goals = ("v4", "v5", "v6", "joint", "margin", "home", "load", "speed")
    out = []
    used = set()
    for label in goals:
        for row in sorted(rows, key=lambda r: objective(r, label))[:per_goal]:
            if row["id"] not in used:
                used.add(row["id"])
                out.append(row)
    return out


seed_states = list(S.values())
for phase, trials in ((1, args.phase1), (2, args.phase2)):
    if phase == 1:
        parents = list(all_pass.values())
    else:
        parents = extrema(list(all_pass.values()), 8)
    by_id = {r["id"]: np.array(r["state"], np.int32) for r in parents}
    face = list(by_id.values()) + (seed_states if phase == 1 else [])
    for i in range(trials):
        if phase == 2 and i and i % 2500 == 0:
            parents = extrema(list(all_pass.values()), 8)
            by_id = {r["id"]: np.array(r["state"], np.int32) for r in parents}
            face = list(by_id.values())
        if phase == 1 or rng.random() < .5:
            donors = rng.sample(face, min(rng.choice((3, 4, 5)), len(face)))
            q = cross(donors)
            origin = "face"
        else:
            base_id = rng.choice(list(by_id))
            q = mutate(by_id[base_id], face + seed_states)
            origin = "mutate:" + base_id
        evaluate(q, phase, origin)
        if (i + 1) % 5000 == 0:
            best = min(all_pass.values(), key=lambda r: objective(r, "joint"))
            print("phase", phase, "trial", i + 1, "counts", dict(counts), "best", best["id"],
                  round(best["v4"], 5), round(best["v5"], 5), round(best["v6Proxy"], 5), flush=True)

selected = extrema(list(all_pass.values()), 12)
selected += sorted((r for r in all_pass.values() if r["v4"] < focus["v4"] and r["v5"] < focus["v5"] and r["v6Proxy"] < focus_proxy),
                   key=lambda r: objective(r, "joint"))[:30]
selected = list({r["id"]: r for r in selected}.values())
out = {"purpose": __doc__, "seed": args.seed, "trials": {"face": args.phase1, "newExtrema": args.phase2},
       "reference": focus_id, "referenceV6Proxy": focus_proxy, "gate": {"M": 41, "D": 1, "Pmax": focus["Pmax"], "homeS2": .5, "S2ms": 73.5,
       "eight": "strictly lower than S005"}, "counts": dict(counts), "results": selected}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(json.dumps({"counts": dict(counts), "saved": len(selected), "jointBest": min(selected, key=lambda r: objective(r, "joint"))["id"]}, ensure_ascii=False))
