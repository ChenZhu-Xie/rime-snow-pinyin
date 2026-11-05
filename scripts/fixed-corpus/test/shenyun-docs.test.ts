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

test("生成报告在所有可比较表中保留图例、星标与奖牌", () => {
	const report = read("reports/shenyun-comparison.md");
	includes(
		report,
		"[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)",
	);
	includes(
		report,
		"[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)",
	);
	includes(report, "第 1 名数值加粗并标 ★★");
	includes(report, "第 2 名数值加粗并标 ★");
	includes(report, "🥇 独立比较全部四方案，可以与星标同时出现");
	includes(report, "原生遵循[飞花式四码顶]");
	includes(report, "采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅");
	includes(report, "综合补全 CKT v5");
	includes(
		report,
		"| 综合补全 CKT v5 | **9.195026** ★★ 🥇 | **9.715587** ★ | 10.000000 | 9.195422 |",
	);
	includes(
		report,
		"| 综合补全 CKT v5.1 | **9.204752** ★★ | **9.717167** ★ | 9.999357 | 9.202834 🥇 |",
	);
	includes(report, "保留各布局的原生主码路由");
	includes(report, "`11⁶=1,771,561` 点");
	includes(report, "四布局的形／调稳健辅序依次为");
	includes(report, "`12/21/14`、`12/21/13`");
	includes(report, "形辅／调辅分别为 `12/12/23`、`21/12/23`");
	includes(report, "每段两位数字表示 CKT v5 优化并计分的前两辅");
	includes(report, "不含三字词第三辅的成本与消歧收益");
	assert.ok(!report.includes("神韵(Overall-17)与 B04 采用四码顶合同"));
	assert.ok(!report.includes("★ ★★"));
	includes(report, "🥇");
	includes(
		report,
		"| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 3.270% | **0.929%** ★ | 0.000% 🥇 | 越低越好 |",
	);
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

test("CKT v5.1 保留原生路由、统一最长六码并保存八模式稳健辅序", () => {
	const result = JSON.parse(
		read("reports/ckt51-aux-order-robustness.json"),
	) as {
		contract: { name: string };
		independentGrid: { combinations: number; coefficients: string[] };
		comparisonToCkt5Robust: Record<
			string,
			{
				ckt5RobustPolicy: string;
				ckt51RobustPolicy: string;
				change: string;
			}
		>;
		cases: Record<
			string,
			{
				robustPolicy: string;
				word3Contract: string;
				v5PolicyTracks: Record<string, { thirdAuxRate: number }>;
			}
		>;
		normalized: { pairs: Record<string, { score: number }> };
	};
	assert.equal(result.contract.name, "native-route-six-code");
	assert.equal(result.independentGrid.combinations, 11 ** 6);
	assert.deepEqual(result.independentGrid.coefficients, [
		"firstAuxMs",
		"secondAuxMs",
		"thirdAuxMs",
		"selectionDecisionMs",
		"scanPerCandidateMs",
		"pageActionMs",
	]);
	assert.equal(result.cases["21x21-keytao"].robustPolicy, "12/231/24");
	assert.equal(result.cases["21x21-sanpin"].robustPolicy, "12/213/23");
	assert.equal(result.cases["21x26-keytao"].robustPolicy, "12/21/14");
	assert.equal(result.cases["21x26-sanpin"].robustPolicy, "12/21/13");
	assert.equal(result.cases["b04-keytao"].robustPolicy, "12/12/23");
	assert.equal(result.cases["b04-sanpin"].robustPolicy, "21/12/23");
	assert.equal(result.cases["s005-keytao"].robustPolicy, "12/231/24");
	assert.equal(result.cases["s005-sanpin"].robustPolicy, "12/213/23");
	assert.equal(result.cases["21x21-keytao"].word3Contract, "AAA+BBB");
	assert.equal(result.cases["21x26-keytao"].word3Contract, "AAAU+BB");
	assert.equal(
		result.cases["21x26-keytao"].v5PolicyTracks.word3.thirdAuxRate,
		0,
	);
	assert.equal(
		result.cases["21x26-sanpin"].v5PolicyTracks.word3.thirdAuxRate,
		0,
	);
	assert.deepEqual(result.comparisonToCkt5Robust["21x26-keytao"], {
		name: "冰雪简道",
		ckt5RobustPolicy: "12/21/14",
		ckt51RobustPolicy: "12/21/14",
		change: "unchanged",
	});
	assert.deepEqual(result.comparisonToCkt5Robust["s005-keytao"], {
		name: "S005 键道",
		ckt5RobustPolicy: "12/21/24",
		ckt51RobustPolicy: "12/231/24",
		change: "word3 first-two order changed and third auxiliary appended",
	});
	assert.ok(
		result.normalized.pairs.b04.score < result.normalized.pairs["21x26"].score,
	);
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

test("十一场景 5500 字全按键热力图与最优路径回放一致", () => {
	const report = JSON.parse(
		read("reports/神韵十一场景_5500字_最优路径全按键键频.json"),
	) as {
		corpus: { scenes: number; hanCharacters: number };
		layouts: Record<
			string,
			{
				totalKeystrokes: number;
				spaces: number;
				shifts: number;
				selections: number;
				nonZeroKeys: number;
				auxiliaryKeys: string[];
				counts: Record<string, number>;
			}
		>;
	};
	assert.equal(report.corpus.scenes, 11);
	assert.equal(report.corpus.hanCharacters, 5500);
	for (const [id, path, expected] of [
		[
			"overall17-shape",
			"docs/shenyun-overall17-5500-keyboard-heat.svg",
			{ keys: 9964, spaces: 401, shifts: 3, nonZeroKeys: 34 },
		],
		[
			"u357-shape",
			"docs/shenyun-u357-5500-keyboard-heat.svg",
			{ keys: 9492, spaces: 359, shifts: 289, nonZeroKeys: 33 },
		],
	] as const) {
		const svg = read(path);
		const data = report.layouts[id];
		includes(svg, 'viewBox="0 0 940 376"');
		includes(svg, '<rect width="940" height="376" fill="#f8f7ff"/>');
		includes(
			svg,
			'<title id="title">十一场景 5500 字最优路径全按键键频图</title>',
		);
		assert.equal(svg.match(/data-mxkey=/gu)?.length, expected.nonZeroKeys);
		assert.equal(data.totalKeystrokes, expected.keys);
		assert.equal(data.spaces, expected.spaces);
		assert.equal(data.shifts, expected.shifts);
		assert.equal(data.selections, 0);
		assert.equal(data.nonZeroKeys, expected.nonZeroKeys);
		assert.equal(Object.keys(data.counts).length, expected.nonZeroKeys);
		assert.ok(Object.values(data.counts).every((count) => count > 0));
		assert.equal(
			Object.values(data.counts).reduce((sum, count) => sum + count, 0),
			expected.keys,
		);
		for (const key of data.auxiliaryKeys)
			assert.ok(data.counts[key] > 0, `${id} 辅键 ${key} 应有实际击键`);
		assert.equal(data.counts.Space, expected.spaces);
		assert.equal(data.counts.Shift, expected.shifts);
		assert.equal(data.counts[","], 213);
		assert.equal(data.counts["."], 154);
		assert.equal(data.counts["\\"], 25);
		for (const key of [..."1234567890"]) {
			assert.equal(data.counts[key], undefined);
			assert.ok(!svg.includes(`data-mxkey="${key}"`));
		}
	}
	assert.equal(report.layouts["overall17-shape"].counts["["], 16);
	assert.equal(report.layouts["u357-shape"].counts["["], undefined);
});

test("两份 README 的六张比较表、标题和方案链接完整", () => {
	for (const filename of ["README.md", "README_CN.md"]) {
		const readme = read(filename);
		const benchmarkHost =
			filename === "README.md"
				? "github.com/more-14-different"
				: "gitee.com/xie-chenzhu";
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
		for (const heading of [
			"**十一场景 5500 字最优路径全按键键频图**",
			"**All-key frequency map for optimal paths over eleven benchmark scenarios and 5,500 Chinese characters**",
			"**十一場景 5500 字最優路徑全按鍵鍵頻圖**",
		])
			assert.equal(readme.split(heading).length - 1, 2, heading);
		for (const image of [
			"docs/shenyun-overall17-5500-keyboard-heat.svg",
			"docs/shenyun-u357-5500-keyboard-heat.svg",
		])
			assert.equal(readme.split(image).length - 1, 3, image);
		includes(
			readme,
			`[神韵(Overall-17) 21×26 双拼](https://${benchmarkHost}/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)`,
		);
		includes(
			readme,
			`[无飞键道(U357) 21×21 双拼](https://${benchmarkHost}/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)`,
		);
		includes(readme, "`production/ckt-v4-2126-strict-d0-20261030`");
		includes(readme, "`production/ckt-v4-2121-strict-avuio-20261024`");
		includes(readme, "### 双拼方案英数字入口");
		includes(readme, "键道类保留原汉字首选，大写、小写固定为第 2、3 候选");
		includes(readme, "| 零／0 | `ltv` | `ltv` | `lgv` | `lgi` |");
		includes(
			readme,
			"[机器可读映射](config/shenyun-21x26-letter-buckets.json)",
		);
		includes(readme, "| D | `dj` | 扽 | Q | `qq` | 穷 |");
		includes(readme, "`21×5×21=2205`");
		includes(readme, "[`7a7e154`](https://");
		includes(readme, "[`11713b6`](https://");
		includes(readme, "2026-10-30-strict-d0-production-closure-report.md");
		includes(readme, "2026-10-29-prodgate-directed-repair-final-report.md");
		includes(readme, "[`snow_shenyun_shape`](snow_shenyun_shape.schema.yaml)");
		assert.ok(!readme.includes("只是保存该方案及绘图、复算函数"));
		assert.ok(
			!readme.includes("is only the benchmark page carrying the scheme"),
		);
		assert.ok(!readme.includes("只是承載方案與繪圖、複算函式"));
		includes(readme, "第 1 名数值加粗并标 ★★");
		includes(readme, "第 2 名数值加粗并标 ★");
		includes(readme, "first place is bold with ★★");
		includes(readme, "second place is bold with ★");
		includes(readme, "第 1 名數值加粗並標 ★★");
		includes(readme, "第 2 名數值加粗並標 ★");
		includes(readme, "采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅");
		includes(readme, "uses its documented `AEUIO` shape and `IEUAO` tone keys");
		includes(readme, "採用原資料記錄的 `AEUIO` 形輔與 `IEUAO` 調輔");
		includes(readme, "CKT v5");
		includes(readme, "9.195422");
		includes(readme, "CKT v5.1");
		includes(readme, "9.202834");
		includes(readme, "research-notes/2026-11-02-ckt-v5.1-six-code.md");
		includes(
			readme,
			"冰雪简道二／三／四字词当前运行的前两辅字位顺序为 `12/21/42`",
		);
		assert.match(
			readme,
			/### \[神韵\(Overall-17\) 21×26 双拼\]\([^)]+\)\r?\n\r?\n冰雪简道二／三／四字词当前运行的前两辅字位顺序/u,
		);
		includes(
			readme,
			"CKT v5.1 保留四码顶的两辅合同，第二辅后按选重计费；其宽网格稳健第一为形 `12/21/14`、调 `12/21/13`",
		);
		includes(
			readme,
			"二／三／四字词的四键主码分别为 `A₁U₁A₂U₂`、`A₁A₂A₃U₃`、`A₁A₂A₃A₄`",
		);
		assert.ok(!readme.includes("A₁A₂A₃U₃[B₂B₁]"));
		assert.ok(!readme.includes("A₁A₂A₃A₄[B₄B₂]"));
		includes(readme, "运行时三字词按剩余字位补第三辅，四字词最多两辅");
		includes(
			readme,
			"CKT v5.1 将三字词第三辅纳入优化和计分，完整辅序为冰雪健道 `12/231/24`、冰雪弎拼 `12/213/23`",
		);
		includes(
			readme,
			"three-character words append the remaining third auxiliary, while four-character words use at most two auxiliaries",
		);
		includes(readme, "運行時三字詞按剩餘字位補第三輔，四字詞最多兩輔");
		includes(readme, "143 个空 `AU`，其中 134 个为空 `AA`、9 个为空 `AB`");
		includes(
			readme,
			"143 runtime `AU` vacancies: 134 vacant `AA` codes and 9 vacant `AB` codes",
		);
		includes(
			readme,
			"143 個運行時空 `AU`，其中 134 個為空 `AA`、9 個為空 `AB`",
		);
		includes(
			readme,
			"| 频率加权 S2 miss[^zh-s2] | **0%** ★★ 🥇 | 3.270% | **0.929%** ★ | 0% 🥇 | 越低越好 |",
		);
		assert.ok(!readme.includes("★ ★★"));
	}
});
