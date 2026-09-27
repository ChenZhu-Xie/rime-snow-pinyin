import assert from "node:assert/strict";
import test from "node:test";
import {
	parseCustomPhrase,
	parseOrderedFixed,
	parseRimeTable,
} from "../parsers";
import type { ParseContext } from "../types";

const context: ParseContext = {
	sourceId: "fixture",
	family: "fixture-family",
	sourcePath: "fixture.dict.yaml",
	sourceRevision: "abc123",
	codeMarkers: ["'", "/"],
};

test("parses Rime rows with weights and physical lines", () => {
	const text = "\uFEFF---\nname: fixture\n...\n# comment\n\n一些\tyx\t123\n";
	const result = parseRimeTable(text, context);

	assert.deepEqual(result.diagnostics, []);
	assert.deepEqual(result.records, [
		{
			schemaVersion: 1,
			sourceId: "fixture",
			family: "fixture-family",
			sourcePath: "fixture.dict.yaml",
			sourceRevision: "abc123",
			line: 6,
			word: "一些",
			originalCode: "yx",
			normalizedCode: "yx",
			wordLength: 2,
			codeLength: 2,
			category: "erjian",
			level: "two-code",
			rank: 1,
			weight: 123,
			derived: false,
			metadata: {},
		},
	]);
});

test("expands ordered fixed candidates with ranks", () => {
	const result = parseOrderedFixed("b\t不 办 本\n", {
		...context,
		sourcePath: "sbxh.fixed.txt",
	});

	assert.deepEqual(
		result.records.map((record) => ({
			word: record.word,
			code: record.originalCode,
			rank: record.rank,
			line: record.line,
			category: record.category,
			level: record.level,
		})),
		[
			{ word: "不", code: "b", rank: 1, line: 1, category: "single", level: "one-code" },
			{ word: "办", code: "b", rank: 2, line: 1, category: "single", level: "one-code" },
			{ word: "本", code: "b", rank: 3, line: 1, category: "single", level: "one-code" },
		],
	);
});

test("preserves marked custom phrase codes", () => {
	const result = parseCustomPhrase("一些\ty'x/\t7\n", {
		...context,
		sourcePath: "custom_phrase.txt",
	});
	const [record] = result.records;

	assert.equal(record.originalCode, "y'x/");
	assert.equal(record.normalizedCode, "yx");
	assert.equal(record.codeLength, 2);
	assert.equal(record.wordLength, 2);
	assert.equal(record.category, "erjian");
	assert.equal(record.level, "two-code");
	assert.equal(record.weight, 7);
	assert.equal(record.line, 1);
});

test("reports malformed non-comment rows", () => {
	const result = parseRimeTable("---\n...\n只有词\n正常\tzz\t9\n", context);

	assert.equal(result.records.length, 1);
	assert.deepEqual(result.diagnostics, [
		{
			sourceId: "fixture",
			sourcePath: "fixture.dict.yaml",
			line: 3,
			severity: "warning",
			message: "数据行至少需要词条和编码两列",
			raw: "只有词",
		},
	]);
});
