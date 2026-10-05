#!/usr/bin/env python3
"""Search the six 21x26 performance/collision cells under two Y scopes.

The frozen R11 factor model supplies the performance measurements.  A fast
canonical-reading AUAU/AAAU/AAAA proxy guides the collision search; every
retained finalist is then replayed with all readings by the local collision
benchmark before it is written to the result file.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from pathlib import Path

for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[variable] = "1"

import numpy as np  # noqa: E402
from numba import njit  # noqa: E402


CUTS = (500, 1000, 2000, 5000, 10000)
SCOPES = ("pure-y", "split-y-yu")
CATEGORIES = ("performance", "collision", "canyon")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay", type=Path, required=True)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--benchmark-tools", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--focus-ids", nargs="*")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--steps", type=int, default=6000)
    parser.add_argument("--restarts", type=int, default=3)
    parser.add_argument("--seed", type=int, default=212626)
    parser.add_argument("--max-memory", type=int, default=44)
    parser.add_argument("--memory-buckets", type=int, nargs="+")
    parser.add_argument("--max-d", type=int, default=10)
    parser.add_argument("--root-limit", type=int, default=4)
    parser.add_argument("--canyon-tolerance", type=float, default=0.03)
    parser.add_argument("--series-prefix", default="CONT")
    return parser.parse_args()


ARGS = arguments()
REPLAY = ARGS.replay.resolve()
REPO = ARGS.repo.resolve()
OUTPUT = ARGS.output.resolve()
RESUME = ARGS.resume.resolve() if ARGS.resume else None
INVENTORY_PATH = ARGS.inventory.resolve()
sys.path[:0] = [str(REPLAY), str(Path(__file__).resolve().parent), str(ARGS.benchmark_tools.resolve())]
os.chdir(REPLAY)

import opt  # noqa: E402
import r10_search  # noqa: E402
import r9_search  # noqa: E402
import search_engine  # noqa: E402
from benchmark_feima_prefixes import read_words, split_pinyin  # noqa: E402
from macroxue.engine import LAYOUT, SPEED, distance, pair  # noqa: E402
from shenyun_collision_benchmark import evaluate_layout, read_word_corpus  # noqa: E402


DATA = json.loads((REPLAY / "source.json").read_text(encoding="utf-8"))
INVENTORY_PAYLOAD = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
INVENTORY = (
    INVENTORY_PAYLOAD["candidates"]
    if isinstance(INVENTORY_PAYLOAD, dict)
    else INVENTORY_PAYLOAD
)
FOCUS_ROWS: list[dict] = []
RESUME_PAYLOAD: dict | None = None
if RESUME:
    RESUME_PAYLOAD = json.loads(RESUME.read_text(encoding="utf-8"))
    resume_rows = {row["id"]: row for row in RESUME_PAYLOAD["candidates"]}
    requested = ARGS.focus_ids or list(resume_rows)
    missing = set(requested) - resume_rows.keys()
    if missing:
        raise ValueError(f"focus IDs not found: {sorted(missing)}")
    FOCUS_ROWS = [resume_rows[identifier] for identifier in requested]
KEYS = opt.META["keys"]
TONE_KEYS = np.array([KEYS.index(key) for key in "IEUAO"], dtype=np.int32)
ORDINARY = np.array(search_engine.ORD, dtype=np.int32)
ANCHOR_IDS = (
    "R10-21X26-M39-08",
    "R10-21X26-M38-07",
    "R10-21X26-M37-04",
)


def build_corpus_arrays() -> tuple[dict[int, np.ndarray], dict[int, np.ndarray]]:
    words = read_words([REPO / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")])
    arrays: dict[int, np.ndarray] = {}
    weights: dict[int, np.ndarray] = {}
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


CORPUS, CORPUS_WEIGHT = build_corpus_arrays()


@njit(cache=True)
def collision_proxy(
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
        if cut_index < 5 and rank + 1 == CUTS[cut_index]:
            output[cut_index, 0] = cross_mass / total if total else 0.0
            output[cut_index, 1] = first_loss / total if total else 0.0
            output[cut_index, 2] = maximum
            output[cut_index, 3] = total
            cut_index += 1
    return output


PROXY_STAMPS = np.zeros(26**4, np.int32)
PROXY_MASKS = np.zeros(26**4, np.uint8)
PROXY_COUNTS = np.zeros(26**4, np.int16)
PROXY_MASSES = np.zeros(26**4, np.float64)
PROXY_MAXIMA = np.zeros(26**4, np.float64)
PROXY_EPOCH = 0


def proxy(state: np.ndarray) -> tuple[float, np.ndarray]:
    global PROXY_EPOCH
    PROXY_EPOCH += 1
    metrics = collision_proxy(
        state,
        CORPUS[2], CORPUS[3], CORPUS[4],
        CORPUS_WEIGHT[2], CORPUS_WEIGHT[3], CORPUS_WEIGHT[4],
        PROXY_STAMPS, PROXY_MASKS, PROXY_COUNTS, PROXY_MASSES, PROXY_MAXIMA, PROXY_EPOCH,
    )
    score = float(np.mean(metrics[:, 0]) + 0.18 * np.mean(metrics[:, 1]) + 0.00002 * np.mean(metrics[:, 2]))
    return score, metrics


CORPORA = json.loads((REPLAY / "R9_corpora.json").read_text(encoding="utf-8"))
TOKENS: list[int] = []
for token in CORPORA["daily"]["tokens"]:
    if "pinyin" not in token:
        continue
    head, final = r10_search.split(token["pinyin"])
    TOKENS.extend((r10_search.HEADS.index(head), 27 + opt.F.index(final)))
TOKENS_NP = np.array(TOKENS, dtype=np.int32)
PAIR_COST = np.array([[pair(a.lower(), b.lower()) for b in KEYS] for a in KEYS])
FIRST_COST = []
for key in KEYS:
    x, y, finger = LAYOUT[key.lower()]
    FIRST_COST.append((0.2 + (distance(finger, 1, x, y) if x < 5 else 0)) / SPEED[finger])
FIRST_COST_NP = np.array(FIRST_COST)


@njit(cache=True)
def daily_mx(state: np.ndarray) -> float:
    total = FIRST_COST_NP[state[TOKENS_NP[0]]]
    for index in range(1, len(TOKENS_NP)):
        total += PAIR_COST[state[TOKENS_NP[index - 1]], state[TOKENS_NP[index]]]
    return 200 * (len(TOKENS_NP) // 2) / total


BASE_ROW = next((row for row in INVENTORY if row["id"] == "R10-21X26-M39-08"), None)
if FOCUS_ROWS:
    assert RESUME_PAYLOAD is not None
    BASE_ID = RESUME_PAYLOAD["baseline"]["id"]
    BASE_STATE = np.array(FOCUS_ROWS[0]["state"], dtype=np.int32)
    BASE_PERF = dict(RESUME_PAYLOAD["baseline"]["performance"])
    BASE_COLLISION = dict(RESUME_PAYLOAD["baseline"]["collision"])
else:
    if BASE_ROW is None:
        raise ValueError("inventory must contain R10-21X26-M39-08 for an unfocused search")
    BASE_ID = BASE_ROW["id"]
    BASE_STATE = np.array(BASE_ROW["state"], dtype=np.int32)
    BASE_PERF = {}
    BASE_COLLISION = {
        "fiveCutAverageCrossAffectedRate": BASE_ROW["affected"],
        "fiveCutAverageCrossFirstChoiceLossRate": BASE_ROW["loss"],
    }


def performance(state: np.ndarray) -> dict:
    _, values = opt.initialize(state, opt.PARAMS)
    metrics = opt.metrics(values, opt.PARAMS)
    result = {
        "S2": float(metrics[0]),
        "v5": float(metrics[1]),
        "v4": float(metrics[2]),
        "v6": float(10 * r9_search.cw26(values)),
        "dailyMX": float(daily_mx(state)),
    }
    ratios = [result[key] / BASE_PERF[key] for key in ("S2", "v5", "v4", "v6")]
    ratios.append(BASE_PERF["dailyMX"] / result["dailyMX"])
    result["meanRatio"] = float(np.mean(ratios))
    result["worstRatio"] = float(max(ratios))
    return result


if not BASE_PERF:
    _, base_values = opt.initialize(BASE_STATE, opt.PARAMS)
    base_metrics = opt.metrics(base_values, opt.PARAMS)
    BASE_PERF.update({
        "S2": float(base_metrics[0]), "v5": float(base_metrics[1]), "v4": float(base_metrics[2]),
        "v6": float(10 * r9_search.cw26(base_values)), "dailyMX": float(daily_mx(BASE_STATE)),
    })


@njit(cache=True)
def legal(state: np.ndarray, split: int, max_memory: int, max_d: int) -> bool:
    for index in range(5):
        if state[62 + index] != TONE_KEYS[index]:
            return False
    if (state[25] != state[26]) != bool(split):
        return False
    initial_counts = np.zeros(26, np.int16)
    final_counts = np.zeros(26, np.int16)
    for token in range(27):
        key = state[token]
        if key < 0 or key >= 26:
            return False
        initial_counts[key] += 1
    for token in range(27, 62):
        key = state[token]
        if key < 0 or key >= 26:
            return False
        final_counts[key] += 1
    if np.sum(initial_counts > 0) != 21 or np.sum(final_counts > 0) != 26:
        return False
    for key in state[62:]:
        if initial_counts[key] > 0:
            return False
    if opt.memory(state) > max_memory:
        return False
    displaced = 0
    for index in ORDINARY:
        displaced += state[index] != opt.PREF[index]
    if displaced > max_d:
        return False
    seen = np.zeros(676, np.uint8)
    for index in range(len(opt.PARAMS[-2])):
        code = state[opt.PARAMS[-2][index]] * 26 + state[opt.PARAMS[-1][index]]
        if seen[code]:
            return False
        seen[code] = 1
    return True


def propose(state: np.ndarray, scope: str, rng: random.Random) -> np.ndarray:
    answer = state.copy()
    kind = rng.random()
    if kind < 0.22:
        available = [key for key in range(26) if key not in set(map(int, TONE_KEYS))]
        left, right = rng.sample(available, 2)
        for token in range(27):
            if answer[token] == left:
                answer[token] = right
            elif answer[token] == right:
                answer[token] = left
    elif kind < 0.44:
        left, right = rng.sample(range(26), 2)
        for token in range(27, 62):
            if answer[token] == left:
                answer[token] = right
            elif answer[token] == right:
                answer[token] = left
    elif kind < 0.70:
        left, right = rng.sample(range(27, 62), 2)
        answer[left], answer[right] = answer[right], answer[left]
    elif kind < 0.88:
        token = rng.randrange(27, 62)
        counts = np.bincount(answer[27:62], minlength=26)
        if counts[answer[token]] > 1:
            answer[token] = rng.randrange(26)
    else:
        token = rng.randrange(27)
        if scope == "pure-y" and token in (25, 26):
            answer[25:27] = rng.randrange(26)
        else:
            answer[token] = rng.randrange(26)
    return answer


def state_d(state: list[int] | np.ndarray) -> int:
    return sum(state[int(index)] != opt.PREF[int(index)] for index in ORDINARY)


def roots(scope: str, category: str, memory_cap: int) -> list[np.ndarray]:
    rows = [
        row for row in INVENTORY
        if row["scope"] == scope and np.array_equal(np.array(row["state"][-5:], dtype=np.int32), TONE_KEYS)
        and row["M"] <= memory_cap and state_d(row["state"]) <= ARGS.max_d
        and legal(
            np.array(row["state"], dtype=np.int32),
            int(scope == "split-y-yu"),
            memory_cap,
            ARGS.max_d,
        )
    ]
    if category == "performance":
        assert BASE_ROW is not None
        ordered = sorted(rows, key=lambda row: np.mean([row[key] / BASE_ROW[key] for key in ("S2", "v5", "v4", "v6")]))
    elif category == "collision":
        ordered = sorted(rows, key=lambda row: (row["affected"], row["loss"]))
    else:
        measured = [(performance(np.array(row["state"], dtype=np.int32)), row) for row in rows]
        eligible = [(perf, row) for perf, row in measured if perf["worstRatio"] <= 1 + ARGS.canyon_tolerance]
        ordered = [row for perf, row in sorted(eligible or measured, key=lambda item: (item[1]["affected"], item[0]["meanRatio"]))]
    anchors = [row for identifier in ANCHOR_IDS for row in rows if row["id"] == identifier]
    selected = []
    seen = set()
    for row in [*anchors, *ordered]:
        key = tuple(row["state"])
        if key in seen:
            continue
        seen.add(key)
        selected.append(np.array(row["state"], dtype=np.int32))
        if len(selected) >= ARGS.root_limit:
            break
    return selected


def search(
    scope: str,
    category: str,
    memory_cap: int,
    rng: random.Random,
    starts: list[np.ndarray] | None = None,
    focus_id: str | None = None,
) -> list[dict]:
    archive: dict[tuple[int, ...], dict] = {}
    search_roots = starts if starts is not None else roots(scope, category, memory_cap)
    for root_index, start in enumerate(search_roots):
        for restart in range(ARGS.restarts):
            state = start.copy()
            pscore, pmetrics = proxy(state)
            perf = performance(state)
            current = perf["meanRatio"] if category == "performance" else pscore
            if category == "canyon":
                current += 0.06 * perf["meanRatio"]
            start_key = tuple(map(int, state))
            if category != "canyon" or perf["worstRatio"] <= 1 + ARGS.canyon_tolerance:
                archive[start_key] = {"state": state.copy(), "performance": perf, "proxyScore": pscore, "proxyMetrics": pmetrics.tolist(), "rootIndex": root_index, "restart": restart, "focusSeed": focus_id}
            for step in range(ARGS.steps):
                candidate = propose(state, scope, rng)
                if np.array_equal(candidate, state) or not legal(
                    candidate,
                    int(scope == "split-y-yu"),
                    memory_cap,
                    ARGS.max_d,
                ):
                    continue
                candidate_perf = performance(candidate)
                if category == "canyon" and candidate_perf["worstRatio"] > 1 + ARGS.canyon_tolerance:
                    continue
                if category == "performance":
                    candidate_score = candidate_perf["meanRatio"]
                    candidate_proxy, candidate_metrics = pscore, pmetrics
                else:
                    candidate_proxy, candidate_metrics = proxy(candidate)
                    candidate_score = candidate_proxy
                    if category == "canyon":
                        candidate_score += 0.06 * candidate_perf["meanRatio"]
                temperature = (0.0015 if category != "performance" else 0.0008) * (1 - step / ARGS.steps) ** 2 + 1e-10
                if candidate_score < current or rng.random() < math.exp(min(0.0, (current - candidate_score) / temperature)):
                    state, current = candidate, candidate_score
                    if category == "performance":
                        candidate_proxy, candidate_metrics = proxy(candidate)
                    perf, pscore, pmetrics = candidate_perf, candidate_proxy, candidate_metrics
                    key = tuple(map(int, state))
                    archive[key] = {"state": state.copy(), "performance": perf, "proxyScore": pscore, "proxyMetrics": pmetrics.tolist(), "rootIndex": root_index, "restart": restart, "focusSeed": focus_id}
            print("Mcap", memory_cap, scope, category, root_index, restart, round(current, 7), perf["meanRatio"], float(np.mean(pmetrics[:, 0])), flush=True)
    rows = list(archive.values())
    if category == "canyon":
        rows = [
            row for row in rows
            if row["performance"]["worstRatio"] <= 1 + ARGS.canyon_tolerance
        ]
    if category == "performance":
        rows.sort(key=lambda row: (row["performance"]["meanRatio"], row["proxyScore"]))
    elif category == "collision":
        rows.sort(key=lambda row: (row["proxyScore"], row["performance"]["meanRatio"]))
    else:
        rows.sort(key=lambda row: (row["proxyScore"], row["performance"]["meanRatio"]))
    return rows[:12]


def exact_replay(
    rows: list[dict],
    scope: str,
    category: str,
    memory_cap: int,
    corpus: dict,
    series: str | None = None,
) -> list[dict]:
    output = []
    for index, row in enumerate(rows):
        state = row.pop("state")
        prefix = f"S21X26-{series}-" if series else "S21X26-"
        identifier = f"{prefix}M{memory_cap}-{scope.upper()}-{category.upper()}-{index + 1:02d}"
        entry = opt.toentry(state, DATA, identifier)
        exact = evaluate_layout(entry, DATA["pinyin"], corpus)
        row.update({
            "id": identifier,
            "scope": scope,
            "category": category,
            "memoryCap": memory_cap,
            "M": int(opt.memory(state)),
            "D": int(state_d(state)),
            "V": int(sum(entry["finalMap"][final] != final.upper() for final in "aeiou")),
            "state": list(map(int, state)),
            "initialMap": entry["initialMap"],
            "finalMap": entry["finalMap"],
            "toneKeys": entry["tone"],
            "collision": exact,
        })
        output.append(row)
    return output


def main() -> None:
    # Compile before the timed work.
    proxy(BASE_STATE)
    exact_corpus = read_word_corpus(
        [REPO / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")],
        allowed_pinyin=set(DATA["pinyin"]),
    )
    rng = random.Random(ARGS.seed)
    started = time.time()
    result_rows = []
    memory_buckets = sorted(set(ARGS.memory_buckets or [ARGS.max_memory]))
    if FOCUS_ROWS:
        memory_buckets = sorted({int(row["M"]) for row in FOCUS_ROWS})
        for focus_index, row in enumerate(FOCUS_ROWS, 1):
            memory_cap = int(row["M"])
            scope = row["scope"]
            start = np.array(row["state"], dtype=np.int32)
            if not legal(start, int(scope == "split-y-yu"), memory_cap, ARGS.max_d):
                raise ValueError(f"illegal focus seed: {row['id']}")
            for category in CATEGORIES:
                retained = search(
                    scope,
                    category,
                    memory_cap,
                    rng,
                    starts=[start],
                    focus_id=row["id"],
                )
                if retained:
                    result_rows.extend(exact_replay(
                        retained,
                        scope,
                        category,
                        memory_cap,
                        exact_corpus,
                        series=f"{ARGS.series_prefix}-F{focus_index:02d}",
                    ))
    else:
        for memory_cap in memory_buckets:
            for scope in SCOPES:
                for category in CATEGORIES:
                    retained = search(scope, category, memory_cap, rng)
                    if retained:
                        result_rows.extend(exact_replay(retained, scope, category, memory_cap, exact_corpus))
    output = {
        "method": "R11 performance model + canonical-reading collision proxy + all-reading five-cut replay",
        "parameters": {
            "steps": ARGS.steps,
            "restarts": ARGS.restarts,
            "seed": ARGS.seed,
            "maxMemory": ARGS.max_memory,
            "memoryBuckets": memory_buckets,
            "maxD": ARGS.max_d,
            "rootLimit": ARGS.root_limit,
            "focusIds": [row["id"] for row in FOCUS_ROWS],
            "canyonTolerance": ARGS.canyon_tolerance,
            "seriesPrefix": ARGS.series_prefix,
            "cuts": CUTS,
        },
        "baseline": {"id": BASE_ID, "performance": BASE_PERF, "collision": BASE_COLLISION},
        "elapsedSeconds": time.time() - started,
        "candidates": result_rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUTPUT, len(result_rows), "elapsed", output["elapsedSeconds"], flush=True)


if __name__ == "__main__":
    main()
