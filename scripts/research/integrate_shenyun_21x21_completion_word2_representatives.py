#!/usr/bin/env python3
"""Integrate the five reviewed word-2 face-search representatives into R11."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
import subprocess
import tempfile
from pathlib import Path

from integrate_shenyun_21x21_b_paths import (
    DATA, DEFAULT_HTML, DEFAULT_REPLAY, PATH_NAMES, TRACK_NAMES,
    load_benchmark, load_module, new_entry, score_missing_exact,
)

IDS = (
    "BCW-728ebe1b8ae6",  # M44/D3, fastest word-2 composite
    "BCW-eb540e052854",  # M41/D1, fastest in band
    "BCW-d3f836f32da1",  # M41/D0, fastest in band
    "BCW-3245b61eed72",  # M40/D0, fastest in band
    "BCW-062294ac76a9",  # M46/D5, eight B paths + P/home
)
SOURCES = (
    "shenyun-21x21-completion-word2-face-search-r1.json",
    "shenyun-21x21-completion-word2-face-search-r2.json",
)


def pack(data: dict) -> str:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8")
    return base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")


def ensemble(modes: dict, reference: dict, tau: float, word_weight: float) -> float:
    terms = []
    for mode in ("keytao", "sanpin"):
        for kind in ("character", "word"):
            item, base = modes[mode][kind], reference[mode][kind]
            t = item["completionUpperMs"] + tau * item["p2"]
            b = base["completionUpperMs"] + tau * base["p2"]
            assert math.isfinite(t) and math.isfinite(b) and t > 0 and b > 0
            terms.append((word_weight if kind == "word" else 1) * (t / b) ** 4)
    return 10 * (sum(terms) / (2 + 2 * word_weight)) ** .25


def write_payload(html: str, body: int, end: int, data: dict, output: Path) -> None:
    staged = output.with_name(output.name + ".tmp")
    staged.write_text(html[:body] + pack(data) + html[end:], encoding="utf-8")
    staged.replace(output)


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
    if set(IDS) <= existing_ids:
        # The first integration increased the current catalogue count; retain
        # the original 562-entry source record and describe the later replay.
        source = data["completionB"]["source"]
        if source.get("entries") == len(existing_ids) and not source.get("extensions"):
            source["entries"] = len(existing_ids) - len(IDS)
            source["extensions"] = [{"ids": list(IDS), "scorer": "score_shenyun_completion_ckt.js",
                                     "policy": "same frozen B-completion-CKT-v0 policy"}]
            write_payload(html, body, end, data, (args.output or benchmark_path).resolve())
        print("All five representatives already integrated")
        return
    assert not (set(IDS) & existing_ids), "partial integration requires review"
    assert set(data["completionB"]["schemes"]) == existing_ids
    before = helper.preservation_snapshot(data, existing_ids)

    rows = {}
    for source in SOURCES:
        for row in json.loads((DATA / source).read_text(encoding="utf-8"))["results"]:
            if row["id"] in IDS:
                if row["id"] in rows:
                    assert row["state"] == rows[row["id"]]["state"]
                rows[row["id"]] = row
    assert set(rows) == set(IDS)
    benchmark, fast = load_benchmark(replay)
    missing = [ident for ident in IDS if not (replay / "exact" / f"{ident}.json").exists()]
    if missing:
        score_missing_exact(replay, benchmark, {i: (rows[i], "") for i in IDS}, missing)

    import numpy as np
    entries, exact = [], {}
    for ident in IDS:
        row = rows[ident]
        scored = json.loads((replay / "exact" / f"{ident}.json").read_text(encoding="utf-8"))
        expected = benchmark.opt.toentry(np.array(row["state"], dtype=np.int32), benchmark.DATA, ident)
        assert scored["entry"]["codeList"] == expected["codeList"], ident
        assert abs(scored["tracks"]["S2"]["upperMs"] - row["S2ms"]) < 1e-8, ident
        assert abs(scored["scores"]["ensembleV5"]["score"] - row["v5"]) < 1e-8, ident
        entry = new_entry(helper, scored, row, "1:2 补全 CKT 面搜索")
        entry["subfamily"] = "AVUIO 锁定·1:2 补全 CKT 面搜索"
        entry["source"] = "word-2 completion face search R1/R2; frozen R11 original 20-track replay"
        entry["notes"].append("Representative from the word-2 completion face search; fixed AVUIO key order.")
        values = fast.score(entry["codeList"])
        for key in PATH_NAMES:
            assert abs(values[key] - row[key]) < 1e-12, (ident, key)
        entry["bPathMetrics"] = values
        entries.append(entry)
        exact[ident] = scored

    data = old.integrate_colliding(helper, data, entries, exact, replay)
    helper.integrate_macroxue(data, entries, replay)
    assert before == helper.preservation_snapshot(data, existing_ids)
    for entry in entries:
        for key, track in TRACK_NAMES.items():
            assert abs(entry["bPathMetrics"][key] - data["ckt"]["tracks"][entry["id"]][track]["miss"]) < 1e-10
    data["r11Research"]["counts"]["postR11ResearchExtensions"] += len(entries)
    data["r11Research"]["scopeRows"].append([
        "Snow Shenyun AVUIO-locked 21x21 word-2 completion face representatives",
        "five M40–46/D0–5 representatives; frozen R11 20-track replay",
    ])
    data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    data["bPathBenchmark"]["schemeCount"] += len(entries)
    data["bPathBenchmark"]["selectedSources"].extend(SOURCES)
    assert len(data["entries"]) == len(existing_ids) + len(IDS)

    with tempfile.TemporaryDirectory(prefix="r11-word2-integration-") as location:
        temporary = Path(location)
        scored_html = temporary / "scored.html"
        scored_html.write_text(html[:body] + pack(data) + html[end:], encoding="utf-8")
        score_file = temporary / "completion.json"
        script = Path(__file__).with_name("score_shenyun_completion_ckt.js")
        subprocess.run(["node", str(script), "--html", str(scored_html), "--output", str(score_file),
                        "--ids", ",".join(IDS)], check=True, cwd=Path(__file__).resolve().parents[2])
        score_document = json.loads(score_file.read_text(encoding="utf-8"))
        scores = score_document["schemes"]
        reference = data["completionB"]["schemes"]["S005"]["modes"]
        for ident in IDS:
            row, scored = rows[ident], scores[ident]
            # Search rows were frozen under the historical Keytao word B2B1
            # order. The current scorer uses requested 21x21 B1B2 there.
            for key in PATH_NAMES:
                if key in ("wj1", "wj2"):
                    continue
                assert abs(scored["bPathDeltas"][key]) < 1e-10, (ident, key)
            parts = [scored["modes"][mode][kind] for mode, kind in
                     (("keytao", "character"), ("sanpin", "character"),
                      ("keytao", "word"), ("sanpin", "word"))]
            assert max(abs(row["times"][i] - parts[i]["completionUpperMs"]) for i in (0, 1, 3)) < 1e-8
            assert max(abs(row["p2"][i] - parts[i]["p2"]) for i in (0, 1, 3)) < 1e-12
            data["completionB"]["schemes"][ident] = scored
            data["completionB"]["ensembleScores"][ident] = {
                "equal": {str(tau): ensemble(scored["modes"], reference, tau, 1)
                          for tau in (0, 150, 300, 600)},
                "word2": {str(tau): ensemble(scored["modes"], reference, tau, 2)
                          for tau in (0, 150, 300, 600)},
            }
            # row['ckt12'] belongs to the historical word order and is not
            # asserted against the corrected comparison contract.
        data["completionB"]["source"]["extensions"] = [{
            "ids": list(IDS), "scorer": "score_shenyun_completion_ckt.js",
            "policy": score_document["version"],
            "scoredHtmlSha256": score_document["source"]["htmlSha256"],
        }]
        assert set(data["completionB"]["schemes"]) == {e["id"] for e in data["entries"]}
        assert set(data["completionB"]["ensembleScores"]) == set(data["completionB"]["schemes"])
        output = (args.output or benchmark_path).resolve()
        write_payload(html, body, end, data, output)
    print(json.dumps({"output": str(output), "catalogue": len(data["entries"]),
                      "newSchemes": list(IDS)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
