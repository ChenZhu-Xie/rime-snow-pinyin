#!/usr/bin/env python3
"""Integrate 21x26 IEUAO 399-unique pure-y CKT v3 frontier and seed schemes into the offline R11 atlas."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib
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
SCORER = MAIN_REPO / "scripts" / "research" / "score_shenyun_completion_ckt.js"

META_CONFIG = {
    # Track A: Ultimate Speed Frontier (M40..M42, V=0)
    "SY26-V3-M42-D8-ULTIMATE-01": ("21×26 CKT-v3前沿·全域极速新巅峰·M42/D8/V0", "全域极速新巅峰·9.4033"),
    "SY26-V3-M41-D8-SPEED-HOME-01": ("21×26 CKT-v3前沿·M41极速高主行冠·M41/D8/V0", "M41极速高主行冠军·Home=42.08%"),
    "SY26-V3-M40-D7-SPEED-01": ("21×26 CKT-v3前沿·M40极速冠军·M40/D7/V0", "M40极速新纪录·9.4263"),
    "SY26-V3-M40-D7-ALLROUND-01": ("21×26 CKT-v3前沿·M40全能旗舰·M40/D7/V0", "M40全能速度旗舰·S2ms=67.21ms"),
    "SY26-V3-M40-D6-LOW-S2-01": ("21×26 CKT-v3前沿·D6单字极速均衡冠·M40/D6/V0", "D=6单字S2ms=66.95ms均衡旗舰"),
    "SY26-V3-M41-D7-ULTRALOW-PINKY-01": ("21×26 CKT-v3前沿·超低小指极速冠·M41/D7/V0", "Pmax=2.84%超低小指破9.46极速冠"),
    "SY26-V3-M40-D7-LOW-PINKY-01": ("21×26 CKT-v3前沿·M40低小指极速冠·M40/D7/V0", "M40低小指(Pmax=3.38%)极速冠军"),
    # Track B: Low-Memory & Equal-(M, D) Pareto Frontier (M35..M39)
    "SY26-V3-M39-D6-SPEED-01": ("21×26 CKT-v3前沿·M39极速新纪录·M39/D6/V0", "M=39极速新纪录·9.4520"),
    "SY26-V3-M39-D5-LOW-PINKY-01": ("21×26 CKT-v3前沿·M39/D5低小指速度冠·M39/D5/V0", "M39/D5低小指(Pmax=3.38%)速度冠"),
    "SY26-V3-M39-D5-BALANCED-01": ("21×26 CKT-v3前沿·M39/D5均衡旗舰·M39/D5/V0", "M39/D5低小指均衡旗舰"),
    "SY26-V3-M38-D5-ULTRALOW-PINKY-01": ("21×26 CKT-v3前沿·M38超低小指速度冠·M38/D5/V0", "M38超低小指(Pmax=2.84%)破9.505"),
    "SY26-V3-M38-D4-SPEED-01": ("21×26 CKT-v3前沿·M38/D4破9.50极速冠·M38/D4/V0", "M38/D4/V0破9.50低小指全优冠"),
    "SY26-V3-M38-D4-BALANCED-01": ("21×26 CKT-v3前沿·M38/D4低S2均衡冠·M38/D4/V0", "M38/D4单字S2ms=67.30ms均衡冠"),
    "SY26-V3-M38-D3-V1-NO-DE-01": ("21×26 CKT-v3前沿·M38/D3消DE极速冠·M38/D3/V1", "M38/D3/V1消DE极速冠·9.4547"),
    "SY26-V3-M38-D3-V1-LOW-PINKY-01": ("21×26 CKT-v3前沿·M38/D3消DE低S2亚军·M38/D3/V1", "M38/D3/V1消DE单字67.52ms亚军"),
    "SY26-V3-M37-D4-V0-NO-DE-01": ("21×26 CKT-v3前沿·M37/D4消DE速度冠·M37/D4/V0", "M37/D4/V0消DE单字68.12ms冠军"),
    "SY26-V3-M37-D4-V0-NO-DE-LP-01": ("21×26 CKT-v3前沿·M37/D4低小指消DE冠·M37/D4/V0", "M37/D4/V0低小指(3.38%)消DE冠军"),
    "SY26-V3-M37-D3-V0-SPEED-01": ("21×26 CKT-v3前沿·M37/D3超低小指极速冠·M37/D3/V0", "M37/D3/V0破9.48超低小指(2.78%)冠"),
    "SY26-V3-M37-D3-V0-NO-DE-LP-01": ("21×26 CKT-v3前沿·M37/D3低小指消DE冠·M37/D3/V0", "M37/D3/V0低小指消DE均衡冠军"),
    "SY26-V3-M37-D2-V1-ULTRALOW-PINKY-01": ("21×26 CKT-v3前沿·M37/D2极致小指冠·M37/D2/V1", "M37/D2/V1右小指2.49%全面超越C19"),
    "SY26-V3-M37-D2-V1-SPEED-01": ("21×26 CKT-v3前沿·M37/D2速度冠军·M37/D2/V1", "M37/D2/V1速度新纪录·9.5869"),
    "SY26-V3-M36-D3-V0-SPEED-01": ("21×26 CKT-v3前沿·M36/D3速度冠军·M36/D3/V0", "M36/D3/V0破9.60速度冠军"),
    "SY26-V3-M36-D3-V0-NO-DE-LP-01": ("21×26 CKT-v3前沿·M36/D3低小指消DE冠·M36/D3/V0", "M36/D3/V0低小指消DE均衡冠"),
    "SY26-V3-M36-D2-V0-SPEED-01": ("21×26 CKT-v3前沿·M36/D2破9.60极速冠·M36/D2/V0", "M36/D2/V0破9.60极速新纪录"),
    "SY26-V3-M36-D2-V0-NO-DE-01": ("21×26 CKT-v3前沿·M36/D2零元音移消DE冠·M36/D2/V0", "M36/D2/V0单字68.44ms低小指冠"),
    "SY26-V3-M36-D2-V1-NO-DE-01": ("21×26 CKT-v3前沿·M36/D2/V1消DE低小指冠·M36/D2/V1", "M36/D2/V1消DE低小指冠军"),
    "SY26-V3-M36-D1-V1-SPEED-01": ("21×26 CKT-v3前沿·M36/D1超低小指速度冠·M36/D1/V1", "M36/D1/V1右小指2.78%速度新冠"),
    "SY26-V3-M36-D1-V1-BALANCED-01": ("21×26 CKT-v3前沿·M36/D1消DE均衡冠·M36/D1/V1", "M36/D1/V1单字69.02ms超低小指冠"),
    "SY26-V3-M35-D2-V0-MINMEM-01": ("21×26 CKT-v3前沿·M35/D2理论最低记忆冠·M35/D2/V0", "M=35/D=2理论极限记忆速度冠"),
    "SY26-V3-M35-D1-V0-MINMEM-01": ("21×26 CKT-v3前沿·M35/D1理论双极限冠·M35/D1/V0", "M=35/D=1理论最低记忆位移双极限冠"),
    # Track C: High-Home & Ultra-Low-Pinky Ravine
    "SY26-V3-M38-D1-V3-HIGH-HOME-45-01": ("21×26 CKT-v3前沿·D1高主行超低小指冠·M38/D1/V3", "D=1高主行(45.29%)+超低小指(2.84%)"),
    "SY26-V3-M38-D2-V1-HIGH-HOME-46-01": ("21×26 CKT-v3前沿·M38高主行极致小指冠·M38/D2/V1", "Home=46.36%+Pmax=2.60%工学冠"),
    "SY26-V3-M40-D3-V3-HIGH-HOME-47-01": ("21×26 CKT-v3前沿·高主行极速双优旗舰·M40/D3/V3", "v3=9.4680+Home=46.96%+Pmax=2.84%"),
    "SY26-V3-M39-D2-V1-HIGH-HOME-48-01": ("21×26 CKT-v3前沿·M39超高主行小指冠·M39/D2/V1", "Home=47.82%+Pmax=2.60%工学旗舰"),
    "SY26-V3-M40-D2-V4-HIGH-HOME-51-01": ("21×26 CKT-v3前沿·M40破50%主行速度冠·M40/D2/V4", "Home=50.73%高主行速度冠军"),
    "SY26-V3-M42-HIGH-HOME-52-01": ("21×26 CKT-v3前沿·M42破54%主行低小指冠·M42/D3/V4", "Home=54.03%+Pmax=3.39%高主行冠"),
    "SY26-V3-M46-D8-V4-HIGH-HOME-55-01": ("21×26 CKT-v3前沿·54.66%极限主行极速种·M46/D8/V4", "Home=54.66%+v3=9.4862极限主行种子"),
    # Track D: 4-Code Cross-Family Collision Canyon
    "SY26-V3-M40-D5-V1-CANYON-34-01": ("21×26 CKT-v3前沿·四码碰撞最深峡谷种·M40/D5/V1", "四码碰撞代理3.37%最深峡谷种子"),
    "SY26-V3-M38-D5-V0-CANYON-38-01": ("21×26 CKT-v3前沿·M38零元音移低碰撞峡谷冠·M38/D5/V0", "M38/V0四码碰撞3.75%+v3=9.6133"),
    "SY26-V3-M38-D5-V0-CANYON-45-01": ("21×26 CKT-v3前沿·M38低碰撞极速双优峡谷·M38/D5/V0", "M38/V0四码碰撞4.53%+v3=9.5447"),
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
        "subfamily": "AEUIO 锁定·CKT v3 前沿探索",
        "source": f"Snow Shenyun 21x26 CKT v3 ({cohort}); 8-track closed-loop [1,3,1,1,1,3,1,1]",
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
            "parent": "NF4I-AE-Z-M40-09",
            "kind": "post-R11 21x26 IEUAO CKT-v3 research extension",
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

    sys.path.insert(0, str(MAIN_REPO / "scripts" / "research"))
    from integrate_shenyun_21x21_b_paths import load_benchmark, score_missing_exact
    from integrate_shenyun_21x21_completion_fixed_frontier import pack, ensemble, write_payload

    html_path = args.html.resolve()
    html = html_path.read_text(encoding="utf-8")

    old = load_module("old_21x21_integrator", MAIN_REPO / "scripts/research/integrate_shenyun_21x21_low_miss.py")
    helper = old.load_helper(html_path)
    data, body, end = helper.extract_payload(html)
    existing = {e["id"] for e in data["entries"]}

    frontier_doc = json.loads((DATA / "shenyun-21x26-ckt-v3-nextgen-frontier.json").read_text(encoding="utf-8"))
    frontier_list = frontier_doc["frontier"]
    frontier_map = {r["id"]: r for r in frontier_list}

    chosen_ids = [r["id"] for r in frontier_list if r["id"] not in existing]
    if not chosen_ids:
        print(json.dumps({"alreadyIntegrated": True, "catalogue": len(existing)}))
        return

    print(f"Integrating {len(chosen_ids)} 21x26 CKT v3 frontier & seed schemes into {html_path}...")
    chosen = [frontier_map[i] for i in chosen_ids]

    before = helper.preservation_snapshot(data, existing)
    benchmark, historical_fast = load_benchmark(args.replay.resolve())
    source = json.loads((args.replay / "source.json").read_text(encoding="utf-8"))

    missing = [i for i in chosen_ids if not (args.replay / "exact" / (i + ".json")).exists()]
    if missing:
        print(f"Scoring {len(missing)} missing exact 20-track replay files via eval_full.js...")
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
        name, cohort = META_CONFIG.get(
            ident,
            (f"21×26 CKT-v3前沿·{r['category']}·M{r['M']}/D{r['D']}/V{r['V']}·{ident}", r["category"]),
        )
        entry = build_21x26_entry(helper, scored, r, name, cohort)
        entry["bPathMetrics"] = historical_fast.score(entry["codeList"])
        entry["bPathMetricsNative"] = copy.deepcopy(ref_21x26_b_native)
        entries.append(entry)
        exact[ident] = scored

    print("Running helper.integrate (20-track CKT, memory/logic audits, load summaries, V5/V6, pair metrics)...")
    data = helper.integrate(data, source, entries, exact, args.replay)

    print("Running helper.integrate_macroxue...")
    helper.integrate_macroxue(data, entries, args.replay)
    for result in data["r11Research"].get("results", []):
        if result.get("id") in set(chosen_ids):
            values = data["macroxue"]["values"][result["id"]]
            result["macroDaily"] = values["daily|native-punctuation"]["score"]
            result["macroPure"] = values["daily|hanzi-only"]["score"]
            result["macroDefault"] = values["default|native-punctuation"]["score"]

    print("Evaluating standard 5-cut four-code collisions for new 21x26 entries...")
    dictionary_paths = [
        MAIN_REPO / f"snow_pinyin.{name}.dict.yaml"
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

    print("Scoring completion tracks (native, fixed, v2) via score_shenyun_completion_ckt.js...")
    with tempfile.TemporaryDirectory(prefix="ckt-v3-21x26-") as location:
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
            subprocess.run(cmd, check=True, cwd=MAIN_REPO)
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

        print(f"Writing updated payload with {len(data['entries'])} schemes to {html_path}...")
        write_payload(html_path, html, body, end, data)

    print("Integration of 21x26 CKT v3 frontier schemes completed successfully!")
    print(json.dumps({"addedCount": len(chosen_ids), "added": chosen_ids, "catalogue": len(data["entries"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
