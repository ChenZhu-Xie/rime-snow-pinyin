import assert from "node:assert/strict";
import test from "node:test";
import { queryRimeCandidates } from "../../lib/rime-candidate-query";

test("候选查询逐键读取并传入物理 Shift，禁止只读最终一页", () => {
	const events: string[] = [];
	const result = queryRimeCandidates("xKd", {
		clearComposition: () => {
			events.push("clear");
		},
		processKey: (key, modifier) => {
			events.push(`${String.fromCodePoint(key)}/${modifier}`);
		},
		readCandidates: () => {
			events.push("read");
			return [String(events.length)];
		},
		takeCommit: () => {
			events.push("commit");
			return "";
		},
	});
	assert.deepEqual(events, [
		"clear",
		"commit",
		"x/0",
		"read",
		"commit",
		"K/1",
		"read",
		"commit",
		"d/0",
		"read",
		"commit",
	]);
	assert.deepEqual(result, { candidates: ["10"], commit: "", completed: true });
});

test("中途顶屏的尾段候选不允许进入完整编码缓存", () => {
	let processed = 0;
	const result = queryRimeCandidates("abcd", {
		clearComposition: () => {},
		processKey: () => {
			processed++;
		},
		readCandidates: () => ["尾段"],
		takeCommit: () => (processed === 2 ? "提前上屏" : ""),
	});
	assert.deepEqual(result, {
		candidates: [],
		commit: "提前上屏",
		completed: false,
	});
	assert.equal(processed, 2);
});

test("词长直选按物理 Shift＋标点发送，仅接受最后一键完成的提交", () => {
	const events: Array<[number, number]> = [];
	let pending = "";
	const result = queryRimeCandidates("abcd<", {
		clearComposition() {},
		processKey(key, modifier) {
			events.push([key, modifier]);
			if (key === 44 && modifier === 1) pending = "人工智能";
		},
		readCandidates: () => [],
		takeCommit: () => {
			const text = pending;
			pending = "";
			return text;
		},
	});
	assert.deepEqual(events.at(-1), [44, 1]);
	assert.deepEqual(result, {
		candidates: [],
		commit: "人工智能",
		completed: true,
	});
});
