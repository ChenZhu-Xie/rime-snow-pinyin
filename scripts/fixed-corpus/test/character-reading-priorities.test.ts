import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { alignFixedContent } from "../../align-fixed-with-sipin";
import { SpellingAlgebra } from "../../lib/algebra";
import { characterReadingPriorities } from "../../lib/character-reading-priorities";
import { rootPath } from "../../lib/paths";
import { pronunciationCodes } from "../../lib/benchmark-schemes";
import { selectThreeKeyFixed } from "../../lib/three-key-fixed";

test("多音字的兜底优先级使用实际读音权重，不借用同字高频读音", () => {
	const rows = [
		"尿\tniao4\t9771",
		"尿\tsui1\t199",
		"虽\tsui1\t2532",
		"桑\tsang1\t1011",
	];
	const expected = [
		"尿/niao4/9771",
		"虽/sui1/2532",
		"桑/sang1/1011",
		"尿/sui1/199",
	];
	for (const input of [
		rows,
		[...rows].reverse(),
		[rows[1], rows[3], rows[0], rows[2]],
	]) {
		assert.deepEqual(
			characterReadingPriorities(input.join("\n")).map(
				({ word, reading, weight }) => `${word}/${reading}/${weight}`,
			),
			expected,
		);
	}
});

test("鹮道 sx 的读音兜底保留虽和尿的权重，固顶尊重四拼的吹", () => {
	const algebra = new SpellingAlgebra(
		rootPath("snow_zhudao.schema.yaml"),
		"speller/algebra",
		{ derive: false },
	);
	const readings = characterReadingPriorities(
		readFileSync(rootPath("scripts/data/tygf-pinyin.tsv"), "utf8"),
	);
	const bucket = readings.filter(
		({ reading }) => algebra.apply(reading) === "sx",
	);
	assert.ok(
		bucket.findIndex((row) => row.word === "虽") <
			bucket.findIndex((row) => row.word === "尿"),
	);
	assert.equal(bucket.find((row) => row.word === "尿")?.weight, 199);
	const fixed = new Map(
		readFileSync(rootPath("snow_zhudao.fixed.txt"), "utf8")
			.split(/\r?\n/u)
			.filter((l) => l.includes("\t") && !l.startsWith("#"))
			.map((l) => l.split("\t") as [string, string]),
	);
	assert.equal(fixed.get("sx"), "吹");
	assert.equal(algebra.apply("niao4"), "ng");
	assert.equal(algebra.apply("sui1"), "sx");
});

test("支持分号追加「的」的九个方案统一一级固顶 d→都", () => {
	for (const schema of [
		"snow_sipin",
		"snow_jiandao",
		"snow_sanpin",
		"snow_jiandao_classic",
		"snow_sanpin_classic",
		"snow_shenyun_shape",
		"snow_shenyun_tone",
		"snow_zhudao",
		"snow_jiandao_toned",
	]) {
		const filename = `${schema}.fixed.txt`;
		const fixed = readFileSync(rootPath(filename), "utf8");
		assert.match(fixed, /^d\t都\r?$/mu, schema);
	}
});

test("兰道和莲道重新生成时将旧的 d→的 修正为 d→都", {
	timeout: 120_000,
}, () => {
	for (const schema of ["snow_jiandao", "snow_jiandao_toned"]) {
		const filename = `${schema}.fixed.txt`;
		const fixed = readFileSync(rootPath(filename), "utf8");
		const previous = fixed.replace(/^d\t都\r?$/mu, "d\t的");
		assert.match(alignFixedContent(filename, previous), /^d\t都$/mu, schema);
	}
});

test("三级固顶优先参考四拼短码，未被四拼固顶的字仍可用读音权重补位", () => {
	const candidates = [
		{ code: "bqo", word: "冰", reading: "bing1", weight: 90_000 },
		{
			code: "bqo",
			word: "病",
			reading: "bing4",
			weight: 10_000,
			sipinLevel: 3,
		},
		{ code: "bqo", word: "并", reading: "bing4", weight: 1_000, sipinLevel: 2 },
		{ code: "rno", word: "额", reading: "e2", weight: 5_000 },
		{ code: "rno", word: "讹", reading: "e2", weight: 50 },
	];
	for (const rows of [candidates, [...candidates].reverse()]) {
		const selected = selectThreeKeyFixed(rows, ["并"]);
		assert.equal(selected.get("bqo"), "病");
		assert.equal(selected.get("rno"), "额");
	}
	assert.equal(selectThreeKeyFixed(candidates, []).get("bqo"), "并");
});

test("三级固顶按当前读音比较权重，并避免多音字在多个槽位重复", () => {
	const candidates = [
		{ code: "ngo", word: "尿", reading: "niao4", weight: 9771 },
		{ code: "sxo", word: "尿", reading: "sui1", weight: 199 },
		{ code: "sxo", word: "虽", reading: "sui1", weight: 2532 },
		{ code: "sxo", word: "谁", reading: "shei2", weight: 10 },
	];
	assert.deepEqual(
		selectThreeKeyFixed(candidates, ["虽"]),
		new Map([
			["ngo", "尿"],
			["sxo", "谁"],
		]),
	);
	assert.equal(selectThreeKeyFixed(candidates, ["尿"]).get("sxo"), "虽");
	assert.equal(
		selectThreeKeyFixed(
			candidates.filter(({ code }) => code === "sxo"),
			[],
		).get("sxo"),
		"虽",
	);
});

test("两套 21×26 道系列三级固顶均为合法主码加首形辅，且不重复占用短码字", {
	timeout: 120_000,
}, () => {
	const readings = new Map<string, string[]>();
	for (const row of characterReadingPriorities(
		readFileSync(rootPath("scripts/data/tygf-pinyin.tsv"), "utf8"),
	)) {
		const values = readings.get(row.word) ?? [];
		values.push(row.reading);
		readings.set(row.word, values);
	}
	for (const [schema, scheme, expectedCount] of [
		["snow_shenyun_shape", "rc26-shape", 1648],
		["snow_zhudao", "zhudao", 2022],
	] as const) {
		const file = `${schema}.fixed.txt`;
		const source = readFileSync(rootPath(file), "utf8").replace(/\r\n/gu, "\n");
		const rows = source
			.split("\n")
			.filter((line) => !line.startsWith("#") && line.includes("\t"))
			.map((line) => line.split("\t"));
		const shortWords = new Set(
			rows
				.filter(([code]) => code.length <= 2)
				.flatMap(([, words]) => words.split(" ")),
		);
		const triples = rows
			.filter(([code]) => code.length === 3)
			.map(([code, words]) => [code, words.split(" ")[0]]);
		assert.equal(triples.length, expectedCount, schema);
		assert.equal(new Set(rows.map(([code]) => code)).size, rows.length, schema);
		assert.equal(
			new Set(triples.map(([, word]) => word)).size,
			triples.length,
			schema,
		);
		for (const [code, word] of triples) {
			assert.match(word, /^\p{Script=Han}$/u, `${schema} ${code}`);
			assert.equal(shortWords.has(word), false, `${schema} ${code} ${word}`);
			assert.ok(
				(readings.get(word) ?? []).some((reading) =>
					pronunciationCodes(scheme, word, [reading]).some(
						(entry) =>
							entry.code === code &&
							entry.mainLength === 2 &&
							entry.auxiliaryLength === 1,
					),
				),
				`${schema} ${code} ${word} 必须符合实际音码和第一形辅`,
			);
		}
		assert.equal(
			alignFixedContent(file, source),
			source,
			`${schema} 重新生成应稳定`,
		);
	}
	const toneRows = readFileSync(rootPath("snow_shenyun_tone.fixed.txt"), "utf8")
		.split(/\r?\n/u)
		.filter((line) => !line.startsWith("#") && line.includes("\t"));
	assert.ok(
		toneRows.every(
			(line) => line.split("\t")[0].length <= 2 || / \d+$/u.test(line),
		),
		"冰雪鹤拼仅允许数字别名使用三级码，不扩展普通三级单字固顶",
	);
});
