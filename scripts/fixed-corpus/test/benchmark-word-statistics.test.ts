import assert from "node:assert/strict";
import test from "node:test";
import {
	benchmarkWordStatistics,
	renderBenchmarkWordStatistics,
} from "../../lib/benchmark-word-statistics";

test("词次统计保留实际输出段，区分编码、Shift、Space、选重及标点", () => {
	const stats = benchmarkWordStatistics([
		{
			text: "甲乙丙丁戊己庚辛壬癸，子。",
			replay: [
				[0, "a_"],
				[1, "b⇧C[候选2]"],
				[3, "def;"],
				[6, "ghij"],
				[10, ","],
				[11, "k1[3]"],
				[12, "."],
			],
		},
		{ text: "天地玄黄宇", replay: [[0, "lmnop_"]] },
	]);
	assert.equal(stats.total.hanCharacters, 16);
	assert.equal(stats.total.tokens, 6);
	assert.equal(stats.total.codeKeys, 18);
	assert.equal(stats.total.averageEncodingLength, 3);
	assert.equal(stats.total.inputKeys, 23);
	assert.equal(stats.total.averageCodeLength, 23 / 6);
	assert.equal(stats.total.selections, 2);
	assert.equal(stats.total.selectionRate, 1 / 3);
	assert.equal(stats.total.spaces, 2);
	assert.equal(stats.total.shifts, 1);
	assert.equal(stats.total.functionKeys[";"], 1);
	assert.deepEqual(
		stats.groups.map((group) => group.tokens),
		[2, 1, 1, 1, 1],
	);
	assert.equal(stats.groups[0].tokenRate, 1 / 3);
	assert.deepEqual(stats.groups[0].codeLengths, {
		"1": { count: 1, rate: 0.5 },
		"2": { count: 1, rate: 0.5 },
	});
	assert.equal(stats.groups[0].averageEncodingLength, 1.5);
	assert.equal(stats.groups[0].averageCodeLength, 2.5);
	assert.deepEqual(stats.groups[0].keyLengths, {
		"2": { count: 1, rate: 0.5 },
		"3": { count: 1, rate: 0.5 },
	});
	assert.equal(stats.groups[1].averageEncodingLength, 2);
	assert.equal(stats.groups[1].averageCodeLength, 4);
	assert.equal(stats.groups[1].selectionRate, 1);
	assert.equal(stats.groups[2].averageEncodingLength, 4);
	assert.equal(stats.groups[4].averageEncodingLength, 5);
	const table = renderBenchmarkWordStatistics([
		{ name: "示例", totalKeys: 25, statistics: stats },
		{ name: "较少按键", totalKeys: 24, statistics: stats },
	]);
	assert.match(table, /输出段数／占比 \| 2／33\.33%/u);
	assert.match(table, /2键 \| 1／50\.00% \|/u);
	assert.ok(table.includes("**25** | **1.5625**"));
	assert.ok(table.indexOf("**较少按键**") < table.indexOf("**示例**"));
});

test("重复出现重复计词次，以 Unicode 汉字位置还原回放，空类别不虚构均码", () => {
	const line = {
		text: "𰻞甲，",
		replay: [
			[0, "ab_"],
			[2, ","],
		] as [number, string][],
	};
	const stats = benchmarkWordStatistics([line, line]);
	assert.equal(stats.total.hanCharacters, 4);
	assert.equal(stats.total.tokens, 2);
	assert.equal(stats.groups[1].tokens, 2);
	assert.equal(stats.groups[1].tokenRate, 1);
	assert.equal(stats.groups[1].averageEncodingLength, 2);
	assert.equal(stats.groups[4].tokens, 0);
	const table = renderBenchmarkWordStatistics([
		{ name: "示例", totalKeys: 8, statistics: stats },
	]);
	assert.ok(table.includes("| 平均码长／段 | — | 3.000 | — | — | — |"));
	assert.throws(() =>
		benchmarkWordStatistics([{ text: "甲，", replay: [[0, "a"]] }]),
	);
});

test("各词长分别统计功能键与修饰键，两张表的零次和次数完整显示", () => {
	const stats = benchmarkWordStatistics([
		{
			text: "甲乙丙丁戊己庚辛壬癸子丑寅卯辰，",
			replay: [
				[0, "a[]"],
				[1, "bc;_"],
				[3, "def/"],
				[6, "ghij<"],
				[10, "klmno>[候选2]"],
				[15, ","],
			],
		},
	]);
	assert.deepEqual(stats.total.functionKeys, {
		"[": 1,
		"]": 1,
		";": 1,
		"/": 1,
		"<": 1,
		">": 1,
	});
	for (const key of ["[", "]", ";", "/", "<", ">"] as const)
		assert.equal(
			stats.groups.reduce((sum, group) => sum + group.functionKeys[key], 0),
			stats.total.functionKeys[key],
		);
	assert.deepEqual(
		stats.groups.map((g) => g.spaces),
		[0, 1, 0, 0, 0],
	);
	assert.deepEqual(
		stats.groups.map((g) => g.shifts),
		[0, 0, 0, 1, 1],
	);
	const table = renderBenchmarkWordStatistics([
		{ name: "示例", totalKeys: stats.total.inputKeys + 1, statistics: stats },
	]);
	assert.ok(table.includes("| `[` | `]` | `;` | `/` | `<` | `>` |"));
	assert.ok(table.includes("| `[` 次数 | 1 | 0 | 0 | 0 | 0 |"));
	assert.ok(table.includes("| `<` 次数 | 0 | 0 | 0 | 1 | 0 |"));
	assert.ok(table.includes("| `>` 次数 | 0 | 0 | 0 | 0 | 1 |"));
	assert.ok(table.includes("| 翻页键次数 | 0 | 0 | 0 | 0 | 0 |"));
});

test("翻页归入对应词长的实际码长，不混入编码键或选重次数", () => {
	const stats = benchmarkWordStatistics([
		{ text: "甲乙", replay: [[0, "ab{PageDown}{PageUp}[2]"]] },
	]);
	assert.equal(stats.total.pageTurns, 2);
	assert.equal(stats.groups[1].pageTurns, 2);
	assert.equal(stats.total.codeKeys, 2);
	assert.equal(stats.total.inputKeys, 5);
	assert.equal(stats.total.selections, 1);
	assert.equal(stats.groups[1].keyLengths[5].count, 1);
	const table = renderBenchmarkWordStatistics([
		{ name: "翻页示例", totalKeys: 5, statistics: stats },
	]);
	assert.ok(table.includes("| 翻页键次数 | 0 | 2 | 0 | 0 | 0 |"));
});
