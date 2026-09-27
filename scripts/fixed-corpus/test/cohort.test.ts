import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadWeightedCohort } from "../cohort";

function dictionary(root: string, name: string, rows: string[]): string {
	const path = join(root, name);
	writeFileSync(path, ["---", `name: ${name}`, "...", ...rows, ""].join("\n"));
	return path;
}

test("cohort merges duplicate readings by maximum weight and preserves polyphones", (t) => {
	const root = mkdtempSync(join(tmpdir(), "snow-cohort-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const paths = [
		dictionary(root, "base", [
			"一些\tyi1 xie1\t100",
			"重庆\tchong2 qing4\t80",
			"重庆\tzhong4 qing4\t90",
			"春夏秋冬\tchun1 xia4 qiu1 dong1\t70",
			"三字词\tsan1 zi4 ci2\t999",
		]),
		dictionary(root, "ext", [
			"一些\tyi1 xie1\t150",
			"重庆\tchong2 qing4\t60",
			"春夏秋冬\tchun1 xia4 qiu1 dong1\t65",
		]),
		dictionary(root, "tencent", [
			"ABC\ta1 b1 c1\t1000",
			"错配\tcuo4 pei4 le5\t500",
		]),
	];

	const cohort = loadWeightedCohort(paths, [2, 4]);
	assert.deepEqual(
		cohort.words.map(({ word, weight }) => [word, weight]),
		[
			["一些", 150],
			["重庆", 90],
			["春夏秋冬", 70],
		],
	);
	const chongqing = cohort.words.find(({ word }) => word === "重庆");
	assert.deepEqual(
		chongqing?.readings.map(({ reading, weight }) => [reading, weight]),
		[
			["chong2 qing4", 80],
			["zhong4 qing4", 90],
		],
	);
	assert.equal(cohort.diagnostics.filter(({ code }) => code === "READING_LENGTH_MISMATCH").length, 1);
});

test("cohort ranking has stable lexical tie-breaking", (t) => {
	const root = mkdtempSync(join(tmpdir(), "snow-cohort-ties-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const path = dictionary(root, "ties", [
		"乙乙\tyi3 yi3\t100",
		"甲甲\tjia3 jia3\t100",
	]);

	assert.deepEqual(
		loadWeightedCohort([path], [2]).words.map(({ word, rank }) => [word, rank]),
		[
			["乙乙", 1],
			["甲甲", 2],
		],
	);
});
