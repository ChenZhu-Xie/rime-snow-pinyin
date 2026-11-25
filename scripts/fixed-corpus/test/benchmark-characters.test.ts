import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { benchmarkCharacters } from "../../lib/benchmark-characters";
import { rootPath } from "../../lib/paths";

test("字频范围先筛常用字再排序截取，同频保持原序", () => {
	const table =
		"# 字\t频次\t音\t常用\r\n外\t999\twai4\t0\r\n乙\t2\tyi3\t1\r\n甲\t3\tjia3\t1\r\n丙\t2\tbing3\t1\r\n";
	assert.deepEqual(
		benchmarkCharacters(table, 2).map((row) => row.text),
		["甲", "乙"],
	);
	assert.deepEqual(
		benchmarkCharacters(table).map((row) => row.text),
		["甲", "乙", "丙"],
	);
});

test("冻结字集有八千个唯一常用字并按频次降序", () => {
	const rows = benchmarkCharacters(
		readFileSync(
			rootPath("scripts/data/benchmark-character-frequency.tsv"),
			"utf8",
		),
	);
	assert.equal(rows.length, 8000);
	assert.equal(new Set(rows.map((row) => row.text)).size, 8000);
	assert.ok(
		rows.every(
			(row, i) =>
				row.common && (i === 0 || rows[i - 1].frequency >= row.frequency),
		),
	);
});
