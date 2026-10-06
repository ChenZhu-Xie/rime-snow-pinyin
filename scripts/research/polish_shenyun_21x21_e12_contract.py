#!/usr/bin/env python3
# ruff: noqa: E402  # Frozen evaluator imports require configuring cwd and argv first.
"""Improve physical final-key placement without changing eight B-path collisions."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "research-notes/data"
p = argparse.ArgumentParser(description=__doc__)
p.add_argument(
    "--replay",
    type=Path,
    default=Path(os.environ.get("TEMP", ""))
    / "rime-21x21-search/R11_integrated_replay",
)
p.add_argument(
    "--search", type=Path, default=DATA / "shenyun-21x21-b-paths-e12-contract-01.json"
)
p.add_argument(
    "--output", type=Path, default=DATA / "shenyun-21x21-b-paths-e12-polish-01.json"
)
p.add_argument("--steps", type=int, default=18000)
p.add_argument("--seed", type=int, default=20261031)
a = p.parse_args()
a.replay, a.search, a.output = (x.resolve() for x in (a.replay, a.search, a.output))
for key in (
    "PYTHONUTF8",
    "OPENBLAS_NUM_THREADS",
    "OMP_NUM_THREADS",
    "NUMBA_NUM_THREADS",
):
    os.environ[key] = "1"
os.chdir(a.replay)
sys.path.insert(0, str(a.replay))
import numpy as np
import opt
import r5_search as r5
import search_engine as se

sys.path.insert(0, str(ROOT / "scripts/research"))
from b_path_fast import NAMES

source = json.loads(a.search.read_text(encoding="utf-8"))
rows = {r["id"]: r for r in source["results"]}
seed_ids = (
    "BPC-248c8bba9d28",
    "BPC-a71ed9e9ee93",
    "BPC-d9492d2a5588",
    "BPC-33024eceb987",
)
assert all(i in rows for i in seed_ids)
e12 = next(
    r
    for r in json.loads(
        (DATA / "shenyun-21x21-b-paths-b3-key-polish.json").read_text(encoding="utf-8")
    )["results"]
    if r["id"] == "BPK-e12a551b29f1"
)
physical = [
    k for k in range(26) if k not in [opt.META["keys"].index(c) for c in "IVUAO"]
]
rng = random.Random(a.seed)


def evaluate(st: np.ndarray, parent: dict) -> dict | None:
    unique, memory, displaced = se.stats(st, opt.PARAMS[-2], opt.PARAMS[-1], 21, 2, 1)
    if unique < 0 or memory > 43 or displaced != parent["D"]:
        return None
    pinky = float(r5.rp(st)[1])
    home = float(r5.home(st)[0])
    if pinky > e12["Pmax"] + 1e-12 or home < 0.5:
        return None
    f = opt.metrics(opt.initialize(st, opt.PARAMS)[1], opt.PARAMS)
    ident = "BKP-" + hashlib.sha256(st.tobytes()).hexdigest()[:12]
    return {
        "id": ident,
        "parent": parent["id"],
        "state": st.tolist(),
        "M": int(memory),
        "D": int(displaced),
        "unique399": int(unique),
        "Pmax": pinky,
        "homeS2": home,
        "S2ms": float(f[0]),
        "v5": float(f[1]),
        "v4": float(f[2]),
        **{k: parent[k] for k in NAMES},
    }


def objective(row: dict) -> float:
    return row["S2ms"] + 2.0 * row["v4"] + 2.0 * row["v5"]


results = {}
summary = []
for ident in seed_ids:
    parent = rows[ident]
    start = np.array(parent["state"], np.int32)
    initial = evaluate(start, parent)
    assert initial and abs(initial["S2ms"] - parent["S2ms"]) < 1e-8
    current, current_state = initial, start
    local = {tuple(start): initial}
    counts = {"proposals": 0, "valid": 0, "accepted": 0}
    for i in range(a.steps):
        q = current_state.copy()
        for _ in range(2 if i % 11 == 0 else 1):
            x, y = rng.sample(physical, 2)
            opt.swapkeys(q, 27, 62, x, y)
        counts["proposals"] += 1
        row = evaluate(q, parent)
        if row is None:
            continue
        counts["valid"] += 1
        signature = tuple(row["state"])
        local[signature] = row
        delta = objective(row) - objective(current)
        temperature = 0.09 * (1 - i / a.steps) ** 2 + 0.002
        if delta <= 0 or rng.random() < math.exp(-delta / temperature):
            current, current_state = row, q
            counts["accepted"] += 1
        if (i + 1) % 5000 == 0:
            best = min(local.values(), key=objective)
            print(
                ident,
                i + 1,
                "valid",
                counts["valid"],
                "best",
                best["id"],
                round(best["S2ms"], 4),
                round(best["v5"], 5),
                flush=True,
            )
    leaders = {}
    for key in (objective, lambda r: r["S2ms"], lambda r: r["v4"], lambda r: r["v5"]):
        for row in sorted(local.values(), key=key)[:10]:
            leaders[tuple(row["state"])] = row
    results.update(leaders)
    best = min(local.values(), key=objective)
    summary.append(
        {
            "source": ident,
            "counts": counts,
            "unique": len(local),
            "best": {
                k: best[k]
                for k in ("id", "M", "D", "S2ms", "v4", "v5", "Pmax", "homeS2")
            },
        }
    )

out = {
    "purpose": __doc__,
    "source": a.search.name,
    "seed": a.seed,
    "stepsPerSeed": a.steps,
    "pCap": e12["Pmax"],
    "homeMin": 0.5,
    "summary": summary,
    "results": list(results.values()),
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(
    json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
)
print(json.dumps({"output": str(a.output), "summary": summary}, ensure_ascii=False))
