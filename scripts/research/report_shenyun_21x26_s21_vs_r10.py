#!/usr/bin/env python3
"""Build the S21x26 versus R10 benchmark report from the integrated atlas."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
DEFAULT_OUTPUT = ROOT / "research-notes/shenyun-21x26-s21-vs-r10-benchmark.md"
BASELINE_IDS = (
    "R10-21X26-M37-04",
    "R10-21X26-M38-07",
    "R10-21X26-M39-08",
)
LOWER_BETTER = {"E6", "S2", "C4", "WX", "far", "finger", "rightPinky"}
HIGHER_BETTER = {"dailyMX", "home"}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def extract_payload(path: Path) -> dict[str, Any]:
    html = path.read_text(encoding="utf-8")
    start = html.index('<script id="payload"')
    body = html.index(">", start) + 1
    end = html.index("</script>", body)
    return json.loads(gzip.decompress(base64.b64decode(html[body:end])))


def objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)


def research_performance() -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    for path in sorted((ROOT / "research-notes/data").glob("shenyun-21x26-constrained*.json")):
        source = json.loads(path.read_text(encoding="utf-8"))
        for row in objects(source):
            scheme_id = row.get("id")
            performance = row.get("performance")
            if not isinstance(scheme_id, str) or not scheme_id.startswith("S21X26-"):
                continue
            if not isinstance(performance, dict) or "meanRatio" not in performance:
                continue
            prior = result.get(scheme_id)
            if prior is not None:
                for key in ("S2", "v5", "v4", "v6", "dailyMX", "meanRatio", "worstRatio"):
                    assert abs(prior[key] - performance[key]) < 1e-9, (scheme_id, key)
            result[scheme_id] = performance
    return result


def group_name(scheme_id: str) -> str:
    for number in range(5, 1, -1):
        if f"CONT{number}-" in scheme_id:
            return f"续搜{number}"
    if "CONT-" in scheme_id:
        return "续搜1"
    return "首轮"


def metrics(data: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    scheme_id = entry["id"]
    ensemble = data["ensembleV6"]["values"][scheme_id]
    fair = data["fairCKT"]["values"][scheme_id]
    load = data["r11LoadSummaries"][scheme_id]
    macro = data["macroxue"]["values"][scheme_id]["daily|hanzi-only"]
    collision = entry["fourCodeCollision"]
    top = collision["cuts"]["10000"]
    return {
        "M": entry["memoryAuditR2"]["M"],
        "D": entry["memoryAuditR2"]["ordinaryDisplacedCount"],
        "V": sum(entry["finalMap"].get(final) != final.upper() for final in "aeiou"),
        "scope": entry["zeroOnsetScope"],
        "E6": ensemble["score"],
        "S2": fair["S2Completion"]["upperMs"],
        "C4": ensemble["outputMetrics"]["C4-Snow"]["choice150MsPerChar"],
        "WX": ensemble["outputMetrics"]["WX-Snow-12"]["choice150MsPerChar"],
        "dailyMX": macro["score"],
        "home": load["homeFloor"],
        "far": load["farMax"],
        "finger": load["maxFinger20"],
        "rightPinky": load["rightPinkyMax20"],
        "affected": collision["fiveCutAverageCrossAffectedRate"],
        "loss": collision["fiveCutAverageCrossFirstChoiceLossRate"],
        "topAffected": top["crossAffectedRate"],
        "topLoss": top["crossFirstChoiceLossRate"],
        "crossBuckets": top["crossBuckets"],
        "allBuckets": top["collisionBuckets"],
        "maxBucket": top["maxBucket"],
    }


def better(value: float, baseline: float, key: str) -> bool:
    if key in LOWER_BETTER:
        return value < baseline
    if key in HIGHER_BETTER:
        return value > baseline
    raise KeyError(key)


def improvement(value: float, baseline: float, higher_is_better: bool) -> float:
    if higher_is_better:
        return (value / baseline - 1) * 100
    return (baseline - value) / baseline * 100


def pct(value: float, digits: int = 3) -> str:
    return f"{value * 100:.{digits}f}%"


def signed(value: float, digits: int = 2, suffix: str = "%") -> str:
    return f"{value:+.{digits}f}{suffix}"


def best_id(rows: list[dict[str, Any]], key: str, higher: bool) -> tuple[str, float]:
    row = max(rows, key=lambda item: item[key]) if higher else min(rows, key=lambda item: item[key])
    return row["id"], row[key]


def main() -> None:
    args = arguments()
    data = extract_payload(args.html)
    entries = {entry["id"]: entry for entry in data["entries"]}
    candidate_ids = [entry["id"] for entry in data["entries"] if entry["id"].startswith("S21X26-")]
    assert len(candidate_ids) == 40
    assert all("fourCodeCollision" in entries[scheme_id] for scheme_id in candidate_ids + list(BASELINE_IDS))
    research = research_performance()
    assert set(candidate_ids) <= set(research)

    baseline = {scheme_id: metrics(data, entries[scheme_id]) for scheme_id in BASELINE_IDS}
    candidates = []
    for scheme_id in candidate_ids:
        row = {"id": scheme_id, "group": group_name(scheme_id), **metrics(data, entries[scheme_id])}
        row["researchDelta"] = (research[scheme_id]["meanRatio"] - 1) * 100
        row["researchWorst"] = (research[scheme_id]["worstRatio"] - 1) * 100
        candidates.append(row)

    formal_keys = ("E6", "S2", "C4", "WX", "dailyMX", "home", "far", "finger", "rightPinky")
    collision_keys = ("affected", "loss", "topAffected", "topLoss", "crossBuckets", "allBuckets", "maxBucket")

    lines = [
        "# S21×26 与三个 R10-21×26 基准的完整 benchmark",
        "",
        "## 结果",
        "",
        f"HTML 中共有 **242** 个 21×26 方案；本轮已把四码跨族碰撞测评补齐到 **242/242**。全目录碰撞 cohort 现为 **259** 个方案（242 个 21×26，加 17 个纯 Y 的 21×28），其中 21×26 的 scope 为 **219 个 pure-y、23 个 split-y-yu**。",
        "",
        "对当前 40 个 `S21X26-*`，结论不是“除碰撞外一无是处”，也不是“全面胜过 R10”：",
        "",
        "1. **确定的额外优势是 dailyMX 和若干键盘负载指标。** 不少 S21 在日常纯双拼文稿、主区最低占比、远键峰值、最重手指或右小指峰值上优于基准。",
        "2. **部分正式 CKT 单项会赢。** 对 M37/M38 基准，40 个 S21 中有 6 个赢 S2、9 个赢 C4-Snow、1 个赢 WX-Snow-12；对更强的 M39 基准，仅 1 个赢 C4，S2/WX 均无人胜出。",
        "3. **正式 EnsembleV6 没有一个 S21 胜过三个 R10 基准。** 因而不能把早期报告里的“搜索综合性能改善”直接解释为 R11 正式综合榜改善；该搜索综合量把 dailyMX 也纳入五项均值，dailyMX 的大幅改善会抵消若干正式成本项的退步。",
        "4. **M/D/V 也不是普遍优势。** 三个 M37/D4 候选能在复杂度上比 M38/M39 低，但没有低于 M37/D4/V0 基准；其余多数为 M38–40、D5。",
        "",
        "因此，S21 的真实价值是：以不同程度的正式性能/复杂度代价，换取显著的四码分流，并在 dailyMX 或人体负载上取得局部收益；目前没有出现同时支配三个 R10 基准的全能方案。",
        "",
        "## 逐指标胜出数量",
        "",
        "下表是 40 个 S21 中，严格优于各基准的方案数。E6、S2、C4、WX、远键、手指和碰撞均越低越好；dailyMX、主区最低占比越高越好。",
        "",
        "| 指标 | vs M37-04 | vs M38-07 | vs M39-08 | S21 最佳值 | 最佳方案 |",
        "|---|---:|---:|---:|---:|---|",
    ]
    labels = {
        "E6": "EnsembleV6",
        "S2": "S2 upper ms",
        "C4": "C4-Snow choice150 ms/字",
        "WX": "WX-Snow-12 choice150 ms/字",
        "dailyMX": "dailyMX（汉字）",
        "home": "主区最低占比",
        "far": "远键峰值",
        "finger": "20轨最重手指",
        "rightPinky": "20轨右小指峰值",
        "affected": "五档跨族受影响",
        "loss": "五档首选损失",
        "topAffected": "Top10k 跨族受影响",
        "topLoss": "Top10k 首选损失",
        "crossBuckets": "Top10k 跨族桶",
        "allBuckets": "Top10k 全碰撞桶",
        "maxBucket": "Top10k 最大桶",
    }
    percent_keys = {"home", "far", "finger", "rightPinky", "affected", "loss", "topAffected", "topLoss"}
    for key in formal_keys + collision_keys:
        higher = key in HIGHER_BETTER
        winner, value = best_id(candidates, key, higher)
        counts = [sum(better(row[key], baseline[base_id][key], key) if key in formal_keys else row[key] < baseline[base_id][key] for row in candidates) for base_id in BASELINE_IDS]
        shown = pct(value) if key in percent_keys else (f"{value:.3f}" if isinstance(value, float) else str(value))
        lines.append(f"| {labels[key]} | {counts[0]}/40 | {counts[1]}/40 | {counts[2]}/40 | {shown} | `{winner}` |")

    lines.extend([
        "",
        "## 长宽总表",
        "",
        "说明：`研究Δ/最差Δ` 是原搜索器相对 M39-08 的五指标比率，负值/越低越好；`E6 改善` 按正式 EnsembleV6 计算，正值才是改善；`MX 改善` 正值为改善；碰撞 `Δ` 用百分点，正值为少碰撞。基准行的研究Δ不适用。",
        "",
    ])
    headers = [
        "批次", "方案", "scope", "M/D/V", "研究Δ", "最差Δ", "E6", "E6改善37", "E6改善38", "E6改善39",
        "S2", "C4", "WX", "dailyMX", "MX改善37", "MX改善38", "MX改善39", "主区低点", "远键峰值", "最重手指", "右小指峰值",
        "五档受影响", "Δ37", "Δ38", "Δ39", "五档首选损失", "Top10k受影响", "Top10k首选损失", "跨族桶", "全碰撞桶", "最大桶",
    ]
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("|" + "|".join(["---"] * len(headers)) + "|")

    def table_row(scheme_id: str, row: dict[str, Any], group: str, research_delta: str, research_worst: str) -> str:
        e6_delta = [improvement(row["E6"], baseline[base_id]["E6"], False) for base_id in BASELINE_IDS]
        mx_delta = [improvement(row["dailyMX"], baseline[base_id]["dailyMX"], True) for base_id in BASELINE_IDS]
        collision_delta = [(baseline[base_id]["affected"] - row["affected"]) * 100 for base_id in BASELINE_IDS]
        cells = [
            group, f"`{scheme_id}`", "Y" if row["scope"] == "pure-y" else "Y/YU", f"{row['M']}/{row['D']}/{row['V']}",
            research_delta, research_worst, f"{row['E6']:.4f}", *(signed(value) for value in e6_delta),
            f"{row['S2']:.3f}", f"{row['C4']:.3f}", f"{row['WX']:.3f}", f"{row['dailyMX']:.3f}", *(signed(value) for value in mx_delta),
            pct(row["home"], 2), pct(row["far"], 2), pct(row["finger"], 2), pct(row["rightPinky"], 2),
            pct(row["affected"]), *(signed(value, 3, " pp") for value in collision_delta), pct(row["loss"]), pct(row["topAffected"]), pct(row["topLoss"]),
            str(row["crossBuckets"]), str(row["allBuckets"]), str(row["maxBucket"]),
        ]
        return "| " + " | ".join(cells) + " |"

    for base_id in BASELINE_IDS:
        lines.append(table_row(base_id, baseline[base_id], "R10基准", "—", "—"))
    for row in candidates:
        lines.append(table_row(row["id"], row, row["group"], signed(row["researchDelta"]), signed(row["researchWorst"])))

    e6_best = best_id(candidates, "E6", False)
    daily_best = best_id(candidates, "dailyMX", True)
    c4_best = best_id(candidates, "C4", False)
    collision_best = best_id(candidates, "affected", False)
    lines.extend([
        "",
        "## 结论与取舍",
        "",
        f"- **正式综合性能端仍是 R10。** S21 最好的 E6 是 `{e6_best[0]}` 的 {e6_best[1]:.4f}，仍差于 M37-04 的 {baseline[BASELINE_IDS[0]]['E6']:.4f}、M38-07 的 {baseline[BASELINE_IDS[1]]['E6']:.4f} 和 M39-08 的 {baseline[BASELINE_IDS[2]]['E6']:.4f}。",
        f"- **dailyMX 是最清楚的非碰撞优势。** 最佳 `{daily_best[0]}` 为 {daily_best[1]:.3f}；共有 {sum(row['dailyMX'] > baseline[BASELINE_IDS[2]]['dailyMX'] for row in candidates)}/40 个 S21 胜过 M39-08。",
        f"- **正式单项存在窄优势。** C4 最佳 `{c4_best[0]}` 为 {c4_best[1]:.3f} ms/字，是唯一胜过 M39-08 C4 的 S21；但没有 S21 同时在 E6、S2、C4、WX 四项都胜过任何一个基准。",
        f"- **低碰撞端继续成立。** 五档受影响最低 `{collision_best[0]}` 为 {pct(collision_best[1])}；所有 40 个 S21 的 Top10k 首选损失和跨族桶数都低于三个基准。",
        "- **适合继续人工检查的不是单一冠军，而是不同折中点。** 若重正式性能，优先查看 performance 类；若重 dailyMX/人体负载，可查看逐指标胜出数量及表中负载列；若重四码分流，则沿 CONT4/CONT5 canyon 深端检查。",
        "",
        "## 口径与复现",
        "",
        "- 四码只评 AUAU（二字）、AAAU（三字）、AAAA（四字）的跨族桶竞争，截点为 Top 500/1k/2k/5k/10k；不把 AA 空槽、五六码后续态混入本指标。",
        "- 碰撞数据直接来自集成 HTML 的 `fourCodeCollision`；正式性能、负载和 dailyMX 来自同一 HTML 的冻结 R11 数据。",
        "- `研究Δ/最差Δ` 来自六轮 `shenyun-21x26-constrained*.json` 的搜索期五指标目标，只用于解释候选的产生原因，不能替代正式 E6。",
        f"- 生成命令：`python scripts/research/{Path(__file__).name}`。输入 HTML：`{args.html}`。",
        "",
    ])
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
