#!/usr/bin/env python3
"""Expand the R10 21x26 frontier toward 21x28 under R11 scoring.

This is a research helper.  It reuses the frozen R11 factor model, keeps the
five auxiliary keys fixed, allows comma and period only as second (U) keys,
and searches exact 26-, 27-, or 28-key final domains.  Common399 uniqueness is
always a hard constraint; V is deliberately not constrained.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path


for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "NUMBA_NUM_THREADS"):
    os.environ[variable] = "1"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replay", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--steps", type=int, default=40_000)
    parser.add_argument("--seeds", type=int, default=4)
    parser.add_argument("--targets", type=int, nargs="+", default=(26, 27, 28))
    parser.add_argument("--resume", type=Path, help="candidate JSON to use as additional roots")
    parser.add_argument("--resume-ids", nargs="*", help="candidate IDs retained from --resume")
    parser.add_argument("--tolerance", type=float, help="override per-D performance guard")
    parser.add_argument("--repo", type=Path, help="Snow Pinyin repo; enables weighted AA-hotspot scoring")
    parser.add_argument("--aa-weight", type=float, default=0.0)
    parser.add_argument("--hotspot-weight", type=float, default=0.0)
    parser.add_argument("--max-d", type=int, help="override the resumed root's D ceiling")
    parser.add_argument("--max-m", type=int, default=42)
    return parser.parse_args()


ARGS = arguments()
REPLAY = ARGS.replay.resolve()
OUTPUT = ARGS.output.resolve()
PROJECT_REPO = ARGS.repo.resolve() if ARGS.repo else None
os.chdir(REPLAY)
sys.path.insert(0, str(REPLAY))

import numpy as np  # noqa: E402
from numba import njit  # noqa: E402

import opt  # noqa: E402
import r10_search  # noqa: E402
import r9_search  # noqa: E402
import search_engine  # noqa: E402
from macroxue.engine import LAYOUT, SPEED, distance, pair  # noqa: E402

if ARGS.repo:
    from benchmark_feima_prefixes import read_words, split_pinyin  # noqa: E402


DATA = json.loads(Path("source.json").read_text(encoding="utf-8"))
BY_ID = {entry["id"]: entry for entry in DATA["entries"]}
for entry in json.loads(Path("entries_to_score.json").read_text(encoding="utf-8")):
    BY_ID[entry["id"]] = entry

KEYS = opt.META["keys"]
COMMA = KEYS.index(",")
PERIOD = KEYS.index(".")
ALLOWED_FINAL = np.array([*range(26), COMMA, PERIOD], dtype=np.int32)
ALLOWED_FINAL_MASK = np.zeros(len(KEYS), dtype=np.uint8)
ALLOWED_FINAL_MASK[ALLOWED_FINAL] = 1
ORDINARY = search_engine.ORD
VOWEL_FINAL_INDICES = np.array([27 + opt.F.index(final) for final in "aeiou"], dtype=np.int32)

CORPORA = json.loads(Path("R9_corpora.json").read_text(encoding="utf-8"))
TOKENS: list[int] = []
for token in CORPORA["daily"]["tokens"]:
    if "pinyin" not in token:
        continue
    head, final = r10_search.split(token["pinyin"])
    TOKENS.extend((r10_search.HEADS.index(head), 27 + opt.F.index(final)))
TOKENS_NP = np.array(TOKENS, dtype=np.int32)
NCHAR = len(TOKENS_NP) // 2
PAIR_COST = np.array([[pair(a.lower(), b.lower()) for b in KEYS] for a in KEYS])
FIRST_COST = []
for key in KEYS:
    x, y, finger = LAYOUT[key.lower()]
    FIRST_COST.append((0.2 + (distance(finger, 1, x, y) if x < 5 else 0)) / SPEED[finger])
FIRST_COST_NP = np.array(FIRST_COST)


def build_hotspots(repo: Path | None) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return head-pair weights averaged over 3/4-char Top 500..10k cuts."""
    if repo is None:
        return (
            np.empty(0, dtype=np.int32),
            np.empty(0, dtype=np.int32),
            np.empty(0, dtype=np.float64),
        )
    paths = [repo / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")]
    words = read_words(paths)
    accumulated: dict[tuple[int, int], float] = defaultdict(float)
    component_count = 0
    for length in (3, 4):
        for cut in (500, 1000, 2000, 5000, 10000):
            rows = words[length][:cut]
            total = sum(row["weight"] for row in rows)
            if not total:
                continue
            component_count += 1
            for row in rows:
                pairs = set()
                for reading in row["readings"]:
                    try:
                        first, _ = split_pinyin(reading[0])
                        second, _ = split_pinyin(reading[1])
                        pairs.add((opt.HEADS.index(first), opt.HEADS.index(second)))
                    except (ValueError, IndexError):
                        continue
                for pair_value in pairs:
                    accumulated[pair_value] += row["weight"] / total / max(1, len(pairs))
    rows = sorted(accumulated.items())
    return (
        np.array([pair_value[0] for pair_value, _ in rows], dtype=np.int32),
        np.array([pair_value[1] for pair_value, _ in rows], dtype=np.int32),
        np.array([weight / component_count for _, weight in rows], dtype=np.float64),
    )


HOT_FIRST, HOT_SECOND, HOT_WEIGHT = build_hotspots(PROJECT_REPO)
AA_OBJECTIVE_WEIGHT = float(ARGS.aa_weight)
HOTSPOT_OBJECTIVE_WEIGHT = float(ARGS.hotspot_weight)


@njit(cache=True)
def daily_mx(state: np.ndarray) -> float:
    total = FIRST_COST_NP[state[TOKENS_NP[0]]]
    for index in range(1, len(TOKENS_NP)):
        total += PAIR_COST[state[TOKENS_NP[index - 1]], state[TOKENS_NP[index]]]
    return 200 * NCHAR / total


@njit(cache=True)
def vacancy_metrics(state: np.ndarray) -> tuple[int, float]:
    occupied = np.zeros(len(KEYS) * len(KEYS), dtype=np.uint8)
    initial_key = np.zeros(len(KEYS), dtype=np.uint8)
    for token in range(27):
        initial_key[state[token]] = 1
    occupied_aa = 0
    for index in range(len(opt.PARAMS[-2])):
        first = state[opt.PARAMS[-2][index]]
        second = state[opt.PARAMS[-1][index]]
        code = first * len(KEYS) + second
        if not occupied[code]:
            occupied[code] = 1
            if initial_key[second]:
                occupied_aa += 1
    separated = 0.0
    for index in range(len(HOT_WEIGHT)):
        code = state[HOT_FIRST[index]] * len(KEYS) + state[HOT_SECOND[index]]
        if not occupied[code]:
            separated += HOT_WEIGHT[index]
    return 21 * 21 - occupied_aa, separated


@njit(cache=True)
def state_stats(state: np.ndarray) -> tuple[int, int, int, int, int]:
    if state[25] != state[26]:
        return -1, 999, 999, 999, 999
    initial_counts = np.zeros(len(KEYS), dtype=np.int32)
    final_counts = np.zeros(len(KEYS), dtype=np.int32)
    for index in range(27):
        key = state[index]
        if key < 0 or key >= 26:
            return -1, 999, 999, 999, 999
        initial_counts[key] += 1
    for index in range(27, 62):
        key = state[index]
        if key < 0 or key >= len(KEYS) or not ALLOWED_FINAL_MASK[key]:
            return -1, 999, 999, 999, 999
        final_counts[key] += 1
    for key in state[62:]:
        if initial_counts[key]:
            return -1, 999, 999, 999, 999
    if np.sum(initial_counts > 0) != 21:
        return -1, 999, 999, 999, 999
    seen = np.zeros(len(KEYS) * len(KEYS), dtype=np.uint8)
    unique = 0
    for index in range(len(opt.PARAMS[-2])):
        code = state[opt.PARAMS[-2][index]] * len(KEYS) + state[opt.PARAMS[-1][index]]
        if not seen[code]:
            unique += 1
            seen[code] = 1
    displaced = 0
    for index in ORDINARY:
        displaced += state[index] != opt.PREF[index]
    vowel_displaced = 0
    for index in VOWEL_FINAL_INDICES:
        vowel_displaced += state[index] != opt.PREF[index]
    return unique, opt.memory(state), displaced, vowel_displaced, np.sum(final_counts > 0)


@njit(cache=True)
def legal(state: np.ndarray, target_r: int, max_d: int, max_m: int) -> bool:
    unique, memory, displaced, _, actual_r = state_stats(state)
    return unique == 399 and memory <= max_m and displaced <= max_d and actual_r == target_r


@njit(cache=True)
def swap_range(state: np.ndarray, lo: int, hi: int, left: int, right: int) -> None:
    for index in range(lo, hi):
        if state[index] == left:
            state[index] = right
        elif state[index] == right:
            state[index] = left


@njit(cache=True)
def propose(state: np.ndarray) -> np.ndarray:
    answer = state.copy()
    kind = np.random.randint(100)
    if kind < 16:
        # All 21 non-auxiliary letter keys are occupied by A, so a physical-key
        # swap is the natural legal move and can change D without changing 21A.
        left = np.random.randint(26)
        while np.any(state[62:] == left):
            left = np.random.randint(26)
        right = np.random.randint(26)
        while right == left or np.any(state[62:] == right):
            right = np.random.randint(26)
        swap_range(answer, 0, 27, left, right)
    elif kind < 42:
        left = ALLOWED_FINAL[np.random.randint(len(ALLOWED_FINAL))]
        right = ALLOWED_FINAL[np.random.randint(len(ALLOWED_FINAL))]
        swap_range(answer, 27, 62, left, right)
    elif kind < 69:
        left = 27 + np.random.randint(35)
        right = 27 + np.random.randint(35)
        answer[left], answer[right] = answer[right], answer[left]
    elif kind < 91:
        token = 27 + np.random.randint(35)
        answer[token] = ALLOWED_FINAL[np.random.randint(len(ALLOWED_FINAL))]
    else:
        a = 27 + np.random.randint(35)
        b = 27 + np.random.randint(35)
        c = 27 + np.random.randint(35)
        answer[a], answer[b], answer[c] = answer[b], answer[c], answer[a]
    return answer


@njit(cache=True)
def score(values: np.ndarray, state: np.ndarray, profile: np.ndarray) -> float:
    metrics = opt.metrics(values, opt.PARAMS)
    v6 = 10 * r9_search.cw26(values)
    aa_empty, hotspot = vacancy_metrics(state)
    return (
        profile[0] * metrics[0] / BASE_METRICS[0]
        + profile[1] * metrics[1] / BASE_METRICS[1]
        + profile[2] * metrics[2] / BASE_METRICS[2]
        + profile[3] * v6 / BASE_V6
        + profile[4] * BASE_MX / daily_mx(state)
        + AA_OBJECTIVE_WEIGHT * (189 - aa_empty) / 189
        + HOTSPOT_OBJECTIVE_WEIGHT * (1 - hotspot)
    )


@njit(cache=True)
def walk(
    start: np.ndarray,
    target_r: int,
    max_d: int,
    max_m: int,
    profile: np.ndarray,
    steps: int,
    seed: int,
    tolerance: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    np.random.seed(seed)
    state = start.copy()
    cache, values = opt.initialize(state, opt.PARAMS)
    current = score(values, state, profile)
    best = state.copy()
    best_values = values.copy()
    best_score = current
    stamp = np.zeros(len(cache), dtype=np.int64)
    ids = np.empty(len(cache), dtype=np.int32)
    costs = np.empty(len(cache))
    delta = np.zeros(60)
    epoch = evaluated = accepted = guard_passed = 0
    for iteration in range(steps):
        candidate = propose(state)
        if np.random.random() < 0.30:
            candidate = propose(candidate)
        if np.all(candidate == state) or not legal(candidate, target_r, max_d, max_m):
            continue
        epoch += 1
        evaluated += 1
        count = opt.probe(state, candidate, cache, opt.PARAMS, stamp, epoch, ids, costs, delta)
        new_values = values + delta
        metrics = opt.metrics(new_values, opt.PARAMS)
        v6 = 10 * r9_search.cw26(new_values)
        mx = daily_mx(candidate)
        if (
            metrics[0] > BASE_METRICS[0] * (1 + tolerance)
            or metrics[1] > BASE_METRICS[1] * (1 + tolerance)
            or metrics[2] > BASE_METRICS[2] * (1 + tolerance)
            or v6 > BASE_V6 * (1 + tolerance)
            or mx < BASE_MX * (1 - tolerance)
        ):
            continue
        guard_passed += 1
        objective = score(new_values, candidate, profile)
        temperature = 0.0014 * (1 - iteration / max(1, steps)) ** 2 + 1e-10
        if objective < current or np.random.random() < np.exp(min(0.0, (current - objective) / temperature)):
            state = candidate
            values = new_values
            current = objective
            accepted += 1
            for index in range(count):
                cache[ids[index]] = costs[index]
            if objective < best_score - 1e-12:
                best = state.copy()
                best_values = values.copy()
                best_score = objective
    return best, best_values, np.array((steps, evaluated, guard_passed, accepted))


def state_from_mapping(mapping: dict) -> np.ndarray:
    return np.array(
        [KEYS.index(mapping["initialMap"][head]) for head in opt.HEADS]
        + [KEYS.index(mapping["finalMap"][final]) for final in opt.F]
        + [KEYS.index(key) for key in mapping["toneKeys"]],
        dtype=np.int32,
    )


def summary(state: np.ndarray, values: np.ndarray | None = None) -> dict:
    if values is None:
        _, values = opt.initialize(state, opt.PARAMS)
    unique, memory, displaced, vowel_displaced, actual_r = state_stats(state)
    metrics = opt.metrics(values, opt.PARAMS)
    aa_empty, hotspot = vacancy_metrics(state)
    return {
        "U": int(unique),
        "M": int(memory),
        "D": int(displaced),
        "V": int(vowel_displaced),
        "actualR": int(actual_r),
        "S2": float(metrics[0]),
        "v5": float(metrics[1]),
        "v4": float(metrics[2]),
        "v6": float(10 * r9_search.cw26(values)),
        "dailyMX": float(daily_mx(state)),
        "aaVacancies": int(aa_empty),
        "weightedAAHotspotSeparation": float(hotspot),
    }


def mapping(state: np.ndarray, identifier: str) -> dict:
    return {
        "id": identifier,
        "name": identifier,
        "initialMap": {head: KEYS[int(state[index])] for index, head in enumerate(opt.HEADS)},
        "finalMap": {final: KEYS[int(state[27 + index])] for index, final in enumerate(opt.F)},
        "toneKeys": "".join(KEYS[int(key)] for key in state[62:]),
    }


def expanded_seeds(state: np.ndarray, target_r: int, width: int = 12) -> list[np.ndarray]:
    beam = [state.copy()]
    while int(state_stats(beam[0])[-1]) < target_r:
        candidates: dict[tuple[int, ...], tuple[float, np.ndarray]] = {}
        for current in beam:
            used = set(map(int, current[27:62]))
            destinations = [key for key in (COMMA, PERIOD) if key not in used]
            counts = {key: int(np.sum(current[27:62] == key)) for key in used}
            for token in range(27, 62):
                if counts[int(current[token])] < 2:
                    continue
                for destination in destinations:
                    candidate = current.copy()
                    candidate[token] = destination
                    stats = state_stats(candidate)
                    if stats[0] != 399:
                        continue
                    _, values = opt.initialize(candidate, opt.PARAMS)
                    perf = score(values, candidate, np.ones(5))
                    candidates[tuple(map(int, candidate))] = (perf, candidate)
        beam = [row[1] for row in sorted(candidates.values(), key=lambda row: row[0])[:width]]
        if not beam:
            break
    return beam


BASE_STATE = opt.state(BY_ID["R10-21X26-M39-08"], DATA)
_, BASE_VALUES = opt.initialize(BASE_STATE, opt.PARAMS)
BASE_METRICS = opt.metrics(BASE_VALUES, opt.PARAMS)
BASE_V6 = float(10 * r9_search.cw26(BASE_VALUES))
BASE_MX = float(daily_mx(BASE_STATE))


def main() -> None:
    mapping_path = Path(__file__).resolve().parents[2] / "config" / "shenyun-21x28-mapping.json"
    shenyun_mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    roots = {
        "R10-21X26-M39-08": BASE_STATE,
        "R21X28-in-ui-an": state_from_mapping(shenyun_mapping),
    }
    for entry_id in ("R11-21X26-M36-01", "R11-21X26-M37-02", "R11-21X26-M38-03"):
        if entry_id in BY_ID:
            roots[entry_id] = opt.state(BY_ID[entry_id], DATA)
    profiles = (
        (1.0, 1.0, 1.0, 1.0, 0.5),
        (2.0, 0.7, 0.7, 1.0, 0.4),
        (0.6, 1.8, 0.8, 0.8, 0.5),
        (0.7, 0.8, 1.8, 0.8, 0.5),
        (0.8, 0.8, 0.8, 2.0, 0.5),
    )
    tolerances = {5: 0.005, 4: 0.012, 3: 0.025, 2: 0.04, 1: 0.07}
    root_specs = [
        ("R10-21X26-M39-08", 5, 42),
        ("R21X28-in-ui-an", 2, 42),
        ("R21X28-in-ui-an", 1, 42),
    ]
    for entry_id, max_d in (
        ("R11-21X26-M37-02", 4),
        ("R11-21X26-M38-03", 4),
        ("R11-21X26-M36-01", 3),
    ):
        if entry_id in roots:
            root_specs.append((entry_id, max_d, 42))
    if ARGS.resume:
        resume_payload = json.loads(ARGS.resume.resolve().read_text(encoding="utf-8"))
        requested = set(ARGS.resume_ids or ())
        selected = [
            candidate for candidate in resume_payload["candidates"]
            if not requested or candidate["id"] in requested
        ]
        missing = requested - {candidate["id"] for candidate in selected}
        if missing:
            raise ValueError(f"resume IDs not found: {sorted(missing)}")
        for candidate in selected:
            name = "resume:" + candidate["id"]
            state = np.array(candidate["state"], dtype=np.int32)
            roots[name] = state
            root_specs.append((
                name,
                ARGS.max_d if ARGS.max_d is not None else int(state_stats(state)[2]),
                ARGS.max_m,
            ))
        # A focused continuation should not rerun every built-in root.
        if requested:
            root_specs = [spec for spec in root_specs if spec[0].startswith("resume:")]
    rows: list[dict] = []
    seen: set[tuple[int, ...]] = set()

    def retain(state: np.ndarray, source: str, job: dict | None = None, values: np.ndarray | None = None) -> None:
        key = tuple(map(int, state))
        if key in seen:
            return
        seen.add(key)
        index = len(rows)
        rows.append({
            "id": f"R10X28-CAND-{index:03d}",
            "source": source,
            "state": list(key),
            "summary": summary(state, values),
            "job": job,
            **mapping(state, f"R10X28-CAND-{index:03d}"),
        })

    retain(BASE_STATE, "embedded baseline")
    for root_name, max_d, max_m in root_specs:
        root = roots[root_name]
        for target_r in ARGS.targets:
            if target_r < int(state_stats(root)[-1]):
                continue
            seeds = expanded_seeds(root, target_r)
            for seed_index, start in enumerate(seeds[:4]):
                if not legal(start, target_r, max_d, max_m):
                    continue
                retain(start, f"expanded seed from {root_name}")
                for profile_index, profile in enumerate(profiles):
                    for repeat in range(ARGS.seeds):
                        random_seed = 2128000 + len(rows) * 193 + profile_index * 31 + repeat
                        best, values, counts = walk(
                            start,
                            target_r,
                            max_d,
                            max_m,
                            np.array(profile),
                            ARGS.steps,
                            random_seed,
                            ARGS.tolerance if ARGS.tolerance is not None else tolerances[max_d],
                        )
                        retain(best, f"search from {root_name}", {
                            "targetR": target_r,
                            "maxD": max_d,
                            "maxM": max_m,
                            "tolerance": ARGS.tolerance if ARGS.tolerance is not None else tolerances[max_d],
                            "profile": profile,
                            "seed": random_seed,
                            "counts": counts.tolist(),
                            "startIndex": seed_index,
                        }, values)
                        print(
                            root_name,
                            target_r,
                            max_d,
                            summary(best, values),
                            counts.tolist(),
                            flush=True,
                        )

    # Keep all unique states in the audit, with a stable performance ordering.
    rows.sort(key=lambda row: (
        row["summary"]["D"],
        row["summary"]["actualR"],
        max(
            row["summary"]["S2"] / BASE_METRICS[0],
            row["summary"]["v5"] / BASE_METRICS[1],
            row["summary"]["v4"] / BASE_METRICS[2],
            row["summary"]["v6"] / BASE_V6,
            BASE_MX / row["summary"]["dailyMX"],
        ),
    ))
    for index, row in enumerate(rows):
        identifier = f"R10X28-CAND-{index:03d}"
        row["id"] = identifier
        row["name"] = identifier
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "method": "R10 embedded baseline; exact 26/27/28-final domains; Common399 unique; fixed IEUAO; V unrestricted",
        "vacancyObjective": {
            "aaWeight": ARGS.aa_weight,
            "hotspotWeight": ARGS.hotspot_weight,
            "hotspotCuts": [500, 1000, 2000, 5000, 10000] if ARGS.repo else [],
            "hotspotWordLengths": [3, 4] if ARGS.repo else [],
        },
        "base": summary(BASE_STATE, BASE_VALUES),
        "allowedFinalKeys": "ABCDEFGHIJKLMNOPQRSTUVWXYZ,.",
        "candidates": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUTPUT, len(rows), flush=True)


if __name__ == "__main__":
    main()
