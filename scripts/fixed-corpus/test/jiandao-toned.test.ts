import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { alignFixedContent } from "../../align-fixed-with-sipin";
import { SpellingAlgebra } from "../../lib/algebra";
import { loadAuxiliarySemantics } from "../../lib/auxiliary-semantics";
import { rootPath } from "../../lib/paths";

const read = (path: string) => readFileSync(rootPath(path), "utf8");
const mapping = JSON.parse(read("config/snow-jiandao-toned-mapping.json")) as {
	id: string;
	capacity: number[];
	occupiedBuckets: number;
	memoryLower: number;
	ordinaryInitialDisplacements: number;
	firstKeys: Record<string, string>;
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
	toneDigitsByShapeMeaning: string;
	wordAuxiliaryPolicy: Record<string, string>;
	referenceTonedCodes: Record<string, string>;
	previousLayoutAudit: { occupiedBuckets: number; vacantBuckets: number };
};
const algebra = new SpellingAlgebra(
	rootPath("snow_jiandao_toned.schema.yaml"),
	"speller/algebra",
);
const fixedSource = read("snow_jiandao_toned.fixed.txt");
const fixed = new Map(
	fixedSource
		.split(/\r?\n/u)
		.filter((l) => l.includes("\t") && !l.startsWith("#"))
		.map((l) => l.split("\t") as [string, string]),
);

test("冰雪莲道逐条复现 CR-LAN-f19a0ad1dc 的 1407 个音节，测量新旧占桶", () => {
	assert.equal(mapping.id, "CR-LAN-f19a0ad1dc");
	assert.deepEqual(mapping.capacity, [21, 21]);
	assert.equal(mapping.memoryLower, 24);
	assert.equal(mapping.ordinaryInitialDisplacements, 2);
	assert.equal(Object.keys(mapping.referenceTonedCodes).length, 1407);
	for (const [reading, code] of Object.entries(mapping.referenceTonedCodes))
		assert.equal(algebra.apply(reading), code, reading);
	assert.equal(new Set(Object.values(mapping.referenceTonedCodes)).size, 432);
	assert.equal(mapping.occupiedBuckets, 432);
	assert.equal(mapping.previousLayoutAudit.occupiedBuckets, 427);
	assert.equal(mapping.previousLayoutAudit.vacantBuckets, 14);
});

test("莲道保持兰道声母和五辅语义，三个声调区合入第二码", () => {
	const parent = JSON.parse(read("config/shenyun-21x21-mapping.json")) as {
		initialMap: Record<string, string>;
	};
	for (const [head, key] of Object.entries(mapping.firstKeys))
		assert.equal(
			key,
			parent.initialMap[head.startsWith("zero-") ? head.slice(5) : head],
			head,
		);
	const semantics = loadAuxiliarySemantics("21x21");
	assert.equal(
		mapping.shapeKeysByMeaning.toLowerCase(),
		semantics.shapeKeysByMeaning,
	);
	assert.equal(mapping.toneKeysByTone.toLowerCase(), semantics.toneKeysByTone);
	assert.equal(mapping.toneDigitsByShapeMeaning, "42310");
	assert.deepEqual(
		[1, 2, 3, 4, 5].map((t) => algebra.apply(`bing${t}`)),
		["bm", "bg", "bg", "be", "bm"],
	);
	assert.equal(algebra.apply("pin1"), "pb");
	assert.equal(algebra.apply("qia1"), "qx");
	assert.equal(algebra.apply("qiu1"), "qn");
	assert.deepEqual(mapping.wordAuxiliaryPolicy, {
		word2: "21",
		word3: "213",
		word4: "14",
	});
});

test("莲道按运行时频率口径回收十个声声空桶，字母占用码始终保留", () => {
	const occupied = new Set<string>();
	for (const line of read("snow_pinyin.dict.yaml").split(/\r?\n/u)) {
		const [character, spelling, weight] = line.split("\t");
		if (spelling && [...character].length === 1 && Number(weight) > 1)
			occupied.add(algebra.apply(spelling));
	}
	const keys = "bpmfdtnlgkhjqxzcsrwye";
	assert.deepEqual(
		[...keys]
			.flatMap((a) => [...keys].map((b) => a + b))
			.filter((c) => !occupied.has(c))
			.sort(),
		["fb", "ff", "gf", "hf", "lg", "rb", "rf", "rg", "rm", "wf"],
	);
	const schema = load(read("snow_jiandao_toned.schema.yaml")) as Record<
		string,
		any
	>;
	assert.equal(schema.__include, "snow_jiandao.schema.yaml:/");
	assert.equal(schema.jianpin.prism, "snow_jiandao_toned_jianpin");
	assert.equal(schema.initial_pair.prism, "snow_jiandao_toned_jianpin");
	assert.equal(schema.patch["translator/word_auxiliary_order"], "21");
	assert.equal(schema.patch["translator/three_word_auxiliary_order"], "213");
	assert.equal(schema.patch["translator/four_word_auxiliary_order"], "14");
	assert.equal(schema.patch["translator/shape_mapping"], undefined);
	assert.equal(
		schema.patch["translator/user_dict_name"],
		"snow_jiandao_toned_cr_lan_f19a0ad1dc",
	);
	assert.ok(
		read("lua/snow/keymaps/snow_jiandao_toned.svg").includes(mapping.id),
	);
	const reserved = new RegExp(
		schema.patch["translator/reserved_initial_pair_pattern"],
	);
	for (const letter of keys + "viuoa") {
		const code =
			(
				{ v: "xg", i: "xl", u: "xh", o: "xd", a: "xw" } as Record<
					string,
					string
				>
			)[letter] ?? `${letter}c`;
		assert.ok(reserved.test(code));
		assert.deepEqual(fixed.get(code)?.split(" ").slice(-2), [
			letter.toUpperCase(),
			letter,
		]);
	}
});

test("莲道重算固顶音码、保留兰道全部 630，生成结果可重复", () => {
	assert.equal(
		alignFixedContent("snow_jiandao_toned.fixed.txt", fixedSource),
		fixedSource,
	);
	const parent630 = read("snow_jiandao.fixed.txt")
		.split("# 630")[1]
		.split("# 单字")[0]
		.trim();
	const current630 = fixedSource.split("# 630")[1].split("# 字母")[0].trim();
	assert.equal(current630, parent630);
	assert.equal(fixed.get("d"), "的");
	assert.equal(fixed.get("pb"), "拼");
	assert.equal(fixed.get("xdv"), "雪");
	assert.equal(fixed.get("rb"), "日本");
	assert.deepEqual(fixed.get("xd")?.split(" "), ["写", "O", "o"]);
});
