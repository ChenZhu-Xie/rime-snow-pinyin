import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { utils, write } from "xlsx";
import { parseLongmaArchive, parseLongmaWorkbook } from "../longma";
import type { ParseContext } from "../types";

const context: ParseContext = {
	sourceId: "longma",
	family: "longma",
	sourcePath: "fixture",
	sourceRevision: "fixture-revision",
};

test("Longma workbook extracts ranked one- and two-code candidates", () => {
	const rows = Array.from({ length: 32 }, () => Array<unknown>(27).fill(null));
	rows[0][0] = "一级简码";
	rows[1][1] = "q";
	rows[1][2] = "w";
	rows[2][1] = "啊";
	rows[3][1] = "爱";
	rows[4][0] = "二级简码";
	rows[5][1] = "q";
	rows[5][2] = "w";
	rows[6][0] = "q";
	rows[6][1] = "嗷嗷\n安安";
	rows[6][2] = "奥\n安排";
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), "键盘布局");
	const buffer = write(workbook, { type: "buffer", bookType: "xlsx" });

	const result = parseLongmaWorkbook(buffer, context);
	assert.deepEqual(
		result.records.map(({ word, originalCode, rank, category, metadata }) => ({
			word,
			code: originalCode,
			rank,
			category,
			role: metadata.evidenceRole,
		})),
		[
			{ word: "啊", code: "q", rank: 1, category: "single", role: "shortcut" },
			{ word: "爱", code: "q", rank: 2, category: "single", role: "shortcut" },
			{
				word: "嗷嗷",
				code: "qq",
				rank: 1,
				category: "erjian",
				role: "shortcut",
			},
			{
				word: "安安",
				code: "qq",
				rank: 2,
				category: "erjian",
				role: "shortcut",
			},
			{ word: "奥", code: "qw", rank: 1, category: "single", role: "shortcut" },
			{
				word: "安排",
				code: "qw",
				rank: 2,
				category: "erjian",
				role: "shortcut",
			},
		],
	);
});

test("Longma Rime archive extracts fixed codes but excludes symbols", () => {
	const dictionary = [
		"---",
		"name: moran_fixed_simp",
		"columns: [text, code, stem, weight, comment]",
		"...",
		"啊\tq",
		"一些\tjgch\t\t123",
		"一些\tjc",
		"？\t;w",
		"",
	].join("\n");
	const archive = zipSync({
		"bundle/moran_fixed_simp.dict.yaml": strToU8(dictionary),
	});

	const result = parseLongmaArchive(archive, context, "rime-fixed");
	assert.deepEqual(
		result.records.map(({ word, normalizedCode, weight, rank, metadata }) => ({
			word,
			code: normalizedCode,
			weight,
			rank,
			role: metadata.evidenceRole,
		})),
		[
			{ word: "啊", code: "q", weight: null, rank: 1, role: "fixed" },
			{ word: "一些", code: "jgch", weight: 123, rank: 1, role: "fixed" },
			{ word: "一些", code: "jc", weight: null, rank: 1, role: "fixed" },
		],
	);
	assert.match(
		result.records[0]?.sourcePath ?? "",
		/!bundle\/moran_fixed_simp\.dict\.yaml$/u,
	);
});

test("Longma no-aux archive contributes only the single-character inventory", () => {
	const archive = zipSync({
		"龙码字词库无辅文件/雪字出.txt": strToU8("的\thk\t100\n𰻞\taa\t1\n"),
		"龙码字词库无辅文件/雪词出.txt": strToU8("一些\tjg ch\t100\n"),
	});

	const result = parseLongmaArchive(archive, context, "no-aux-singles");
	assert.deepEqual(
		result.records.map(({ word, normalizedCode, metadata }) => ({
			word,
			code: normalizedCode,
			role: metadata.evidenceRole,
		})),
		[
			{ word: "的", code: "hk", role: "inventory" },
			{ word: "𰻞", code: "aa", role: "inventory" },
		],
	);
});
