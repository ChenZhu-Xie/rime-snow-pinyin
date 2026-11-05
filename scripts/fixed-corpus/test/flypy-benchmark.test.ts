import assert from "node:assert/strict";
import test from "node:test";
import {
	parseFlypyCodetable,
	parseFlypyWdatDump,
	preferredFlypyCodes,
	rankFlypyEntries,
} from "../../lib/flypy-benchmark";

test("小鹤音形主库导出保留官方全局顺序并应用整库权重", () => {
	assert.deepEqual(
		parseFlypyWdatDump("aa\t阿\t0\t5\t0x1\n", {
			id: "xh",
			baseOrder: 0,
			defaultWeight: 7000,
		}),
		[
			{
				text: "阿",
				code: "aa",
				weight: 7000,
				order: 5,
				baseOrder: 0,
				layer: "xh",
			},
		],
	);
});

test("小鹤音形附加词库只读取正文 TSV", () => {
	const content = [
		"---",
		'name: "fl"',
		"columns: [text, code, weight]",
		"...",
		"# 注释",
		"从\tcs\t123",
	].join("\n");
	assert.equal(
		parseFlypyCodetable(content, {
			id: "fl",
			baseOrder: 1,
			defaultWeight: 6500,
		})[0]?.weight,
		6500,
	);
});

test("小鹤音形按权重、库基序和出现序还原候选", () => {
	const entries = [
		...parseFlypyWdatDump("a\t甲\t0\t1\t0x1\na\t乙\t0\t0\t0x1\n", {
			id: "xh",
			baseOrder: 0,
			defaultWeight: 7000,
		}),
		...parseFlypyCodetable("...\n丙\ta\n", {
			id: "fl",
			baseOrder: 1,
			defaultWeight: 6500,
		}),
	];
	const ranked = rankFlypyEntries(entries, new Set(["甲", "乙", "丙"]));
	assert.deepEqual(
		ranked
			.filter(({ code }) => code === "a")
			.sort((a, b) => a.rank - b.rank)
			.map(({ word, rank }) => [word, rank]),
		[
			["乙", 1],
			["甲", 2],
			["丙", 3],
		],
	);
});

test("有首选时只保留最短首选，无首选才允许首页兜底", () => {
	const ranked = [
		{
			word: "甲",
			code: "a",
			rank: 2,
			candidates: [],
			instant: false,
			popppable: false,
			layer: "xh",
		},
		{
			word: "甲",
			code: "aaaa",
			rank: 1,
			candidates: [],
			instant: true,
			popppable: true,
			layer: "xh",
		},
	];
	assert.deepEqual(
		preferredFlypyCodes(ranked).map(({ code, rank }) => [code, rank]),
		[["aaaa", 1]],
	);
});
