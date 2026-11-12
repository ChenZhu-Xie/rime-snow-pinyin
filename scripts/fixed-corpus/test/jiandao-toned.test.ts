import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { SpellingAlgebra } from "../../lib/algebra";

const root = new URL("../../../", import.meta.url);
const mapping = JSON.parse(
	readFileSync(new URL("config/snow-jiandao-toned-mapping.json", root), "utf8"),
) as {
	id: string;
	capacity: [number, number];
	tonedSyllableInventory: number;
	occupiedBuckets: number;
	memoryLower: number;
	ordinaryInitialDisplacements: number;
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
	toneDigitsByShapeMeaning: string;
	soundKeys: string;
};
const algebra = new SpellingAlgebra(
	fileURLToPath(new URL("snow_jiandao_toned.schema.yaml", root)),
	"speller/algebra",
);

test("冰雪剑道冻结 MARS10-D1 的容量、记忆与五辅语义", () => {
	assert.equal(mapping.id, "MARS10-AVUIO786-D1-final-9.203609845305");
	assert.deepEqual(mapping.capacity, [21, 21]);
	assert.equal(mapping.tonedSyllableInventory, 1407);
	assert.equal(mapping.occupiedBuckets, 427);
	assert.equal(mapping.memoryLower, 21);
	assert.equal(mapping.ordinaryInitialDisplacements, 1);
	assert.equal(mapping.shapeKeysByMeaning, "AVUIO");
	assert.equal(mapping.toneKeysByTone, "IVUAO");
	assert.equal(mapping.toneDigitsByShapeMeaning, "42310");
	assert.equal(mapping.soundKeys, "QWERTYPSDFGHJKLZXCBNM");
});

test("冰雪剑道三个调区和十韵组生成指定第二码", () => {
	assert.deepEqual(
		["a1", "en1", "e1", "ai1", "an1", "ang1", "wu1", "yi1", "o1", "ao1"].map(
			(value) => algebra.apply(value),
		),
		["rz", "rn", "rm", "rc", "rm", "rx", "wn", "yb", "rn", "rc"],
	);
	assert.deepEqual(
		["a2", "en2", "e2", "ai2", "an2", "ang2", "wu2", "yi2", "o2", "ao2"].map(
			(value) => algebra.apply(value),
		),
		["rs", "rk", "rd", "rg", "rl", "rj", "wh", "yf", "rk", "rh"],
	);
	assert.deepEqual(
		["a4", "en4", "e4", "ai4", "an4", "ang4", "wu4", "yi4", "o4", "ao4"].map(
			(value) => algebra.apply(value),
		),
		["re", "rt", "rw", "rp", "rq", "ry", "we", "yr", "ry", "rt"],
	);
});

test("冰雪剑道保持 p 的唯一普通声母位移并允许 QZ 实际音节", () => {
	assert.equal(algebra.apply("pin1"), "kn");
	assert.equal(algebra.apply("lin1"), "ln");
	assert.equal(algebra.apply("qia1"), "qz");
	assert.equal(algebra.apply("qiu1"), "qz");
	assert.equal(algebra.apply("zhong1"), "en");
	assert.equal(algebra.apply("chong2"), "sk");
	assert.equal(algebra.apply("shi4"), "pr");
});

test("冰雪剑道完整音节只使用二个非形辅音码键", () => {
	const soundKeys = new Set(mapping.soundKeys.toLowerCase());
	for (const reading of [
		"bing1",
		"xue3",
		"yuan2",
		"yue4",
		"jun1",
		"lve4",
		"er5",
		"zhuang4",
	]) {
		const code = algebra.apply(reading);
		assert.equal(code.length, 2, reading);
		assert.ok(
			[...code].every((key) => soundKeys.has(key)),
			`${reading} → ${code}`,
		);
	}
});
