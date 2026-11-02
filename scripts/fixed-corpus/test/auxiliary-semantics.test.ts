import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const require = createRequire(import.meta.url);
const {
	TONE_DIGITS_BY_SHAPE_MEANING,
	auxiliarySemantics,
	shapeKeysFromToneKeys,
	toneKeysFromShapeKeys,
} = require("../../research/auxiliary_semantics.js") as {
	TONE_DIGITS_BY_SHAPE_MEANING: string;
	auxiliarySemantics: (toneKeysByTone: string) => {
		shapeKeysByMeaning: string;
		toneKeysByTone: string;
		toneDigitsByShapeMeaning: string;
	};
	shapeKeysFromToneKeys: (toneKeysByTone: string) => string;
	toneKeysFromShapeKeys: (shapeKeysByMeaning: string) => string;
};

function readMapping(path: string) {
	return JSON.parse(readFileSync(new URL(path, root), "utf8")) as {
		shapeKeysByMeaning: string;
		toneKeysByTone: string;
		auxiliaryKeys?: unknown;
		toneKeys?: unknown;
	};
}

test("标准 21×26 与 21×21 五辅映射保持 42310 语义不变量", () => {
	assert.deepEqual(auxiliarySemantics("IEUAO"), {
		shapeKeysByMeaning: "AEUIO",
		toneKeysByTone: "IEUAO",
		toneDigitsByShapeMeaning: "42310",
	});
	assert.deepEqual(auxiliarySemantics("IVUAO"), {
		shapeKeysByMeaning: "AVUIO",
		toneKeysByTone: "IVUAO",
		toneDigitsByShapeMeaning: "42310",
	});
	assert.equal(TONE_DIGITS_BY_SHAPE_MEANING, "42310");
});

test("神韵机器可读配置显式区分形义序与声调序", () => {
	for (const path of [
		"config/shenyun-21x21-mapping.json",
		"config/shenyun-21x26-mapping.json",
		"config/shenyun-21x28-mapping.json",
		"docs/shenyun-u357-mapping.json",
	]) {
		const mapping = readMapping(path);
		assert.equal(Object.hasOwn(mapping, "auxiliaryKeys"), false, path);
		assert.equal(Object.hasOwn(mapping, "toneKeys"), false, path);
		assert.equal(
			shapeKeysFromToneKeys(mapping.toneKeysByTone),
			mapping.shapeKeysByMeaning,
			path,
		);
		assert.equal(
			toneKeysFromShapeKeys(mapping.shapeKeysByMeaning),
			mapping.toneKeysByTone,
			path,
		);
		assert.equal(
			auxiliarySemantics(mapping.toneKeysByTone).toneDigitsByShapeMeaning,
			"42310",
			path,
		);
	}
});

test("AEUIO 或 AVUIO 类别名不能直接当成声调序", () => {
	assert.equal(shapeKeysFromToneKeys("AEUIO"), "IEUAO");
	assert.equal(shapeKeysFromToneKeys("AVUIO"), "IVUAO");
});
