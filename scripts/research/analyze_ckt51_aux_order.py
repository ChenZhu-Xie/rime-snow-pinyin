#!/usr/bin/env python3
"""Rank all 144 native-route CKT v5.1 policies on the exact grid."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np


TRACKS = ("character", "word2", "word3", "word4")
WEIGHTS = {"character": 1, "word2": 3, "word3": 1, "word4": 1}
CURRENT = {
    "21x21-keytao": "12/231/24",
    "21x21-sanpin": "12/213/23",
    "21x26-keytao": "12/21/42",
    "21x26-sanpin": "12/21/13",
    "b04-keytao": "12/12/23",
    "b04-sanpin": "21/12/23",
    "s005-keytao": "12/213/24",
    "s005-sanpin": "12/213/23",
}
V5_ROBUST = {
    "21x21-keytao": "12/23/24",
    "21x21-sanpin": "12/21/23",
    "21x26-keytao": "12/21/14",
    "21x26-sanpin": "12/21/13",
    "b04-keytao": "12/12/23",
    "b04-sanpin": "21/12/23",
    "s005-keytao": "12/21/24",
    "s005-sanpin": "12/21/23",
}
REFERENCES = {
    "keytao": ("s005-keytao", "12/213/24"),
    "sanpin": ("s005-sanpin", "12/213/23"),
}
NAMES = {
    "21x21-keytao": "冰雪键道",
    "21x21-sanpin": "冰雪三拼",
    "21x26-keytao": "冰雪神韵·形",
    "21x26-sanpin": "冰雪神韵·调",
    "b04-keytao": "首道 B04·形",
    "b04-sanpin": "首道 B04·调",
    "s005-keytao": "S005 键道",
    "s005-sanpin": "S005 三拼",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    root = Path(__file__).resolve().parents[2]
    parser.add_argument(
        "--input",
        type=Path,
        default=root / "output" / "ckt51-aux-order-components.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=root / "reports" / "ckt51-aux-order-robustness.json",
    )
    parser.add_argument("--chunk-size", type=int, default=4096)
    return parser.parse_args()


def component_vector(track: dict[str, float], baseline: dict[str, float]) -> list[float]:
    return [
        track["motorUpperMs"],
        baseline["firstAuxMs"] * track["firstAuxRate"],
        baseline["secondAuxMs"] * track["secondAuxRate"],
        baseline["thirdAuxMs"] * track["thirdAuxRate"],
        baseline["selectionDecisionMs"] * track["selectionRate"],
        baseline["scanPerCandidateMs"] * track["meanRejectedCandidates"],
        baseline["pageActionMs"] * track["meanPageActions"],
    ]


def track_vectors(result: dict, baseline: dict[str, float]) -> list[list[float]]:
    return [component_vector(result["tracks"][track], baseline) for track in TRACKS]


def competition_ranks(scores: np.ndarray, tolerance: float = 1e-9) -> np.ndarray:
    order = np.argsort(scores, axis=1, kind="stable")
    sorted_scores = np.take_along_axis(scores, order, axis=1)
    positions = np.broadcast_to(
        np.arange(1, scores.shape[1] + 1, dtype=np.int16), scores.shape
    )
    changes = np.empty(scores.shape, dtype=bool)
    changes[:, 0] = True
    changes[:, 1:] = np.abs(np.diff(sorted_scores, axis=1)) > tolerance
    sorted_ranks = np.maximum.accumulate(
        np.where(changes, positions, 0).astype(np.int16), axis=1
    )
    ranks = np.empty_like(sorted_ranks)
    np.put_along_axis(ranks, order, sorted_ranks, axis=1)
    return ranks


def make_grid() -> np.ndarray:
    count = 11**6
    quotient = np.arange(count, dtype=np.int32)
    grid = np.empty((count, 6), dtype=np.float64)
    for axis in range(5, -1, -1):
        grid[:, axis] = quotient % 11
        quotient //= 11
    grid *= 0.5
    return grid


def rank_case(
    case_id: str,
    case: dict,
    reference: dict,
    baseline: dict[str, float],
    grid: np.ndarray,
    chunk_size: int,
) -> dict:
    keys = [result["policyKey"] for result in case["results"]]
    vectors = np.asarray(
        [track_vectors(result, baseline) for result in case["results"]],
        dtype=np.float64,
    )
    reference_vectors = np.asarray(track_vectors(reference, baseline), dtype=np.float64)
    weights = np.asarray([WEIGHTS[track] for track in TRACKS], dtype=np.float64)
    count = len(keys)
    top1 = np.zeros(count, dtype=np.int64)
    top3 = np.zeros(count, dtype=np.int64)
    rank_sum = np.zeros(count, dtype=np.int64)
    worst_rank = np.zeros(count, dtype=np.int16)
    for start in range(0, len(grid), chunk_size):
        multipliers = grid[start : start + chunk_size]
        effective = vectors[:, :, 0][None, :, :] + np.einsum(
            "ba,pta->bpt", multipliers, vectors[:, :, 1:], optimize=True
        )
        reference_effective = reference_vectors[:, 0][None, :] + (
            multipliers @ reference_vectors[:, 1:].T
        )
        scores = np.sum(
            weights[None, None, :] * (effective / reference_effective[:, None, :]) ** 4,
            axis=2,
        )
        ranks = competition_ranks(scores)
        top1 += np.sum(ranks == 1, axis=0)
        top3 += np.sum(ranks <= 3, axis=0)
        rank_sum += np.sum(ranks, axis=0, dtype=np.int64)
        worst_rank = np.maximum(worst_rank, np.max(ranks, axis=0))
    points = len(grid)
    ranking = [
        {
            "policy": key,
            "top1Rate": float(top1[index] / points),
            "top3Rate": float(top3[index] / points),
            "meanRank": float(rank_sum[index] / points),
            "worstRank": int(worst_rank[index]),
        }
        for index, key in enumerate(keys)
    ]
    ranking.sort(
        key=lambda item: (
            item["meanRank"],
            -item["top3Rate"],
            -item["top1Rate"],
            item["worstRank"],
            item["policy"],
        )
    )
    baseline_effective = np.sum(vectors, axis=2)
    reference_baseline = np.sum(reference_vectors, axis=1)
    baseline_scores = 10 * (
        np.sum(weights[None, :] * (baseline_effective / reference_baseline) ** 4, axis=1)
        / sum(WEIGHTS.values())
    ) ** 0.25
    baseline_ranks = competition_ranks(baseline_scores[None, :])[0]
    baseline_order = np.argsort(baseline_scores, kind="stable")
    baseline_top10 = [
        {
            "policy": keys[index],
            "rank": int(baseline_ranks[index]),
            "normalizedCkt51": float(baseline_scores[index]),
        }
        for index in baseline_order[:10]
    ]
    selected = ranking[0]
    selected_result = next(
        result for result in case["results"] if result["policyKey"] == selected["policy"]
    )
    current = next(item for item in ranking if item["policy"] == CURRENT[case_id])
    current_result = next(
        result for result in case["results"] if result["policyKey"] == CURRENT[case_id]
    )
    print(
        f"{case_id}: robust={selected['policy']} meanRank={selected['meanRank']:.6f}",
        file=sys.stderr,
    )
    return {
        "name": NAMES[case_id],
        "v5PolicyProjectedToCkt51": CURRENT[case_id],
        "word3Contract": case["word3Contract"],
        "robustPolicy": selected["policy"],
        "robust": selected,
        "current": current,
        "robustTop10": ranking[:10],
        "baselineTop10": baseline_top10,
        "selectedTracks": selected_result["tracks"],
        "v5PolicyTracks": current_result["tracks"],
    }


def normalized_track_set(
    results: dict, references: dict, track_field: str
) -> tuple[dict, dict]:
    mode_scores = {}
    mode_power_sums = {}
    for case_id, result in results.items():
        mode = "keytao" if case_id.endswith("keytao") else "sanpin"
        power_sum = 0.0
        ratios = {}
        reference_tracks = references[mode]["tracks"]
        for track, weight in WEIGHTS.items():
            ratio = (
                result[track_field][track]["effectiveMs"]
                / reference_tracks[track]["effectiveMs"]
            )
            ratios[track] = ratio
            power_sum += weight * ratio**4
        mode_power_sums[case_id] = power_sum
        mode_scores[case_id] = {
            "score": 10 * (power_sum / sum(WEIGHTS.values())) ** 0.25,
            "ratios": ratios,
        }
    pairs = {}
    for pair, members in {
        "21x21": ("21x21-keytao", "21x21-sanpin"),
        "21x26": ("21x26-keytao", "21x26-sanpin"),
        "b04": ("b04-keytao", "b04-sanpin"),
        "s005-optimized": ("s005-keytao", "s005-sanpin"),
    }.items():
        power_sum = sum(mode_power_sums[member] for member in members)
        pairs[pair] = {
            "members": list(members),
            "score": 10 * (power_sum / (2 * sum(WEIGHTS.values()))) ** 0.25,
        }
    return mode_scores, pairs


def normalized_scores(results: dict, references: dict) -> dict:
    modes, pairs = normalized_track_set(results, references, "selectedTracks")
    v5_policy_modes, v5_policy_pairs = normalized_track_set(
        results, references, "v5PolicyTracks"
    )
    pairs["s005-anchor"] = {
        "members": ["s005-keytao", "s005-sanpin"],
        "score": 10,
    }
    return {
        "modes": modes,
        "pairs": pairs,
        "v5PolicyModes": v5_policy_modes,
        "v5PolicyPairs": v5_policy_pairs,
    }


def compare_to_v5_robust(results: dict) -> dict:
    comparison = {}
    for case_id, result in results.items():
        v5_policy = V5_ROBUST[case_id]
        ckt51_policy = result["robustPolicy"]
        v5_word2, v5_word3, v5_word4 = v5_policy.split("/")
        ckt51_word2, ckt51_word3, ckt51_word4 = ckt51_policy.split("/")
        if ckt51_policy == v5_policy:
            change = "unchanged"
        elif (
            ckt51_word2 == v5_word2
            and ckt51_word4 == v5_word4
            and len(v5_word3) == 2
            and len(ckt51_word3) == 3
            and ckt51_word3.startswith(v5_word3)
        ):
            change = "third auxiliary appended; first two unchanged"
        else:
            change = "word3 first-two order changed and third auxiliary appended"
        comparison[case_id] = {
            "name": NAMES[case_id],
            "ckt5RobustPolicy": v5_policy,
            "ckt51RobustPolicy": ckt51_policy,
            "change": change,
        }
    return comparison


def main() -> None:
    args = parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if payload["version"] != "ckt5.1-aux-order-components-1":
        raise ValueError(f"unsupported input version: {payload['version']}")
    if args.chunk_size < 1:
        raise ValueError("--chunk-size must be positive")
    grid = make_grid()
    references = {}
    for mode, (case_id, policy) in REFERENCES.items():
        reference_case = payload["cases"][case_id]
        references[mode] = next(
            result for result in reference_case["results"] if result["policyKey"] == policy
        )
    results = {}
    for case_id in (
        "21x21-keytao",
        "21x21-sanpin",
        "21x26-keytao",
        "21x26-sanpin",
        "b04-keytao",
        "b04-sanpin",
        "s005-keytao",
        "s005-sanpin",
    ):
        case = payload["cases"][case_id]
        mode = "keytao" if case_id.endswith("keytao") else "sanpin"
        results[case_id] = rank_case(
            case_id,
            case,
            references[mode],
            payload["baselineCostsMs"],
            grid,
            args.chunk_size,
        )
    output = {
        "version": "ckt5.1-aux-order-robustness-1",
        "contract": payload["contract"],
        "corpus": payload["corpus"],
        "trackWeights": WEIGHTS,
        "baselineCostsMs": payload["baselineCostsMs"],
        "independentGrid": {
            "rangePercent": [0, 500],
            "stepPercent": 50,
            "coefficients": [
                "firstAuxMs",
                "secondAuxMs",
                "thirdAuxMs",
                "selectionDecisionMs",
                "scanPerCandidateMs",
                "pageActionMs",
            ],
            "pointsPerCoefficient": 11,
            "combinations": 11**6,
        },
        "robustSelection": (
            "lowest mean competition rank; ties use higher top-three rate, higher "
            "top-one rate, lower worst rank, then lexical policy order"
        ),
        "policyNotation": (
            "word2/word3/word4 source positions; traditional 21x21 word3 uses "
            "three positions (for example 12/231/24), while four-code-top word3 "
            "keeps two auxiliaries after AAAU (for example 12/21/42)"
        ),
        "referencePolicies": {
            mode: {"case": case_id, "policy": policy}
            for mode, (case_id, policy) in REFERENCES.items()
        },
        "cases": results,
        "comparisonToCkt5Robust": compare_to_v5_robust(results),
        "normalized": normalized_scores(results, references),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(args.output)


if __name__ == "__main__":
    main()
