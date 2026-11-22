import assert from "node:assert/strict";
import test from "node:test";
import {
	wordLengthAlternatives,
	wordLengthProbeCodes,
} from "../../lib/benchmark-word-length";
import { pronunciationCodes } from "../../lib/benchmark-schemes";
import { optimizeBenchmarkLine } from "../../lib/benchmark-paths";

test("21×26 枚举四声母补全与逐级大写续写，直选只探测四主码", () => {
	const entry = {
		word: "中华人民共和国",
		syllables: ["zhong1", "hua2", "ren2", "min2", "gong4", "he2", "guo2"],
		weight: 1,
	};
	for (const [scheme, base] of [
		["rc26-shape", "shrm"],
		["rc26-tone", "shrm"],
		["zhudao", "xhrm"],
	] as const) {
		const codes = pronunciationCodes(scheme, entry.word, entry.syllables).map(
			(v) => v.code,
		);
		assert.deepEqual(codes, [base, base + "G", base + "GH", base + "GHG"]);
		assert.deepEqual(wordLengthProbeCodes(scheme, [entry]), [base]);
		assert.deepEqual(
			wordLengthProbeCodes(scheme, [entry], () => 5),
			[],
		);
		assert.deepEqual(
			wordLengthProbeCodes(scheme, [entry], () => 6),
			[base],
		);
	}
	assert.deepEqual(wordLengthProbeCodes("sipin", [entry]), []);
	assert.deepEqual(wordLengthProbeCodes("qingyun", [entry]), []);
});

test("直选的 Shift 成本参与最优切分，更便宜的普通码仍优先", () => {
	const word = "人工智能";
	const [selection] = wordLengthAlternatives(
		["abcd"],
		new Set([word]),
		() => word,
	);
	for (const ordinaryCost of [5, 7]) {
		const ordinary = {
			...selection,
			displayCode: "x".repeat(ordinaryCost),
			rawCode: "x".repeat(ordinaryCost),
			keyCost: ordinaryCost,
			shift: 0,
			source: "普通码",
		};
		const path = optimizeBenchmarkLine(
			word,
			new Map([[word, [selection, ordinary]]]),
		);
		assert.equal(path.keys, Math.min(6, ordinaryCost));
		assert.equal(
			path.tokens[0].source,
			ordinaryCost < 6 ? "普通码" : "词长直选",
		);
	}
});

test("直选只纳入真实提交的目标词，计两键并立即上屏，不需追加空格", () => {
	const words = new Set(["人工智能", "股份有限公司"]);
	const routes = wordLengthAlternatives(["abcd", "efgh"], words, (code) =>
		code === "abcd<" ? "人工智能" : code === "efgh>" ? "股份有限公司》" : "",
	);
	assert.equal(routes.length, 1);
	assert.equal(routes[0].keyCost, 6);
	assert.equal(routes[0].shift, 1);
	assert.equal(routes[0].instant, true);
	assert.equal(routes[0].selectionCount, 0);
});
