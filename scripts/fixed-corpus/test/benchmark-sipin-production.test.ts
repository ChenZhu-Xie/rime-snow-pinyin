import assert from "node:assert/strict";
import test from "node:test";
import {
	pronunciationCodes,
	productionCharacterCodes,
} from "../../lib/benchmark-schemes";
test("四拼语料单字复用生产路径，声调后先补 o 再接笔画", () => {
	for (const [text, reading, base] of [
		["母", "mu2", "mue"],
		["母", "mu3", "muu"],
		["锁", "suo3", "sou"],
		["布", "bu4", "bua"],
	]) {
		const routes = pronunciationCodes("sipin", text, [reading]);
		assert.deepEqual(routes, productionCharacterCodes("sipin", text, reading));
		assert.ok(routes.some((r) => r.code === base + "o"));
		for (const r of routes.filter(
			(r) => r.auxiliaryLength > 0 && !r.code.includes("1"),
		)) {
			assert.equal(r.mainLength, 4);
			assert.ok(r.code.startsWith(base + "o"));
		}
	}
	const codes = pronunciationCodes("sipin", "母", ["mu2"]).map((r) => r.code);
	assert.ok(codes.includes("mueoaa"));
	assert.ok(!codes.includes("mueaa"));
	assert.ok(!codes.includes("muea"));
});
