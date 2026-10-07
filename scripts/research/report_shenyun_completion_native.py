#!/usr/bin/env python3
"""Write a cross-domain R11 native-B comparison from the integrated atlas."""

from __future__ import annotations

import argparse
import base64
from collections import defaultdict
import gzip
import json
from pathlib import Path
from statistics import median

from integrate_shenyun_21x21_b_paths import DEFAULT_HTML, PATH_NAMES

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "research-notes/shenyun-completion-native-fair-comparison.md"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    html = args.html.read_text(encoding="utf-8")
    start = html.index(">", html.index('<script id="payload"')) + 1
    end = html.index("</script>", start)
    data = json.loads(gzip.decompress(base64.b64decode(html[start:end])))
    native, fixed = data["completionB"], data["completionBFixed"]
    reference = next(e["bPathMetricsNative"] for e in data["entries"] if e["id"] == "S005")
    grouped = defaultdict(list)
    items = []
    for entry in data["entries"]:
        ident = entry["id"]
        score = native["ensembleScores"][ident]["word2"]["150"]
        old = fixed["ensembleScores"][ident]["word2"]["150"]
        modes = native["schemes"][ident]["modes"]
        item = {
            "id": ident, "domain": "×".join(map(str, entry["capacity"])),
            "aux": entry.get("auxiliaryClass") or entry.get("reservedKeys") or "other",
            "tone": entry.get("tone"), "score": score, "fixed": old,
            "eight": all(entry["bPathMetricsNative"][key] < reference[key] for key in PATH_NAMES),
            "coverage": min(modes[mode][kind]["coverage"] for mode in ("keytao", "sanpin") for kind in ("character", "word")),
            "extrapolated": max(modes[mode][kind]["extrapolatedCodeShare"] for mode in ("keytao", "sanpin") for kind in ("character", "word")),
            "M": entry.get("searchMemoryNoTone") or entry.get("memoryAuditR2", {}).get("M"),
            "D": entry.get("mappingAudit", {}).get("ordinaryInitialDisplacements"),
            "topgong": entry.get("topgongValid") is not False,
            "reservation": entry.get("auxiliaryMappingMatchesReservation") is not False,
        }
        items.append(item)
        grouped[(item["domain"], item["aux"])].append(item)
    strict = [item for item in items if item["topgong"] and item["reservation"]
              and item["coverage"] == 1 and item["extrapolated"] == 0]
    lines = [
        "# R11 各方案辅键映射与指定词尾顺序比较", "",
        "## 口径", "",
        "- 全部方案使用冻结 R11 Common8095 单字和 Snow 常见二字词的相同字词频、候选排序、CKT 上界与 τ=150 ms。",
        "- 每套方案的调、形、纯笔画 B 键均取其有序 `tone` 映射；单字依旧为键道形 B1/B2、三拼调 B1/纯笔画 B2。",
        "- **本轮指定合同**：键道 21×21 二字词先追加首字 B、再追加次字 B；其他键域键道二字词与所有三拼二字词先追加次字 B、再追加首字 B。后者符合[冰雪飞花四码顶](https://input.tansongchen.com/snow-feihua/basic)的 B₂B₁ 顺序。21×21 的 B₁B₂ 与现行 [`snow_jiandao` 候选过滤器](../lua/snow/shape_filter.lua) 的二字全码一致；[`shenyun.lua`](../lua/snow/shenyun.lua) 属于另一套原型，不能用于推断键道编码。键道的两字 630 简码另有次字取码特例，本报告的 `IRIR+B` 不涉及它。",
        "- 八项非首选率在相同字词队列内按频率求平均。原生 1:2 综合分在四条路径上按单字各 1/6、二字词各 1/3，以同 τ 的 S005 时间归一后取四次均方根；越低越好。",
        "- 固定 IVUAO 对照统一假设物理 B 键为 IVUAO，词尾顺序与原生列相同；它用来隔离声韵布局差异，不能表示非 IVUAO 方案的原生体验。模型速度对应 1:2 输入项目时，每汉字时间为 `(T字+2T词)/5`。",
        f"- 早先 21×21 八项基准误用了次字先顺序；那批搜索与表格的键道词两项属于历史测评口径，与实际键道二字全码不一致。本报告和当前 HTML 按首字先重算，其数值不能与历史门槛互换。S005 键道词一 B 非首选率从历史口径的 {data['bPathBenchmarkLegacy']['referenceS005']['wj1']:.5%} 变为现行口径的 {reference['wj1']:.5%}；二 B 非首选率为 {reference['wj2']:.5%}。",
        "- 不以键域大小直接修正时间。比较时另看 M、D、右小指、主行；CKT 外推比例非零的组需要额外审视。顶功约束不合格或辅键与保留集合不一致的方案仍展示模型值，但单独标记，不视为可直接落地的同合同方案。", "",
        f"共 {len(items)} 套；四条路径的最低语料覆盖率 {min(x['coverage'] for x in items):.3%}。S005 原生 1:2 分为 10。",
        f"其中 {len(strict)} 套同时满足顶功标记、辅键保留一致、完整覆盖及零 CKT 外推；该严格子集有 {sum(x['eight'] for x in strict)} 套八项全优于 S005，最低综合分为 `{min(strict, key=lambda x: x['score'])['id']}`（{min(x['score'] for x in strict):.5f}）。八项全优数量跨不同词尾顺序，仅表示各自指定打法对 S005 的结果门槛；21×21 键道词尾顺序与现行 Rime 一致，非 21×21 的方案仍是按本轮指定顺序建模，不能据此推出已部署的实际打法。", "",
        "## 键域与辅键类", "",
        "| 键域 | 辅键类 | 套数 | 原生八项全优于 S005 | 顶功合格 | 辅键保留一致 | 最好原生 1:2 | 最佳方案 | 原生－固定分差中位数 | 最大 CKT 外推 |",
        "|---|---|---:|---:|---:|---:|---:|---|---:|---:|",
    ]
    for (domain, aux), group in sorted(grouped.items(), key=lambda kv: (int(kv[0][0].split('×')[0]), int(kv[0][0].split('×')[1]), kv[0][1])):
        best = min(group, key=lambda x: x["score"])
        lines.append(f"| {domain} | {aux} | {len(group)} | {sum(x['eight'] for x in group)} | {sum(x['topgong'] for x in group)} | {sum(x['reservation'] for x in group)} | {best['score']:.5f} | {best['id']} | {median(x['score']-x['fixed'] for x in group):+.5f} | {max(x['extrapolated'] for x in group):.2%} |")
    lines += ["", "## 原生 1:2 前十五", "",
              "| 序 | 方案 | 键域 | 辅键类 | M | D | 原生分 | 固定分 | 八项全优 | 顶功合格 | 辅键保留一致 | 最大 CKT 外推 |",
              "|---:|---|---|---|---:|---:|---:|---:|---|---|---|---:|"]
    for index, item in enumerate(sorted(items, key=lambda x: x["score"])[:15], 1):
        lines.append(f"| {index} | {item['id']} | {item['domain']} | {item['aux']} | {item['M'] if item['M'] is not None else '—'} | {item['D'] if item['D'] is not None else '—'} | {item['score']:.5f} | {item['fixed']:.5f} | {'是' if item['eight'] else '否'} | {'是' if item['topgong'] else '否'} | {'是' if item['reservation'] else '否'} | {item['extrapolated']:.2%} |")
    best21 = min((x for x in strict if x["domain"] == "21×21"), key=lambda x: x["score"])
    best2126 = min((x for x in strict if x["domain"] == "21×26"), key=lambda x: x["score"])
    best2626 = min((x for x in strict if x["domain"] == "26×26"), key=lambda x: x["score"])
    lines += ["", "## 结果与边界", "",
              f"- 严格子集的 21×21、21×26、26×26 最佳指定合同分依次为 {best21['score']:.5f}（`{best21['id']}`）、{best2126['score']:.5f}（`{best2126['id']}`）、{best2626['score']:.5f}（`{best2626['id']}`）。较大键域能取得更低的综合模型时间，但本次不同键域的键道词 B 顺序也不同；分数不表示相同键域、词尾合同或记忆预算。",
              "- AEUIO 与 ANY5 的原生分和固定 IVUAO 对照可能一升一降，故固定键实验不能替代原生排名。",
              "- 25×30 组存在非零 CKT 外推；其分数应连同外推比例阅读。结果仍是静态击键与一次残余选重假设，没有实际打字、候选翻页或提交动作计时。", "",
              "## 复现", "",
              "评分：`node scripts/research/score_shenyun_completion_ckt.js --html <R11.html> --output research-notes/data/shenyun-completion-ckt-native-r11.json --mapping native`。",
              "入库/复核：`python scripts/research/correct_shenyun_completion_word_order.py --native research-notes/data/shenyun-completion-ckt-native-r11.json --fixed research-notes/data/shenyun-completion-ckt-fixed-r11.json`。",
              "本表：`python scripts/research/report_shenyun_completion_native.py`。", ""]
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "schemes": len(items),
                      "eightBetter": sum(x["eight"] for x in items),
                      "strict": len(strict), "strictEightBetter": sum(x["eight"] for x in strict),
                      "best": min(items, key=lambda x: x["score"])["id"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
