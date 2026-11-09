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
			"| 指标 | D3 | QZ | S005 | B04 | 何为好 |",
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
				["D3", 3],
				["QZ", 1],
				["Overall", 2],
				["U357", 4],
				["S005", 5],
				["B04", 0],
			),
			"min",
			5,
		);
		assert.deepEqual(compared, [
			"D3",
			"**QZ** ★★",
			"**Overall** ★",
			"U357",
			"S005",
			"B04 🥇",
		]);
		const source = [
			"| 指标 | D3 | QZ | Overall | U357 | S005 | B04 | 何为好 |",
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
		"| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | **5 / 2 / 1 / 1** ★★ | 4 / 1 / 0 / 5 | **3 / 0 / 0 / 4** ★ | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |",
	);
	includes(
		report,
		"| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |",
	);
	includes(
		report,
		"| S2 异键同指率 | **9.252%** ★ | **4.255%** ★★ 🥇 | 11.638% | 11.343% | 越低越好 |",
	);
	includes(report, "可用键集不再恰好等于同名原键");
	includes(report, "E→E/U 使 A 增加 1");
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

test("次世代追加报告以新旧四布局、S005 和首道组成六方案完整明细", () => {
	const report = read("reports/shenyun-comparison.md");
	includes(report, "## 次世代布局追加对比");
	includes(report, "上面的历史四方案报告原样保留");
	includes(
		report,
		"| 指标 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005]",
	);
	includes(
		report,
		"| 综合补全 CKT v5.1 | **9.103000** ★★ 🥇 | 9.567898 | **9.204752** ★ | 9.717167 | 9.999357 | 9.202834 |",
	);
	includes(report, "不参与五方案名次");
	includes(report, "🥇 独立比较全部六方案");
	for (const heading of [
		"### 六方案 [CKT v4]",
		"### 六方案冻结语料加权非首选率",
		"### 六方案逐级辅键后的频率加权残余非首选率",
		"### 六方案二／三／四字词终局碰撞桶",
	])
		includes(report, heading);
	includes(
		report,
		"| 编码轨 | 词长 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005]",
	);
	includes(report, "| [首道 B04]");
	const nextSection = report.split("## 次世代布局追加对比")[1] ?? "";
	const nextSummary = nextSection.split("\n### ")[0];
	includes(nextSummary, "★");
	includes(nextSummary, "🥇");
	for (const heading of [
		"### 六方案 [CKT v4]",
		"### 六方案冻结语料加权非首选率",
		"### 六方案逐级辅键后的频率加权残余非首选率",
	]) {
		const section = nextSection.split(heading)[1]?.split("\n### ")[0] ?? "";
		includes(section, "★", heading);
		includes(section, "🥇", heading);
	}

	const comparison = JSON.parse(read("reports/shenyun-comparison.json")) as {
		nextGenerationComparison: {
			displayedLayouts: string[];
			rankedLayouts: string[];
			externalReference: string;
			schemes: Record<string, unknown>;
			metrics: { cktV51: Record<string, number | string> };
			weightedNonfirstRates: Record<string, unknown>;
			stagedResidualNonfirstRates: Record<string, unknown>;
			terminalWordCollisionBuckets: Record<string, unknown>;
			cktV4Explanation: Record<string, unknown>;
		};
	};
	assert.deepEqual(comparison.nextGenerationComparison.rankedLayouts, [
		"D3V1",
		"QZ",
		"Overall17First",
		"U357First",
		"S005",
	]);
	assert.deepEqual(comparison.nextGenerationComparison.displayedLayouts, [
		"D3V1",
		"QZ",
		"Overall17First",
		"U357First",
		"S005",
		"B04",
	]);
	assert.equal(comparison.nextGenerationComparison.externalReference, "B04");
	assert.ok(comparison.nextGenerationComparison.schemes.S005);
	assert.ok(comparison.nextGenerationComparison.weightedNonfirstRates.keytao);
	assert.ok(
		comparison.nextGenerationComparison.stagedResidualNonfirstRates.sanpin,
	);
	assert.ok(
		comparison.nextGenerationComparison.terminalWordCollisionBuckets.keytao,
	);
	assert.ok(comparison.nextGenerationComparison.cktV4Explanation);
	assert.equal(
		comparison.nextGenerationComparison.metrics.cktV51.D3V1,
		9.10299979136027,
	);
	assert.equal(
		comparison.nextGenerationComparison.metrics.cktV51.Overall17First,
		9.204752315229815,
	);

	const robustness = JSON.parse(
		read("reports/ckt51-aux-order-robustness.json"),
	) as {
		cases: Record<string, unknown>;
		nextGeneration: {
			preservedHistoricalCases: boolean;
			schemes: Record<
				string,
				{ selectedPolicies: { keytao: { word3: string } } }
			>;
		};
	};
	assert.ok(robustness.cases["21x26-keytao"]);
	assert.ok(robustness.cases["21x21-keytao"]);
	assert.equal(robustness.nextGeneration.preservedHistoricalCases, true);
	assert.equal(
		robustness.nextGeneration.schemes.D3V1.selectedPolicies.keytao.word3,
		"12",
	);
	assert.equal(
		robustness.nextGeneration.schemes.QZ.selectedPolicies.keytao.word3,
		"213",
	);
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

test("D/V 与 S2 异键同指率使用 benchmark 的原始口径", () => {
	const comparison = JSON.parse(read("reports/shenyun-comparison.json")) as {
		metrics: {
			soundRhymeDisorder: Record<string, number[] | string>;
			s2DifferentKeySameFingerRate: Record<string, number | string>;
		};
	};
	assert.deepEqual(comparison.metrics.soundRhymeDisorder, {
		better: "lower",
		Overall17: [1, 1],
		U357: [0, 5],
		S005: [0, 4],
		B04: [0, 0],
	});
	assert.deepEqual(comparison.metrics.s2DifferentKeySameFingerRate, {
		better: "lower",
		Overall17: 0.09251887998300894,
		U357: 0.04255326008481471,
		S005: 0.11638456570295873,
		B04: 0.11343047534562911,
	});
	const r9Report = read("reports/shenyun-r9-comparison.md");
	includes(r9Report, "| 声母乱序度 D | 0 | 0 | 0 |");
	includes(r9Report, "| 韵母乱序度 V | 5 | 4 | 0 |");
	includes(r9Report, "| S2 异键同指率 | 3.35% | 11.64% | 11.34% |");
	includes(r9Report, "D 统计普通声母未落在同名字母键上的数量");
	includes(r9Report, "同键重复另计，不包含在此项中");
	assert.ok(!r9Report.includes("S2 同指连击率"));
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
			"d3v1-shape",
			"docs/shenyun-d3v1-5500-keyboard-heat.svg",
			{ keys: 9895, spaces: 382, shifts: 3, nonZeroKeys: 34 },
		],
		[
			"qz-shape",
			"docs/shenyun-qz-e8f37a-5500-keyboard-heat.svg",
			{ keys: 9444, spaces: 376, shifts: 307, nonZeroKeys: 33 },
		],
		[
			"overall17-first-shape",
			"docs/shenyun-overall17-5500-keyboard-heat.svg",
			{ keys: 9961, spaces: 406, shifts: 1, nonZeroKeys: 34 },
		],
		[
			"u357-first-shape",
			"docs/shenyun-u357-5500-keyboard-heat.svg",
			{ keys: 9459, spaces: 393, shifts: 295, nonZeroKeys: 33 },
		],
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

/* 历史 README 合同：下一代发布后不再把 Overall-17／U357 写成现行标题。
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
		assert.ok(!readme.includes("### 双拼方案英数字入口"));
		assert.equal(readme.split("#### 英数入口").length - 1, 2);
		assert.equal(readme.split("#### Letter and number entry").length - 1, 2);
		assert.equal(readme.split("#### 英數入口").length - 1, 2);
		includes(readme, "键道类保留原汉字首选，大写、小写固定为第 2、3 候选");
		includes(readme, "| 零／0 | `ltv` | `ltv` | `lgv` | `lgv` |");
		includes(
			readme,
			"[机器可读字母映射](config/shenyun-21x26-letter-buckets.json)",
		);
		includes(readme, "| D | `dj` | 扽 | Q | `qq` | 穷 |");
		includes(readme, "两个 21×26 方案已经启用同一套占用桶字母方案");
		includes(readme, "[数字码映射](config/shenyun-21x26-number-codes.json)");
		includes(readme, "| 四／4 | `sii` | `sia` |");
		includes(readme, "| 十／10 | `wiu` | `wie` |");
		includes(readme, "但尚未写入两份 fixed 表");
		includes(readme, "`21×5×21=2205`");
		includes(readme, "`AAB` 与 `AAAB` 的既定路由同样不改");
		const overallPosition = readme.indexOf("### [神韵(Overall-17) 21×26 双拼]");
		const u357Position = readme.indexOf("### [无飞键道(U357) 21×21 双拼]");
		const comparisonPosition = readme.indexOf("### 两代神韵与");
		const overallEntryPosition = readme.indexOf(
			"两个 21×26 方案已经启用同一套占用桶字母方案",
		);
		const u357EntryPosition = readme.indexOf(
			"本节同时列出采用 U357 的冰雪健道、冰雪弎拼",
		);
		assert.ok(overallPosition < overallEntryPosition);
		assert.ok(overallEntryPosition < u357Position);
		assert.ok(u357Position < u357EntryPosition);
		assert.ok(u357EntryPosition < comparisonPosition);
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
		includes(
			readme,
			"| 声母／韵母乱序度 D/V[^zh-dv] | **1 / 1** ★★ | 0 / 5 | **0 / 4** ★ | 0 / 0 🥇 | 越低越接近字母原键 |",
		);
		includes(
			readme,
			"| S2 异键同指率[^zh-sfb] | **9.252%** ★ | **4.255%** ★★ 🥇 | 11.638% | 11.343% | 越低越好 |",
		);
		includes(readme, "| Initial/final disorder D/V[^en-dv] |");
		includes(readme, "| 聲母／韻母亂序度 D/V[^zht-dv] |");
		includes(readme, "| S2 different-key same-finger rate[^en-sfb] |");
		includes(readme, "| S2 異鍵同指率[^zht-sfb] |");
		includes(readme, "[^zh-dv]: 声母／韵母乱序度 D/V");
		includes(readme, "[^zh-sfb]: S2 异键同指率");
		assert.ok(!readme.includes("★ ★★"));
	}
});
*/

test("两份 README 只以 D3/V1 与 QZ-e8f37a 为现行双拼并链接全量报告", () => {
	for (const filename of ["README.md", "README_CN.md"]) {
		const readme = read(filename);
		for (const heading of [
			"### D3/V1 21×26 双拼",
			"### D3/V1 21×26 double pinyin",
			"### D3/V1 21×26 雙拼",
			"### QZ-e8f37a 21×21 双拼",
			"### QZ-e8f37a 21×21 double pinyin",
			"### QZ-e8f37a 21×21 雙拼",
		])
			includes(readme, heading);
		assert.ok(!readme.includes("### [神韵(Overall-17) 21×26 双拼]"));
		assert.ok(!readme.includes("### [无飞键道(U357) 21×21 双拼]"));
		includes(readme, "`SNOW-SHENYUN-21X26-D3V1-BALANCED`");
		includes(readme, "`QZ-e8f37a0998f9`");
		includes(readme, "M-R2 `40`");
		includes(readme, "A/I/D/V `8/5/3/1`");
		includes(readme, "M-R2 `42`");
		includes(readme, "A/I/D/V `5/2/2/5`");
		includes(readme, "CKT v5.1 `9.10299979136027`");
		includes(readme, "CKT v5.1 `9.56789806405906`");
		includes(readme, "`12/12/24`");
		includes(readme, "`12/21/13`");
		includes(readme, "`12/213/24`");
		includes(readme, "`12/213/23`");
		includes(readme, "docs/shenyun-d3v1-keyboard.svg");
		includes(readme, "docs/shenyun-qz-e8f37a-keyboard.svg");
		includes(readme, "docs/shenyun-d3v1-5500-keyboard-heat.svg");
		includes(readme, "docs/shenyun-qz-e8f37a-5500-keyboard-heat.svg");
		includes(readme, "Overall-17·初代");
		includes(readme, "U357·初代");
		for (const header of [
			/\| 指标 \| D3\/V1 21×26 \| QZ-e8f37a 21×21 \| 原键道 (?:S005|\[S005\]\([^)]+\)) \| (?:首道 B04|\[首道 B04\]\([^)]+\)) \| 何为好 \|/u,
			/\| Metric \| D3\/V1 21×26 \| QZ-e8f37a 21×21 \| KeyTao (?:S005|\[S005\]\([^)]+\)) \| Shoudao (?:B04|\[B04\]\([^)]+\)) \| Better \|/u,
			/\| 指標 \| D3\/V1 21×26 \| QZ-e8f37a 21×21 \| 原鍵道 (?:S005|\[S005\]\([^)]+\)) \| (?:首道 B04|\[首道 B04\]\([^)]+\)) \| 何者為佳 \|/u,
		])
			assert.match(readme, header);
		assert.match(
			readme,
			/(?:首道 B04|\[首道 B04\]\([^)]+\)) 不参与三方案名次/u,
		);
		includes(readme, "🥇 独立比较全部四方案");
		includes(
			readme,
			"| 综合补全 CKT v5.1 | **9.103000** ★★ 🥇 | **9.567898** ★ | 9.999357 | 9.202834 | 越低越好 |",
		);
		includes(
			readme,
			"| CKT v5.1 completion | **9.103000** ★★ 🥇 | **9.567898** ★ | 9.999357 | 9.202834 | Lower |",
		);
		includes(
			readme,
			"| 綜合補全 CKT v5.1 | **9.103000** ★★ 🥇 | **9.567898** ★ | 9.999357 | 9.202834 | 越低越好 |",
		);
		const tableLines = readme.split("\n");
		const currentTableStarts = tableLines
			.map((line, index) =>
				/^\| (?:指标|Metric|指標) \| D3\/V1 21×26/u.test(line) ? index : -1,
			)
			.filter((index) => index >= 0);
		assert.equal(currentTableStarts.length, 3);
		for (const start of currentTableStarts) {
			let end = start + 2;
			while (end < tableLines.length && tableLines[end].startsWith("|")) end++;
			for (const row of tableLines.slice(start + 2, end)) {
				includes(row, "★");
				includes(row, "🥇");
			}
		}
		includes(readme, "reports/冰雪十二方案_500字_最短键码实战测评.txt");
		includes(readme, "reports/十篇五百字_十二方案最优切分及字词比率报告.md");
		includes(readme, "reports/十篇五百字_十三方案最优切分及字词比率报告.md");
		includes(readme, "reports/十篇五百字_十四方案最优切分及字词比率报告.md");
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
		for (const [layout, next, mapping, rules, letters] of [
			[
				"### D3/V1 21×26 双拼",
				"### QZ-e8f37a 21×21 双拼",
				"**声母—韵母映射**",
				"#### 声韵编码规则",
				"#### 英数入口",
			],
			[
				"### QZ-e8f37a 21×21 双拼",
				"### 固顶、空桶与逐级简码",
				"**声母—韵母映射**",
				"#### 声韵编码规则",
				"#### 英数入口",
			],
			[
				"### D3/V1 21×26 double pinyin",
				"### QZ-e8f37a 21×21 double pinyin",
				"**Initial–final mapping**",
				"#### Initial and final coding rules",
				"#### Letter and number entry",
			],
			[
				"### QZ-e8f37a 21×21 double pinyin",
				"### Fixed candidates, vacant buckets, and staged abbreviations",
				"**Initial–final mapping**",
				"#### Initial and final coding rules",
				"#### Letter and number entry",
			],
			[
				"### D3/V1 21×26 雙拼",
				"### QZ-e8f37a 21×21 雙拼",
				"**聲母—韻母映射**",
				"#### 聲韻編碼規則",
				"#### 英數入口",
			],
			[
				"### QZ-e8f37a 21×21 雙拼",
				"### 固頂、空桶與逐級簡碼",
				"**聲母—韻母映射**",
				"#### 聲韻編碼規則",
				"#### 英數入口",
			],
		] as const) {
			const section = readme.slice(
				readme.indexOf(layout),
				readme.indexOf(next),
			);
			assert.ok(
				section.indexOf(mapping) < section.indexOf(rules) &&
					section.indexOf(rules) < section.indexOf(letters),
				`${filename} 的 ${layout} 子节顺序错误`,
			);
		}

		includes(readme, "M=40、无飞键、无音节重码、无 630");
		assert.ok(!readme.includes("M=36、无飞键、无音节重码、无 630"));
		includes(readme, "`D/J/X` 分别使用 `dd/jg/xo`");
		includes(readme, "| D | `dd` | 扽 | Q | `qn` | 桑 |");
		includes(readme, "配置状态仍为 `calculated-not-enabled`");
		includes(readme, "| 四／4 | `qii` | `qia` |");
		includes(readme, "| 四／4 | `sfi` | `sfa` |");
		includes(readme, "| 零／0 | `ekv` | `ekv` |");
		assert.ok(!readme.includes("| D | `dj`"));
		assert.ok(!readme.includes("| 四／4 | `sii` | `sia` |"));

		includes(readme, "| `q` | `F` | `x` | `Y` | `zh` | `S` |");
		includes(readme, "| `A` | `R` | `E` | `C` | `O` | `R` |");
		includes(readme, "144 个 `AU` 空码，其中 131 个为 `AA`、13 个为 `AB`");
		includes(readme, "94 个 `AA` 空码，包含保留码 `qz`、`zq`");
		includes(readme, "两个方案的 630 固顶区都完整覆盖 630 个码位且词项不重复");
		includes(readme, "### 固顶、空桶与逐级简码");
		includes(
			readme,
			"### Fixed candidates, vacant buckets, and staged abbreviations",
		);
		includes(readme, "### 固頂、空桶與逐級簡碼");
		includes(
			readme,
			"各含 21 个一级简码、376 个二码单字、108 个二简词和 26 个字母入口",
		);
		includes(
			readme,
			"以 351 个二码单字和 90 个二简词完整覆盖 441 个 `AA` 位置",
		);
		includes(readme, "由 105 个二码位与 525 个三码位组成");
		includes(readme, "覆盖 133,205 条可编码读音及 1,372 个二简／630 槽位");
	}
});
