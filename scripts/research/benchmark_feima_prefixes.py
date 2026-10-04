#!/usr/bin/env python3
"""Measure Feima-style AUBB/AAA(U)BB refinement on Snow Pinyin corpora.

This is a research helper, not a generator for released schema files.  It
combines a 21x28 layout description with the local Shengbi Feima character
stems.  Results are emitted as JSON on stdout.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path


CUTS = (500, 1000, 2000, 5000, 10000)
CONSONANTS = ("b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s")
PARSER = tuple(sorted(CONSONANTS, key=len, reverse=True))
YU = {"yu", "yuan", "yue", "yun"}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--layouts", type=Path, required=True)
    parser.add_argument("--stems", type=Path, required=True)
    parser.add_argument("--pinyin", type=Path, required=True)
    parser.add_argument("--ids", nargs="*", help="optional layout IDs to retain")
    parser.add_argument("--output", type=Path, help="write JSON here instead of stdout")
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def split_pinyin(value: str) -> tuple[str, str]:
    py = re.sub(r"[0-9]+$", "", value.lower())
    if py[0] in "aeo":
        return py[0].upper(), py
    if py.startswith("y"):
        head = "YU" if py in YU else "Y"
        final = py[1:]
    elif py.startswith("w"):
        head, final = "W", py[1:]
    else:
        head = next((candidate for candidate in PARSER if py.startswith(candidate)), "")
        if not head:
            raise ValueError(value)
        final = py[len(head) :]
    if head in {"j", "q", "x", "Y", "YU"} and final.startswith("u"):
        final = "v" + final[1:]
    if not final:
        raise ValueError(value)
    return head, final


def read_words(paths: list[Path]) -> dict[int, list[dict]]:
    merged: dict[str, dict] = {}
    for path in paths:
        body = False
        with path.open("r", encoding="utf-8-sig") as stream:
            for raw in stream:
                line = raw.rstrip("\r\n")
                if not body:
                    body = line.strip() == "..."
                    continue
                if not line or line.startswith("#"):
                    continue
                fields = line.split("\t")
                if len(fields) not in (2, 3):
                    continue
                word, reading = fields[:2]
                chars = list(word)
                if len(chars) not in (2, 3, 4):
                    continue
                syllables = tuple(reading.split())
                if len(syllables) != len(chars):
                    continue
                try:
                    weight = float(fields[2].removesuffix("%")) if len(fields) == 3 and fields[2] else 0.0
                except ValueError:
                    continue
                row = merged.setdefault(word, {"word": word, "weight": weight, "readings": set()})
                row["weight"] = max(row["weight"], weight)
                row["readings"].add(syllables)
    result: dict[int, list[dict]] = {2: [], 3: [], 4: []}
    for row in merged.values():
        row["readings"] = sorted(row["readings"])
        result[len(row["word"])].append(row)
    for length in result:
        result[length].sort(key=lambda row: (-row["weight"], row["word"]))
    return result


def read_stems(path: Path) -> dict[str, set[str]]:
    answer: dict[str, set[str]] = defaultdict(set)
    body = False
    with path.open("r", encoding="utf-8-sig") as stream:
        for raw in stream:
            line = raw.rstrip("\r\n")
            if not body:
                body = line.strip() == "..."
                continue
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) < 4 or len(fields[0]) != 1:
                continue
            stem = fields[3].strip().lower()
            if len(stem) >= 4 and stem[2] in "aeuio" and stem[3] in "aeuio":
                answer[fields[0]].add(stem[2:4])
    return answer


def read_single_pinyin(path: Path) -> list[dict]:
    merged: dict[str, dict] = {}
    body = False
    with path.open("r", encoding="utf-8-sig") as stream:
        for raw in stream:
            line = raw.rstrip("\r\n")
            if not body:
                body = line.strip() == "..."
                continue
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) < 2 or len(fields[0]) != 1:
                continue
            try:
                weight = float(fields[2]) if len(fields) >= 3 and fields[2] else 0.0
            except ValueError:
                weight = 0.0
            row = merged.setdefault(fields[0], {"word": fields[0], "weight": weight, "readings": set()})
            row["weight"] = max(row["weight"], weight)
            row["readings"].add((fields[1],))
    answer = []
    for row in merged.values():
        row["readings"] = sorted(row["readings"])
        answer.append(row)
    answer.sort(key=lambda row: (-row["weight"], row["word"]))
    return answer


def encode_reading(reading: tuple[str, ...], layout: dict) -> list[tuple[str, str]] | None:
    encoded = []
    for syllable in reading:
        try:
            head, final = split_pinyin(syllable)
            encoded.append((layout["initialMap"][head], layout["finalMap"][final]))
        except (KeyError, ValueError):
            return None
    return encoded


def build_items(rows: list[dict], layout: dict, stems: dict[str, set[str]], length: int) -> list[dict]:
    items = []
    for row in rows:
        stages: dict[str, set[str]] = defaultdict(set)
        suffixes = stems.get(row["word"][0], set())
        for reading in row["readings"]:
            encoded = encode_reading(reading, layout)
            if not encoded:
                continue
            if length == 1:
                a, u = encoded[0]
                stages["AU"].add(a + u)
                for suffix in suffixes:
                    stages["AUB"].add(a + u + suffix[0])
                    stages["AUBB"].add(a + u + suffix)
            elif length == 2:
                stages["AUAU"].add("".join(key for pair in encoded for key in pair))
            elif length == 3:
                aaa = "".join(pair[0] for pair in encoded)
                aaau = aaa + encoded[2][1]
                stages["AAA"].add(aaa)
                stages["AAAU"].add(aaau)
                for suffix in suffixes:
                    stages["AAAUBB"].add(aaau + suffix)
            else:
                stages["AAAA"].add("".join(pair[0] for pair in encoded))
        items.append({"word": row["word"], "weight": row["weight"], "stages": stages})
    return items


def stage_metrics(items: list[dict], stage: str) -> dict:
    covered = [(index, item) for index, item in enumerate(items) if item["stages"].get(stage)]
    buckets: dict[str, set[int]] = defaultdict(set)
    for index, item in covered:
        for code in item["stages"][stage]:
            buckets[code].add(index)
    winners = {}
    for code, members in buckets.items():
        winners[code] = min(members, key=lambda index: (-items[index]["weight"], items[index]["word"]))
    total_weight = sum(item["weight"] for _, item in covered)
    unresolved_weight = 0.0
    first_loss_weight = 0.0
    for index, item in covered:
        codes = item["stages"][stage]
        if all(len(buckets[code]) > 1 for code in codes):
            unresolved_weight += item["weight"]
        if all(winners[code] != index for code in codes):
            first_loss_weight += item["weight"]
    collision_buckets = [members for members in buckets.values() if len(members) > 1]
    return {
        "covered": len(covered),
        "coverage": len(covered) / len(items) if items else 0.0,
        "weight": total_weight,
        "unresolvedWeightRate": unresolved_weight / total_weight if total_weight else 0.0,
        "firstChoiceLossRate": first_loss_weight / total_weight if total_weight else 0.0,
        "collisionBuckets": len(collision_buckets),
        "maxBucket": max((len(members) for members in buckets.values()), default=0),
    }


def prefix_interference(singles: list[dict], triples: list[dict]) -> dict:
    single2 = {code for item in singles for code in item["stages"].get("AU", ())}
    single3 = {code for item in singles for code in item["stages"].get("AUB", ())}
    single4 = {code for item in singles for code in item["stages"].get("AUBB", ())}
    covered = [item for item in triples if item["stages"].get("AAA")]
    total_weight = sum(item["weight"] for item in covered)

    def rate(stage: str, singles_at_length: set[str], prefix_length: int) -> float:
        affected = 0.0
        for item in covered:
            codes = item["stages"].get(stage, set())
            if codes and all(code[:prefix_length] in singles_at_length for code in codes):
                affected += item["weight"]
        return affected / total_weight if total_weight else 0.0

    return {
        "needsThirdKeyRate": rate("AAA", single2, 2),
        "threeKeyExactPrefixRate": rate("AAA", single3, 3),
        "fourKeyExactCodeRate": rate("AAAU", single4, 4),
    }


def combined_metrics(families: dict[str, tuple[list[dict], str]]) -> tuple[dict, dict[str, set[int]]]:
    buckets: dict[str, set[tuple[str, int]]] = defaultdict(set)
    for family, (items, stage) in families.items():
        for index, item in enumerate(items):
            for code in item["stages"].get(stage, ()):
                buckets[code].add((family, index))
    winners: dict[str, tuple[str, int]] = {}
    for code, members in buckets.items():
        winners[code] = min(
            members,
            key=lambda member: (-families[member[0]][0][member[1]]["weight"], families[member[0]][0][member[1]]["word"]),
        )
    resolved: dict[str, set[int]] = defaultdict(set)
    by_family = {}
    total_weight = 0.0
    total_loss = 0.0
    cross_weight = 0.0
    cross_loss = 0.0
    for family, (items, stage) in families.items():
        family_weight = family_loss = family_cross = family_cross_loss = 0.0
        for index, item in enumerate(items):
            codes = item["stages"].get(stage, set())
            if not codes:
                continue
            weight = item["weight"]
            family_weight += weight
            code_cross = {
                code: len({member[0] for member in buckets[code]}) > 1 for code in codes
            }
            is_winner = any(winners[code] == (family, index) for code in codes)
            if is_winner:
                resolved[family].add(index)
            else:
                family_loss += weight
            if all(code_cross.values()):
                family_cross += weight
                if not is_winner:
                    family_cross_loss += weight
        total_weight += family_weight
        total_loss += family_loss
        cross_weight += family_cross
        cross_loss += family_cross_loss
        by_family[family] = {
            "covered": sum(bool(item["stages"].get(stage)) for item in items),
            "firstChoiceLossRate": family_loss / family_weight if family_weight else 0.0,
            "crossAffectedRate": family_cross / family_weight if family_weight else 0.0,
            "crossFirstChoiceLossRate": family_cross_loss / family_weight if family_weight else 0.0,
        }
    collision_buckets = [members for members in buckets.values() if len(members) > 1]
    cross_buckets = [members for members in buckets.values() if len({member[0] for member in members}) > 1]
    return ({
        "totalWeight": total_weight,
        "firstChoiceLossWeight": total_loss,
        "crossAffectedWeight": cross_weight,
        "crossFirstChoiceLossWeight": cross_loss,
        "firstChoiceLossRate": total_loss / total_weight if total_weight else 0.0,
        "crossAffectedRate": cross_weight / total_weight if total_weight else 0.0,
        "crossFirstChoiceLossRate": cross_loss / total_weight if total_weight else 0.0,
        "collisionBuckets": len(collision_buckets),
        "crossBuckets": len(cross_buckets),
        "maxBucket": max((len(members) for members in buckets.values()), default=0),
        "byFamily": by_family,
    }, resolved)


def main() -> None:
    args = arguments()
    dictionary_paths = [args.repo / f"snow_pinyin.{name}.dict.yaml" for name in ("base", "ext", "tencent")]
    words = read_words(dictionary_paths)
    words[1] = read_single_pinyin(args.pinyin)
    stems = read_stems(args.stems)
    layout_payload = json.loads(args.layouts.read_text(encoding="utf-8"))
    if isinstance(layout_payload, dict):
        layouts = layout_payload.get("candidates") or layout_payload.get("schemes", [])
    else:
        layouts = layout_payload
    if args.ids:
        requested = set(args.ids)
        layouts = [layout for layout in layouts if layout["id"] in requested]
        missing = requested - {layout["id"] for layout in layouts}
        if missing:
            raise ValueError(f"layout IDs not found: {sorted(missing)}")
    output = {
        "inputs": {
            path.name: sha256(path) for path in [*dictionary_paths, args.layouts, args.stems, args.pinyin]
        },
        "wordCounts": {str(length): len(rows) for length, rows in words.items()},
        "stemCharacters": len(stems),
        "cuts": CUTS,
        "layouts": [],
    }
    for layout in layouts:
        singles = build_items(words[1], layout, stems, 1)
        doubles = build_items(words[2], layout, stems, 2)
        triples = build_items(words[3], layout, stems, 3)
        quadruples = build_items(words[4], layout, stems, 4)
        result = {
            "id": layout["id"],
            "name": layout.get("name", layout.get("label", layout["id"])),
            "cuts": {},
        }
        for cut in CUTS:
            single_cut = singles[:cut]
            double_cut = doubles[:cut]
            triple_cut = triples[:cut]
            quadruple_cut = quadruples[:cut]
            stage3, resolved3 = combined_metrics({
                "single": (single_cut, "AUB"),
                "triple": (triple_cut, "AAA"),
            })
            triple_residual = [item for index, item in enumerate(triple_cut) if index not in resolved3["triple"]]
            stage4_baseline, _ = combined_metrics({
                "double": (double_cut, "AUAU"),
                "triple": (triple_cut, "AAAU"),
                "quadruple": (quadruple_cut, "AAAA"),
            })
            stage4_routed, _ = combined_metrics({
                "double": (double_cut, "AUAU"),
                "triple": (triple_residual, "AAAU"),
                "quadruple": (quadruple_cut, "AAAA"),
            })
            stage4_routed["crossAffectedRateAll234"] = (
                stage4_routed["crossAffectedWeight"] / stage4_baseline["totalWeight"]
                if stage4_baseline["totalWeight"] else 0.0
            )
            stage4_routed["crossFirstChoiceLossRateAll234"] = (
                stage4_routed["crossFirstChoiceLossWeight"] / stage4_baseline["totalWeight"]
                if stage4_baseline["totalWeight"] else 0.0
            )
            result["cuts"][str(cut)] = {
                "single": {stage: stage_metrics(single_cut, stage) for stage in ("AU", "AUB", "AUBB")},
                "triple": {stage: stage_metrics(triple_cut, stage) for stage in ("AAA", "AAAU", "AAAUBB")},
                "singleTriple": prefix_interference(singles, triple_cut),
                "stage3SingleTriple": stage3,
                "stage4Baseline": stage4_baseline,
                "stage4AfterStage3Top": stage4_routed,
                "stage3Resolved": {
                    "single": len(resolved3["single"]),
                    "triple": len(resolved3["triple"]),
                },
                "tripleResidualAAAUBB": stage_metrics(triple_residual, "AAAUBB"),
            }
        output["layouts"].append(result)
    rendered = json.dumps(output, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
