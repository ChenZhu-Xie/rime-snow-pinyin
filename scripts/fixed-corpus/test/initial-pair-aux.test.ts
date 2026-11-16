import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	initialPairCodes,
	type BenchmarkSchemeId,
} from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";

const examples: [BenchmarkSchemeId, string, string[], string, string][] = [
	["oc21-shape", "也许", ["ye3", "xu3"], "yxoaai", "yxai oa".replace(" ", "")],
	["classic-shape", "也许", ["ye3", "xu3"], "yxoaai", "yxaioa"],
	["oc21-tone", "也许", ["ye3", "xu3"], "yxuoua", "yxuauo"],
	["classic-tone", "也许", ["ye3", "xu3"], "yxuoua", "yxuauo"],
	["rc26-shape", "测试", ["ce4", "shi4"], "cvoaaa", "cvaaoa"],
	["rc26-tone", "才是", ["cai2", "shi4"], "cvaiee", "cveeai"],
];

test("六方案声声四辅均从本方案标准二字词辅序推导，12 和 21 分别反向成 2211 和 1122", () => {
	for (const [scheme, word, syllables, forward, reverse] of examples) {
		const codes = initialPairCodes(scheme, word, syllables);
		assert.deepEqual(
			codes.map(({ auxiliaryLength }) => auxiliaryLength),
			[0, 1, 2, 3, 4],
		);
		assert.equal(codes.at(-1)?.code, forward, scheme);
		assert.equal(
			initialPairCodes(scheme, word, syllables, "21").at(-1)?.code,
			reverse,
			scheme,
		);
	}
});

test("四个 21×21 方案只对真实空桶接收四辅，第四辅之后阻止继续追加", () => {
	for (const schema of [
		"snow_jiandao",
		"snow_sanpin",
		"snow_jiandao_classic",
		"snow_sanpin_classic",
	]) {
		const source = readFileSync(rootPath(`${schema}.schema.yaml`), "utf8");
		assert.match(source, /vacant: true[\s\S]*match_shape: "\^\.\{0,3\}\$"/u);
		assert.match(source, /match_shape: "\^\.\{4,\}\$"[\s\S]*block: true/u);
		assert.match(source, /translator\/word_auxiliary_order: "12"/u);
	}
	assert.deepEqual(initialPairCodes("rc26-shape", "也许", ["ye3", "xu3"]), []);
});
