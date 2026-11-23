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
	test("前三方案按名次显示双星、单星、无星，奖牌独立比较全部四方案", () => {
		assert.deepEqual(
			decorateComparison(values(["1", 1], ["2", 2], ["3", 3], ["1", 1]), "min"),
			["**1** ★★ 🥇", "**2** ★", "3", "1 🥇"],
		);
		assert.deepEqual(
			decorateComparison(
				values(["0%", 0], ["3.270%", 0.0327], ["0.929%", 0.00929], ["0%", 0]),
				"min",
			),
			["**0%** ★★ 🥇", "3.270%", "**0.929%** ★", "0% 🥇"],
		);
		assert.deepEqual(
			decorateComparison(values(["2", 2], ["1", 1], ["3", 3], ["0", 0]), "min"),
			["**2** ★", "**1** ★★", "3", "0 🥇"],
		);
		assert.deepEqual(
			decorateComparison(values(["3", 3], ["2", 2], ["2", 2], ["1", 1]), "min"),
			["3", "**2** ★★", "**2** ★★", "1 🥇"],
		);
	});

	test("支持高优、接近 50%、多元组总数与飞键三元组总数", () => {
		assert.deepEqual(
			decorateComparison(values(["8", 8], ["7", 7], ["6", 6], ["9", 9]), "max"),
			["**8** ★★", "**7** ★", "6", "9 🥇"],
		);
		assert.deepEqual(
			decorateComparison(
				values(
					["1 / 1", [1, 1]],
					["0 / 5", [0, 5]],
					["0 / 4", [0, 4]],
					["0 / 0", [0, 0]],
				),
				"sum",
			),
			["**1 / 1** ★★", "0 / 5", "**0 / 4** ★", "0 / 0 🥇"],
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

	test("Markdown 表格按 A/I/D/V 的 D+V 排名且奖牌覆盖全表", () => {
		const source = [
			"| 指标 | RC26 | OC21 | S005 | B04 | 何为好 |",
			"| --- | ---: | ---: | ---: | ---: | --- |",
			"| A/I/D/V | 8 / 5 / 3 / 1 | 5 / 2 / 2 / 5 | 3 / 0 / 0 / 4 | 1 / 0 / 0 / 0 | D+V 越低越好 |",
		].join("\n");
		includes(
			decorateMarkdownTable(source, ["traditional-final-sum"]),
			"| A/I/D/V | **8 / 5 / 3 / 1** ★★ | 5 / 2 / 2 / 5 | **3 / 0 / 0 / 4** ★★ | 1 / 0 / 0 / 0 🥇 | D+V 越低越好 |",
		);
	});

	test("五个布局参与星级排名且 B04 只参与六列奖牌", () => {
		const compared = decorateComparison(
			values(
				["RC26", 3],
				["OC21", 1],
				["Overall", 2],
				["U357", 4],
				["S005", 5],
				["B04", 0],
			),
			"min",
			5,
		);
		assert.deepEqual(compared, [
			"RC26",
			"**OC21** ★★",
			"**Overall** ★",
			"U357",
			"S005",
			"B04 🥇",
		]);
		const source = [
			"| 指标 | RC26 | OC21 | Overall | U357 | S005 | B04 | 何为好 |",
			"| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
			"| 得分 | 3 | 1 | 2 | 4 | 5 | 0 | 越低越好 |",
		].join("\n");
		includes(
			decorateMarkdownTable(source, ["min"], 5),
			"| 得分 | 3 | **1** ★★ | **2** ★ | 4 | 5 | 0 🥇 | 越低越好 |",
		);
	});
});

test("为四个方案名补链接且不嵌套已有链接", () => {
	const source =
		"神韵(Overall-17) 21×26 双拼、无飞键道(U357) 21×21 双拼、S005、[首道 B04](https://example.com/b04)";
	const linked = linkShenyunTerms(source, "zh", "github");
	includes(
		linked,
		"[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)",
	);
	includes(
		linked,
		"[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)",
	);
	includes(
		linked,
		"[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)",
	);
	includes(linked, "[首道 B04](https://example.com/b04)");
	assert.ok(!linked.includes("[[首道 B04]"));
});

test("两份 README 记录现行四份布局、带调对比与全量报告", () => {
	for (const filename of ["README.md", "README_CN.md"]) {
		const readme = read(filename);
		for (const heading of [
			"### RC26-39a5bfdc045342cd 21×26 双拼",
			"### RC26-39a5bfdc045342cd 21×26 double pinyin",
			"### RC26-39a5bfdc045342cd 21×26 雙拼",
			"### UED-3158ce08b5bc 21×21 双拼",
			"### UED-3158ce08b5bc 21×21 double pinyin",
			"### UED-3158ce08b5bc 21×21 雙拼",
		])
			includes(readme, heading);
		assert.ok(!readme.includes("### [神韵(Overall-17) 21×26 双拼]"));
		assert.ok(!readme.includes("### [无飞键道(U357) 21×21 双拼]"));
		includes(readme, "`RC26-39a5bfdc045342cd`");
		includes(readme, "`UED-3158ce08b5bc`");
		includes(readme, "M-R2 `40`");
		includes(readme, "A/I/D/V `8/5/3/1`");
		includes(readme, "M-R2 `41`");
		includes(readme, "A/I/D/V `5/2/2/5`");
		includes(readme, "CKT v5.1 `9.082777229838413`");
		includes(readme, "CKT v5.1 `9.565504107623386`");
		includes(readme, "`12/12/24`");
		includes(readme, "`12/21/13`");
		includes(readme, "`12/231/23`");
		includes(readme, "`12/213/23`");
		includes(readme, "docs/shenyun-rc26-keyboard.svg");
		includes(readme, "docs/shenyun-ued-3158ce08b5bc-keyboard.svg");
		includes(readme, "docs/shenyun-rc26-keyboard-heat.svg");
		includes(readme, "docs/shenyun-ued-3158ce08b5bc-keyboard-heat.svg");
		includes(readme, "全部方案比较金牌");
		includes(readme, "CKT v5.2");
		includes(readme, "冰雪莲道 CR-REF-7e650f7a4c 21×21");
		includes(readme, "冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26");
		for (const id of ["zh-benchmark-toned", "zh-benchmark-v52"]) {
			if (filename === "README_CN.md") {
				includes(readme, `](#readme-note-${id})`);
				includes(readme, `<a id="readme-note-${id}"></a>`);
			} else {
				includes(readme, `[^${id}]`);
			}
		}
		if (filename === "README_CN.md") assert.ok(!readme.includes("[^"));
	}
});

test("两份 README 完整记录现行双拼的英数入口与声韵规则", () => {
	for (const filename of ["README.md", "README_CN.md"]) {
		const readme = read(filename);
		assert.equal(readme.split("#### 英数入口").length - 1, 2);
		assert.equal(readme.split("#### Letter and number entry").length - 1, 2);
		assert.equal(readme.split("#### 英數入口").length - 1, 2);
		assert.equal(readme.split("#### 声韵编码规则").length - 1, 2);
		assert.equal(
			readme.split("#### Initial and final coding rules").length - 1,
			2,
		);
		assert.equal(readme.split("#### 聲韻編碼規則").length - 1, 2);
		for (const [
			layout,
			next,
			mapping,
			pureHeat,
			allKeyHeat,
			rules,
			letters,
		] of [
			[
				"### RC26-39a5bfdc045342cd 21×26 双拼",
				"### UED-3158ce08b5bc 21×21 双拼",
				"**声母—韵母映射**",
				"**日常八场景文稿纯双拼键频图（含标点）**",
				"**十一场景 5500 字最优路径全按键键频**",
				"#### 声韵编码规则",
				"#### 英数入口",
			],
			[
				"### UED-3158ce08b5bc 21×21 双拼",
				"### 固顶、空桶与逐级简码",
				"**声母—韵母映射**",
				"**日常八场景文稿纯双拼键频图（含标点）**",
				"**十一场景 5500 字最优路径全按键键频**",
				"#### 声韵编码规则",
				"#### 英数入口",
			],
			[
				"### RC26-39a5bfdc045342cd 21×26 double pinyin",
				"### UED-3158ce08b5bc 21×21 double pinyin",
				"**Initial–final mapping**",
				"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
				"**Eleven-scenario optimal-path all-key frequency over 5,500 characters**",
				"#### Initial and final coding rules",
				"#### Letter and number entry",
			],
			[
				"### UED-3158ce08b5bc 21×21 double pinyin",
				"### Fixed candidates, vacant buckets, and staged abbreviations",
				"**Initial–final mapping**",
				"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
				"**Eleven-scenario optimal-path all-key frequency over 5,500 characters**",
				"#### Initial and final coding rules",
				"#### Letter and number entry",
			],
			[
				"### RC26-39a5bfdc045342cd 21×26 雙拼",
				"### UED-3158ce08b5bc 21×21 雙拼",
				"**聲母—韻母映射**",
				"**日常八場景文稿純雙拼鍵頻圖（含標點）**",
				"**十一場景 5500 字最佳路徑全按鍵鍵頻**",
				"#### 聲韻編碼規則",
				"#### 英數入口",
			],
			[
				"### UED-3158ce08b5bc 21×21 雙拼",
				"### 固頂、空桶與逐級簡碼",
				"**聲母—韻母映射**",
				"**日常八場景文稿純雙拼鍵頻圖（含標點）**",
				"**十一場景 5500 字最佳路徑全按鍵鍵頻**",
				"#### 聲韻編碼規則",
				"#### 英數入口",
			],
		] as const) {
			const section = readme.slice(
				readme.indexOf(layout),
				readme.indexOf(next),
			);
			assert.ok(
				section.indexOf(mapping) < section.indexOf(pureHeat) &&
					section.indexOf(pureHeat) < section.indexOf(rules) &&
					section.indexOf(rules) < section.indexOf(letters),
				`${filename} 的 ${layout} 子节顺序错误`,
			);
		}

		includes(readme, "M=40、无飞键、无音节重码、无 630");
		assert.ok(!readme.includes("M=36、无飞键、无音节重码、无 630"));
		includes(readme, "`D/J/X` 分别使用 `db/jm/xo`");
		includes(readme, "| D | `db` | 嗲 | Q | `qn` | 桑 |");
		includes(readme, "三套 21×26 方案的 0～10 数字固顶别名均已启用");
		includes(readme, "| 四／4 | `qi` | `qi` | `sk` |");
		includes(readme, "| 四／4 | `cfi` | `cfa` |");
		includes(readme, "| 零／0 | `lgv` | `lgv` |");
		assert.ok(!readme.includes("| D | `dj`"));
		assert.ok(!readme.includes("| 四／4 | `sii` | `sia` |"));

		includes(readme, "| `q` | `F` | `x` | `Y` | `zh` | `S` |");
		includes(readme, "| `A` | `R` | `E` | `R` | `O` | `R` |");
		includes(readme, "142 个 `AU` 空码，其中 129 个为 `AA`、13 个为 `AB`");
		includes(readme, "87 个 `AA` 空码，包含保留码 `qz`、`zq`");
		includes(readme, "两个方案的 630 固顶区都完整覆盖 630 个码位且词项不重复");
		includes(readme, "### 固顶、空桶与逐级简码");
		includes(
			readme,
			"### Fixed candidates, vacant buckets, and staged abbreviations",
		);
		includes(readme, "### 固頂、空桶與逐級簡碼");
		includes(
			readme,
			"各含 21 个一级简码、378 个二码单字、108 个二简词和 26 个字母入口",
		);
		includes(
			readme,
			"以 360 个二码单字和 81 个二简词完整覆盖 441 个 `AA` 位置",
		);
		includes(readme, "由 105 个二码位与 525 个三码位组成");
	}
});
