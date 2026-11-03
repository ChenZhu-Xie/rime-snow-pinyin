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
import {
	BENCHMARK_SCHEMES,
	pronunciationCodes,
} from "../../lib/benchmark-schemes";
import { rankBenchmarkCodes } from "../../lib/benchmark-ranking";

const root = new URL("../../../", import.meta.url);
const require = createRequire(import.meta.url);
const {
	TONE_DIGITS_BY_SHAPE_MEANING,
	auxiliarySemantics,
	shapeKeysFromToneKeys,
	strokeKeysFromToneKeys,
	toneKeysFromShapeKeys,
} = require("../../research/auxiliary_semantics.js") as {
	TONE_DIGITS_BY_SHAPE_MEANING: string;
	auxiliarySemantics: (toneKeysByTone: string) => {
		shapeKeysByMeaning: string;
		toneKeysByTone: string;
		toneDigitsByShapeMeaning: string;
	};
	shapeKeysFromToneKeys: (toneKeysByTone: string) => string;
	strokeKeysFromToneKeys: (toneKeysByTone: string) => string;
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
	assert.equal(strokeKeysFromToneKeys("IVUAO"), "VIUOA");
	assert.equal(strokeKeysFromToneKeys("IEUAO"), "EIUOA");
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

test("生成的运行时语义表区分三拼 B2 与独立笔画反查", () => {
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
	const sanpinSemantics = loadAuxiliarySemantics("21x21");
	assert.match(
		sanpinStroke,
		new RegExp(`xlit/12345/${sanpinSemantics.toneKeysByTone}/`, "u"),
	);
	const sanpin = readFileSync(new URL("snow_sanpin.schema.yaml", root), "utf8");
	assert.match(
		sanpin,
		new RegExp(
			`stroke/preedit_format: \\[xlit/${sanpinSemantics.toneKeysByTone}/`,
			"u",
		),
	);
	assert.match(
		readFileSync(new URL("lua/snow/shape_filter.lua", root), "utf8"),
		/auxiliary_semantics\["21x21"\][\s\S]*stroke_keys_by_digit/u,
	);
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

test("benchmark schemes use the current main-code contracts and auxiliary orders", () => {
	assert.deepEqual(
		BENCHMARK_SCHEMES.map(({ id, auxiliaryOrder }) => [id, auxiliaryOrder]),
		[
			["u357-shape", "12/231/24"],
			["u357-tone", "12/213/23"],
			["overall17-shape", "12/21/42"],
			["overall17-tone", "12/21/13"],
		],
	);
	const u357Three = pronunciationCodes("u357-tone", "天地人", [
		"tian1",
		"di2",
		"ren3",
	]);
	assert.equal(u357Three[0].mainLength, 3);
	assert.equal(u357Three.at(-1)?.code.slice(-3), "viu");
	const overallThree = pronunciationCodes("overall17-tone", "天地人", [
		"tian1",
		"di2",
		"ren3",
	]);
	assert.deepEqual(
		overallThree
			.filter(({ auxiliaryLength }) => auxiliaryLength === 0)
			.map(({ mainLength }) => mainLength),
		[3, 4],
	);
	assert.equal(overallThree.at(-1)?.code.slice(-2), "ei");
	const u357Four = pronunciationCodes("u357-tone", "天地人和", [
		"tian1",
		"di2",
		"ren3",
		"he2",
	]);
	assert.equal(u357Four.at(-1)?.code.slice(-2), "vu");
	const overallFour = pronunciationCodes("overall17-tone", "天地人和", [
		"tian1",
		"di2",
		"ren3",
		"he2",
	]);
	assert.equal(overallFour.at(-1)?.code.slice(-2), "iu");

	const jiandaoSingle = pronunciationCodes("u357-shape", "时", ["shi2"]);
	const shenyunShapeSingle = pronunciationCodes("overall17-shape", "时", [
		"shi2",
	]);
	const shenyunToneSingle = pronunciationCodes("overall17-tone", "时", [
		"shi2",
	]);
	assert.equal(jiandaoSingle.at(-1)?.auxiliaryLength, 4);
	assert.equal(shenyunShapeSingle.at(-1)?.auxiliaryLength, 4);
	assert.equal(shenyunToneSingle.at(-1)?.auxiliaryLength, 4);
	assert.equal(jiandaoSingle.at(-1)?.code.slice(-4), "oivi");
	assert.equal(shenyunShapeSingle.at(-1)?.code.slice(-4), "oiei");
	assert.equal(shenyunToneSingle.at(-1)?.code.slice(-4), "eiae");
});

test("21×26 单字明确支持 AU 后连续追加四辅", () => {
	const schema = readFileSync(
		new URL("snow_shenyun_common.yaml", root),
		"utf8",
	);
	assert.match(
		schema,
		/- match: "\^\[bpmfdtnlgkhjqwvxrzcsy\]\[a-z\]\[aeuio\]\{3\}\$"\r?\n\s+accept: "\[aeuio\]"\r?\n\s+strategy: append/u,
	);
});

test("benchmark 逐级模拟首选后置并保留最短合法单字码", () => {
	const entries = [
		{ word: "是", syllables: ["shi4"], weight: 100 },
		{ word: "时", syllables: ["shi2"], weight: 10 },
	];
	const ranked = rankBenchmarkCodes(
		"overall17-shape",
		[entries[1]],
		entries,
		new Map([["w", { word: "是" }]]),
	);
	assert.equal(ranked.find(({ code }) => code === "w")?.rank, 2);
	assert.equal(ranked.find(({ code }) => code === "wi")?.rank, 1);
});
