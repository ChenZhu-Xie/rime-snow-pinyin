#!/usr/bin/env python3
"""Apply the domain-specific Keytao word-B order to the R11 atlas."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import DEFAULT_HTML
from integrate_shenyun_21x21_completion_word2_representatives import ensemble

ORDER = "keytao: 21x21 first character then second; other domains second then first; sanpin: second then first"
PATHS = (("j1", "keytao", "character", "p1"), ("j2", "keytao", "character", "p2"),
         ("s1", "sanpin", "character", "p1"), ("s2", "sanpin", "character", "p2"),
         ("wj1", "keytao", "word", "p1"), ("wj2", "keytao", "word", "p2"),
         ("ws1", "sanpin", "word", "p1"), ("ws2", "sanpin", "word", "p2"))


def once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one anchor, found {text.count(old)}: {old[:80]}")
    return text.replace(old, new, 1)


def annotate_deployed_order(data: dict, html: str) -> str:
    data["bPathBenchmark"]["deployed21x21KeytaoWordOrder"] = "first character then second (snow_jiandao shape_filter.lua)"
    data["bPathBenchmark"]["comparison21x21KeytaoWordOrder"] = "first character then second (matches deployed snow_jiandao full word)"
    # Previous page copies contain both the initial neutral text and the later
    # mistaken claim that deployed Keytao uses second-character B first.
    replacements = (
        (
            ("旧 21×21 八项数据采用次字先的历史口径，单独留在 bPathBenchmarkLegacy；当前列按本页新顺序计算。",
             "现行 Lua 键道二字词仍是次字先；本页 21×21 首字先是用户指定的 benchmark 合同。历史次字先八项留在 bPathBenchmarkLegacy，二者不能混用。"),
            "snow_jiandao 实际二字全码的形码为首字先、次字后；本页 21×21 与之相同。历史次字先八项留在 bPathBenchmarkLegacy，二者不能混用。",
        ),
        (
            ("其他键道及三拼先次字 B、再首字 B。</p>",
             "其他键道及三拼先次字 B、再首字 B。现行 Lua 的 21×21 键道词也为次字先，本页首字先属于指定 benchmark 合同。</p>"),
            "其他键道及三拼先次字 B、再首字 B；21×21 键道与 snow_jiandao 实际二字全码形码顺序一致。</p>",
        ),
        (
            ("模型速度为时间换算。</p>",
             "模型速度为时间换算；21×21 键道词首字先尚非现行 Lua 的实际输入顺序。</p>"),
            "模型速度为时间换算；21×21 键道二字全码的 B 顺序与 snow_jiandao 实际候选过滤一致。</p>",
        ),
    )
    for previous, corrected in replacements:
        for old in previous:
            if old in html:
                html = once(html, old, corrected)
                break
    return html


def write_html(path: Path, html: str, start: int, end: int, data: dict) -> None:
    blob = base64.b64encode(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8"), compresslevel=6, mtime=0)).decode("ascii")
    staged = path.with_name(path.name + ".tmp")
    staged.write_text(html[:start] + blob + html[end:], encoding="utf-8")
    staged.replace(path)


def scores(doc: dict, definition: dict) -> dict:
    result = copy.deepcopy(doc)
    short_version = result["version"].removeprefix("B-completion-CKT-")
    result["ensembleDefinition"] = copy.deepcopy(definition["ensembleDefinition"])
    result["ensembleDefinition"]["version"] = "A7E-v7-B-" + short_version
    result["compositeDefinition"] = copy.deepcopy(definition["compositeDefinition"])
    result["compositeDefinition"]["version"] = "B-completion-CKT-word2-" + short_version
    base = result["schemes"]["S005"]["modes"]
    result["ensembleScores"] = {
        ident: {"equal": {str(t): ensemble(row["modes"], base, t, 1) for t in (0, 150, 300, 600)},
                "word2": {str(t): ensemble(row["modes"], base, t, 2) for t in (0, 150, 300, 600)}}
        for ident, row in result["schemes"].items()
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--native", type=Path, required=True)
    parser.add_argument("--fixed", type=Path, required=True)
    args = parser.parse_args()
    html_path = args.html.resolve()
    html = html_path.read_text(encoding="utf-8")
    start = html.index(">", html.index('<script id="payload"')) + 1
    end = html.index("</script>", start)
    data = json.loads(gzip.decompress(base64.b64decode(html[start:end])))
    native_doc = json.loads(args.native.read_text(encoding="utf-8"))
    fixed_doc = json.loads(args.fixed.read_text(encoding="utf-8"))
    if native_doc["version"] != "B-completion-CKT-native-v2" or fixed_doc["version"] != "B-completion-CKT-fixed-v1":
        raise ValueError("Unexpected corrected scorer version")
    if native_doc["policy"]["wordBOrder"] != ORDER or fixed_doc["policy"]["wordBOrder"] != ORDER:
        raise ValueError("Score documents do not encode the requested order")
    ids = {e["id"] for e in data["entries"]}
    if ids != set(native_doc["schemes"]) or ids != set(fixed_doc["schemes"]):
        raise ValueError("Score coverage differs from page entries")
    if data["completionB"]["version"] == "B-completion-CKT-native-v2":
        for ident in ids:
            if data["completionB"]["schemes"][ident]["modes"] != native_doc["schemes"][ident]["modes"]:
                raise ValueError(f"Integrated native score differs: {ident}")
            if data["completionBFixed"]["schemes"][ident]["modes"] != fixed_doc["schemes"][ident]["modes"]:
                raise ValueError(f"Integrated fixed score differs: {ident}")
        previous_metadata = (
            data["bPathBenchmark"].get("deployed21x21KeytaoWordOrder"),
            data["bPathBenchmark"].get("comparison21x21KeytaoWordOrder"),
        )
        annotated = annotate_deployed_order(data, html)
        current_metadata = (
            data["bPathBenchmark"]["deployed21x21KeytaoWordOrder"],
            data["bPathBenchmark"]["comparison21x21KeytaoWordOrder"],
        )
        if annotated != html or previous_metadata != current_metadata:
            write_html(html_path, annotated, start, end, data)
        print(json.dumps({"html": str(html_path), "schemes": len(ids), "alreadyIntegrated": True}, ensure_ascii=False))
        return
    if data["completionB"]["version"] != "B-completion-CKT-native-v1":
        raise ValueError("Expected previous native benchmark snapshot")
    old_native = data["completionB"]
    old_fixed = data["completionBFixed"]
    for entry in data["entries"]:
        ident = entry["id"]
        new = native_doc["schemes"][ident]["modes"]
        old = old_native["schemes"][ident]["modes"]
        first_first = entry.get("capacity") == [21, 21]
        for mode in ("keytao", "sanpin"):
            for kind in ("character", "word"):
                if first_first and mode == "keytao" and kind == "word":
                    continue
                if new[mode][kind] != old[mode][kind]:
                    raise ValueError(f"Unexpected result change: {ident} {mode}.{kind}")
        if entry["tone"] == "IVUAO" and new != fixed_doc["schemes"][ident]["modes"]:
            raise ValueError(f"Fixed/native mismatch on identical auxiliary order: {ident}")
        entry["bPathMetricsNative"] = {key: new[mode][kind][stage] for key, mode, kind, stage in PATHS}
    data["completionB"] = scores(native_doc, old_native)
    data["completionBFixed"] = scores(fixed_doc, old_fixed)
    data["bPathBenchmarkLegacy"] = data.pop("bPathBenchmarkFixed")
    data["bPathBenchmarkLegacy"]["historicalWordBOrder"] = "keytao and sanpin both second character then first"
    data["bPathBenchmarkLegacy"]["supersededBy"] = "Common8095-all-domains-native-B-v2"
    data["bPathBenchmark"].update({
        "version": "Common8095-all-domains-native-B-v2", "wordBOrder": ORDER,
        "referenceS005": next(e["bPathMetricsNative"] for e in data["entries"] if e["id"] == "S005"),
        "selectedSources": [args.native.name, args.fixed.name],
    })
    html = once(html,
        "键道与三拼二字词均先追加次字 B，再追加首字 B。",
        "键道 21×21 二字词先追加首字 B、再追加次字 B；其他键域键道与所有三拼二字词先追加次字 B、再追加首字 B。")
    html = once(html,
        "旧固定 IVUAO 的 21×21 八项数据留在原始字段中。",
        "旧 21×21 八项数据采用次字先的历史口径，单独留在 bPathBenchmarkLegacy；当前列按本页新顺序计算。")
    html = once(html,
        "八条 B 路径覆盖全部方案，按各自有序五键映射计算加权非首选率；二字词均先次字 B、再首字 B。",
        "八条 B 路径覆盖全部方案，按各自有序五键映射计算加权非首选率；键道 21×21 二字词先首字 B、再追加次字 B，其他键道及三拼先次字 B、再首字 B。")
    html = once(html,
        "四组字词补全时间来自同一冻结语料与CKT模型，B 键按每套方案的有序五键映射取值；二字词均先次字 B、再首字 B。",
        "四组字词补全时间来自同一冻结语料与CKT模型，B 键按每套方案的有序五键映射取值；键道 21×21 二字词先首字 B、再追加次字 B，其他键道与所有三拼二字词先次字 B、再首字 B。")
    html = annotate_deployed_order(data, html)
    write_html(html_path, html, start, end, data)
    print(json.dumps({"html": str(html_path), "schemes": len(ids), "changedKeytaoWord": sum(e["capacity"] == [21, 21] for e in data["entries"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
