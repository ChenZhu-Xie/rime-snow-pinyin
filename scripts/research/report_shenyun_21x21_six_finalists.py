#!/usr/bin/env python3
"""Write the transposed six-layout report from the integrated R11 atlas."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from integrate_shenyun_21x21_b_paths import DATA, DEFAULT_HTML, load_module
from integrate_shenyun_21x21_between_finalists import IDS, shifted_initials

HERE = Path(__file__).resolve().parents[2]
OUTPUT = HERE / "research-notes/shenyun-21x21-b-paths-six-scheme-comparison.md"
SCHEMES = ("S005", "R9-21X21-M40-02", *IDS)
B_LABELS = (
    ("键道·单字+B1", "j1"),
    ("键道·单字+B1+B2", "j2"),
    ("三拼·单字+B1", "s1"),
    ("三拼·单字+B1+B2", "s2"),
    ("键道·二字词+B1", "wj1"),
    ("键道·二字词+B1+B2", "wj2"),
    ("三拼·二字词+B1", "ws1"),
    ("三拼·二字词+B1+B2", "ws2"),
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    atlas = args.benchmark.resolve()
    import sys
    sys.path.insert(0, str(atlas.parent / "tools"))
    helper = load_module("r11_atlas_reader", atlas.parent / "tools/integrate_shenyun_21x28.py")
    data, _, _ = helper.extract_payload(atlas.read_text(encoding="utf-8"))
    entries = {e["id"]: e for e in data["entries"]}
    assert len(SCHEMES) == 6 and all(s in entries for s in SCHEMES)
    reference = entries["S005"]["bPathMetrics"]

    def pct(x: float, places: int = 3) -> str:
        return f"{100 * x:.{places}f}"

    def num(x: float, places: int = 3) -> str:
        return f"{x:.{places}f}"

    def section(label: str) -> list[str]:
        return [f"| **{label}** |" + " |" * len(SCHEMES)]

    def row(label: str, fn) -> str:
        return "| " + label + " | " + " | ".join(str(fn(s, entries[s])) for s in SCHEMES) + " |"

    lines = [
        "# 六套 21×21 方案：M41/D1 跨盆地代表、R9 与 S005",
        "",
        "本表直接读取已更新的 `a7_CKT_R11.html` 冻结 R11 数据。列是方案，行是属性；四套 BPK 分别代表 S2 最快、v5 最低、八项余量较宽、右小指 Pmax 最低。所有方案均为 21×21。时间是模型上界，不是实测输入速度。百分率行只写数值，单位在行名中。加权 B 路径非首选率保留六位小数，以便看到最窄的胜出余量。",
        "",
        "| 属性 | " + " | ".join(f"`{s}`" for s in SCHEMES) + " |",
        "| --- | " + " | ".join("---:" for _ in SCHEMES) + " |",
    ]
    lines += section("结构与记忆")
    lines += [
        row("容量（声×韵）", lambda s, e: "×".join(map(str, e["capacity"]))),
        row("五辅键预留（原字段顺序）", lambda s, e: f"`{e.get('reservedKeys', '—')}`"),
        row("调／辅五类顺序", lambda s, e: f"`{e['tone']}`"),
        row("普通声母移位（下划线标记）", lambda s, e: "、".join(f"`{i}_→{k}`" for i, k in shifted_initials(e).items()) or "—"),
        row("记忆代理 M ↓", lambda s, e: e["memoryAuditR2"]["M"]),
        row("移位普通声母 D ↓", lambda s, e: e["memoryAuditR2"]["ordinaryDisplacedCount"]),
        row("声母关联项", lambda s, e: e["memoryAuditR2"]["firstLinks"]),
        row("韵母关联项", lambda s, e: e["memoryAuditR2"]["finalLinks"]),
        row("条件分支项", lambda s, e: e["memoryAuditR2"]["branchCount"]),
        row("共同 399 音节裸二键唯一 U ↑", lambda s, e: e["memoryAuditR2"]["unique"]),
        row("裸二键加权非首选率 % ↓", lambda s, e: pct(data["fairCKT"]["values"][s]["S2miss"], 6)),
    ]
    lines += section("八项 B 路径：加权非首选率 % ↓")
    for label, key in B_LABELS:
        lines.append(row(label, lambda s, e, key=key: pct(e["bPathMetrics"][key], 6)))
    lines += [
        row("低于 S005 的 B 路径项数 / 8 ↑", lambda s, e: sum(e["bPathMetrics"][key] < reference[key] for _, key in B_LABELS)),
        row("最窄 S005−方案余量，百分点 ↑", lambda s, e: num(min(100 * (reference[key] - e["bPathMetrics"][key]) for _, key in B_LABELS), 6)),
    ]
    lines += section("键位负担：冻结 20 合同")
    load = data["r11LoadSummaries"]
    lines += [
        row("右小指最大负担 Pmax % ↓", lambda s, e: pct(load[s]["rightPinkyMax20"])),
        row("Pmax 所在合同", lambda s, e: f"`{load[s]['rightPinkyTrack']}`"),
        row("裸二键主行 H-S2 % ↑", lambda s, e: pct(load[s]["homeS2"])),
        row("C4-Snow 主行 % ↑", lambda s, e: pct(load[s]["homeC4"])),
        row("WX-Snow-21 主行 % ↑", lambda s, e: pct(load[s]["homeWX"])),
        row("三路径主行最低值 % ↑", lambda s, e: pct(load[s]["homeFloor"])),
        row("左小指最大负担 % ↓", lambda s, e: pct(load[s]["leftPinkyMax20"])),
    ]
    lines += section("冻结路径时间上界与补全")
    tracks = data["ckt"]["tracks"]
    for label, key in (
        ("裸二键 S2 上界 ms ↓", "S2"),
        ("单字二码 C2 上界 ms ↓", "C2"),
        ("三拼单字一 B C3 上界 ms ↓", "C3"),
        ("键道单字二 B C4-Snow 上界 ms ↓", "C4-Snow"),
        ("二字词四码 W4-Snow 上界 ms ↓", "W4-Snow"),
        ("键道二字词二 B WX-Snow-21 上界 ms ↓", "WX-Snow-21"),
        ("三拼二字词二 B W6-21 上界 ms ↓", "W6-21"),
    ):
        lines.append(row(label, lambda s, e, key=key: num(tracks[s][key]["upperMs"])))
    lines += [
        row("裸二键公平补全上界 ms ↓", lambda s, e: num(data["fairCKT"]["values"][s]["S2Completion"]["upperMs"])),
        row("裸二键公平补全平均码长 ↓", lambda s, e: num(data["fairCKT"]["values"][s]["S2Completion"]["meanKeys"], 4)),
    ]
    lines += section("系综")
    for name in ("ensembleV4", "ensembleV5", "ensembleV6"):
        lines.append(row(name + " 分数 ↓", lambda s, e, name=name: num(data[name]["values"][s]["score"], 5)))
    lines += [
        "",
        "## 结果与结论",
        "",
    ]
    fastest, best_v5, wider, min_p = IDS
    b = lambda s, k: entries[s]["bPathMetrics"][k]
    wins = lambda s: sum(b(s, k) < reference[k] for _, k in B_LABELS)
    assert all(wins(s) == 8 for s in IDS)
    margin = lambda s: min(100 * (reference[k] - b(s, k)) for _, k in B_LABELS)
    lines += [
        f"1. **八项门槛：四套均 8/8 严格胜过 S005；R9 为 {wins(SCHEMES[1])}/8。**最窄余量分别为 {margin(fastest):.6f}、{margin(best_v5):.6f}、{margin(wider):.6f}、{margin(min_p):.6f} 个百分点。最快与 v5 最低方案的瓶颈都是键道二字词二 B，余量很窄，不能推断换语料后仍全胜。",
        f"2. **速度与系综：**最快方案 S2 为 {tracks[fastest]['S2']['upperMs']:.3f} ms，比 R9 慢 {tracks[fastest]['S2']['upperMs']-tracks[SCHEMES[1]]['S2']['upperMs']:.3f} ms，但比 S005 快 {tracks[SCHEMES[0]]['S2']['upperMs']-tracks[fastest]['S2']['upperMs']:.3f} ms。v5 最低方案为 {data['ensembleV5']['values'][best_v5]['score']:.5f}，仍高于 R9 的 {data['ensembleV5']['values'][SCHEMES[1]]['score']:.5f}；四套 v6 则均低于 S005 的 10.00000。",
        f"3. **负担与记忆：**四套均 M41/D1、H-S2 超过 50%、Pmax 低于 R9 的 {pct(load[SCHEMES[1]]['rightPinkyMax20'])}%。只有最低 P 方案的 Pmax ({pct(load[min_p]['rightPinkyMax20'])}%) 同时低于 S005 ({pct(load[SCHEMES[0]]['rightPinkyMax20'])}%)，代价是 S2 上界升至 {tracks[min_p]['S2']['upperMs']:.3f} ms。宽余量方案的 H-S2 为 {pct(load[wider]['homeS2'])}%，在四套中最高。",
        "4. **性能边界与选型：**四套的 v4 均高于 R9 和 S005；部分字词路径时间也未超过 S005，八项碰撞率全胜不等于每条路径的模型上界都更快。追求裸二键速度先看最快方案；在同一八项碰撞分组内重视 v5 看 v5 最低方案；重视八项余量与主行看宽余量方案；右小指负担优先看最低 P 方案。",
        "",
        "## 口径与核验",
        "",
        "B1/B2 指追加的第一个、第二个 B 集合。键道单字用首、次形码，三拼单字用调、纯笔画；键道二字词用次字、首字形码，三拼二字词用次字、首字声调。八项为同一冻结字词频和候选排序口径的加权非首选率，越低越好。Pmax 是 20 合同右小指最大负担，H-S2 是裸二键路径的主行占比。M 为 M-R2 关联代理，D 为普通声母移位个数。",
        "",
        "四套新方案的 `j` 移至 `F`。键盘 SVG 用真实映射判定非直映声母，给 `j` 加下划线；表中 `j_→F` 保留显式记号。加入方案时逐项核对原 R11 重放、独立 B 路径评分与 HTML 冻结数据；全目录移位声母也经过显示位置审计。静态及语料比较不等同于真实 Rime 候选行为测试。",
        "",
        "## 键盘图的键域标记",
        "",
        "声韵兼用是 21×21 方案的常态，采用近白底；仅声使用淡蓝，仅韵使用暖金，五辅键专用使用淡绿，未用键为中性灰。多韵键由金棕粗框区分，零声母仍沿用自己的虚线标记，F/J 用键帽底部短横表示定位键。负担视图另用单一绿色深浅编码负载，避免把键域分类误读为负担大小。",
        "",
        "数据：[五套跨盆地状态及独立八项](data/shenyun-21x21-b-paths-between-finalists.json)、[原引擎重放摘要](data/shenyun-21x21-b-paths-between-finalists-exact.json)、[正式 B 集合基准](shenyun-21x21-b-sets-benchmark.md)。",
        "",
    ]
    output = args.output.resolve()
    output.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"output": str(output), "schemes": list(SCHEMES), "rows": len(lines)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
