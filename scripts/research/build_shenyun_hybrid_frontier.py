#!/usr/bin/env python3
"""Build the curated artifact for the 21x28 hybrid-basin search."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


CUTS = (500, 1000, 2000, 5000, 10000)
SELECTIONS = (
    # stable ID, label, input set, candidate ID
    ("SHENYUN-OLD-180", "旧 180 空桶极端基线", "initial", "OB-R10X28-CAND-000"),
    ("SHENYUN-R10X28-D3-M38", "上一轮 R10 端 D3", "initial", "D3-R10X28-CAND-000"),
    ("SHENYUN-HYBRID-D4-M38", "第一轮性能侧 D4", "initial", "D4-R10X28-CAND-004"),
    ("SHENYUN-HYBRID-D4-M39", "局部加密性能前沿", "refined", "D4R-R10X28-CAND-001"),
    ("SHENYUN-HYBRID-D5-M41-FAST", "局部加密折中前沿", "refined", "OBR-R10X28-CAND-001"),
    ("SHENYUN-HYBRID-D5-M41-COLL", "第一轮碰撞侧前沿", "initial", "OB-R10X28-CAND-002"),
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--initial-layouts", type=Path, required=True)
    parser.add_argument("--initial-collisions", type=Path, required=True)
    parser.add_argument("--refined-layouts", type=Path, required=True)
    parser.add_argument("--refined-collisions", type=Path, required=True)
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


def main() -> None:
    args = arguments()
    paths = {
        "initialLayouts": args.initial_layouts,
        "initialCollisions": args.initial_collisions,
        "refinedLayouts": args.refined_layouts,
        "refinedCollisions": args.refined_collisions,
    }
    layouts = {
        "initial": by_id(json.loads(args.initial_layouts.read_text(encoding="utf-8-sig")), "candidates"),
        "refined": by_id(json.loads(args.refined_layouts.read_text(encoding="utf-8-sig")), "candidates"),
    }
    collisions = {
        "initial": by_id(json.loads(args.initial_collisions.read_text(encoding="utf-8-sig")), "layouts"),
        "refined": by_id(json.loads(args.refined_collisions.read_text(encoding="utf-8-sig")), "layouts"),
    }

    schemes = []
    for stable_id, label, input_set, candidate_id in SELECTIONS:
        candidate = layouts[input_set][candidate_id]
        collision = collisions[input_set][candidate_id]
        summary = candidate["summary"]
        cuts = {}
        for cut in CUTS:
            metric = collision["cuts"][str(cut)]["stage4Baseline"]
            cuts[str(cut)] = {
                key: metric[key]
                for key in (
                    "crossAffectedRate",
                    "crossFirstChoiceLossRate",
                    "crossBuckets",
                    "collisionBuckets",
                    "maxBucket",
                )
            }
        average_cross = sum(row["crossAffectedRate"] for row in cuts.values()) / len(CUTS)
        average_loss = sum(row["crossFirstChoiceLossRate"] for row in cuts.values()) / len(CUTS)
        schemes.append({
            "id": stable_id,
            "label": label,
            "sourceCandidate": candidate_id,
            "common399Unique": summary["U"],
            "capacity": [21, 28],
            "actual": [21, summary["actualR"]],
            "M": summary["M"],
            "D": summary["D"],
            "V": summary["V"],
            "performanceProxy": {
                key: summary[key]
                for key in ("S2", "v5", "v4", "v6", "dailyMX")
            },
            "vacancyProxy": {
                "aaVacancies": summary["aaVacancies"],
                "weightedAAHotspotSeparation": summary["weightedAAHotspotSeparation"],
            },
            "toneKeys": candidate["toneKeys"],
            "initialMap": candidate["initialMap"],
            "finalMap": candidate["finalMap"],
            "fourCodeCollision": {
                "families": ["AUAU", "AAAU", "AAAA"],
                "cuts": cuts,
                "fiveCutAverageCrossAffectedRate": average_cross,
                "fiveCutAverageCrossFirstChoiceLossRate": average_loss,
            },
        })

    output = {
        "status": "research frontier; not a released schema mapping",
        "method": {
            "search": "multi-start bounded annealing between the R10-derived and old 180-vacancy extremes",
            "performance": "frozen R11 factor replay used during search; lower S2/v4/v5/v6 is better, higher dailyMX is better",
            "collision": "real Snow dictionaries; exact AUAU/AAAU/AAAA cross-family replay at Top 500/1k/2k/5k/10k",
            "constraints": [
                "Common399 399/399 unique",
                "integral one-key finals",
                "comma and period only as U keys",
                "fixed IEUAO auxiliary order",
                "V unrestricted",
            ],
        },
        "inputSha256": {name: digest(path) for name, path in paths.items()},
        "schemes": schemes,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.output} with {len(schemes)} schemes")


if __name__ == "__main__":
    main()
