import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rootPath } from "../lib/paths";

const output = rootPath("output/prepend-experiment");
const ids = [
	"sipin",
	"oc21-shape",
	"oc21-tone",
	"rc26-shape",
	"rc26-tone",
	"liandao",
	"zhudao",
	"classic-shape",
	"classic-tone",
];
const all = ids.map((id) =>
	JSON.parse(readFileSync(join(output, `${id}-summary.json`), "utf8")),
);
for (const r of all)
	assert.ok(
		r.status.startsWith("terminal-validated"),
		`${r.name} 尚未完成验证`,
	);
for (const r of all)
	for (const row of r.summaries) {
		const baseline = r.summaries.find(
			(s: any) => s.variant === "production" && s.group === row.group,
		);
		assert.equal(row.characters, baseline.characters, `${r.id} 变体覆盖不一致`);
		assert.equal(
			row.selections,
			baseline.selections,
			`${r.id} 变体选重变化，不能仅按键数排序`,
		);
	}
const sum = (r: any, variant: string, original = false) =>
	r.summaries
		.filter(
			(s: any) =>
				s.variant === variant &&
				(original ? s.group === "original5500" : s.group !== "original5500"),
		)
		.reduce((n: number, s: any) => n + s.keys, 0);
const variants = all[0].summaries
	.filter((s: any) => s.group === "original5500" && s.variant.includes(":"))
	.map((s: any) => s.variant);
const title = (v: string) =>
	v.replace("append:", "追加").replace("prepend:", "前插");
const lines = [
	"# 前插与追加字实验",
	"",
	"九个支持追加字的冰雪方案，23 个字 × 两个方向。生产 / 追加了为基线；保留 ; 追加的及全部已有普通整词短码。删除旧 / 路径后逐篇重新优化，先最少选重再最少按键。单独按 / 也输出目标字，表中净收益包含这部分；使用次数在 JSON 中分开记录。",
	"",
	"每个方案各变体使用该方案原评测的相同可编码片段；不同方案覆盖略有差异，故跨方案只比较各自基线的增减，不混用总键数排名。纯汉字段，不计标点。",
	"",
	"实际末键验证在冻结源码副本注入实验处理器，用固定参数字「在」分别验证前插／追加的所有入选编码：要求候选覆盖完整输入、没有提前上屏，最后一次 / 输出完整预期文本。字符替换为同一拼接操作；未改生产 Lua 或方案。失败路径移除后重新优化并复验。",
	"",
	"## 长语料：基线功能收益与最佳替代",
	"",
	"| 方案 | 覆盖字数 | 生产总键数 | 追加了净省 | 追加的净省 | 最佳替代 | 相对生产省键 |",
	"| --- | ---: | ---: | ---: | ---: | --- | ---: |",
];
for (const r of all) {
	const base = sum(r, "production");
	const best = [...variants]
		.sort((a, b) => sum(r, a) - sum(r, b))
		.filter((v) => v !== "append:了")[0];
	const chars = r.summaries
		.filter(
			(s: any) => s.variant === "production" && s.group !== "original5500",
		)
		.reduce((n: number, s: any) => n + s.characters, 0);
	lines.push(
		`| ${r.name} | ${chars} | ${base} | ${sum(r, "withoutSlash") - base} | ${sum(r, "withoutSemicolon") - base} | ${title(best)} | ${base - sum(r, best)} |`,
	);
}
for (const original of [false, true]) {
	lines.push(
		"",
		`## ${original ? "原 5500 字" : "三份长语料合计"}：相对生产净省键数`,
		"",
		"正数为节省，负数为增加；0 表示持平。",
		"",
		`| 用法 | ${all.map((r) => r.name).join(" | ")} |`,
		`| --- | ${all.map(() => "---:").join(" | ")} |`,
	);
	for (const variant of variants)
		lines.push(
			`| ${title(variant)} | ${all.map((r) => sum(r, "production", original) - sum(r, variant, original)).join(" | ")} |`,
		);
}
lines.push(
	"",
	"## 四拼分语料净省键数",
	"",
	"| 用法 | 原5500字 | 维基 | 新闻 | 酒店评论 |",
	"| --- | ---: | ---: | ---: | ---: |",
);
const sipin = all[0];
for (const v of variants)
	lines.push(
		`| ${title(v)} | ${["original5500", "gsd", "pud", "hotel"].map((g) => sipin.summaries.find((s: any) => s.variant === "production" && s.group === g).keys - sipin.summaries.find((s: any) => s.variant === v && s.group === g).keys).join(" | ")} |`,
	);
writeFileSync(join(output, "summary.md"), lines.join("\n") + "\n");
console.log(join(output, "summary.md"));
