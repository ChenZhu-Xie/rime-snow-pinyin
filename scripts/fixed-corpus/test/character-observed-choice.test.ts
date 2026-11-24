import assert from "node:assert/strict";
import test from "node:test";
import { observedMinimum } from "../../lib/character-observed-choice";

test("逐键观察取更短前缀首选，不把后置后的长码当最短", () => {
	const rows = new Map([
		["a", { code: "a", commit: null, candidates: [{ text: "甲" }] }],
		["ab", { code: "ab", commit: null, candidates: [{ text: "章" }] }],
		["abc", { code: "abc", commit: null, candidates: [{ text: "赣" }] }],
	]);
	assert.deepEqual(observedMinimum("章", ["abc"], rows), {
		code: "ab",
		keys: 2,
	});
});
test("中途上屏后尾段出现目标不能充当单字路由，直出则可用", () => {
	const rows = new Map([
		["a", { code: "a", commit: "甲", candidates: [] }],
		["ab", { code: "ab", commit: null, candidates: [{ text: "乙" }] }],
	]);
	assert.equal(observedMinimum("乙", ["ab"], rows), undefined);
	assert.deepEqual(observedMinimum("甲", ["ab"], rows), { code: "a", keys: 1 });
});
test("缺少前缀观测必须失败，不能静默宣布已验证", () => {
	assert.throws(
		() => observedMinimum("甲", ["ab"], new Map()),
		/缺少逐键观测/u,
	);
});
