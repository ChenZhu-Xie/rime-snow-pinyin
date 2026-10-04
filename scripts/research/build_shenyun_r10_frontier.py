#!/usr/bin/env python3
"""Build the curated R10 -> 21x28 research frontier artifact.

The heavy searches and corpus replays intentionally remain separate.  This
script joins their JSON outputs with the frozen R11 exact-engine records and
emits the small, reviewable artifact tracked by this repository.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


CUTS = (500, 1000, 2000, 5000, 10000)
SELECTIONS = (
    # stable ID, label, performance input, candidate ID, collision input, exact ID
    ("R10-21X26-M39-08", "R10 21×26 嵌入基线", "refined", "R10X28-CAND-032", "refined", None),
    ("SHENYUN-R10X28-D1-M39", "D1 低位移性能点", "d1", "R10X28-CAND-000", "d1", "SHENYUN-R10X28-D1-M39"),
    ("SHENYUN-R10X28-D2-M38", "D2 低位移均衡点", "refined", "R10X28-CAND-003", "refined", "SHENYUN-R10X28-D2-M38"),
    ("SHENYUN-R10X28-D3-M38", "D3 碰撞优先点", "refined", "R10X28-CAND-014", "refined", "SHENYUN-R10X28-D3-M38"),
    ("SHENYUN-R10X28-D4-M38", "D4 综合均衡点", "refined", "R10X28-CAND-022", "refined", "SHENYUN-R10X28-D4-M38"),
    ("SHENYUN-R10X27-D5-M41-COLL", "21×27 碰撞过渡点", "refined", "R10X28-CAND-037", "refined", "SHENYUN-R10X27-D5-M41-COLL"),
    ("SHENYUN-R10X28-D5-M39-BAL", "D5 全面均衡点", "refined", "R10X28-CAND-044", "refined", "SHENYUN-R10X28-D5-M39-BAL"),
    ("SHENYUN-R10X28-D5-M39-PERF", "D5 性能优先点", "refined", "R10X28-CAND-048", "refined", "SHENYUN-R10X28-D5-M39-PERF"),
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refined", type=Path, required=True)
    parser.add_argument("--d1", type=Path, required=True)
    parser.add_argument("--refined-collisions", type=Path, required=True)
    parser.add_argument("--d1-collisions", type=Path, required=True)
    parser.add_argument("--exact-dir", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            result.update(block)
    return result.hexdigest()


def by_id(payload: dict, collection: str) -> dict[str, dict]:
    return {row["id"]: row for row in payload[collection]}


def compact_track(track: dict) -> dict:
    return {
        key: track[key]
        for key in (
            "upperMs", "sfb", "repeat", "alt", "crossRow", "home",
            "rightPinky", "maxFinger", "miss",
        )
    }


def main() -> None:
    args = arguments()
    paths = {
        "refined": args.refined,
        "d1": args.d1,
        "refinedCollisions": args.refined_collisions,
        "d1Collisions": args.d1_collisions,
        "source": args.source,
    }
    input_hashes = {name: digest(path) for name, path in paths.items()}
    performance = {
        "refined": by_id(json.loads(args.refined.read_text(encoding="utf-8")), "candidates"),
        "d1": by_id(json.loads(args.d1.read_text(encoding="utf-8")), "candidates"),
    }
    collisions = {
        "refined": by_id(json.loads(args.refined_collisions.read_text(encoding="utf-8")), "layouts"),
        "d1": by_id(json.loads(args.d1_collisions.read_text(encoding="utf-8")), "layouts"),
    }
    source = json.loads(args.source.read_text(encoding="utf-8"))
    source_entries = by_id(source, "entries")
    baseline_id = "R10-21X26-M39-08"
    baseline_summary = performance["refined"]["R10X28-CAND-032"]["summary"]
    baseline_collision = collisions["refined"]["R10X28-CAND-032"]

    rows = []
    for stable_id, label, performance_set, candidate_id, collision_set, exact_id in SELECTIONS:
        candidate = performance[performance_set][candidate_id]
        collision = collisions[collision_set][candidate_id]
        summary = candidate["summary"]
        if exact_id:
            exact_path = args.exact_dir / f"{exact_id}.json"
            input_hashes[f"exact/{exact_id}.json"] = digest(exact_path)
            exact = json.loads(exact_path.read_text(encoding="utf-8"))
            tracks = exact["tracks"]
            exact_metrics = {
                "v5": exact["scores"]["ensembleV5"]["score"],
                "v4": exact["scores"]["ensembleV4"]["score"],
                "v6": summary["v6"],
                "dailyMX": summary["dailyMX"],
                "tracks": {
                    name: compact_track(tracks[name])
                    for name in ("S2", "C2", "C4-Snow", "W4-Snow", "WX-Snow-12")
                },
                "verification": {
                    "engine": exact["verification"]["engine"],
                    "maxFactorDifference": exact["verification"]["maxFactorDifference"],
                },
            }
        else:
            entry = source_entries[baseline_id]
            tracks = source["ckt"]["tracks"][baseline_id]
            exact_metrics = {
                "v5": source["ensembleV5"]["values"][baseline_id]["score"],
                "v4": source["ensembleV4"]["values"][baseline_id]["score"],
                "v6": source["ensembleV6"]["values"][baseline_id]["score"],
                "dailyMX": summary["dailyMX"],
                "tracks": {
                    name: compact_track(tracks[name])
                    for name in ("S2", "C2", "C4-Snow", "W4-Snow", "WX-Snow-12")
                },
                "verification": {"engine": "frozen R11 source entry"},
            }
            assert entry["initialMap"] == candidate["initialMap"]
            assert entry["finalMap"] == candidate["finalMap"]

        cut_metrics = {}
        for cut in CUTS:
            metric = collision["cuts"][str(cut)]["stage4Baseline"]
            cut_metrics[str(cut)] = {
                key: metric[key]
                for key in (
                    "crossAffectedRate", "crossFirstChoiceLossRate", "crossBuckets",
                    "collisionBuckets", "maxBucket",
                )
            }
        average_cross = sum(row["crossAffectedRate"] for row in cut_metrics.values()) / len(CUTS)
        average_loss = sum(row["crossFirstChoiceLossRate"] for row in cut_metrics.values()) / len(CUTS)
        baseline_cuts = [baseline_collision["cuts"][str(cut)]["stage4Baseline"] for cut in CUTS]
        baseline_average_cross = sum(row["crossAffectedRate"] for row in baseline_cuts) / len(CUTS)
        baseline_average_loss = sum(row["crossFirstChoiceLossRate"] for row in baseline_cuts) / len(CUTS)
        rows.append({
            "id": stable_id,
            "label": label,
            "sourceCandidate": candidate_id,
            "capacity": [21, 28],
            "actual": [21, summary["actualR"]],
            "common399Unique": summary["U"],
            "M": summary["M"],
            "D": summary["D"],
            "V": summary["V"],
            "toneKeys": candidate["toneKeys"],
            "initialMap": candidate["initialMap"],
            "finalMap": candidate["finalMap"],
            "performance": exact_metrics,
            "fourCodeCollision": {
                "families": ["AUAU", "AAAU", "AAAA"],
                "cuts": cut_metrics,
                "fiveCutAverageCrossAffectedRate": average_cross,
                "fiveCutAverageCrossFirstChoiceLossRate": average_loss,
                "relativeCrossAffectedVsBaseline": average_cross / baseline_average_cross - 1,
                "relativeCrossFirstChoiceLossVsBaseline": average_loss / baseline_average_loss - 1,
            },
            "performanceRelativeToBaseline": {
                "S2": exact_metrics["tracks"]["S2"]["upperMs"] / baseline_summary["S2"] - 1,
                "v5": exact_metrics["v5"] / baseline_summary["v5"] - 1,
                "v4": exact_metrics["v4"] / baseline_summary["v4"] - 1,
                "v6": exact_metrics["v6"] / baseline_summary["v6"] - 1,
                "dailyMX": exact_metrics["dailyMX"] / baseline_summary["dailyMX"] - 1,
            },
        })

    output = {
        "status": "research frontier; not a released schema mapping",
        "method": {
            "performance": "frozen R11 original 20-track JS engine; lower v4/v5/v6/CKT is better, higher dailyMX is better",
            "collision": "real Snow dictionaries; exact AUAU/AAAU/AAAA cross-family replay at Top 500/1k/2k/5k/10k",
            "constraints": [
                "Common399 399/399 unique",
                "integral one-key finals",
                "comma and period only as U keys",
                "fixed IEUAO auxiliary order",
                "V unrestricted",
            ],
        },
        "inputSha256": input_hashes,
        "schemes": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.output} with {len(rows)} schemes")


if __name__ == "__main__":
    main()
