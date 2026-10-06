#!/usr/bin/env python3
# ruff: noqa: E402  # Frozen evaluator imports require configuring cwd and argv first.
"""Expand near e12 and its parents, then contract AVUIO-locked 21x21 to D=0."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "research-notes/data"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--replay",
    type=Path,
    default=Path(os.environ.get("TEMP", ""))
    / "rime-21x21-search/R11_integrated_replay",
)
parser.add_argument(
    "--output", type=Path, default=DATA / "shenyun-21x21-b-paths-e12-contract-01.json"
)
parser.add_argument("--trials2", type=int, default=30000)
parser.add_argument("--trials1", type=int, default=40000)
parser.add_argument("--trials0", type=int, default=60000)
parser.add_argument("--seed", type=int, default=20261030)
args = parser.parse_args()
args.replay, args.output = args.replay.resolve(), args.output.resolve()
for key in (
    "PYTHONUTF8",
    "OPENBLAS_NUM_THREADS",
    "OMP_NUM_THREADS",
    "NUMBA_NUM_THREADS",
):
    os.environ[key] = "1"
os.chdir(args.replay)
sys.path.insert(0, str(args.replay))
sys.path.insert(0, str(ROOT / "scripts/research"))
sys.argv = [
    "benchmark_shenyun_21x21_b_sets.py",
    "--replay",
    str(args.replay),
    "--output",
    str(DATA / "shenyun-21x21-b-sets-benchmark.json"),
]
spec = importlib.util.spec_from_file_location(
    "b_sets", ROOT / "scripts/research/benchmark_shenyun_21x21_b_sets.py"
)
assert spec and spec.loader
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
import numpy as np
from audit import split
from b_path_fast import FastBuckets, NAMES, _score

rng = random.Random(args.seed)
np.random.seed(args.seed)
reference = json.loads(
    (DATA / "shenyun-21x21-b-sets-benchmark.json").read_text(encoding="utf-8")
)["reference"]["S005"]
base = np.array([reference[key] for key in NAMES])
fast = FastBuckets(b)
heads = {h: i for i, h in enumerate(b.opt.HEADS)}
finals = {f: i + 27 for i, f in enumerate(b.opt.F)}
index = np.array(
    [
        (p, heads[split(b.DATA["pinyin"][p])[0]], finals[split(b.DATA["pinyin"][p])[1]])
        for p, _weight in b.DATA["base"]
    ],
    np.int32,
)
aux = np.array([b.opt.META["keys"].index(k) for k in "IVUAO"], np.int32)
physical = np.array([k for k in range(26) if k not in aux], np.int32)
ordinary = set(map(int, b.se.ORD))


def eight(st: np.ndarray) -> np.ndarray:
    codes = np.full(len(b.DATA["pinyin"]), -1, np.int32)
    codes[index[:, 0]] = st[index[:, 1]] * 26 + st[index[:, 2]]
    fast.epoch += 1
    return _score(
        codes,
        fast.chars,
        fast.words,
        fast.char_stamps,
        fast.char_max,
        fast.stroke_stamps,
        fast.stroke_winners,
        fast.word_stamps,
        fast.word_keys,
        fast.word_max,
        fast.epoch,
    )


known = {}
for path in DATA.glob("shenyun-21x21-b-paths-*.json"):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        continue
    for row in payload.get("results", []):
        if (
            isinstance(row, dict)
            and len(row.get("state", [])) == 67
            and all(k in row for k in NAMES)
        ):
            signature = tuple(row["state"])
            if signature not in known or len(row) > len(known[signature]):
                known[signature] = row
e12 = next(row for row in known.values() if row["id"] == "BPK-e12a551b29f1")
assert np.allclose(
    eight(np.array(e12["state"], np.int32)), [e12[k] for k in NAMES], atol=1e-12, rtol=0
)
p_cap = e12["Pmax"]


def ratios(row: dict) -> np.ndarray:
    return np.array([row[k] for k in NAMES]) / base


def quality(row: dict) -> float:
    return float(max(ratios(row)))


def candidate(st: np.ndarray, parent: str, stage: int, max_d: int) -> dict | None:
    if not np.array_equal(st[62:], aux):
        return None
    unique, memory, displaced = b.se.stats(
        st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, max_d, 1
    )
    if unique < 0 or memory > 43 or displaced > max_d:
        return None
    values = eight(st)
    ratio = float(max(values / base))
    if ratio > (1.08 if max_d else 1.15):
        return None
    p = float(b.r5.rp(st)[1])
    home = float(b.r5.home(st)[0])
    # Retain modest bridges, including states whose physical final-key names
    # can later be permuted without changing the eight collision rates.
    if p > (0.125 if max_d == 0 else 0.075) or home < (0.35 if max_d == 0 else 0.46):
        return None
    factors = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
    ident = "BPC-" + hashlib.sha256(st.tobytes()).hexdigest()[:12]
    return {
        "id": ident,
        "parent": parent,
        "stage": stage,
        "state": st.tolist(),
        "M": int(memory),
        "D": int(displaced),
        "unique399": int(unique),
        "Pmax": p,
        "homeS2": home,
        "S2ms": float(factors[0]),
        "v5": float(factors[1]),
        "v4": float(factors[2]),
        **dict(zip(NAMES, map(float, values))),
    }


def repairs(st: np.ndarray, cap: int):
    displaced = [i for i in ordinary if st[i] != b.opt.PREF[i]]
    if len(displaced) <= cap:
        yield st
        return
    for j in displaced:
        target = int(b.opt.PREF[j])
        for k in [-1, *range(27)]:
            if k >= 0 and (k in ordinary or st[k] != target):
                continue
            q = st.copy()
            if k < 0:
                q[j] = target
            else:
                q[j], q[k] = q[k], q[j]
            if len(displaced) - 1 <= cap:
                yield q
            else:
                yield from repairs(q, cap)


def mutate(st: np.ndarray, parents: list[dict], max_d: int) -> np.ndarray:
    q = st.copy()
    kind = rng.randrange(100)
    if kind < 47:
        a, c = rng.sample(range(27, 62), 2)
        q[a], q[c] = q[c], q[a]
    elif kind < 58:
        a, c, d = rng.sample(range(27, 62), 3)
        q[a], q[c], q[d] = q[c], q[d], q[a]
    elif kind < 67:
        a, c = rng.sample(list(physical), 2)
        b.opt.swapkeys(q, 27, 62, a, c)
    elif kind < 82 and parents:
        donor = np.array(rng.choice(parents)["state"], np.int32)
        positions = rng.sample(range(27, 62), rng.randint(2, 5))
        for i in positions:
            q[i] = donor[i]
        used = set(map(int, q[27:62]))
        missing = list(set(map(int, physical)) - used)
        if missing:
            counts = {key: int(np.sum(q[27:62] == key)) for key in physical}
            duplicate = [i for i in range(27, 62) if counts[int(q[i])] > 1]
            rng.shuffle(duplicate)
            for key in missing:
                if not duplicate:
                    break
                i = duplicate.pop()
                counts[int(q[i])] -= 1
                q[i] = key
                counts[key] = 1
    else:
        q = b.r5.proposal(q, physical, 21, max_d)
    return q


def rank(row: dict, focus: str) -> tuple:
    r = ratios(row)
    load = 1.5 * max(0, row["Pmax"] - p_cap) + 0.15 * max(0, 0.5 - row["homeS2"])
    if focus == "raw":
        return (float(max(r)), row["M"], row["S2ms"])
    if focus == "load":
        return (float(max(r)) + load, row["S2ms"])
    if focus == "speed":
        return (
            float(max(r)) + load if max(r) >= 1.01 else row["S2ms"] / 72.6 + load,
            float(max(r)),
        )
    if focus == "v5":
        return (
            float(max(r)) + load if max(r) >= 1.01 else row["v5"] / 10.64 + load,
            float(max(r)),
        )
    if focus == "word":
        return (float(max(r[4:])), float(max(r)))
    if focus == "character":
        return (float(max(r[:4])) + load, float(max(r)))
    return (float(max(r)) + load, row["S2ms"])


def select(rows: list[dict], size: int) -> list[dict]:
    goals = ("balanced", "word", "raw", "balanced", "load", "speed", "v5", "character")
    lists = {name: sorted(rows, key=lambda row: rank(row, name)) for name in set(goals)}
    out, seen, metric_counts = [], set(), {}
    for i in range(size):
        for row in lists[goals[i % len(goals)]]:
            sig = tuple(row["state"])
            metric = tuple(round(row[k], 10) for k in NAMES)
            if sig not in seen and metric_counts.get(metric, 0) < 3:
                seen.add(sig)
                metric_counts[metric] = metric_counts.get(metric, 0) + 1
                out.append(row)
                break
    return out


focus_ids = {
    "BPK-e12a551b29f1",
    "BPF-b3cfc3f2d638",
    "BPK-804b9848cbe6",
    "BPK-6e41384de9ef",
}
focus = [row for row in known.values() if row["id"] in focus_ids]
assert len(focus) == 4
stage_results = {}
previous = focus
for cap, trials in ((2, args.trials2), (1, args.trials1), (0, args.trials0)):
    initial = list(previous)
    # Known states give the contracted stages several different onset maps.
    familiar = [
        r for r in known.values() if r.get("M", 999) <= 43 and r.get("D", 999) <= cap
    ]
    if cap == 2:
        initial += sorted(
            (
                r
                for r in familiar
                if sum(x != y for x, y in zip(r["state"], e12["state"])) <= 22
            ),
            key=quality,
        )[:70]
    elif cap == 1:
        initial += sorted((r for r in familiar if quality(r) < 1.005), key=quality)[:70]
    else:
        initial += sorted(familiar, key=quality)[:80]
        # Include the best actual final map for every known D=0 onset map.
        by_onset = {}
        for row in familiar:
            onset = tuple(row["state"][:27])
            if onset not in by_onset or quality(row) < quality(by_onset[onset]):
                by_onset[onset] = row
        initial += sorted(by_onset.values(), key=quality)[:80]
    repaired = 0
    if cap < 2:
        for parent in previous[:100]:
            for st in repairs(np.array(parent["state"], np.int32), cap):
                row = candidate(st, parent["id"], cap, cap)
                if row is not None:
                    initial.append(row)
                    repaired += 1
    pool = {}
    for row in initial:
        if row.get("M", 999) > 43 or row.get("D", 999) > cap:
            continue
        if all(key in row for key in ("Pmax", "homeS2", "S2ms", "v4", "v5")):
            normalized = row
        else:
            normalized = candidate(
                np.array(row["state"], np.int32), row["id"], cap, cap
            )
        if normalized is not None:
            pool[tuple(normalized["state"])] = normalized
    # The original four poles remain reachable after D=2 expansion.
    elite = select(list(pool.values()), 100)
    counts = {
        "proposals": 0,
        "legalAndNear": 0,
        "allEight": 0,
        "allEightLoad": 0,
        "repaired": repaired,
    }
    for i in range(trials):
        if i and i % 500 == 0:
            elite = select(list(pool.values()), 100)
        parent = rng.choice(elite)
        st = mutate(np.array(parent["state"], np.int32), elite, cap)
        sig = tuple(map(int, st))
        counts["proposals"] += 1
        if sig in pool:
            continue
        row = candidate(st, parent["id"], cap, cap)
        if row is None:
            continue
        pool[sig] = row
        counts["legalAndNear"] += 1
        if quality(row) < 1:
            counts["allEight"] += 1
            if row["Pmax"] <= p_cap + 1e-12 and row["homeS2"] >= 0.5:
                counts["allEightLoad"] += 1
        if (i + 1) % 5000 == 0:
            best = min(pool.values(), key=quality)
            print(
                "D<=",
                cap,
                "trial",
                i + 1,
                "pool",
                len(pool),
                "best",
                best["id"],
                round(quality(best), 8),
                "passing",
                counts["allEight"],
                flush=True,
            )
    rows = list(pool.values())
    selected = select(rows, 160)
    selected += sorted(
        (
            r
            for r in rows
            if quality(r) < 1 and r["Pmax"] <= p_cap + 1e-12 and r["homeS2"] >= 0.5
        ),
        key=lambda r: (r["S2ms"], r["v5"]),
    )[:80]
    selected = list({tuple(r["state"]): r for r in selected}.values())
    stage_results[str(cap)] = {
        "counts": counts,
        "initial": len(initial),
        "pool": len(pool),
        "bestRatio": min(quality(r) for r in rows),
        "results": selected,
    }
    previous = selected
    print(
        "STAGE",
        cap,
        "counts",
        counts,
        "best",
        stage_results[str(cap)]["bestRatio"],
        flush=True,
    )

output = {
    "purpose": __doc__,
    "seed": args.seed,
    "Mcap": 43,
    "Pcap": p_cap,
    "trialCaps": {"2": args.trials2, "1": args.trials1, "0": args.trials0},
    "baseline": {k: reference[k] for k in NAMES},
    "stages": stage_results,
    "results": list(
        {
            tuple(r["state"]): r
            for stage in stage_results.values()
            for r in stage["results"]
        }.values()
    ),
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(
    json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
    encoding="utf-8",
)
print(
    json.dumps(
        {
            "output": str(args.output),
            "stages": {
                k: {p: v[p] for p in ("counts", "pool", "bestRatio")}
                for k, v in stage_results.items()
            },
        },
        ensure_ascii=False,
    )
)
