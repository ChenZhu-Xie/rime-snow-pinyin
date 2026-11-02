import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	loadAuxiliarySemantics,
	SHAPE_MEANINGS,
	STROKES,
	TONES,
} from "../../lib/auxiliary-semantics";

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

test("四个生产方案逐位使用形义序、声调序和笔画序", () => {
	assert.deepEqual(SHAPE_MEANINGS, ["折", "横", "撇", "竖", "点"]);
	assert.deepEqual(TONES, ["一", "二", "三", "四", "轻"]);
	assert.deepEqual(STROKES, ["横", "竖", "撇", "点", "折"]);
	assert.deepEqual(loadAuxiliarySemantics("21x21"), {
		capacity: "21x21",
		shapeKeysByMeaning: "avuio",
		toneKeysByTone: "ivuao",
		strokeKeysByStroke: "viuoa",
		toneDigitsByShapeMeaning: "42310",
	});
	assert.deepEqual(loadAuxiliarySemantics("21x26"), {
		capacity: "21x26",
		shapeKeysByMeaning: "aeuio",
		toneKeysByTone: "ieuao",
		strokeKeysByStroke: "eiuoa",
		toneDigitsByShapeMeaning: "42310",
	});
});

test("生成的运行时语义表和三拼笔画棱镜消费当前配置", () => {
	const lua = readFileSync(
		new URL("lua/snow/auxiliary_semantics.lua", root),
		"utf8",
	);
	assert.match(
		lua,
		/\["21x21"\][\s\S]*shape_keys_by_meaning = "avuio"[\s\S]*tone_keys_by_tone = "ivuao"[\s\S]*stroke_keys_by_stroke = "viuoa"/u,
	);
	assert.match(
		lua,
		/\["21x26"\][\s\S]*shape_keys_by_meaning = "aeuio"[\s\S]*tone_keys_by_tone = "ieuao"[\s\S]*stroke_keys_by_stroke = "eiuoa"/u,
	);
	const sanpinStroke = readFileSync(
		new URL("snow_sanpin_bihua.schema.yaml", root),
		"utf8",
	);
	assert.match(sanpinStroke, /xlit\/12345\/viuoa\//u);
	assert.doesNotMatch(sanpinStroke, /xlit\/12345\/ivuao\//u);
	const sanpin = readFileSync(new URL("snow_sanpin.schema.yaml", root), "utf8");
	assert.match(sanpin, /stroke\/algebra:[\s\S]*xlit\/12345\/viuoa\//u);
});

test("键道二分形辅保留折横撇竖点含义", () => {
	const mapping = new Map(
		readFileSync(new URL("lua/snow/radical_jiandao.txt", root), "utf8")
			.split(/\r?\n/u)
			.map((line) => line.split("\t") as [string, string]),
	);
	assert.deepEqual(
		["乙", "一", "丿", "丨", "丶"].map((element) => mapping.get(element)),
		[..."avuio"],
	);
	const decomposition = readFileSync(
		new URL("snow_jiandao_chaifen.dict.yaml", root),
		"utf8",
	).match(/^冰\t([^\r\n]+)$/mu)?.[1];
	assert.equal(decomposition, "丶一・水");
	assert.equal(
		[...(decomposition ?? "")]
			.map((element) => mapping.get(element) ?? "")
			.join(""),
		"ova",
		"冰的第一分区为点、横，第二分区为水；物理形辅应为 OVA",
	);
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
