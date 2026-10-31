import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";
import {
	decorateComparison,
	decorateMarkdownTable,
	linkShenyunTerms,
} from "../../lib/shenyun-markdown";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const values = (...entries: Array<[string, number | number[]]>) =>
	entries.map(([display, score]) => ({ display, score }));
const includes = (source: string, expected: string, message?: string) =>
	assert.ok(source.includes(expected), message ?? `缺少：${expected}`);

describe("神韵文档比较装饰", () => {
	test("单星比较两个 21×21 方案，双星比较前三方案，奖牌比较全部四方案", () => {
		assert.deepEqual(
			decorateComparison(values(["1", 1], ["2", 2], ["3", 3], ["1", 1]), "min"),
			["**1** ★★ 🥇", "**2** ★", "3", "1 🥇"],
		);
		assert.deepEqual(
			decorateComparison(values(["3", 3], ["2", 2], ["2", 2], ["1", 1]), "min"),
			["3", "**2** ★★", "**2** ★★", "1 🥇"],
		);
	});

	test("支持高优、接近 50% 与飞键三元组总数", () => {
		assert.deepEqual(
			decorateComparison(values(["8", 8], ["7", 7], ["6", 6], ["9", 9]), "max"),
			["**8** ★★", "**7** ★", "6", "9 🥇"],
		);
		assert.deepEqual(
			decorateComparison(
				values(["49%", 0.49], ["48%", 0.48], ["53%", 0.53], ["51%", 0.51]),
				"closest-to-half",
			),
			["**49%** ★★ 🥇", "**48%** ★", "53%", "51% 🥇"],
		);
		assert.deepEqual(
			decorateComparison(
				values(
					["0 / 0 / 0", [0, 0, 0]],
					["0 / 0 / 0", [0, 0, 0]],
					["2 / 0 / 1", [2, 0, 1]],
					["0 / 1 / 7", [0, 1, 7]],
				),
				"triple-sum",
			),
			["**0 / 0 / 0** ★★ 🥇", "**0 / 0 / 0** ★★ 🥇", "2 / 0 / 1", "0 / 1 / 7"],
		);
	});

	test("Markdown 表格装饰可重复运行且不会累加标记", () => {
		const source = [
			"| 指标 | Overall | U357 | S005 | B04 |",
			"| --- | ---: | ---: | ---: | ---: |",
			"| 低优 | 1 | 2 | 3 | 1 |",
			"| 飞键 | 0 / 0 / 0 | 0 / 0 / 0 | 2 / 0 / 1 | 0 / 1 / 7 |",
		].join("\n");
		const once = decorateMarkdownTable(source, ["min", "triple-sum"]);
		includes(once, "| 低优 | **1** ★★ 🥇 | **2** ★ | 3 | 1 🥇 |");
		includes(
			once,
			"| 飞键 | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 |",
		);
		assert.equal(decorateMarkdownTable(once, ["min", "triple-sum"]), once);
		assert.ok(!once.includes("★ ★★"));
	});
});

test("为四个方案名补链接且不嵌套已有链接", () => {
	const source =
		"神韵(Overall-17) 21×26 双拼、无飞键道(U357) 21×21 双拼、S005、[首道 B04](https://example.com/b04)";
	const linked = linkShenyunTerms(source, "zh", "github");
	includes(
		linked,
		"[神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html)",
	);
	includes(
		linked,
		"[无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)",
	);
	includes(
		linked,
		"[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)",
	);
	includes(linked, "[首道 B04](https://example.com/b04)");
	assert.ok(!linked.includes("[[首道 B04]"));
});

test("生成报告在所有可比较表中保留图例、星标与奖牌", () => {
	const report = read("reports/shenyun-comparison.md");
	includes(report, "**粗体** ★");
	includes(report, "**粗体** ★★");
	assert.ok(!report.includes("★ ★★"));
	includes(report, "🥇");
	includes(
		report,
		"[Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)",
	);
	for (const heading of [
		"## 总览",
		"## [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 成本分解",
		"## 冻结语料加权非首选率",
		"## 逐级辅键后的频率加权残余非首选率",
	]) {
		const section = report.split(heading)[1]?.split("\n## ")[0] ?? "";
		includes(section, "★", heading);
		includes(section, "🥇", heading);
	}
	const buckets =
		report.split("## 二／三／四字词的终局碰撞桶")[1]?.split("\n## ")[0] ?? "";
	assert.ok(!buckets.includes("★"));
	assert.ok(!buckets.includes("🥇"));
});

test("两张纯双拼热力图使用相同裁剪、背景和短标题", () => {
	for (const path of [
		"docs/shenyun-overall17-keyboard-heat.svg",
		"docs/shenyun-u357-keyboard-heat.svg",
	]) {
		const svg = read(path);
		includes(svg, 'viewBox="0 0 790 304"');
		includes(svg, '<rect width="790" height="304" fill="#fbfcfa"/>');
		includes(
			svg,
			'<title id="title">日常八场景文稿纯双拼键频图（含标点）</title>',
		);
		assert.equal(svg.match(/data-mxkey=/gu)?.length, 29);
	}
});

test("两份 README 的六张比较表、标题和方案链接完整", () => {
	for (const filename of ["README.md", "README_CN.md"]) {
		const readme = read(filename);
		const lines = readme.split("\n");
		const tables = lines
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => /^\| (?:指标|Metric|指標) \|/u.test(line))
			.map(({ index }) => {
				const rows: string[] = [];
				for (
					let cursor = index;
					cursor < lines.length && lines[cursor].startsWith("|");
					cursor++
				)
					rows.push(lines[cursor]);
				return rows.join("\n");
			});
		assert.equal(tables.length, 3);
		for (const table of tables) {
			includes(table, "★");
			includes(table, "★★");
			includes(table, "🥇");
		}
		for (const heading of [
			"**声韵辅-键 映射**",
			"**Initial/final/auxiliary-key mapping**",
			"**聲韻輔-鍵 映射**",
		])
			assert.equal(readme.split(heading).length - 1, 2, heading);
		for (const heading of [
			"**日常八场景文稿纯双拼键频图（含标点）**",
			"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
			"**日常八場景文稿純雙拼鍵頻圖（含標點）**",
		])
			assert.equal(readme.split(heading).length - 1, 2, heading);
		includes(
			readme,
			"[神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html)",
		);
		includes(
			readme,
			"[无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)",
		);
		includes(readme, "[`snow_shenyun_shape`](snow_shenyun_shape.schema.yaml)");
		includes(readme, "[`a7_CKT_R11.html`](https://");
		includes(readme, "**粗体** ★");
		includes(readme, "**粗体** ★★");
		includes(readme, "**Bold** ★");
		includes(readme, "**Bold** ★★");
		includes(readme, "**粗體** ★");
		includes(readme, "**粗體** ★★");
		assert.ok(!readme.includes("★ ★★"));
	}
});
