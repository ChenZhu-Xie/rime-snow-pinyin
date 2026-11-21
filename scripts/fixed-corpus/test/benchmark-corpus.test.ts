import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkTargetWords } from "../../lib/benchmark-corpus";
import { optimizeBenchmarkLine } from "../../lib/benchmark-paths";

test("三类方案共用无人工分词排除的子串域，长词可独立竞争最优路径", () => {
	const words = benchmarkTargetWords(["自主创新与数字化转型，持续投入。"]);
	for (const word of ["数字化", "数字化转型", "与数字", "化转型"])
		assert.ok(words.has(word), word);
	assert.ok(!words.has("型，持"));
	const alternatives = new Map(
		[...words].map((word) => [
			word,
			[
				{
					word,
					displayCode: "abc",
					rawCode: "abc",
					keyCost: 3,
					instant: true,
					popppable: false,
					source: "普通码",
					shift: 0,
					selectionCount: 0,
				},
			],
		]),
	);
	assert.deepEqual(
		optimizeBenchmarkLine("数字化转型", alternatives).tokens.map((t) => t.word),
		["数字化转型"],
	);
});
