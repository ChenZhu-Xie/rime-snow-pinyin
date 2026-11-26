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
	assert.equal(counts.pageTurns, 0);
	assert.equal(counts.frequencies.Candidate2, 1);
	assert.equal(counts.frequencies["3"], 1);
	assert.equal(
		Object.values(counts.frequencies).reduce((a, b) => a + b, 0),
		counts.keys,
	);
	assert.throws(() => countBenchmarkKeys(["⇧a"]));
});

test("上下翻页各计一次按键，选重另计，不把记号字符当作实际键", () => {
	const counts = countBenchmarkKeys(["ab{PageDown}{PageDown}{PageUp}[2]"]);
	assert.equal(counts.keys, 6);
	assert.equal(counts.pageTurns, 3);
	assert.equal(counts.selections, 1);
	assert.equal(counts.frequencies.PageDown, 2);
	assert.equal(counts.frequencies.PageUp, 1);
	assert.equal(counts.functionKeys["["], 0);
	assert.equal(counts.functionKeys[">"], 0);
});

test("词长直选的左右书名号各为两键，不冒充数字选重或单键标点", () => {
	const result = countBenchmarkKeys(["abcd<", "efgh>"]);
	assert.equal(result.keys, 12);
	assert.equal(result.shifts, 2);
	assert.equal(result.selections, 0);
	assert.equal(result.frequencies[","], 1);
	assert.equal(result.frequencies["."], 1);
	assert.equal(result.functionKeys["<"], 1);
	assert.equal(result.functionKeys[">"], 1);
});

test("功能键独立计次，选重括号不计，左右书名号的 Shift 不重复累加", () => {
	const result = countBenchmarkKeys([
		"[];;/",
		"a[3]b[候选2]c[Space]",
		"d<e><",
		",.",
	]);
	assert.deepEqual(result.functionKeys, {
		"[": 1,
		"]": 1,
		";": 2,
		"/": 1,
		"<": 2,
		">": 1,
	});
	assert.equal(result.shifts, 3);
	assert.equal(result.spaces, 1);
	assert.equal(result.selections, 3);
	assert.equal(result.frequencies[","], 3);
	assert.equal(result.frequencies["."], 2);
	assert.equal(result.keys, 21);
	assert.equal(
		Object.values(result.frequencies).reduce((sum, count) => sum + count, 0),
		result.keys,
	);
});
