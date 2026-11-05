import assert from "node:assert/strict";
import test from "node:test";
import {
	sbxhIsPoppable,
	sbxhSoundCode,
	sbxhStandardCodes,
	sbxhSupplementalStrokes,
	sbxhWordCode,
} from "../../lib/sbxh-benchmark";

test("声笔小鹤只借用小鹤韵位并保留 z/c/s 声母", () => {
	assert.equal(sbxhSoundCode("qing44"), "qk");
	assert.equal(sbxhSoundCode("chen25"), "cf");
	assert.equal(sbxhSoundCode("shi4"), "si");
	assert.equal(sbxhSoundCode("lve4"), "lt");
	assert.equal(sbxhSoundCode("yuan2"), "yr");
	assert.equal(sbxhSoundCode("e4"), "ve");
});

test("声笔小鹤词语严格遵循自己的三条 encoder 公式", () => {
	assert.equal(sbxhWordCode(["qk", "cf"]), "qkcf");
	assert.equal(sbxhWordCode(["gh", "gh", "xk"]), "ggxk");
	assert.equal(sbxhWordCode(["gh", "gh", "xk", "ld"]), "ggxl");
	assert.deepEqual(sbxhStandardCodes(["mu"], ["eiii"]), [
		"muei",
		"mueii",
		"mueiii",
	]);
	assert.deepEqual(sbxhStandardCodes(["qk", "cf"], ["ooee", "aeiu"]), [
		"qkcf",
		"qkcfo",
		"qkcfoo",
		"qkcfooa",
		"qkcfooae",
		"qkcfooaei",
		"qkcfooaeiu",
	]);
	assert.equal(sbxhSupplementalStrokes(["uieaoiao"]), "eaoiao");
	assert.ok(sbxhStandardCodes(["dd"], ["uieaoiao"]).includes("dduieao"));
	assert.ok(
		sbxhStandardCodes(["gu", "si"], ["eiiaeeee", "eiao"]).includes("gusieie"),
	);
});

test("声笔小鹤顶屏判断覆盖三码单字、二字全码与撇号简词", () => {
	assert.equal(sbxhIsPoppable("qci"), true);
	assert.equal(sbxhIsPoppable("qkcf"), true);
	assert.equal(sbxhIsPoppable("bb'"), true);
	assert.equal(sbxhIsPoppable("qk"), false);
});
