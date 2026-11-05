import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { load } from "js-yaml";
import {
	ALL_BENCHMARK_SCHEMES,
	type BenchmarkSchemeId,
	LEGACY_BENCHMARK_SCHEMES,
	pronunciationCodes,
} from "../../lib/benchmark-schemes";
import {
	type BenchmarkDictionaryEntry,
	rankBenchmarkCodes,
} from "../../lib/benchmark-ranking";
import { SpellingAlgebra } from "../../lib/algebra";
import { rootPath } from "../../lib/paths";
import { readShapeCodes } from "../../固顶编译器";

const fixtureRoot = rootPath("scripts", "data", "legacy-schemes", "3658e22");

interface Manifest {
	sourceCommit: string;
	migrationCommit: string;
	releaseSchemas: boolean;
	files: Record<string, { gitBlob: string; sha256: string }>;
}

function fixedSections(file: string) {
	const sections = new Map<string, Array<[string, string[]]>>();
	let current: Array<[string, string[]]> | undefined;
	for (const line of readFileSync(rootPath(file), "utf8").split(/\r?\n/u)) {
		if (line.startsWith("#")) {
			current = [];
			sections.set(line, current);
			continue;
		}
		const [code, candidates] = line.split("\t");
		if (current && code && candidates)
			current.push([code, candidates.split(" ")]);
	}
	return sections;
}

function dictionaryReadings() {
	const result = new Map<string, string[][]>();
	for (const file of [
		"snow_pinyin.dict.yaml",
		"snow_pinyin.base.dict.yaml",
		"snow_pinyin.ext.dict.yaml",
		"snow_pinyin.tencent.dict.yaml",
		"snow_pinyin.user.dict.yaml",
	]) {
		for (const line of readFileSync(rootPath(file), "utf8").split(/\r?\n/u)) {
			if (!line.includes("\t") || line.startsWith("#")) continue;
			const [word, reading] = line.split("\t");
			if (!word || !reading || reading.startsWith("~")) continue;
			const values = result.get(word) ?? [];
			values.push(reading.split(" "));
			result.set(word, values);
		}
	}
	return result;
}

test("经典冰雪键道与冰雪三拼快照完整且可独立校验", () => {
	const manifest = JSON.parse(
		readFileSync(`${fixtureRoot}/manifest.json`, "utf8"),
	) as Manifest;
	assert.equal(
		manifest.sourceCommit,
		"3658e22a151cfaa703a68e3a47a16101efd88e42",
	);
	assert.equal(
		manifest.migrationCommit,
		"b8fd127da9ecb14d07da1ce9a680ca92d91837f0",
	);
	assert.equal(manifest.releaseSchemas, true);
	for (const [relative, expected] of Object.entries(manifest.files)) {
		assert.match(expected.gitBlob, /^[0-9a-f]{40}$/u);
		const actual = createHash("sha256")
			.update(readFileSync(`${fixtureRoot}/${relative}`))
			.digest("hex");
		assert.equal(actual, expected.sha256, relative);
	}
});

test("经典 schema 保留迁移前名称并以独立 ID 进入发布方案", () => {
	const jiandao = load(
		readFileSync(`${fixtureRoot}/schemas/snow_jiandao.schema.yaml`, "utf8"),
	) as { schema: { schema_id: string; name: string } };
	const sanpin = load(
		readFileSync(`${fixtureRoot}/schemas/snow_sanpin.schema.yaml`, "utf8"),
	) as { schema: { schema_id: string; name: string } };
	assert.deepEqual(jiandao.schema, {
		schema_id: "snow_jiandao",
		name: "冰雪键道",
		version: "0.3",
		author: ["吅吅大山", "谭淞宸 <i@tansongchen.com>"],
		description: "单字三码起顶、词组四码起顶的双拼词顶功方案\n",
		dependencies: [
			"snow_pinyin",
			"snow_jiandao_bihua",
			"snow_jiandao_jianpin",
			"snow_jiandao_chaifen",
		],
	});
	assert.equal(sanpin.schema.schema_id, "snow_sanpin");
	assert.equal(sanpin.schema.name, "冰雪三拼");
	assert.equal(LEGACY_BENCHMARK_SCHEMES.length, 2);
	assert.equal(ALL_BENCHMARK_SCHEMES.length, 8);
	const releasedJiandao = readFileSync(
		rootPath("snow_jiandao_classic.schema.yaml"),
		"utf8",
	);
	const releasedSanpin = readFileSync(
		rootPath("snow_sanpin_classic.schema.yaml"),
		"utf8",
	);
	assert.match(releasedJiandao, /schema_id: snow_jiandao_classic/u);
	assert.match(releasedJiandao, /name: 冰雪键道/u);
	assert.match(releasedJiandao, /translator\/user_dict_name: snow_jiandao/u);
	assert.match(releasedSanpin, /schema_id: snow_sanpin_classic/u);
	assert.match(releasedSanpin, /name: 冰雪三拼/u);
	assert.match(releasedSanpin, /translator\/user_dict_name: snow_sanpin/u);
	for (const file of ["lua/snow/fix.lua", "lua/snow/user_dict.lua"]) {
		assert.match(
			readFileSync(rootPath(file), "utf8"),
			/config:get_string\("translator\/user_dict_name"\) or env\.engine\.schema\.schema_id/u,
			file,
		);
	}
});

test("经典方案保留迁移前飞键主码并采用 CKT v5.1 辅序扩展", () => {
	assert.deepEqual(
		pronunciationCodes("classic-shape", "时", ["shi2"]).map(({ code }) => code),
		["e", "ek", "eko", "ekoi", "ekoiv", "ekoivi"],
	);
	assert.deepEqual(
		pronunciationCodes("classic-tone", "冰雪", ["bing1", "xue3"]).map(
			({ code }) => code,
		),
		["bgxh", "bgxhv", "bgxhvu"],
	);
	const inputMethodCodes = pronunciationCodes("classic-tone", "输入法", [
		"shu1",
		"ru4",
		"fa3",
	]).map(({ code }) => code);
	assert.deepEqual(
		inputMethodCodes.filter((code) => !/[A-Z]/u.test(code)),
		["erf", "erfo", "erfov", "erfovu"],
	);
	for (const code of ["eJrf", "erJf", "erfS", "eJrJfS"]) {
		assert.ok(inputMethodCodes.includes(code), code);
	}
	const fourCharacterCodes = pronunciationCodes("classic-tone", "冰雪拼音", [
		"bing1",
		"xue3",
		"pin1",
		"yin1",
	]).map(({ code }) => code);
	assert.deepEqual(
		fourCharacterCodes.filter((code) => !/[A-Z]/u.test(code)),
		["bxpy", "bxpyu", "bxpyuv"],
	);
});

test("经典发布方案接入 AA 空桶与 AAB 二字辅码", () => {
	for (const schema of [
		"snow_jiandao_classic.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
	]) {
		const source = readFileSync(rootPath(schema), "utf8");
		assert.match(source, /^vacancy:/mu, schema);
		assert.match(source, /vacant: true/u, schema);
		assert.match(source, /status: initial_pair/u, schema);
		assert.doesNotMatch(source, /vacant_initial_pattern/u, schema);
	}
	const vacancySource = readFileSync(rootPath("lua/snow/vacancy.lua"), "utf8");
	assert.match(vacancySource, /translator:query\(input, segment\)/u);
	assert.match(vacancySource, /projection:apply\(spelling\)/u);
	assert.match(
		readFileSync(rootPath("snow_jiandao_classic.schema.yaml"), "utf8"),
		/lua_translator@\*snow\.table_like\*initial_pair/u,
	);
	assert.doesNotMatch(
		readFileSync(rootPath("scripts/lib/benchmark-ranking.ts"), "utf8"),
		/scheme\.startsWith\("classic-"\).*return/u,
	);
	const entries = [{ word: "表示", syllables: ["biao3", "shi4"], weight: 100 }];
	for (const [scheme, aab] of [
		["classic-shape", "bev"],
		["classic-tone", "beo"],
	] as const) {
		const codes = rankBenchmarkCodes(scheme, entries, entries, new Map()).map(
			({ code }) => code,
		);
		assert.ok(codes.includes("be"), `${scheme} 应包含空 AA 二简`);
		assert.ok(codes.includes(aab), `${scheme} 应包含空 AAB 辅码`);
	}
	for (const [scheme, occupant] of [
		["classic-tone", { word: "里", syllables: ["li3"], weight: 1000 }],
		["u357-tone", { word: "来", syllables: ["lai2"], weight: 1000 }],
	] as Array<[BenchmarkSchemeId, BenchmarkDictionaryEntry]>) {
		const target = { word: "离开", syllables: ["li2", "kai1"], weight: 100 };
		const codes = rankBenchmarkCodes(
			scheme,
			[target],
			[target, occupant],
			new Map(),
		).map(({ code }) => code);
		assert.ok(!codes.includes("lk"), `${scheme} 不应占用已有单字的 AA`);
	}
	const tableLike = readFileSync(rootPath("lua/snow/table_like.lua"), "utf8");
	assert.match(
		tableLike,
		/input:len\(\) == 2[\s\S]+vacancy\.is_empty\(input, segment/u,
	);
});

test("经典 630 首选均符合经典声码与 CKT v5.1 辅码语义", () => {
	const algebra = new SpellingAlgebra(
		rootPath(
			"scripts",
			"data",
			"legacy-schemes",
			"3658e22",
			"schemas",
			"snow_sanpin.schema.yaml",
		),
		"sanpin_algebra",
	);
	const elementKeys: Record<string, string> = {};
	for (const line of readFileSync(
		rootPath("lua", "snow", "radical_jiandao.txt"),
		"utf8",
	).split(/\r?\n/u)) {
		const [element, code] = line.split("\t");
		if (element && code) elementKeys[element] = code;
	}
	const shapes = readShapeCodes(
		rootPath("snow_jiandao_chaifen.dict.yaml"),
		elementKeys,
	);
	const readings = dictionaryReadings();
	const initials = (syllable: string) =>
		new Set(
			algebra
				.applyAll(syllable)
				.filter((code) => /^[a-z]{3}$/u.test(code))
				.map((code) => code[0]),
		);
	const toneKeys: Record<string, string> = {
		"1": "v",
		"2": "i",
		"3": "u",
		"4": "o",
		"5": "a",
	};
	const toneKey = (syllable: string) => toneKeys[syllable.at(-1) ?? ""] ?? "";
	for (const [code, [word]] of fixedSections(
		"snow_jiandao_classic.fixed.txt",
	).get("# 630") ?? []) {
		const characters = [...word];
		const shape = shapes.get(characters[1] ?? "") ?? "";
		assert.ok(
			characters.length === 2 &&
				(readings.get(word) ?? []).some(
					(syllables) =>
						syllables.length === 2 &&
						initials(syllables[0]).has(code[0]) &&
						shape.startsWith(code.slice(1)),
				),
			`${code}\t${word}`,
		);
	}
	for (const [code, [word]] of fixedSections(
		"snow_sanpin_classic.fixed.txt",
	).get("# 630") ?? []) {
		const length = [...word].length;
		assert.ok(
			(readings.get(word) ?? []).some((syllables) => {
				if (length < 2 || syllables.length !== length) return false;
				const prefix = code[0] + toneKey(syllables[1]);
				if (code.length === 2)
					return initials(syllables[0]).has(code[0]) && code === prefix;
				const target = length === 2 ? syllables[0] : syllables[2];
				return (
					initials(syllables[0]).has(code[0]) &&
					code === prefix + toneKey(target)
				);
			}),
			`${code}\t${word}`,
		);
	}
});

test("经典发布版迁入现行 fixed 功能并采用 CKT v5.1 辅序", () => {
	assert.deepEqual(
		LEGACY_BENCHMARK_SCHEMES.map(({ auxiliaryOrder }) => auxiliaryOrder),
		["12/231/24", "12/213/23"],
	);
	for (const file of [
		"snow_jiandao_classic.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
	]) {
		const source = readFileSync(rootPath(file), "utf8");
		assert.match(source, /strategy: append_raw/u, file);
		assert.match(source, /\[A-Z\]\?/u, file);
	}
	assert.match(
		readFileSync(rootPath("snow_jiandao_classic_jianpin.schema.yaml"), "utf8"),
		/derive\/\^\(\.\)\(\.\)\[viuoa\]\$\/\$1\\u\$2\//u,
	);
	const classicJiandao = readFileSync(
		rootPath("snow_jiandao_classic.schema.yaml"),
		"utf8",
	);
	assert.match(classicJiandao, /lua_translator@\*snow\.table_like\*jianpin/u);
	assert.doesNotMatch(classicJiandao, /jianpin:\r?\n\s+tag:/u);
	const jiandao = fixedSections("snow_jiandao_classic.fixed.txt");
	const sanpin = fixedSections("snow_sanpin_classic.fixed.txt");
	const currentJiandao = fixedSections("snow_jiandao.fixed.txt");
	const currentSanpin = fixedSections("snow_sanpin.fixed.txt");
	const words = (rows: Array<[string, string[]]>) =>
		new Set(rows.map(([, candidates]) => candidates[0]));
	assert.equal(jiandao.get("# 630")?.length, 630);
	assert.equal(words(jiandao.get("# 630") ?? []).size, 630);
	assert.ok(
		words(jiandao.get("# 单字") ?? []).size >=
			words(currentJiandao.get("# 单字") ?? []).size,
	);
	assert.ok((sanpin.get("# 630")?.length ?? 0) >= 611);
	assert.equal(
		words(sanpin.get("# 630") ?? []).size,
		sanpin.get("# 630")?.length,
	);
	assert.ok(
		words(sanpin.get("# 单字") ?? []).size >=
			words(currentSanpin.get("# 单字") ?? []).size,
	);
	assert.equal(sanpin.get("# 字母")?.length, 26);
	assert.equal(sanpin.get("# 临时数字")?.length, 7);
	for (const [code, digit] of [
		["xj", "2"],
		["s", "3"],
		["sk", "4"],
		["y", "1"],
	]) {
		assert.ok(
			sanpin
				.get("# 单字")
				?.find(([candidateCode]) => candidateCode === code)?.[1]
				.includes(digit),
		);
	}
});
