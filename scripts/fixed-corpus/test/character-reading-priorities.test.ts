import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SpellingAlgebra } from "../../lib/algebra";
import { characterReadingPriorities } from "../../lib/character-reading-priorities";
import { rootPath } from "../../lib/paths";

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

test("竹道 qz 的兜底读音和已生成固顶均首选虽，同时保留尿的合法异读", () => {
	const algebra = new SpellingAlgebra(
		rootPath("snow_zhudao.schema.yaml"),
		"speller/algebra",
		{ derive: false },
	);
	const readings = characterReadingPriorities(
		readFileSync(rootPath("scripts/data/tygf-pinyin.tsv"), "utf8"),
	);
	const bucket = readings.filter(
		({ reading }) => algebra.apply(reading) === "qz",
	);
	assert.equal(bucket[0].word, "虽");
	assert.equal(bucket.find((row) => row.word === "尿")?.weight, 199);
	const fixed = new Map(
		readFileSync(rootPath("snow_zhudao.fixed.txt"), "utf8")
			.split(/\r?\n/u)
			.filter((l) => l.includes("\t") && !l.startsWith("#"))
			.map((l) => l.split("\t") as [string, string]),
	);
	assert.equal(fixed.get("qz"), "虽");
	assert.equal(algebra.apply("niao4"), "nf");
	assert.equal(algebra.apply("sui1"), "qz");
});

test("读音兜底重排保留冰雪兰道已约定的一级固顶 d→的", () => {
	assert.match(
		readFileSync(rootPath("snow_jiandao.fixed.txt"), "utf8"),
		/^d\t的\r?$/mu,
	);
});
