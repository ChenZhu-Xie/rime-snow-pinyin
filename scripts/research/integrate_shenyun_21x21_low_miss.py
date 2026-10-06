#!/usr/bin/env python3
"""Add reviewed AVUIO-locked 21x21 layouts to the local R11 benchmark atlas."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
DEFAULT_BENCHMARK = Path(
    r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html"
)
DEFAULT_REPLAY = Path(os.environ.get("TEMP", "")) / "rime-21x21-search/R11_integrated_replay"
SOURCE_SHA256 = "9fe09dd63e8025b27f7c520dfb303afdac9863f6efaa902d71e2913768fd9458"

# The current R9 is already in the page and represents M40/D0. Each row below
# is a distinct, fully scored outcome from the bounded AVUIO-locked search.
CANDIDATES = (
    ("shenyun-21x21-low-m41-balanced-exact.json", "21×21低重码·M41/D1·均衡"),
    ("shenyun-21x21-low-m42-balanced-exact.json", "21×21低重码·M42/D2·均衡"),
    ("shenyun-21x21-low-m42-fast-exact.json", "21×21低重码·M42/D2·速度"),
    ("shenyun-21x21-low-m42-miss-exact.json", "21×21低重码·M42/D2·更低非首选"),
    ("shenyun-21x21-low-miss-m43-exact.json", "21×21低重码·M43/D2·五项领先"),
    ("shenyun-21x21-low-miss-exact.json", "21×21低重码·M44/D3·五项领先"),
    ("shenyun-21x21-low-miss-near-load-exact.json", "21×21低重码·M44/D3·近负载"),
    ("shenyun-21x21-low-miss-max-speed-exact.json", "21×21低重码·M44/D3·极致速度"),
)


def load_helper(benchmark: Path):
    helper_path = benchmark.parent / "tools/integrate_shenyun_21x28.py"
    sys.path.insert(0, str(helper_path.parent))
    spec = importlib.util.spec_from_file_location("r11_integration", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load R11 integration helper: {helper_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_entry(helper, source: dict, scored: dict, name: str) -> dict:
    entry = copy.deepcopy(scored["entry"])
    scheme_id = entry["id"]
    assert scheme_id == scored["id"]
    assert entry["tone"] == "IVUAO" and entry["capacity"] == [21, 21]
    assert len(entry["codeList"]) == len(source["pinyin"])
    assert all(key not in "AVUIO" for code in entry["codeList"] if code for key in code)
    assert scored["fair"]["S2miss"] < source["ckt"]["tracks"]["S005"]["S2"]["miss"]

    metrics = entry.pop("searchMetrics", None) or entry.pop("sourceMetrics", None)
    entry.pop("sourceMetrics", None)
    if metrics is None:
        raise ValueError(f"Missing M/D source metrics for {scheme_id}")
    entry.pop("searchTraceIndex", None)
    memory = metrics["M"]
    displaced = metrics["D"]
    codes_digest = hashlib.sha256(
        json.dumps(entry["codeList"], ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    entry.update({
        "name": name,
        "family": "Snow Shenyun 21x21",
        "subfamily": "AVUIO 锁定·低加权音节非首选",
        "source": "2026-10-06 bounded 21x21 low-miss search; original R11 20-track replay",
        "new": True,
        "roles": helper.onset_roles(entry["initialMap"]),
        "zeroOnsetScope": helper.zero_onset_scope(entry),
        "rhymes": helper.inverse(entry["finalMap"]),
        "reservedKeys": "AVUIO",
        "auxiliaryClass": "AVUIO",
        "defaultAuxOrder": False,
        "auxiliaryMappingMatchesReservation": True,
        "topgongReserve": "AVUIO",
        "topgongValid": True,
        "strictTopgong": True,
        "exceptionCount": 0,
        "searchMemoryNoTone": memory,
        "mappingAudit": {
            "scope": "Common399; 21x21; fixed AVUIO auxiliary keys",
            "codeListSha256": codes_digest,
            "ordinaryInitialDisplacements": displaced,
            "baseFinalDisplacements": 5,
            "aaVacancies": None,
        },
        "r11Provenance": {
            "parent": "R9-21X21-M40-02",
            "kind": "post-R11 AVUIO-locked low-collision research extension",
            "soundLayout": scheme_id,
        },
        "notes": [
            f"21x21; M{memory}, D{displaced}, V5; fixed AVUIO physical auxiliary keys.",
            f"Frequency-weighted S2 nonfirst {100 * scored['fair']['S2miss']:.4f}%; original 20-track engine.",
        ],
    })
    return entry


def integrate_colliding(helper, data: dict, entries: list[dict], exact: dict, replay: Path) -> dict:
    """Adapt the R11 integration path for ordinary two-key syllable collisions."""
    sys.path.insert(0, str(replay))
    import logic
    import memory_r2
    import metrics_r8
    import pair_eval_r8

    existing_ids = {entry["id"] for entry in data["entries"]}
    previous_v6 = copy.deepcopy(data["ensembleV6"]["values"])
    versions = ("ensemble", "ensembleV2", "ensembleV3", "ensembleV4", "ensembleV5")
    for entry in entries:
        scheme_id = entry["id"]
        scored = exact[scheme_id]
        audit = memory_r2.audit(data, entry)
        unique = scored["fair"]["unique399"]
        assert audit["M"] == entry["searchMemoryNoTone"]
        assert audit["ordinaryDisplacedCount"] == entry["mappingAudit"]["ordinaryInitialDisplacements"]
        assert audit["unique"] == unique
        entry["memoryAuditR2"] = audit
        entry["memoryAuditNF4"] = copy.deepcopy(audit)
        entry["memory"] = {
            "firstLinks": audit["firstLinks"],
            "finalLinks": audit["finalLinks"],
            "nontrivialFinals": audit["finalLinks"],
            "toneLinks": 5,
            "conditionalBranches": audit["branchCount"],
            "commonNontrivial": audit["M"] + 5,
            "definition": "M-R2-explicit",
            "scope": audit["scope"],
        }
        entry["logicUniformity"] = logic.lu(entry)
        entry["logicAudit"] = logic.fa(entry)
        entry["sound"] = copy.deepcopy(scored["quick"][scheme_id + "|S2"])
        entry["sound"]["memory"] = audit["M"] + 5
        entry["metricVerification"] = scored["verification"]
        data["entries"].append(entry)
        for version in versions:
            data[version]["values"][scheme_id] = copy.deepcopy(scored["scores"][version])
            if "scoreCoverage" in data[version]:
                data[version]["scoreCoverage"] = len(data["entries"])
        for key, value in scored["quick"].items():
            value["memory"] = audit["M"] + 5
            data["quick"][key] = value
        data["ckt"]["tracks"][scheme_id] = scored["tracks"]
        data["ckt"]["eligibility"][scheme_id] = {
            "eligible": False,
            "unique399": unique,
            "actualI": entry["actual"][0],
            "actualR": entry["actual"][1],
            "reasons": ["Common399 bare two-key codes have syllable collisions; fair completion is scored separately."],
        }
        data["fairCKT"]["values"][scheme_id] = scored["fair"]
        data["finalSelection"]["factorAuditValues"][scheme_id] = entry["logicAudit"]

    data["r11LoadSummaries"] = {
        entry["id"]: helper.load_summary(data, entry["id"]) for entry in data["entries"]
    }
    data["r9LoadSummaries"] = data["r11LoadSummaries"]
    recomputed_v6 = metrics_r8.compute(data)
    for scheme_id in existing_ids:
        if scheme_id in previous_v6:
            recomputed_v6["values"][scheme_id] = previous_v6[scheme_id]
    data["ensembleV6"] = recomputed_v6
    old_cwd = Path.cwd()
    try:
        os.chdir(replay)
        data["r11PairMetrics"] = pair_eval_r8.compute(data)
    finally:
        os.chdir(old_cwd)
    data["r11PairMetrics"]["verification"].pop("seconds", None)
    data["r9PairMetrics"] = data["r11PairMetrics"]

    for entry in entries:
        scheme_id = entry["id"]
        codes = [entry["codeList"][index] for index, _ in data["base"]]
        first = {code[0] for code in codes}
        second = {code[1] for code in codes}
        eligibility = {
            "comparable": True,
            "commonCovered": 399,
            "twoKey": True,
            "supported34": True,
            "capacityOK": len(first) <= 21 and len(second) <= 21,
            "requiredReservationOK": True,
            "historicalDomainValid": True,
            "actualFirstCommon": len(first),
            "actualSecondCommon": len(second),
            "declaredCapacity": [21, 21],
            "unique399": len(set(codes)),
            "reasonCodes": [],
            "historicalReferenceEligible": False,
        }
        data["r11Eligibility"][scheme_id] = eligibility
        data["r10Eligibility"][scheme_id] = copy.deepcopy(eligibility)

    data["finalSelection"]["currentCatalogueCount"] = len(data["entries"])
    research = data["r11Research"]
    research["counts"]["current"] = len(data["entries"])
    for entry in entries:
        scheme_id = entry["id"]
        research["results"].append({
            "id": scheme_id,
            "domain": "21x21",
            "name": entry["name"],
            "M": entry["memoryAuditR2"]["M"],
            "D": entry["memoryAuditR2"]["ordinaryDisplacedCount"],
            "V": 5,
            "tone": entry["tone"],
            "unique": entry["memoryAuditR2"]["unique"],
            "S2": data["ckt"]["tracks"][scheme_id]["S2"]["upperMs"],
            "v6": data["ensembleV6"]["values"][scheme_id],
            **helper.load_summary(data, scheme_id),
        })
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_BENCHMARK)
    parser.add_argument("--replay", type=Path, default=DEFAULT_REPLAY)
    parser.add_argument("--output", type=Path, help="Write a review copy instead of replacing the benchmark")
    args = parser.parse_args()

    current_bytes = args.benchmark.read_bytes()
    helper = load_helper(args.benchmark)
    html = current_bytes.decode("utf-8")
    data, body, end = helper.extract_payload(html)
    original_ids = {entry["id"] for entry in data["entries"]}
    exact = {}
    entries = []
    for filename, name in CANDIDATES:
        scored = json.loads((HERE / "research-notes/data" / filename).read_text(encoding="utf-8"))
        entry = make_entry(helper, data, scored, name)
        exact[entry["id"]] = scored
        entries.append(entry)
    candidate_ids = {entry["id"] for entry in entries}
    if len(candidate_ids) != len(entries):
        raise ValueError("The representative list contains a duplicate scheme")
    if candidate_ids <= original_ids:
        print(f"Already integrated: {len(candidate_ids)} schemes in {args.benchmark}")
        return
    if candidate_ids & original_ids:
        raise ValueError("Only part of the candidate set is already integrated")
    if hashlib.sha256(current_bytes).hexdigest() != SOURCE_SHA256:
        raise ValueError("Benchmark snapshot changed before integration; review it first")
    if len(data["entries"]) != 524:
        raise ValueError("Expected the frozen 524-scheme R11 atlas")

    old_research_count = data["r11Research"]["counts"]["postR11ResearchExtensions"]
    updated = integrate_colliding(helper, data, entries, exact, args.replay)
    helper.integrate_macroxue(updated, entries, args.replay)
    updated["r11Research"]["counts"]["postR11ResearchExtensions"] = (
        old_research_count + len(entries)
    )
    scope = [
        "Snow Shenyun AVUIO-locked 21x21 low-collision representatives",
        "M41/D1, M42/D2, M43/D2, M44/D3; original R11 20-track replay",
    ]
    if scope not in updated["r11Research"]["scopeRows"]:
        updated["r11Research"]["scopeRows"].append(scope)
    updated["fourCodeCollisionBenchmark"]["catalogueCount"] = len(updated["entries"])

    assert len(updated["entries"]) == 524 + len(entries)
    assert all(entry["id"] in updated["macroxue"]["values"] for entry in entries)
    assert all(entry["id"] in updated["ensembleV6"]["values"] for entry in entries)
    for entry in entries:
        scheme_id = entry["id"]
        assert updated["ckt"]["tracks"][scheme_id]["S2"]["miss"] < (
            updated["ckt"]["tracks"]["S005"]["S2"]["miss"]
        )
        assert updated["fairCKT"]["values"][scheme_id]["unique399"] < 399

    raw = json.dumps(updated, ensure_ascii=False, separators=(",", ":")).replace(
        "</", "<\\/"
    ).encode("utf-8")
    encoded = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")
    result = html[:body] + encoded + html[end:]
    output = args.output or args.benchmark
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(result, encoding="utf-8")
    temporary.replace(output)
    print(json.dumps({
        "benchmark": str(output),
        "catalogue": len(updated["entries"]),
        "added": [entry["id"] for entry in entries],
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
