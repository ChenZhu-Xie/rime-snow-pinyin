#!/usr/bin/env python3
"""Add four M41/D1 cross-basin finalists to the R11 HTML atlas."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import (
    DATA, DEFAULT_HTML, DEFAULT_REPLAY, PATH_NAMES, TRACK_NAMES,
    load_benchmark, load_module, new_entry,
)

IDS = (
    "BPK-15096e3d18ee",  # fastest S2
    "BPK-6e41384de9ef",  # best v5
    "BPK-e082fecc42d0",  # wider eight-path margin
    "BPK-d363896809ab",  # lowest Pmax
)
ORDINARY = frozenset("bpmfdtnlgkhjqxrzcs")


def shifted_initials(entry: dict) -> dict[str, str]:
    return {initial: key for initial, key in (entry.get("initialMap") or {}).items()
            if len(initial) == 1 and initial in ORDINARY and key != initial.upper()}


def audit_underlines(data: dict, html: str) -> dict:
    """The keyboard draws underlines from non-direct roles, not literal '_' data."""
    assert "function directOnset(k,s)" in html
    assert "ks.roles.filter(s=>!directOnset(k,s))" in html
    assert 'class="pub-nonidentity" text-decoration="underline"' in html
    checked = 0
    schemes = 0
    for entry in data["entries"]:
        shifted = shifted_initials(entry)
        if not shifted:
            continue
        schemes += 1
        for initial, key in shifted.items():
            assert initial in entry["roles"][key], (entry["id"], initial, key)
            # An ordinary one-letter initial on another key passes the renderer's
            # !directOnset filter and is printed with SVG underline decoration.
            assert initial.upper() != key
            checked += 1
    return {"schemes": schemes, "shiftedInitials": checked}


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
    before_ids = {entry["id"] for entry in data["entries"]}
    assert all(ident not in before_ids for ident in IDS), "Finalists already integrated"
    before = helper.preservation_snapshot(data, before_ids)
    results = {row["id"]: row for row in json.loads(
        (DATA / "shenyun-21x21-b-paths-between-finalists.json").read_text(encoding="utf-8"))["results"]}
    benchmark, fast = load_benchmark(replay)
    entries, exact = [], {}
    import numpy as np
    for ident in IDS:
        row = results[ident]
        scored = json.loads((replay / "exact" / f"{ident}.json").read_text(encoding="utf-8"))
        expected = benchmark.opt.toentry(np.array(row["state"], dtype=np.int32), benchmark.DATA, ident)
        assert scored["entry"]["codeList"] == expected["codeList"], ident
        assert abs(scored["tracks"]["S2"]["upperMs"] - row["S2ms"]) < 1e-8
        entry = new_entry(helper, scored, row, "M41/D1 跨盆地")
        entry["subfamily"] = "AVUIO 锁定·M41/D1 负载性能交汇"
        entry["source"] = "M41/D1 cross-basin finalists; frozen R11 original 20-track replay"
        entry["notes"].append("Shifted ordinary initial is underlined on the keyboard; see initialMap for its physical key.")
        assert len(shifted_initials(entry)) == 1, ident
        values = fast.score(entry["codeList"])
        for key in PATH_NAMES:
            assert abs(values[key] - row[key]) < 1e-12, (ident, key)
        entry["bPathMetrics"] = values
        entries.append(entry)
        exact[ident] = scored
    data = old.integrate_colliding(helper, data, entries, exact, replay)
    helper.integrate_macroxue(data, entries, replay)
    assert before == helper.preservation_snapshot(data, before_ids)
    for entry in entries:
        ident = entry["id"]
        for key, track in TRACK_NAMES.items():
            assert abs(entry["bPathMetrics"][key] - data["ckt"]["tracks"][ident][track]["miss"]) < 1e-10
    data["r11Research"]["counts"]["postR11ResearchExtensions"] += len(entries)
    scope = ["Snow Shenyun AVUIO-locked 21x21 cross-basin M41/D1 finalists",
             "four finalists: fastest S2, lowest v5, wider B-path margin, lowest Pmax"]
    if scope not in data["r11Research"]["scopeRows"]:
        data["r11Research"]["scopeRows"].append(scope)
    data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    data["bPathBenchmark"]["schemeCount"] += len(entries)
    data["bPathBenchmark"]["selectedSources"].append("shenyun-21x21-b-paths-between-finalists.json")
    audit = audit_underlines(data, html)
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8")
    encoded = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")
    output = (args.output or benchmark_path).resolve()
    temp = output.with_name(output.name + ".tmp")
    temp.write_text(html[:body] + encoded + html[end:], encoding="utf-8")
    temp.replace(output)
    print(json.dumps({"output": str(output), "catalogue": len(data["entries"]),
                      "newSchemes": list(IDS), "underlines": audit}, ensure_ascii=False))


if __name__ == "__main__":
    main()
