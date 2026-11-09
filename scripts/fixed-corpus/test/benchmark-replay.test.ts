import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkPathResult } from "../../lib/benchmark-paths";
import {
	assertBenchmarkReplaySchemes,
	benchmarkReplay,
	renderBenchmarkReplays,
} from "../../lib/benchmark-replay";

test("回放缓存严格校验方案数量与顺序", () => {
	const cache = {
		contract: "test",
		schemes: { a: [], b: [] },
	};
	assert.doesNotThrow(() =>
		assertBenchmarkReplaySchemes(cache, ["a", "b"], "内部方案"),
	);
	assert.throws(
		() => assertBenchmarkReplaySchemes(cache, ["b", "a"], "内部方案"),
		/内部方案回放方案顺序不一致/u,
	);
});

test("回放序列只保留统一对齐所需的起点和实际键码", () => {
	const path = {
		tokens: [
			{ start: 0, displayCode: "ab", separator: true },
			{ start: 2, displayCode: "c", separator: false },
		],
	} as BenchmarkPathResult;
	assert.deepEqual(benchmarkReplay(path), [
		[0, "ab_"],
		[2, "c"],
	]);
});

test("多方案回放共享同一组列位置", () => {
	const rendered = renderBenchmarkReplays("甲乙丙", [
		{
			name: "短码",
			replay: [
				[0, "a"],
				[1, "b"],
				[2, "c"],
			],
		},
		{
			name: "长码",
			replay: [
				[0, "abcdef"],
				[1, "g"],
				[2, "h"],
			],
		},
	]);
	const lines = rendered.split("\n");
	const width = (text: string) =>
		[...text].reduce(
			(sum, character) => sum + Number(/\p{Script=Han}/u.test(character)) + 1,
			0,
		);
	const offset = (line: string, start: string, target: string) =>
		width(line.slice(line.indexOf(start), line.indexOf(target)));
	assert.equal(lines.length, 3);
	assert.equal(offset(lines[0], "甲", "乙"), offset(lines[1], "a", "b"));
	assert.equal(offset(lines[0], "甲", "乙"), offset(lines[2], "a", "g"));
	assert.equal(offset(lines[0], "甲", "丙"), offset(lines[1], "a", "c"));
	assert.equal(offset(lines[0], "甲", "丙"), offset(lines[2], "a", "h"));
});
