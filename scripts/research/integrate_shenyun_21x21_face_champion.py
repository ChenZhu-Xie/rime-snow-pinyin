#!/usr/bin/env python3
"""Add the verified multi-pole M41/D1 champion to the R11 HTML atlas."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import (
    DATA, DEFAULT_HTML, DEFAULT_REPLAY, PATH_NAMES, TRACK_NAMES,
    load_benchmark, load_module, new_entry,
)
from integrate_shenyun_21x21_between_finalists import audit_underlines, shifted_initials

IDENT = "BPK-e12a551b29f1"
SOURCE = "shenyun-21x21-b-paths-b3-key-polish.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--replay", type=Path, default=DEFAULT_REPLAY)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    benchmark_path, replay = args.benchmark.resolve(), args.replay.resolve()
    html = benchmark_path.read_text(encoding="utf-8")
    old = load_module("old_21x21_integrator", Path(__file__).with_name("integrate_shenyun_21x21_low_miss.py"))
    helper = old.load_helper(benchmark_path)
    data, body, end = helper.extract_payload(html)
    existing_ids = {entry["id"] for entry in data["entries"]}
    if IDENT in existing_ids:
        raise ValueError(f"Already integrated: {IDENT}")
    before = helper.preservation_snapshot(data, existing_ids)

    row = next(row for row in json.loads((DATA / SOURCE).read_text(encoding="utf-8"))["results"]
               if row["id"] == IDENT)
    scored = json.loads((replay / "exact" / f"{IDENT}.json").read_text(encoding="utf-8"))
    benchmark, fast = load_benchmark(replay)
    import numpy as np
    expected = benchmark.opt.toentry(np.array(row["state"], dtype=np.int32), benchmark.DATA, IDENT)
    assert scored["entry"]["codeList"] == expected["codeList"]
    assert abs(scored["tracks"]["S2"]["upperMs"] - row["S2ms"]) < 1e-8
    assert abs(scored["scores"]["ensembleV5"]["score"] - row["v5"]) < 1e-8

    entry = new_entry(helper, scored, row, "多极点韵母面优胜")
    entry["subfamily"] = "AVUIO 锁定·多极点韵母面"
    entry["source"] = "M41/D1 multi-pole face search; frozen R11 original 20-track replay"
    entry["notes"].append("One shifted ordinary initial is underlined on the keyboard; see initialMap for its physical key.")
    assert shifted_initials(entry) == {"j": "F"}
    values = fast.score(entry["codeList"])
    reference = data["bPathBenchmark"]["referenceS005"]
    for key in PATH_NAMES:
        assert abs(values[key] - row[key]) < 1e-12, key
        assert values[key] < reference[key], key
    entry["bPathMetrics"] = values

    data = old.integrate_colliding(helper, data, [entry], {IDENT: scored}, replay)
    helper.integrate_macroxue(data, [entry], replay)
    assert before == helper.preservation_snapshot(data, existing_ids)
    for key, track in TRACK_NAMES.items():
        assert abs(values[key] - data["ckt"]["tracks"][IDENT][track]["miss"]) < 1e-10, key
    data["r11Research"]["counts"]["postR11ResearchExtensions"] += 1
    data["r11Research"]["scopeRows"].append([
        "Snow Shenyun AVUIO-locked 21x21 multi-pole face champion",
        "BPK-e12a551b29f1; M41/D1; eight B paths below S005; original R11 20-track replay",
    ])
    data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    data["bPathBenchmark"]["schemeCount"] += 1
    data["bPathBenchmark"]["selectedSources"].append(SOURCE)
    audit = audit_underlines(data, html)
    assert IDENT in data["ensembleV6"]["values"]
    assert IDENT in data["macroxue"]["values"]

    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8")
    encoded = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")
    output = (args.output or benchmark_path).resolve()
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(html[:body] + encoded + html[end:], encoding="utf-8")
    temporary.replace(output)
    print(json.dumps({"output": str(output), "catalogue": len(data["entries"]),
                      "scheme": IDENT, "eightB": values, "underlines": audit}, ensure_ascii=False))


if __name__ == "__main__":
    main()
