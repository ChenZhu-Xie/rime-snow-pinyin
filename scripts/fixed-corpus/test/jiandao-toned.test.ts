import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { alignFixedContent } from "../../align-fixed-with-sipin";
import { SpellingAlgebra } from "../../lib/algebra";
import { loadAuxiliarySemantics } from "../../lib/auxiliary-semantics";
import { rootPath } from "../../lib/paths";
import { loadVacancyFallbackSyllables } from "../../lib/runtime-vacancy";

const read = (path: string) => readFileSync(rootPath(path), "utf8");
const mapping = JSON.parse(read("config/snow-jiandao-toned-mapping.json")) as {
	id: string;
	name: string;
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
	runtimeVacantCodes: string[];
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

test("冰雪莲道逐条复现 CR-REF-7e650f7a4c 的 1407 个音节，测量新旧占桶", () => {
	assert.equal(mapping.id, "CR-REF-7e650f7a4c");
	assert.equal(mapping.name, "冰雪莲道");
	assert.deepEqual(mapping.capacity, [21, 21]);
	assert.equal(mapping.memoryLower, 21);
	assert.equal(mapping.ordinaryInitialDisplacements, 2);
	assert.equal(Object.keys(mapping.referenceTonedCodes).length, 1407);
	for (const [reading, code] of Object.entries(mapping.referenceTonedCodes))
		assert.equal(algebra.apply(reading), code, reading);
	assert.equal(new Set(Object.values(mapping.referenceTonedCodes)).size, 433);
	assert.equal(mapping.occupiedBuckets, 433);
	assert.ok(!Object.values(mapping.referenceTonedCodes).includes("kg"));
	assert.equal(mapping.previousLayoutAudit.occupiedBuckets, 432);
	assert.equal(mapping.previousLayoutAudit.vacantBuckets, 9);
});

test("莲道使用目标声母并保持五辅语义，三个声调区合入第二码", () => {
	assert.deepEqual(
		["zh", "ch", "sh", "s", "l", "k", "zero-A", "zero-E", "zero-O"].map(
			(head) => mapping.firstKeys[head],
		),
		["E", "S", "K", "C", "L", "P", "R", "R", "R"],
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
		["bz", "bg", "bg", "be", "bz"],
	);
	assert.equal(algebra.apply("pin1"), "pn");
	assert.equal(algebra.apply("qia1"), "qx");
	assert.equal(algebra.apply("qiu1"), "qm");
	assert.deepEqual(mapping.wordAuxiliaryPolicy, {
		word2: "21",
		word3: "231",
		word4: "14",
	});
});

test("莲道按运行时兜底音节口径回收七个声声空桶，杓 shuo2 与字母占用码保留", () => {
	const occupied = new Set<string>();
	const fallbackSyllables = loadVacancyFallbackSyllables();
	const spellings = new Set<string>();
	for (const line of read("snow_pinyin.dict.yaml").split(/\r?\n/u)) {
		const [character, spelling] = line.split("\t");
		if (
			spelling &&
			[...character].length === 1 &&
			!spelling.startsWith("~") &&
			!fallbackSyllables.has(spelling.replace(/[0-9]$/u, ""))
		)
			spellings.add(spelling);
	}
	for (const spelling of spellings) occupied.add(algebra.apply(spelling));
	const keys = "bpmfdtnlgkhjqxzcsrwye";
	assert.deepEqual(
		[...keys]
			.flatMap((a) => [...keys].map((b) => a + b))
			.filter((c) => !occupied.has(c))
			.sort(),
		mapping.runtimeVacantCodes,
	);
	assert.deepEqual(mapping.runtimeVacantCodes, [
		"fb",
		"ff",
		"gf",
		"hf",
		"rf",
		"sg",
		"wf",
	]);
	assert.equal(algebra.apply("shuo2"), "kg");
	assert.ok(occupied.has("kg"));
	assert.notEqual(fixed.get("kg"), "说过");
	const schema = load(read("snow_jiandao_toned.schema.yaml")) as Record<
		string,
		any
	>;
	assert.equal(schema.__include, "snow_jiandao.schema.yaml:/");
	assert.equal(schema.jianpin.prism, "snow_jiandao_toned_jianpin");
	assert.equal(schema.initial_pair.prism, "snow_jiandao_toned_jianpin");
	assert.equal(schema.patch["translator/word_auxiliary_order"], "21");
	assert.equal(schema.patch["translator/three_word_auxiliary_order"], "231");
	assert.equal(schema.patch["translator/four_word_auxiliary_order"], "14");
	assert.equal(schema.patch["translator/shape_mapping"], undefined);
	assert.equal(
		schema.patch["translator/user_dict_name"],
		"snow_jiandao_toned_cr_ref_7e650f7a4c",
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

test("莲道重算固顶音码、按声母重映射兰道全部 630，生成结果可重复", () => {
	assert.equal(
		alignFixedContent("snow_jiandao_toned.fixed.txt", fixedSource),
		fixedSource,
	);
	const parent630 = read("snow_jiandao.fixed.txt")
		.split("# 630")[1]
		.split("# 单字")[0]
		.trim();
	const current630 = fixedSource.split("# 630")[1].split("# 字母")[0].trim();
	const shortcuts = new Map(
		current630.split("\n").map((line) => line.split("\t") as [string, string]),
	);
	const parentAlgebra = new SpellingAlgebra(
		rootPath("snow_jiandao.schema.yaml"),
		"speller/algebra",
	);
	const readings = new Map<string, string[]>();
	for (const line of read("scripts/data/tygf-pinyin.tsv").trim().split("\n")) {
		const [character, reading] = line.split("\t");
		const values = readings.get(character) ?? [];
		values.push(reading);
		readings.set(character, values);
	}
	for (const line of parent630.split("\n")) {
		const [code, candidates] = line.split("\t");
		for (const word of candidates.split(" ")) {
			const reading = readings
				.get([...word][0])
				?.find((reading) => parentAlgebra.apply(reading).startsWith(code[0]));
			assert.ok(reading, word);
			const nextCode = algebra.apply(reading)[0] + code.slice(1);
			assert.ok(
				shortcuts.get(nextCode)?.split(" ").includes(word),
				`${word}: ${code} → ${nextCode}`,
			);
		}
	}
	assert.equal(
		new Set([...shortcuts.values()].flatMap((words) => words.split(" "))).size,
		new Set(
			parent630.split("\n").flatMap((line) => line.split("\t")[1].split(" ")),
		).size,
	);
	assert.equal(fixed.get("d"), "都");
	assert.equal(fixed.get("pn"), "哭");
	assert.equal(fixed.get("xdv"), "雪");
	assert.equal(fixed.get("sg"), "成功");
	assert.deepEqual(fixed.get("xd")?.split(" "), ["写", "O", "o"]);
});
