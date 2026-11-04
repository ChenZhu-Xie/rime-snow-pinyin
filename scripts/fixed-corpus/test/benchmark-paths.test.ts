import assert from "node:assert/strict";
import test from "node:test";
import {
	type BenchmarkAlternative,
	optimizeBenchmarkLine,
	preferredRankedCodes,
} from "../../lib/benchmark-paths";
import type { RankedBenchmarkCode } from "../../lib/benchmark-ranking";
import { supportsStructuralAbbreviations } from "../../lib/benchmark-schemes";

function ranked(word: string, code: string, rank: number): RankedBenchmarkCode {
	return {
		word,
		code,
		rank,
		mainLength: code.length,
		auxiliaryLength: 0,
		popppable: false,
		candidates: [],
		path: [code],
	};
}

function alternative(
	word: string,
	rawCode: string,
	options: Partial<BenchmarkAlternative> = {},
): BenchmarkAlternative {
	return {
		word,
		displayCode: rawCode,
		rawCode,
		keyCost: rawCode.length,
		instant: false,
		popppable: false,
		source: "普通码",
		shift: 0,
		selectionCount: 0,
		...options,
	};
}

test("有首选编码时排除同字词的二三选短码并停在最短首选", () => {
	const actual = preferredRankedCodes([
		ranked("卷帘门", "jlm", 3),
		ranked("卷帘门", "jlme", 1),
		ranked("卷帘门", "jlmeo", 1),
	]);
	assert.deepEqual(
		actual.map(({ code, rank }) => [code, rank]),
		[["jlme", 1]],
	);
});

test("完全没有首选编码时才保留二三选兜底", () => {
	const actual = preferredRankedCodes([
		ranked("从", "c", 2),
		ranked("从", "cp", 3),
		ranked("从", "cpi", 4),
	]);
	assert.deepEqual(
		actual.map(({ code, rank }) => [code, rank]),
		[
			["c", 2],
			["cp", 3],
		],
	);
});

test("路径先避免选重再比较总按键", () => {
	const result = optimizeBenchmarkLine(
		"甲乙",
		new Map([
			[
				"甲乙",
				[
					alternative("甲乙", "a", {
						keyCost: 2,
						instant: true,
						source: "次选",
						selectionCount: 1,
					}),
				],
			],
			["甲", [alternative("甲", "aa", { instant: true })]],
			["乙", [alternative("乙", "bb", { instant: true })]],
		]),
	);
	assert.equal(result.selectionCount, 0);
	assert.deepEqual(
		result.tokens.map(({ word }) => word),
		["甲", "乙"],
	);
});

test("同为首选且总按键相同时选择短标准码加 Space", () => {
	const result = optimizeBenchmarkLine(
		"甲乙",
		new Map([
			[
				"甲",
				[
					alternative("甲", "abc"),
					alternative("甲", "abcd", { popppable: true }),
				],
			],
			["乙", [alternative("乙", "e", { instant: true })]],
		]),
	);
	assert.equal(result.keys, 5);
	assert.equal(result.tokens[0].rawCode, "abc");
	assert.equal(result.tokens[0].separator, true);
});

test("只有两个 21×26 benchmark 方案启用结构略码", () => {
	for (const scheme of [
		"u357-shape",
		"u357-tone",
		"classic-shape",
		"classic-tone",
	] as const) {
		assert.equal(supportsStructuralAbbreviations(scheme), false, scheme);
	}
	for (const scheme of ["overall17-shape", "overall17-tone"] as const) {
		assert.equal(supportsStructuralAbbreviations(scheme), true, scheme);
	}
});
