import assert from "node:assert/strict";
import test from "node:test";
import { generateBihua } from "../../generate-stroke-dict";
import { productionCharacterCodes } from "../../lib/benchmark-schemes";

test("笔顺来源修正合并G而不丢弃原地区", () => {
	const { dictionary } = generateBihua(
		"尖\t2 3 4 1 3 4\tH,J,K,V\n尘\t2 3 4 1 2 1\tJ",
	);
	assert.match(dictionary, /尖\t234134GHJKV/u);
	assert.match(dictionary, /尘\t234121GJ/u);
});
test("短部件单字保留全部前缀并重复一次末辅", () => {
	for (const [text, reading, expected] of [
		["几", "ji3", "jkuaa"],
		["乙", "yi3", "ykaa"],
		["口", "kou3", "kdoo"],
		["曰", "yue1", "yhoii"],
	]) {
		const codes = productionCharacterCodes("classic-shape", text, reading).map(
			(c) => c.code,
		);
		assert.ok(codes.includes(expected));
		assert.ok(codes.includes(expected.slice(0, -1)));
	}
});
test("尖尘默认大陆来源生成完整笔画辅码", () => {
	assert.ok(
		productionCharacterCodes("oc21-tone", "尖", "jian1").some(
			(c) => c.code === "jpiiuovuo",
		),
	);
	assert.ok(
		productionCharacterCodes("rc26-tone", "尘", "chen2").some(
			(c) => c.code === "xdeiuoeie",
		),
	);
});
