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
	assert.equal(stats.total.averageCodeLength, 3);
	assert.equal(stats.total.selections, 2);
	assert.equal(stats.total.selectionRate, 1 / 3);
	assert.deepEqual(
		stats.groups.map((group) => group.tokens),
		[2, 1, 1, 1, 1],
	);
	assert.equal(stats.groups[0].tokenRate, 1 / 3);
	assert.deepEqual(stats.groups[0].codeLengths, {
		"1": { count: 1, rate: 0.5 },
		"2": { count: 1, rate: 0.5 },
	});
	assert.equal(stats.groups[0].averageCodeLength, 1.5);
	assert.equal(stats.groups[1].averageCodeLength, 2);
	assert.equal(stats.groups[1].selectionRate, 1);
	assert.equal(stats.groups[2].averageCodeLength, 4);
	assert.equal(stats.groups[4].averageCodeLength, 5);
	const table = renderBenchmarkWordStatistics([
		{ name: "示例", statistics: stats },
	]);
	assert.match(table, /\*\*2／33\.33%\*\*/u);
	assert.match(table, /1→1／50\.00%；2→1／50\.00%/u);
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
	assert.equal(stats.groups[1].averageCodeLength, 2);
	assert.equal(stats.groups[4].tokens, 0);
	assert.match(
		renderBenchmarkWordStatistics([{ name: "示例", statistics: stats }]),
		/五字及以上 \| 0／0\.00% \| — \| — \| 0／0\.00%/u,
	);
	assert.throws(() =>
		benchmarkWordStatistics([{ text: "甲，", replay: [[0, "a"]] }]),
	);
});
