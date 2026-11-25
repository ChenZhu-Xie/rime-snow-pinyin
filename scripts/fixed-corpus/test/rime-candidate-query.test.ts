import assert from "node:assert/strict";
import test from "node:test";
import { queryRimeCandidates } from "../../lib/rime-candidate-query";

test("前缀观测在提前上屏处终止，并保存独立的候选数组", () => {
	let typed = "";
	const observations: Array<[string, unknown]> = [];
	const candidates = ["首选"];
	queryRimeCandidates("abcd", {
		clearComposition() {},
		processKey(key) { typed += String.fromCodePoint(key); },
		readCandidates: () => candidates,
		takeCommit: () => typed === "ab" ? "提交" : "",
	}, (code, result) => observations.push([code, result]));
	candidates[0] = "后续变化";
	assert.deepEqual(observations, [
		["a", { candidates: ["首选"], commit: "", completed: true }],
		["ab", { candidates: [], commit: "提交", completed: true }],
	]);
});

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
