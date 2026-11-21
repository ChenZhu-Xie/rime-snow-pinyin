import assert from "node:assert/strict";
import test from "node:test";
import { countBenchmarkKeys } from "../../lib/benchmark-key-counts";

test("逐键回放完整计入大小写、显式 Shift、空格、两种选重及撇号", () => {
	const counts = countBenchmarkKeys([
		"a⇧B_",
		"co[3]",
		"xh[候选2]",
		"a'",
		",",
		".",
	]);
	assert.equal(counts.keys, 14);
	assert.equal(counts.spaces, 1);
	assert.equal(counts.shifts, 1);
	assert.equal(counts.selections, 2);
	assert.equal(counts.frequencies.Candidate2, 1);
	assert.equal(counts.frequencies["3"], 1);
	assert.equal(
		Object.values(counts.frequencies).reduce((a, b) => a + b, 0),
		counts.keys,
	);
	assert.throws(() => countBenchmarkKeys(["⇧a"]));
});
