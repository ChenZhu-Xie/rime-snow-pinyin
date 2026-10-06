#!/usr/bin/env python3
# ruff: noqa: E402  # Frozen evaluator imports require configuring cwd and argv first.
"""Target D=0 onset maps whose collision-free word floor can beat S005."""

from __future__ import annotations
import argparse
import hashlib
import importlib.util
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
    "--output",
    type=Path,
    default=DATA / "shenyun-21x21-b-paths-e12-d0-onset-focus.json",
)
p.add_argument("--onsets", type=int, default=12)
p.add_argument("--steps", type=int, default=9000)
p.add_argument("--seed", type=int, default=20261101)
a = p.parse_args()
a.replay = a.replay.resolve()
a.output = a.output.resolve()
for k in ("PYTHONUTF8", "OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[k] = "1"
os.chdir(a.replay)
sys.path.insert(0, str(a.replay))
sys.path.insert(0, str(ROOT / "scripts/research"))
sys.argv = [
    "benchmark_shenyun_21x21_b_sets.py",
    "--replay",
    str(a.replay),
    "--output",
    str(DATA / "shenyun-21x21-b-sets-benchmark.json"),
]
spec = importlib.util.spec_from_file_location(
    "benchmark", ROOT / "scripts/research/benchmark_shenyun_21x21_b_sets.py"
)
assert spec and spec.loader
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
import numpy as np
from audit import split
from b_path_fast import FastBuckets, NAMES, _score

rng = random.Random(a.seed)
fast = FastBuckets(b)
reference = json.loads(
    (DATA / "shenyun-21x21-b-sets-benchmark.json").read_text(encoding="utf8")
)["reference"]["S005"]
baseline = np.array([reference[k] for k in NAMES])
aux = np.array([b.opt.META["keys"].index(k) for k in "IVUAO"], np.int32)
head_index = {h: i for i, h in enumerate(b.opt.HEADS)}
final_index = {f: i for i, f in enumerate(b.opt.F)}
indices = np.array(
    [
        (
            p,
            head_index[split(b.DATA["pinyin"][p])[0]],
            final_index[split(b.DATA["pinyin"][p])[1]],
        )
        for p, _ in b.DATA["base"]
    ],
    np.int32,
)


def eight(st):
    codes = np.full(len(b.DATA["pinyin"]), -1, np.int32)
    codes[indices[:, 0]] = st[indices[:, 1]] * 26 + st[indices[:, 2] + 27]
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


def floor(onset):
    codes = np.full(len(b.DATA["pinyin"]), -1, np.int32)
    pair = onset[indices[:, 1]] * 35 + indices[:, 2]
    _, inv = np.unique(pair, return_inverse=True)
    codes[indices[:, 0]] = inv
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


def ratio(row):
    return max(row[k] / reference[k] for k in NAMES)


known = {}
for path in DATA.glob("shenyun-21x21-b-paths-*.json"):
    try:
        payload = json.loads(path.read_text(encoding="utf8"))
    except (ValueError, OSError):
        continue
    for row in payload.get("results", []):
        if (
            isinstance(row, dict)
            and row.get("D") == 0
            and row.get("M", 999) <= 43
            and len(row.get("state", [])) == 67
            and all(k in row for k in NAMES)
        ):
            known[tuple(row["state"])] = row
maps = {}
for row in known.values():
    onset = tuple(row["state"][:27])
    best = maps.get(onset)
    if best is None or ratio(row) < ratio(best):
        maps[onset] = row
eligible = []
for onset, row in maps.items():
    r = float(max(floor(np.array(onset, np.int32)) / baseline))
    if r < 1:
        eligible.append((r, ratio(row), onset, row))
assert eligible
picks = {}
for _, _, onset, row in (
    sorted(eligible, key=lambda x: x[0])[: a.onsets // 2]
    + sorted(eligible, key=lambda x: x[1])[: a.onsets // 2]
):
    picks[onset] = row
print(
    "known",
    len(known),
    "onsetMaps",
    len(maps),
    "eligibleFloors",
    len(eligible),
    "picked",
    len(picks),
    flush=True,
)


def energy(values):
    r = values / baseline
    excess = np.maximum(r - 1, 0)
    return float(np.max(r) + 0.15 * np.sum(excess) + 0.007 * np.mean(r))


rows = {}
summaries = []
for onset, first in picks.items():
    start = np.array(first["state"], np.int32)
    state = start.copy()
    current = eight(state)
    best_value = float(max(current / baseline))
    best_state = state.copy()
    best_scores = current.copy()
    accepted = 0
    valid = 0
    visited = {tuple(state): current}
    bridge = sorted(
        (r for r in known.values() if tuple(r["state"][:27]) == onset), key=ratio
    )[:12]
    for it in range(a.steps):
        q = state.copy()
        kind = rng.randrange(100)
        if kind < 52:
            i, j = rng.sample(range(27, 62), 2)
            q[i], q[j] = q[j], q[i]
        elif kind < 70:
            i, j, k = rng.sample(range(27, 62), 3)
            q[i], q[j], q[k] = q[j], q[k], q[i]
        elif kind < 91:
            i, j = rng.sample(range(27, 62), 2)
            q[i] = q[j]
        else:
            donor = np.asarray(rng.choice(bridge)["state"], np.int32)
            i, j = rng.sample(range(27, 62), 2)
            q[i] = donor[i]
            q[j] = donor[j]
        u, m, d = b.se.stats(q, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 0, 1)
        if u < 0 or m > 43 or d:
            continue
        valid += 1
        sig = tuple(map(int, q))
        value = visited.get(sig)
        if value is None:
            value = eight(q)
            visited[sig] = value
        rr = float(max(value / baseline))
        if rr < best_value - 1e-12:
            best_value = rr
            best_state = q.copy()
            best_scores = value.copy()
            print("IMPROVE", first["id"], "step", it, "ratio", round(rr, 9), flush=True)
        temperature = 0.0025 * (1 - it / a.steps) + 0.00002
        diff = energy(value) - energy(current)
        if diff <= 0 or rng.random() < math.exp(-min(500, diff / temperature)):
            state, current = q, value
            accepted += 1
        if (it + 1) % 1000 == 0 and len(visited) > 500:
            elite = sorted(visited.items(), key=lambda x: energy(x[1]))[:20]
            sig, val = rng.choice(elite[:8])
            state = np.array(sig, np.int32)
            current = val
    for sig, value in sorted(visited.items(), key=lambda x: energy(x[1]))[:6]:
        st = np.array(sig, np.int32)
        f = b.opt.metrics(b.opt.initialize(st, b.opt.PARAMS)[1], b.opt.PARAMS)
        row = {
            "id": "B0F-" + hashlib.sha256(st.tobytes()).hexdigest()[:12],
            "parent": first["id"],
            "state": list(map(int, sig)),
            "M": int(b.opt.memory(st)),
            "D": 0,
            "unique399": int(
                b.se.stats(st, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 0, 1)[0]
            ),
            "Pmax": float(b.r5.rp(st)[1]),
            "homeS2": float(b.r5.home(st)[0]),
            "S2ms": float(f[0]),
            "v5": float(f[1]),
            "v4": float(f[2]),
            **dict(zip(NAMES, map(float, value))),
        }
        rows[sig] = row
    summaries.append(
        {
            "seed": first["id"],
            "floorRatio": float(max(floor(np.array(onset, np.int32)) / baseline)),
            "initialRatio": ratio(first),
            "bestRatio": best_value,
            "visited": len(visited),
            "valid": valid,
            "accepted": accepted,
        }
    )
    print(
        "ONSET",
        len(summaries),
        "of",
        len(picks),
        "seed",
        first["id"],
        "best",
        round(best_value, 9),
        "visited",
        len(visited),
        flush=True,
    )
out = {
    "purpose": __doc__,
    "seed": a.seed,
    "stepsPerOnset": a.steps,
    "onsets": len(picks),
    "eligibleFloors": len(eligible),
    "baseline": reference,
    "summaries": summaries,
    "results": list(rows.values()),
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(
    json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8"
)
print(
    json.dumps(
        {
            "output": str(a.output),
            "best": sorted(
                (
                    {
                        "id": r["id"],
                        "ratio": ratio(r),
                        "M": r["M"],
                        "P": r["Pmax"],
                        "H": r["homeS2"],
                    }
                    for r in rows.values()
                ),
                key=lambda r: r["ratio"],
            )[:5],
        },
        ensure_ascii=False,
    )
)
