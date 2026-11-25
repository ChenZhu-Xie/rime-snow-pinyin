"""从含选重 JSON 生成九宫格均键图；运行：python scripts/plot-character-selection-report.py。"""
import argparse
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import MultipleLocator
from matplotlib.patches import Patch
from decimal import Decimal, ROUND_HALF_UP


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--report-dir", type=Path, default=ROOT / "reports")
args = parser.parse_args()
stem = "8000字_十二方案含选重键数"
data = json.loads((args.report_dir / (stem + ".json")).read_text(encoding="utf-8-sig"))
cohorts = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000]
# ID 固定映射，与各表排名无关。纹理辅助识别相近颜色。
styles = {
    "sipin": ("#686D76", "", "solid"),
    "oc21-shape": ("#C45B78", "", "solid"),
    "oc21-tone": ("#C45B78", "//", "solid"),
    "qingyun": ("#C69A35", "", "solid"),
    "rc26-shape": ("#4D87BF", "", "dashed"),
    "rc26-tone": ("#4D87BF", "//", "dashed"),
    "liandao": ("#C47A46", "", "solid"),
    "zhudao": ("#399F8C", "", "dashed"),
    "classic-shape": ("#8E72B3", "", "solid"),
    "classic-tone": ("#8E72B3", "//", "solid"),
    "sbxh": ("#999999", "..", "solid"),
    "flypy": ("#B2A16B", "xx", "solid"),
}
available = {font.name for font in font_manager.fontManager.ttflist}
fonts = [f for f in ["Microsoft YaHei", "Noto Sans CJK SC", "SimHei", "WenQuanYi Zen Hei"] if f in available]
if not fonts:
    raise RuntimeError("需要中文字体：Microsoft YaHei、Noto Sans CJK SC 或 SimHei")
plt.rcParams.update({"font.family": fonts[0], "font.size": 11, "axes.unicode_minus": False,
                     "svg.fonttype": "path", "hatch.linewidth": 0.45})
schemes = data["schemes"]
assert len(schemes) == 12 and {s["id"] for s in schemes} == set(styles)
means = [s["cohorts"][str(n)]["mean"] for n in cohorts for s in schemes]
assert all(v is not None and math.isfinite(v) and v > 0 for v in means), "NA 不能画成零键"
limit = math.ceil((max(means) + 0.5) * 2) / 2
fig, axes = plt.subplots(3, 3, figsize=(21, 18.5))
fig.patch.set_facecolor("#F7F9FC")
fig.subplots_adjust(left=0.09, right=0.98, top=0.90, bottom=0.15, wspace=0.36, hspace=0.32)
fig.suptitle("十二方案 · 单字平均按键数", fontsize=27, fontweight="bold", x=0.5, y=0.97, color="#172B4D")
fig.text(0.5, 0.935, "前 m 个常用字，按字等权  |  越短越省键  |  各图同一刻度、同方案同色同纹理", ha="center", fontsize=13, color="#526174")
for ax, n in zip(axes.flat, cohorts):
    ranked = sorted(schemes, key=lambda s: s["cohorts"][str(n)]["mean"])
    values = [s["cohorts"][str(n)]["mean"] for s in ranked]
    labels = [s["name"].replace("冰雪", "").replace("（清风版）", "") for s in ranked]
    for i, (scheme, value) in enumerate(zip(ranked, values)):
        color, hatch, edge = styles[scheme["id"]]
        ax.barh(i, value, height=0.68, color=color, edgecolor="#344052", linewidth=0.8, linestyle=edge, hatch=hatch, zorder=3)
        ax.text(value + 0.07, i, str(Decimal(value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)), va="center", fontsize=10, color="#263449")
    ax.set_yticks(range(12), labels)
    ax.invert_yaxis()
    ax.set_xlim(0, limit)
    ax.xaxis.set_major_locator(MultipleLocator(1))
    ax.grid(axis="x", color="#DFE5EE", linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    ax.set_title(f"前 {n:,} 字", loc="left", pad=13, fontsize=16, fontweight="bold", color="#172B4D")
    ax.set_xlabel("平均按键数（键／字）", fontsize=10, color="#526174")
    ax.tick_params(axis="both", length=0, labelcolor="#334155", pad=5)
    for spine in ax.spines.values():
        spine.set_visible(False)
layout_legend = [
    Patch(facecolor=styles[key][0], label=label)
    for key, label in [("oc21-shape", "兰道／兰拼"), ("rc26-shape", "鹤道／鹤拼"),
                       ("classic-shape", "键道／三拼"), ("liandao", "莲道"), ("zhudao", "鹮道"),
                       ("sipin", "四拼"), ("qingyun", "清韵"), ("sbxh", "声笔小鹤"), ("flypy", "小鹤音形")]
]
fig.legend(handles=layout_legend, loc="lower center", bbox_to_anchor=(0.54, 0.092), ncol=9, frameon=False, fontsize=10, handlelength=1.8, columnspacing=1.4)
fig.legend(handles=[Patch(facecolor="#D7DEE7", edgecolor="#344052", label="双拼道系：实心"),
                    Patch(facecolor="#D7DEE7", edgecolor="#344052", hatch="//", label="双拼拼系：斜纹"),
                    Patch(facecolor="white", edgecolor="#344052", linestyle="solid", label="21×21：实线边框"),
                    Patch(facecolor="white", edgecolor="#344052", linestyle="dashed", label="21×26：虚线边框")],
           loc="lower center", bbox_to_anchor=(0.54, 0.065), ncol=4, frameon=False, fontsize=11, handlelength=2.5, columnspacing=2)
fig.text(0.09, 0.025, "样式维度仅用于双拼方案；其他方案单独着色。各图横轴从零开始，刻度一致。\n口径：优先无需选重，否则计翻页与选重；首选不计确认空格。最短性限于已枚举路径。\n十个冰雪方案为空词典引擎验证；声笔小鹤、小鹤音形（清风版）沿用原资料。", fontsize=10, color="#526174", linespacing=1.7)
for ext in ["png", "svg"]:
    target = args.report_dir / (stem + "_均键对比." + ext)
    fig.savefig(target, dpi=180, facecolor=fig.get_facecolor())
    print(target)
plt.close(fig)
