#!/usr/bin/env python3
"""Promote native-B completion results for every R11 layout, retaining fixed-B control."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import json
import math
from pathlib import Path

from integrate_shenyun_21x21_b_paths import DEFAULT_HTML, PATH_NAMES
from integrate_shenyun_21x21_completion_word2_representatives import ensemble

TRACKS = (
    ("j1", "keytao", "character", "p1"), ("j2", "keytao", "character", "p2"),
    ("s1", "sanpin", "character", "p1"), ("s2", "sanpin", "character", "p2"),
    ("wj1", "keytao", "word", "p1"), ("wj2", "keytao", "word", "p2"),
    ("ws1", "sanpin", "word", "p1"), ("ws2", "sanpin", "word", "p2"),
)


def once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one UI anchor, found {text.count(old)}: {old[:75]}")
    return text.replace(old, new, 1)


def update_ui(html: str) -> str:
    old = "e.bPathMetrics?.[key]"
    if html.count(old) != 2:
        raise ValueError("Expected two eight-path table anchors")
    html = html.replace(old, "e.bPathMetricsNative?.[key]")
    html = once(html,
        "UG.bPaths={title:'21×21 八项 B 路径非首选率',brief:'冻结 Common8095 字词频；越低越好。',detail:'键道单字 B1/B2 是形码首、次键，三拼单字 B1 是调、B2 是纯笔画；键道二字词 B1/B2 是次字、首字形码，三拼二字词 B1/B2 是次字、首字声调。仅比较追加到该 B 集合后的加权非首选率；未计上屏或选重。',sources:[],related:['selectioncost'],controls:[]};",
        "UG.bPaths={title:'全键域八项原生 B 路径非首选率',brief:'冻结 Common8095 字词频，按每套方案自己的五键顺序计算；越低越好。',detail:'键道单字 B1/B2 是形码首、次键，三拼单字 B1 是调、B2 是纯笔画；键道与三拼二字词均先追加次字 B，再追加首字 B。B 的物理键由方案 tone 的有序五键映射决定；同一冻结语料、候选排序与字词频。旧固定 IVUAO 的 21×21 八项数据留在原始字段中。',sources:['bPathBenchmark'],related:['bComposite0','selectioncost'],controls:[]};")
    html = once(html,
        "八条 B 路径仅为 21×21 方案提供，数值为加权非首选率；B1/B2 为追加的第一／第二个 B 集合。",
        "八条 B 路径覆盖全部方案，按各自有序五键映射计算加权非首选率；二字词均先次字 B、再首字 B。")
    html = once(html,
        "UG.bComposite0={title:'四路径综合补全 CKT · 字:词=1:2 · τ ×10'",
        "UG.bComposite0={title:'原生四路径综合补全 CKT · 字:词=1:2 · τ ×10'")
    html = once(html,
        "UG.bV7={title:'A7E-v7-B补全(τ) ×10'",
        "UG.bCompositeFixed={title:'固定 IVUAO 对照 · 字:词=1:2 · τ ×10',brief:'所有方案都假设物理 IVUAO 作 B 键时的旧情景分。',detail:'保留升级前的固定键实验，便于隔离声韵布局变化；非 IVUAO 原生方案不能用本列表示原生输入体验。与原生列使用相同语料、CKT、τ和 S005 归一公式。',direction:'同τ越低越好',related:['bComposite0'],sources:['completionBFixed'],controls:['uxTau']};\nUG.bV7={title:'A7E-v7-B补全(τ) ×10'")
    html = once(html,
        "function bCompletionRow(e){return D.completionB?.schemes?.[e.id]?.modes||null}",
        "function bCompletionRow(e){return D.completionB?.schemes?.[e.id]?.modes||null}\nfunction bCompletionFixedRow(e){return D.completionBFixed?.schemes?.[e.id]?.modes||null}")
    html = once(html,
        "function bCompletionScore(m,tau,wordWeight=1){const base=bCompletionRow({id:'S005'});",
        "function bCompletionScore(m,tau,wordWeight=1,reference=null){const base=reference||bCompletionRow({id:'S005'});")
    html = once(html, "return Number.isFinite(c)&&Number.isFinite(w)?(c+w)/3:null}",
                     "return Number.isFinite(c)&&Number.isFinite(w)?(c+2*w)/5:null}")
    html = once(html,
        "{label:'综合补全 CKT · 字:词=1:2 · τ ×10',help:'bComposite0'},{label:'A7E-v7-B补全 · 字:词=1:1 · τ ×10',help:'bV7'},",
        "{label:'原生综合补全 CKT · 字:词=1:2 · τ ×10',help:'bComposite0'},{label:'固定 IVUAO 对照 · 字:词=1:2 · τ ×10',help:'bCompositeFixed'},{label:'A7E-v7-B补全 · 字:词=1:1 · τ ×10',help:'bV7'},")
    html = once(html,
        "const oldS=bOldSelection(e,tau),scoreWord2=bCompletionScore(m,tau,2),scoreTau=bCompletionScore(m,tau);",
        "const oldS=bOldSelection(e,tau),scoreWord2=bCompletionScore(m,tau,2),fixedM=bCompletionFixedRow(e),fixedWord2=bCompletionScore(fixedM,tau,2,bCompletionFixedRow({id:'S005'})),scoreTau=bCompletionScore(m,tau);")
    html = once(html, "oldS,scoreWord2,scoreTau];", "oldS,scoreWord2,fixedWord2,scoreTau];")
    html = once(html, "num(oldS),num(scoreWord2,5),num(scoreTau,5),",
                     "num(oldS),num(scoreWord2,5),num(fixedWord2,5),num(scoreTau,5),")
    html = once(html,
        "四组字词补全时间来自同一冻结语料与CKT模型。综合补全CKT按单字:二字词=1:2，A7E-v7按1:1；两列均用当前τ和S005同组时间归一，不含M/D/V。模型速度是时间换算，不重复加入总分。",
        "四组字词补全时间来自同一冻结语料与CKT模型，B 键按每套方案的有序五键映射取值；二字词均先次字 B、再首字 B。原生综合补全CKT按单字:二字词=1:2，A7E-v7按1:1；固定 IVUAO 列仅作布局对照。各列使用当前τ及S005同组归一，不含M/D/V。模型速度为时间换算。")
    html = once(html, "模型速度仍按输入项目各半（q=0.5）。", "模型速度与原生综合列一致，按单字:二字词=1:2 输入项目（q=2/3）。")
    old_mix = "单字与二字词各占一半输入项目时"
    if html.count(old_mix) != 2:
        raise ValueError("Expected two mixed-speed glossary anchors")
    html = html.replace(old_mix, "单字与二字词按1:2输入项目时")
    html = once(html, "再设二字词项目比例q=0.5。", "再设二字词项目比例q=2/3。")
    html = once(html, "T字词/汉字=[(1−q)T字+qT词]/(1+q), q=0.5", "T字词/汉字=(T字+2T词)/5, q=2/3")
    html = once(html, "q固定为0.5；τ沿用本表输入。", "q固定为2/3；τ沿用本表输入。")
    html = once(html,
        "'ensembleV5','fairCKT','completionB','audit'",
        "'ensembleV5','fairCKT','completionB','completionBFixed','audit'")
    return html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--scores", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    html_path = args.html.resolve()
    html = html_path.read_text(encoding="utf-8")
    prefix = html.index(">", html.index('<script id="payload"')) + 1
    suffix = html.index("</script>", prefix)
    data = json.loads(gzip.decompress(base64.b64decode(html[prefix:suffix])))
    scored = json.loads(args.scores.read_text(encoding="utf-8"))
    if scored["version"] != "B-completion-CKT-native-v1":
        raise ValueError("Expected native completion score document")
    ids = {e["id"] for e in data["entries"]}
    if ids != set(scored["schemes"]):
        raise ValueError("Score document does not cover every scheme")
    if "completionBFixed" in data:
        raise ValueError("Native completion already integrated")
    fixed = data["completionB"]
    if ids != set(fixed["schemes"]):
        raise ValueError("Fixed control does not cover every scheme")
    fixed["policy"]["mappingMode"] = "fixed"
    native = scored
    native["ensembleDefinition"] = copy.deepcopy(fixed["ensembleDefinition"])
    native["ensembleDefinition"]["version"] = "A7E-v7-B-native-v1"
    native["compositeDefinition"] = copy.deepcopy(fixed["compositeDefinition"])
    native["compositeDefinition"]["version"] = "B-completion-CKT-word2-native-v1"
    reference = native["schemes"]["S005"]["modes"]
    native["ensembleScores"] = {
        ident: {
            "equal": {str(tau): ensemble(row["modes"], reference, tau, 1) for tau in (0, 150, 300, 600)},
            "word2": {str(tau): ensemble(row["modes"], reference, tau, 2) for tau in (0, 150, 300, 600)},
        } for ident, row in native["schemes"].items()
    }
    for entry in data["entries"]:
        ident = entry["id"]
        modes = native["schemes"][ident]["modes"]
        if entry["tone"] == "IVUAO":
            for mode in ("keytao", "sanpin"):
                for kind in ("character", "word"):
                    a, b = modes[mode][kind], fixed["schemes"][ident]["modes"][mode][kind]
                    for field in ("p0", "p1", "p2", "completionUpperMs", "meanKeys"):
                        assert abs(a[field] - b[field]) < 1e-9, (ident, mode, kind, field)
        values = {key: modes[mode][kind][stage] for key, mode, kind, stage in TRACKS}
        assert len(values) == len(PATH_NAMES) and all(math.isfinite(v) for v in values.values())
        assert all(modes[mode][kind]["coverage"] == 1 for mode in ("keytao", "sanpin")
                   for kind in ("character", "word")), ident
        entry["bPathMetricsNative"] = values
    data["completionBFixed"] = fixed
    data["completionB"] = native
    data["bPathBenchmarkFixed"] = copy.deepcopy(data["bPathBenchmark"])
    data["bPathBenchmark"].update({
        "version": "Common8095-all-domains-native-B-v1", "schemeCount": len(ids),
        "cohort": "all catalogue layouts", "mapping": "native ordered entry.tone",
        "wordBOrder": "second character, first character in both modes",
        "selectedSources": [args.scores.name],
        "referenceS005": next(e["bPathMetricsNative"] for e in data["entries"] if e["id"] == "S005"),
    })
    html = update_ui(html)
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").encode("utf-8")
    blob = base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode("ascii")
    output = (args.output or html_path).resolve()
    staged = output.with_name(output.name + ".tmp")
    staged.write_text(html[:prefix] + blob + html[suffix:], encoding="utf-8")
    staged.replace(output)
    print(json.dumps({"output": str(output), "schemes": len(ids), "nativeEightRates": len(ids),
                      "fixedControl": len(fixed["schemes"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
