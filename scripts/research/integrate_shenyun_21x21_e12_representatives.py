#!/usr/bin/env python3
"""Add the six reviewed e12-to-D0 representatives to the R11 HTML atlas."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import (
    DATA,
    DEFAULT_HTML,
    DEFAULT_REPLAY,
    PATH_NAMES,
    TRACK_NAMES,
    load_benchmark,
    load_module,
    new_entry,
)
from integrate_shenyun_21x21_between_finalists import audit_underlines, shifted_initials

COHORTS = (
    ("BPC-86e7df755b03", "D2·八项逐项优于 e12"),
    ("BKP-b3bc7b878f2c", "D1·宽余量近速度"),
    ("BKP-3d3b0364453d", "D1·八项逐项优于 e12"),
    ("BPC-d9492d2a5588", "D1·较低系综当量"),
    ("BPC-33024eceb987", "D0·低八项比值"),
    ("BKP-e0048df69193", "D0·低八项比值补速"),
)
SOURCES = (
    "shenyun-21x21-b-paths-e12-contract-01.json",
    "shenyun-21x21-b-paths-e12-polish-01.json",
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--replay", type=Path, default=DEFAULT_REPLAY)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    benchmark_path, replay = args.benchmark.resolve(), args.replay.resolve()
    html = benchmark_path.read_text(encoding="utf-8")
    old = load_module(
        "old_21x21_integrator",
        Path(__file__).with_name("integrate_shenyun_21x21_low_miss.py"),
    )
    helper = old.load_helper(benchmark_path)
    data, body, end = helper.extract_payload(html)
    existing = {entry["id"] for entry in data["entries"]}
    wanted = {ident for ident, _ in COHORTS}
    if wanted & existing:
        raise ValueError(f"Already integrated: {sorted(wanted & existing)}")
    before = helper.preservation_snapshot(data, existing)
    initial_count = data["bPathBenchmark"]["schemeCount"]
    assert initial_count == sum(
        entry.get("capacity") == [21, 21] for entry in data["entries"]
    )

    source_rows = {}
    for name in SOURCES:
        payload = json.loads((DATA / name).read_text(encoding="utf-8"))
        source_rows.update({row["id"]: row for row in payload["results"]})
    benchmark, fast = load_benchmark(replay)
    import numpy as np

    entries, exact = [], {}
    reference = data["bPathBenchmark"]["referenceS005"]
    for ident, cohort in COHORTS:
        row = source_rows[ident]
        scored = json.loads(
            (replay / "exact" / f"{ident}.json").read_text(encoding="utf-8")
        )
        expected = benchmark.opt.toentry(
            np.array(row["state"], dtype=np.int32), benchmark.DATA, ident
        )
        assert scored["entry"]["codeList"] == expected["codeList"], ident
        assert abs(scored["tracks"]["S2"]["upperMs"] - row["S2ms"]) < 1e-8, ident
        assert abs(scored["scores"]["ensembleV4"]["score"] - row["v4"]) < 1e-8, ident
        assert abs(scored["scores"]["ensembleV5"]["score"] - row["v5"]) < 1e-8, ident
        assert (
            abs(
                max(track["rightPinky"] for track in scored["tracks"].values())
                - row["Pmax"]
            )
            < 1e-11
        )
        assert abs(scored["tracks"]["S2"]["home"] - row["homeS2"]) < 1e-11

        entry = new_entry(helper, scored, row, cohort)
        entry["subfamily"] = "AVUIO 锁定·e12 向 D0 收缩"
        entry["source"] = (
            "M<=43/D<=2 e12-to-D0 contraction; frozen R11 original 20-track replay"
        )
        rates = fast.score(entry["codeList"])
        for key in PATH_NAMES:
            assert abs(rates[key] - row[key]) < 1e-12, (ident, key)
        passes = all(rates[key] < reference[key] for key in PATH_NAMES)
        assert passes == (row["D"] > 0), ident
        entry["bPathMetrics"] = rates
        entry["notes"].append(
            "All eight weighted B-path rates beat S005."
            if passes
            else "Five of eight weighted B-path rates remain above S005; see bPathMetrics."
        )
        shifted = shifted_initials(entry)
        assert len(shifted) == row["D"], ident
        if shifted:
            entry["notes"].append(
                "Shifted ordinary initials are underlined on the keyboard; see initialMap."
            )
        entries.append(entry)
        exact[ident] = scored

    data = old.integrate_colliding(helper, data, entries, exact, replay)
    helper.integrate_macroxue(data, entries, replay)
    assert before == helper.preservation_snapshot(data, existing)
    for entry in entries:
        ident = entry["id"]
        for key, track in TRACK_NAMES.items():
            assert (
                abs(
                    entry["bPathMetrics"][key]
                    - data["ckt"]["tracks"][ident][track]["miss"]
                )
                < 1e-10
            )
        assert ident in data["ensembleV6"]["values"]
        assert ident in data["macroxue"]["values"]
    data["r11Research"]["counts"]["postR11ResearchExtensions"] += len(entries)
    data["r11Research"]["scopeRows"].append(
        [
            "Snow Shenyun AVUIO-locked 21x21 e12-to-D0 representatives",
            "Six layouts: D2/D1 eight-path winners, D1 ensemble point, D0 collision and speed points",
        ]
    )
    data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    data["bPathBenchmark"]["schemeCount"] += len(entries)
    data["bPathBenchmark"]["selectedSources"].extend(SOURCES)
    assert data["bPathBenchmark"]["schemeCount"] == initial_count + len(entries)
    assert data["bPathBenchmark"]["schemeCount"] == sum(
        entry.get("capacity") == [21, 21] for entry in data["entries"]
    )
    audit = audit_underlines(data, html)

    raw = (
        json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        .replace("</", "<\\/")
        .encode("utf-8")
    )
    encoded = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode(
        "ascii"
    )
    output = (args.output or benchmark_path).resolve()
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(html[:body] + encoded + html[end:], encoding="utf-8")
    temporary.replace(output)
    print(
        json.dumps(
            {
                "output": str(output),
                "catalogue": len(data["entries"]),
                "all21x21WithEightRates": data["bPathBenchmark"]["schemeCount"],
                "newSchemes": [entry["id"] for entry in entries],
                "underlines": audit,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
