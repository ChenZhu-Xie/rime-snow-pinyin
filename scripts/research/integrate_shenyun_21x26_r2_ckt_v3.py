#!/usr/bin/env python3
"""Integrate the 45 curated Round 2 21x26 IEUAO 399-unique pure-y CKT v3 frontier & seed schemes into a7_CKT_R11.html."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import numpy as np

WORKTREE = Path(__file__).resolve().parents[2]
MAIN_REPO = Path(r"D:\C2D\Documents\rime-snow-pinyin")
DATA = WORKTREE / "research-notes" / "data"
DEFAULT_HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
DEFAULT_REPLAY = Path(os.environ.get("TEMP", "")) / "rime-21x21-search" / "R11_integrated_replay"
SCORER = WORKTREE / "scripts" / "research" / "score_shenyun_completion_ckt.js"

# Exact 45 selected schemes from the 5 Round 2 tables (Categories A..E)
META_CONFIG_R2 = {
    # Track A: Global Ultimate Speed & M39..M44 Pareto Frontier (11 schemes)
    "SY26-V3-R2-M44-D9-ULTIMATE-384": ("21×26 CKT-v3 R2前沿·全域极速破9.385巅峰·M44/D9/V0", "R2全域极速巅峰·9.3848"),
    "SY26-V3-R2-M44-D9-HOME-SPEED": ("21×26 CKT-v3 R2前沿·M44极速高主行低小指冠·M44/D9/V0", "R2极速高主行(44.13%)+Pmax=4.80%·9.3872"),
    "SY26-V3-R2-M43-D9-ULTIMATE-387": ("21×26 CKT-v3 R2前沿·M43极速v→V省记忆冠·M43/D9/V0", "R2 M43极速冠军·9.3878"),
    "SY26-V3-R2-M43-D9-HOME-SPEED": ("21×26 CKT-v3 R2前沿·M43极速高主行低小指冠·M43/D9/V0", "R2 M43高主行(43.68%)极速冠·9.3884"),
    "SY26-V3-R2-M42-D9-SUB940-01": ("21×26 CKT-v3 R2前沿·M42/D9破9.40极速冠·M42/D9/V0", "R2 M42/D9(W→W+v→V)破9.40冠·9.3932"),
    "SY26-V3-R2-M42-D8-SUB940-01": ("21×26 CKT-v3 R2前沿·M42/D8破9.40低S2冠·M42/D8/V0", "R2 M42/D8单字66.53ms破9.40冠·9.3937"),
    "SY26-V3-R2-M41-D7-SPEED-01": ("21×26 CKT-v3 R2前沿·M41/D7超R1全局极速冠·M41/D7/V0", "R2 M41/D7极速冠军·9.4012"),
    "SY26-V3-R2-M41-D8-SPEED-01": ("21×26 CKT-v3 R2前沿·M41/D8低S2/E6极速冠·M41/D8/V0", "R2 M41/D8单字66.74ms极速冠·9.4013"),
    "SY26-V3-R2-M40-D7-SPEED-01": ("21×26 CKT-v3 R2前沿·M40/D7极速新纪录·M40/D7/V0", "R2 M40/D7极速新纪录·9.4077"),
    "SY26-V3-R2-M40-D7-BALANCED-01": ("21×26 CKT-v3 R2前沿·M40/D7低S2均衡旗舰·M40/D7/V0", "R2 M40/D7单字67.20ms均衡旗舰·9.4161"),
    "SY26-V3-R2-M39-D6-SPEED-01": ("21×26 CKT-v3 R2前沿·M39/D6极速新纪录·M39/D6/V0", "R2 M39/D6极速新纪录·9.4188"),

    # Track B: M39..M42 Low-Pinky & Ultra-Low-Pinky Cliff Breakthroughs (8 schemes)
    "SY26-V3-R2-M42-D7-V1-LP-01": ("21×26 CKT-v3 R2前沿·M42低小指高主行极速冠·M42/D7/V1", "R2 M42低小指(3.38%)+44.12%主行·9.4201"),
    "SY26-V3-R2-M42-D7-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M42/V0超低小指极速冠·M42/D7/V0", "R2 M42/V0超低小指(2.78%)极速冠·9.4302"),
    "SY26-V3-R2-M41-D6-V1-ULP-01": ("21×26 CKT-v3 R2前沿·M41/V1超低小指低S2冠·M41/D6/V1", "R2 M41超低小指(2.78%)单字66.95ms冠·9.4292"),
    "SY26-V3-R2-M41-D6-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M41/V0超低小指极速冠·M41/D6/V0", "R2 M41/V0超低小指(2.78%)极速冠·9.4330"),
    "SY26-V3-R2-M40-D6-V0-LP-01": ("21×26 CKT-v3 R2前沿·M40/D6低小指极速冠·M40/D6/V0", "R2 M40/D6低小指(3.38%)极速冠·9.4348"),
    "SY26-V3-R2-M40-D6-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M40/D6超低小指极速冠·M40/D6/V0", "R2 M40/D6超低小指(2.78%)极速冠·9.4353"),
    "SY26-V3-R2-M39-D6-V0-LP-01": ("21×26 CKT-v3 R2前沿·M39/D6低小指断崖击穿冠·M39/D6/V0", "R2 M39低小指(3.38%)暴降0.162冠·9.4573"),
    "SY26-V3-R2-M39-D6-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M39/D6超低小指断崖击穿冠·M39/D6/V0", "R2 M39超低小指(2.78%)暴降0.161冠·9.4576"),

    # Track C: Low-Memory & Palatal Triad Ravines M35..M38 (14 schemes)
    "SY26-V3-R2-M38-D3-V1-SPEED-01": ("21×26 CKT-v3 R2前沿·M38/D3极速破9.45冠·M38/D3/V1", "R2 M38/D3/V1极速新纪录·9.4454"),
    "SY26-V3-R2-M38-D4-V1-ULP-01": ("21×26 CKT-v3 R2前沿·M38超低小指高主行冠·M38/D4/V1", "R2 M38 JKW盆地(2.84%小指+43.88%主行)·9.4587"),
    "SY26-V3-R2-M38-D5-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M38/D5/V0超低小指冠·M38/D5/V0", "R2 M38/D5/V0超低小指(2.78%)冠·9.4659"),
    "SY26-V3-R2-M38-D4-V0-NODE-LP-01": ("21×26 CKT-v3 R2前沿·M38/V0不拆DE低小指冠·M38/D4/V0", "R2 M38/V0不拆DE低小指破9.50冠·9.4978"),
    "SY26-V3-R2-M37-D3-V0-SPEED-01": ("21×26 CKT-v3 R2前沿·M37/D3/V0极速新纪录·M37/D3/V0", "R2 M37/D3/V0极速新纪录·9.4541"),
    "SY26-V3-R2-M37-D3-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M37/D3/V0超低小指冠·M37/D3/V0", "R2 M37/D3/V0超低小指(2.78%)冠·9.4743"),
    "SY26-V3-R2-M37-D3-V0-NODE-LP-01": ("21×26 CKT-v3 R2前沿·M37/D3/V0不拆DE超低小指冠·M37/D3/V0", "R2 M37不拆DE(d→K)+Pmax=2.91%冠·9.5964"),
    "SY26-V3-R2-M36-D2-V1-TRIAD-LP-01": ("21×26 CKT-v3 R2前沿·M36/D2舌面三元低小指冠·M36/D2/V1", "R2 M36 JW_JWX三元盆地(3.38%)冠·9.6153"),
    "SY26-V3-R2-M36-D2-V1-TRIAD-ULP-01": ("21×26 CKT-v3 R2前沿·M36/D2舌面三元超低小指冠·M36/D2/V1", "R2 M36 JW_JWX三元盆地(2.78%)冠·9.6189"),
    "SY26-V3-R2-M36-D3-V0-TRIAD-P244-01": ("21×26 CKT-v3 R2前沿·M36/D3/V0极致2.49%小指种·M36/D3/V0", "R2 M36/V0右小指2.49%极限种子·9.6509"),
    "SY26-V3-R2-M36-D2-V0-NODE-LP-01": ("21×26 CKT-v3 R2前沿·M36/D2/V0不拆DE低S2冠·M36/D2/V0", "R2 M36/V0不拆DE单字68.35ms低小指冠·9.6605"),
    "SY26-V3-R2-M35-D1-V0-SPEED-01": ("21×26 CKT-v3 R2前沿·M35/D1理论最低记忆极速冠·M35/D1/V0", "R2 M35/D1/V0最低记忆速度新纪录·9.6202"),
    "SY26-V3-R2-M35-D1-V0-LP-01": ("21×26 CKT-v3 R2前沿·M35/D1理论最低记忆低小指冠·M35/D1/V0", "R2 M35/D1/V0低小指(3.38%)冠军·9.6240"),
    "SY26-V3-R2-M35-D1-V0-ULP-01": ("21×26 CKT-v3 R2前沿·M35/D1理论最低记忆超低小指冠·M35/D1/V0", "R2 M35/D1/V0超低小指(2.77%)冠军·9.6270"),

    # Track D: High-Home + Ultra-Low-Pinky Dual-Gated Ergonomic Basin (6 schemes)
    "SY26-V3-R2-M44-D7-V2-HOME49-ULP-01": ("21×26 CKT-v3 R2前沿·50%主行超低小指破9.413冠·M46/D9/V2", "R2 49.74%主行+2.78%小指极速冠·9.4127"),
    "SY26-V3-R2-M43-D7-V1-HOME50-ULP-01": ("21×26 CKT-v3 R2前沿·M43/V1准50%主行超低小指冠·M43/D7/V1", "R2 M43/V1 49.88%主行+2.84%小指冠·9.4376"),
    "SY26-V3-R2-M42-D3-V4-HOME54-ULP-01": ("21×26 CKT-v3 R2前沿·M42破54%主行超低小指破9.50冠·M42/D3/V4", "R2 54.13%主行+2.84%小指破9.50冠·9.4949"),
    "SY26-V3-R2-M42-D5-V2-HOME50-ULP-01": ("21×26 CKT-v3 R2前沿·M42/V2破50%主行超低小指冠·M42/D5/V2", "R2 WJ_JWK盆地50.21%主行+2.78%小指·9.4993"),
    "SY26-V3-R2-M42-D5-V2-HOME56-ULP-01": ("21×26 CKT-v3 R2前沿·M42/V2 55.99%主行超低小指冠·M42/D5/V2", "R2 55.99%超高主行+2.78%超低小指·9.5576"),
    "SY26-V3-R2-M44-D7-V2-HOME56-MAX-01": ("21×26 CKT-v3 R2前沿·56.12%全域最高主行低小指冠·M44/D7/V2", "R2 56.12%最高主行+3.38%小指纪录·9.5359"),

    # Track E: 4-Code Cross-Family Collision Canyon Sub-3.00% (6 schemes)
    "SY26-V3-R2-M38-D4-V1-CANYON-292-01": ("21×26 CKT-v3 R2前沿·M38四码碰撞2.92%最深峡谷冠·M38/D4/V1", "R2四码碰撞代理2.92%全域最低纪录"),
    "SY26-V3-R2-M43-D9-V1-CANYON-293-01": ("21×26 CKT-v3 R2前沿·2.93%超低碰撞高速峡谷冠·M43/D9/V1", "R2四码碰撞2.93%+v3=9.6534峡谷冠"),
    "SY26-V3-R2-M36-D2-V1-CANYON-299-01": ("21×26 CKT-v3 R2前沿·M36/D2破3%碰撞极简峡谷种·M36/D2/V1", "R2 M36/D2四码碰撞2.99%极简种子"),
    "SY26-V3-R2-M38-D4-V1-CANYON-326-01": ("21×26 CKT-v3 R2前沿·M38低碰撞40%主行均衡峡谷·M38/D4/V1", "R2 M38碰撞3.26%+40.15%主行+3.38%小指"),
    "SY26-V3-R2-M38-D5-V0-CANYON-331-01": ("21×26 CKT-v3 R2前沿·M38/V0不拆DE低碰撞峡谷冠·M38/D5/V0", "R2 M38/V0不拆DE碰撞3.31%+v3=9.6412"),
    "SY26-V3-R2-M43-D9-V1-CANYON-FAST-01": ("21×26 CKT-v3 R2前沿·3.37%低碰撞破9.54极速峡谷冠·M43/D9/V1", "R2 3.37%低碰撞极速冠·9.5321"),
}


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_21x26_entry(helper, scored: dict, row: dict, name: str, cohort: str) -> dict:
    entry = copy.deepcopy(scored["entry"])
    ident = row["id"]
    assert entry["id"] == ident and entry["tone"] == "IEUAO"
    assert entry["actual"] == [21, 26]
    assert all(not code or not set(code[:1]) & set("AEIOU") for code in entry["codeList"])
    entry["capacity"] = [21, 26]
    digest = hashlib.sha256(json.dumps(entry["codeList"], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    entry.update({
        "name": name,
        "family": "Snow Shenyun 21x26",
        "subfamily": "AEUIO 锁定·CKT v3 R2 前沿探索",
        "source": f"Snow Shenyun 21x26 CKT v3 Round 2 ({cohort}); 8-track closed-loop [1,3,1,1,1,3,1,1]",
        "new": True,
        "roles": helper.onset_roles(entry["initialMap"]),
        "zeroOnsetScope": helper.zero_onset_scope(entry),
        "rhymes": helper.inverse(entry["finalMap"]),
        "reservedKeys": "AEIOU",
        "auxiliaryClass": "AEUIO",
        "defaultAuxOrder": True,
        "auxiliaryMappingMatchesReservation": True,
        "topgongReserve": "AEIOU",
        "topgongValid": True,
        "strictTopgong": True,
        "exceptionCount": 0,
        "searchMemoryNoTone": row["M"],
        "mappingAudit": {
            "scope": "Common399; 21x26; fixed IEUAO auxiliary keys",
            "codeListSha256": digest,
            "ordinaryInitialDisplacements": row["D"],
            "baseFinalDisplacements": row["V"],
            "aaVacancies": None,
        },
        "r11Provenance": {
            "parent": "SY26-V3-M42-D8-ULTIMATE-01",
            "kind": "post-R11 21x26 IEUAO CKT-v3 Round 2 research extension",
            "soundLayout": ident,
        },
        "notes": [
            f"Common399 399/399 unique; 21x26 pure-y; M{row['M']}, D{row['D']}, V{row['V']}; fixed IEUAO (AEUIO) auxiliary keys.",
            f"CKT v3 = {row['ckt_v3']:.5f} (raw = {row['ckt_v3_raw']:.5f}); S2ms = {row['S2ms']:.2f}ms; E6 = {row['E6']:.4f}; V6 = {row['V6']:.4f}; Home = {row['homeS2']*100:.2f}%; Pmax = {row['Pmax']*100:.2f}%; {cohort}.",
        ],
    })
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--replay", type=Path, default=DEFAULT_REPLAY)
    args = parser.parse_args()

    sys.path.insert(0, str(WORKTREE / "scripts" / "research"))
    from integrate_shenyun_21x21_b_paths import load_benchmark, score_missing_exact
    from integrate_shenyun_21x21_completion_fixed_frontier import pack, ensemble, write_payload

    html_path = args.html.resolve()
    html = html_path.read_text(encoding="utf-8")

    old = load_module("old_21x21_integrator", WORKTREE / "scripts/research/integrate_shenyun_21x21_low_miss.py")
    helper = old.load_helper(html_path)
    data, body, end = helper.extract_payload(html)
    existing = {e["id"] for e in data["entries"]}

    frontier_doc = json.loads((DATA / "shenyun-21x26-ckt-v3-round2-frontier.json").read_text(encoding="utf-8"))
    frontier_list = frontier_doc["frontier"]
    frontier_map = {r["id"]: r for r in frontier_list}

    selected_order = list(META_CONFIG_R2.keys())
    assert len(selected_order) == 45, f"Expected 45 selected schemes, got {len(selected_order)}"
    for sid in selected_order:
        if sid not in frontier_map:
            raise KeyError(f"Selected scheme {sid} not found in shenyun-21x26-ckt-v3-round2-frontier.json")

    chosen_ids = [sid for sid in selected_order if sid not in existing]
    if not chosen_ids:
        print(json.dumps({"alreadyIntegrated": True, "catalogue": len(existing)}))
        return

    print(f"Integrating {len(chosen_ids)} Round 2 21x26 CKT v3 frontier & seed schemes into {html_path}...", flush=True)
    chosen = [frontier_map[i] for i in chosen_ids]

    before = helper.preservation_snapshot(data, existing)
    benchmark, historical_fast = load_benchmark(args.replay.resolve())
    source = json.loads((args.replay / "source.json").read_text(encoding="utf-8"))

    missing = [i for i in chosen_ids if not (args.replay / "exact" / (i + ".json")).exists()]
    if missing:
        print(f"Scoring {len(missing)} missing exact 20-track replay files via eval_full.js...", flush=True)
        score_missing_exact(args.replay, benchmark, {r["id"]: (r, "") for r in chosen}, missing)

    ref_21x26_b_native = copy.deepcopy(
        next(e["bPathMetricsNative"] for e in data["entries"] if e["id"] == "NF4I-AE-Z-M40-09")
    )

    entries, exact = [], {}
    for r in chosen:
        ident = r["id"]
        scored = json.loads((args.replay / "exact" / (ident + ".json")).read_text(encoding="utf-8"))
        expected = benchmark.opt.toentry(np.asarray(r["state"], dtype=np.int32), benchmark.DATA, ident)
        if scored["entry"]["codeList"] != expected["codeList"]:
            raise ValueError("Code mismatch " + ident)
        name, cohort = META_CONFIG_R2[ident]
        entry = build_21x26_entry(helper, scored, r, name, cohort)
        entry["bPathMetrics"] = historical_fast.score(entry["codeList"])
        entry["bPathMetricsNative"] = copy.deepcopy(ref_21x26_b_native)
        entries.append(entry)
        exact[ident] = scored

    print("Running helper.integrate (20-track CKT, memory/logic audits, load summaries, V5/V6, pair metrics)...", flush=True)
    data = helper.integrate(data, source, entries, exact, args.replay)

    print("Running helper.integrate_macroxue...", flush=True)
    helper.integrate_macroxue(data, entries, args.replay)
    for result in data["r11Research"].get("results", []):
        if result.get("id") in set(chosen_ids):
            values = data["macroxue"]["values"][result["id"]]
            result["macroDaily"] = values["daily|native-punctuation"]["score"]
            result["macroPure"] = values["daily|hanzi-only"]["score"]
            result["macroDefault"] = values["default|native-punctuation"]["score"]

    print("Evaluating standard 5-cut four-code collisions for new Round 2 21x26 entries...", flush=True)
    dictionary_paths = [
        WORKTREE / f"snow_pinyin.{name}.dict.yaml"
        for name in ("base", "ext", "tencent")
    ]
    common399 = {
        helper.normalize_pinyin(source["pinyin"][index])
        for index, _ in source["base"]
    }
    corpus = helper.read_word_corpus(
        dictionary_paths,
        max_cut=max(helper.CUTS),
        allowed_pinyin=common399,
    )
    new_collisions = helper.benchmark_catalogue(entries, source["pinyin"], corpus)
    entries_by_id = {e["id"]: e for e in data["entries"]}
    for ident, coll in new_collisions.items():
        entries_by_id[ident]["fourCodeCollision"] = coll

    if before != helper.preservation_snapshot(data, existing):
        raise ValueError("Original catalogue changed!")

    data["r11Research"]["counts"]["current"] = len(data["entries"])
    data["r11Research"]["counts"]["postR11ResearchExtensions"] += len(entries)
    data["fourCodeCollisionBenchmark"]["catalogueCount"] = len(data["entries"])
    data["fourCodeCollisionBenchmark"]["schemeCount"] = sum(
        1 for e in data["entries"] if "fourCodeCollision" in e
    )
    data["bPathBenchmark"]["schemeCount"] = len(data["entries"])

    print("Scoring completion tracks (native, fixed, v2) via score_shenyun_completion_ckt.js...", flush=True)
    with tempfile.TemporaryDirectory(prefix="ckt-v3-21x26-r2-") as location:
        temp = Path(location)
        staged = temp / "scored.html"
        staged.write_text(html[:body] + pack(data) + html[end:], encoding="utf-8")
        result = {}
        for mapping in ("native", "fixed", "v2"):
            target = temp / (mapping + ".json")
            cmd = [
                "node",
                str(SCORER),
                "--html",
                str(staged),
                "--output",
                str(target),
                "--ids",
                ",".join(chosen_ids),
                "--mapping",
                "fixed" if mapping == "v2" else mapping,
            ]
            if mapping == "v2":
                cmd.extend(["--model", "v2"])
            subprocess.run(cmd, check=True, cwd=WORKTREE)
            result[mapping] = json.loads(target.read_text(encoding="utf-8"))["schemes"]

        for r in chosen:
            ident = r["id"]
            v2 = result["v2"][ident]
            data["completionBV2"]["schemes"][ident] = v2

            for mapping in ("native", "fixed"):
                block = data["completionB" if mapping == "native" else "completionBFixed"]
                item = result[mapping][ident]
                block["schemes"][ident] = item
                base = block["schemes"]["S005"]["modes"]
                block["ensembleScores"][ident] = {
                    "equal": {str(t): ensemble(item["modes"], base, t, 1) for t in (0, 150, 300, 600)},
                    "word2": {str(t): ensemble(item["modes"], base, t, 2) for t in (0, 150, 300, 600)},
                }

            if "completionBV3" in data:
                data["completionBV3"]["schemes"][ident] = {
                    "capacity": [21, 26],
                    "tone": "IEUAO",
                    "modes": r["modes"],
                }

        all_ids = {e["id"] for e in data["entries"]}
        if len(all_ids) != len(existing) + len(chosen_ids):
            raise ValueError("Catalogue mismatch")
        for name in ("completionB", "completionBFixed", "completionBV2", "completionBV3"):
            if set(data[name]["schemes"]) != all_ids:
                raise ValueError(f"Catalogue mismatch in {name}")

        print(f"Writing updated payload with {len(data['entries'])} schemes to {html_path}...", flush=True)
        write_payload(html_path, html, body, end, data)

    print("Integration of 45 Round 2 21x26 CKT v3 frontier schemes completed successfully!", flush=True)
    print(json.dumps({"addedCount": len(chosen_ids), "added": chosen_ids, "catalogue": len(data["entries"])}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
