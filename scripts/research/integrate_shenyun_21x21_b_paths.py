#!/usr/bin/env python3
"""Integrate the two reviewed 21x21 B-path cohorts into the R11 HTML atlas.

The frozen R11 engine scores new layouts.  The eight B-path rates use the
repository's frozen character/word corpus and the same bucket evaluator used
by the search.  Existing R11 scores are retained.
"""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
DATA = HERE / "research-notes/data"
DEFAULT_HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
DEFAULT_REPLAY = Path(os.environ.get("TEMP", "")) / "rime-21x21-search/R11_integrated_replay"
PATH_NAMES = ("j1", "j2", "s1", "s2", "wj1", "wj2", "ws1", "ws2")
TRACK_NAMES = {"j2": "C4-Snow", "s1": "C3", "wj2": "WX-Snow-21", "ws2": "W6-21"}


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def selected_rows() -> dict[str, tuple[dict, str]]:
    result = {}
    for filename, cohort in (
        ("shenyun-21x21-b-paths-wide-frontier.json", "扩 M/D 前沿"),
        ("shenyun-21x21-b-paths-low-m-selected.json", "低 M 回缩"),
    ):
        for row in json.loads((DATA / filename).read_text(encoding="utf-8"))["results"]:
            result[row["id"]] = (row, cohort)
    assert len(result) == 19, len(result)
    return result


def new_entry(helper, exact: dict, row: dict, cohort: str) -> dict:
    entry = copy.deepcopy(exact["entry"])
    ident = row["id"]
    assert entry["id"] == ident and entry["tone"] == "IVUAO"
    assert entry["actual"] == [21, 21]
    assert all(not code or not set(code) & set("AVUIO") for code in entry["codeList"])
    entry["capacity"] = [21, 21]
    digest = hashlib.sha256(json.dumps(entry["codeList"], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    entry.update({
        "name": f"21×21 B路径·{cohort}·M{row['M']}/D{row['D']}·{ident[4:]}",
        "family": "Snow Shenyun 21x21",
        "subfamily": "AVUIO 锁定·八项 B 路径",
        "source": f"{cohort}; frozen R11 original 20-track replay",
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
        "searchMemoryNoTone": row["M"],
        "mappingAudit": {
            "scope": "Common399; 21x21; fixed AVUIO auxiliary keys",
            "codeListSha256": digest,
            "ordinaryInitialDisplacements": row["D"],
            "baseFinalDisplacements": 5,
            "aaVacancies": None,
        },
        "r11Provenance": {
            "parent": row.get("parent"),
            "kind": "post-R11 AVUIO-locked B-path research extension",
            "soundLayout": ident,
        },
        "notes": [
            f"21x21; M{row['M']}, D{row['D']}, V5; fixed AVUIO physical auxiliary keys.",
            f"Eight weighted B-path nonfirst rates measured on the frozen R11 corpus; {cohort}.",
        ],
    })
    return entry


def load_benchmark(replay: Path):
    os.chdir(replay)
    sys.argv = ["benchmark_shenyun_21x21_b_sets.py", "--replay", str(replay),
                "--output", str(DATA / "shenyun-21x21-b-sets-benchmark.json")]
    benchmark = load_module("b_path_corpus", HERE / "scripts/research/benchmark_shenyun_21x21_b_sets.py")
    sys.path.insert(0, str(HERE / "scripts/research"))
    from b_path_fast import FastBuckets
    return benchmark, FastBuckets(benchmark)


def score_missing_exact(replay: Path, benchmark, rows: dict, missing: list[str]) -> None:
    import numpy as np
    original_path = replay / "entries_to_score.json"
    original_bytes = original_path.read_bytes()
    entries = json.loads(original_bytes)
    first = len(entries)
    for ident in missing:
        entry = benchmark.opt.toentry(np.array(rows[ident][0]["state"], dtype=np.int32), benchmark.DATA, ident)
        entry["id"] = ident
        entries.append(entry)
    try:
        original_path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
        subprocess.run(["node", "eval_full.js", str(first), str(len(entries))], cwd=replay, check=True)
    finally:
        original_path.write_bytes(original_bytes)


def add_ui(html: str) -> str:
    marker = "SHENYUN_B_PATH_COLUMNS_V1"
    if marker in html:
        return html
    anchor = "function uxHeadersBenchmark(){"
    assert html.count(anchor) == 1
    helper = """/* SHENYUN_B_PATH_COLUMNS_V1: frozen Common8095 weighted nonfirst rates. */
const B_PATH_COLUMNS=[['键道·字+B1','j1'],['键道·字+B1+B2','j2'],
 ['三拼·字+B1','s1'],['三拼·字+B1+B2','s2'],
 ['键道·词+B1','wj1'],['键道·词+B1+B2','wj2'],
 ['三拼·词+B1','ws1'],['三拼·词+B1+B2','ws2']];
function bPathPct(x){return Number.isFinite(x)?(x*100).toFixed(5)+'%':'—'}
"""
    html = html.replace(anchor, helper + anchor, 1)
    old = "['Top10k 最大桶','collisionMaxBucket',null,null]"
    assert html.count(old) == 1
    html = html.replace(old, old + ",\n ...B_PATH_COLUMNS.map(([label,key])=>[label,'bPaths',null,null])", 1)
    old = "fc.avgAffected,fc.avgLoss,fc.topAffected,fc.topLoss,fc.maxBucket];"
    assert html.count(old) == 1
    html = html.replace(old, "fc.avgAffected,fc.avgLoss,fc.topAffected,fc.topLoss,fc.maxBucket,\n   ...B_PATH_COLUMNS.map(([,key])=>e.bPathMetrics?.[key]??null)];", 1)
    old = "pct(fc.avgAffected),pct(fc.avgLoss),pct(fc.topAffected),pct(fc.topLoss),fc.maxBucket??'—'];"
    assert html.count(old) == 1
    html = html.replace(old, "pct(fc.avgAffected),pct(fc.avgLoss),pct(fc.topAffected),pct(fc.topLoss),fc.maxBucket??'—',\n   ...B_PATH_COLUMNS.map(([,key])=>bPathPct(e.bPathMetrics?.[key]))];", 1)
    old = "缺数据不填0；含重码候选应同时查看消歧补全或相同音形合同。列名打开口径卡片，↕只改变显示顺序。"
    assert html.count(old) == 1
    html = html.replace(old, old + " 八条 B 路径仅为 21×21 方案提供，数值为加权非首选率；B1/B2 为追加的第一／第二个 B 集合。", 1)
    # uxTerm uses UG[id], so the eight headers share one explicit definition.
    anchor = "function uxHeadersBenchmark(){"
    definition = """UG.bPaths={title:'21×21 八项 B 路径非首选率',brief:'冻结 Common8095 字词频；越低越好。',detail:'键道单字 B1/B2 是形码首、次键，三拼单字 B1 是调、B2 是纯笔画；键道二字词 B1/B2 是次字、首字形码，三拼二字词 B1/B2 是次字、首字声调。仅比较追加到该 B 集合后的加权非首选率；未计上屏或选重。',sources:[],related:['selectioncost'],controls:[]};
"""
    html = html.replace(anchor, definition + anchor, 1)
    return html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--replay", type=Path, default=DEFAULT_REPLAY)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    benchmark_path, replay = args.benchmark.resolve(), args.replay.resolve()
    html = benchmark_path.read_text(encoding="utf-8")
    old = load_module("old_21x21_integrator", HERE / "scripts/research/integrate_shenyun_21x21_low_miss.py")
    helper = old.load_helper(benchmark_path)
    data, body, end = helper.extract_payload(html)
    rows = selected_rows()
    existing_ids = {entry["id"] for entry in data["entries"]}
    missing = [ident for ident in rows if ident not in existing_ids]
    benchmark, fast = load_benchmark(replay)
    exact_missing = [ident for ident in missing if not (replay / "exact" / f"{ident}.json").exists()]
    if exact_missing:
        score_missing_exact(replay, benchmark, rows, exact_missing)
    entries, exact = [], {}
    for ident in missing:
        row, cohort = rows[ident]
        scored = json.loads((replay / "exact" / f"{ident}.json").read_text(encoding="utf-8"))
        import numpy as np
        expected = benchmark.opt.toentry(np.array(row["state"], dtype=np.int32), benchmark.DATA, ident)
        assert scored["entry"]["codeList"] == expected["codeList"], ident
        assert abs(scored["tracks"]["S2"]["upperMs"] - row["S2ms"]) < 1e-8, ident
        assert abs(scored["scores"]["ensembleV5"]["score"] - row["v5"]) < 1e-8, ident
        entry = new_entry(helper, scored, row, cohort)
        entries.append(entry)
        exact[ident] = scored
    if entries:
        before = helper.preservation_snapshot(data, existing_ids)
        data = old.integrate_colliding(helper, data, entries, exact, replay)
        helper.integrate_macroxue(data, entries, replay)
        assert before == helper.preservation_snapshot(data, existing_ids)
        data["r11Research"]["counts"]["postR11ResearchExtensions"] += len(entries)
        scope = ["Snow Shenyun AVUIO-locked 21x21 B-path representatives",
                 "13 expanded M/D plus 7 low-M rows; shared M41/D1 seed counted once"]
        if scope not in data["r11Research"]["scopeRows"]:
            data["r11Research"]["scopeRows"].append(scope)
        data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    expected_count = sum(entry.get("capacity") == [21, 21] for entry in data["entries"])
    reference = json.loads((DATA / "shenyun-21x21-b-sets-benchmark.json").read_text(encoding="utf-8"))["reference"]
    selected_metrics = {ident: row for ident, (row, _) in rows.items()}
    for entry in data["entries"]:
        if entry.get("capacity") != [21, 21]:
            continue
        ident = entry["id"]
        values = fast.score(entry["codeList"])
        for key, track in TRACK_NAMES.items():
            assert abs(values[key] - data["ckt"]["tracks"][ident][track]["miss"]) < 1e-10, (ident, key)
        if ident in selected_metrics:
            for key in PATH_NAMES:
                assert abs(values[key] - selected_metrics[ident][key]) < 1e-12, (ident, key)
        entry["bPathMetrics"] = values
    assert sum("bPathMetrics" in entry for entry in data["entries"]) == expected_count
    for ident in ("S005", "R9-21X21-M40-02"):
        values = next(entry["bPathMetrics"] for entry in data["entries"] if entry["id"] == ident)
        for key in PATH_NAMES:
            assert abs(values[key] - reference["S005" if ident == "S005" else "R9"][key]) < 1e-12
    data["bPathBenchmark"] = {
        "version": "Common8095-21x21-B-paths-v1",
        "schemeCount": expected_count,
        "fields": list(PATH_NAMES),
        "referenceS005": {key: reference["S005"][key] for key in PATH_NAMES},
        "cohort": "all catalogue 21x21 layouts",
        "corpus": "frozen R11 Common8095 characters and Snow common two-character words",
        "characterB": "Keytao shape1/shape2; Sanpin tone/accepted first pure stroke",
        "wordB": "Keytao second/first character shape; Sanpin second/first character tone",
        "selectedSources": ["shenyun-21x21-b-paths-wide-frontier.json", "shenyun-21x21-b-paths-low-m-selected.json"],
    }
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8")
    encoded = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")
    result = add_ui(html[:body] + encoded + html[end:])
    output = (args.output or benchmark_path).resolve()
    temp = output.with_name(output.name + ".tmp")
    temp.write_text(result, encoding="utf-8")
    temp.replace(output)
    print(json.dumps({"output": str(output), "catalogue": len(data["entries"]),
                      "newSchemes": len(entries), "all21x21WithEightRates": expected_count},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
