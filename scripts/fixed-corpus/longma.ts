import { strFromU8, unzipSync } from "fflate";
import { read, utils } from "xlsx";
import { classifyRecord } from "./parsers";
import type { CorpusRecord, ParseContext, ParseResult } from "./types";

export type LongmaArchiveProfile = "rime-fixed" | "no-aux-singles";

function corpusRecord(
	word: string,
	code: string,
	line: number,
	rank: number,
	weight: number | null,
	context: ParseContext,
	metadata: Record<string, unknown>,
	sourcePath = context.sourcePath,
): CorpusRecord {
	const normalizedCode = code.replace(/\s+/gu, "");
	const lengths = {
		wordLength: [...word].length,
		codeLength: [...normalizedCode].length,
	};
	return {
		schemaVersion: 1,
		sourceId: context.sourceId,
		family: context.family,
		sourcePath,
		sourceRevision: context.sourceRevision,
		line,
		word,
		originalCode: code,
		normalizedCode,
		...lengths,
		...classifyRecord(lengths),
		rank,
		weight,
		derived: false,
		metadata,
	};
}

function text(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	if (typeof value === "number") return String(value);
	return null;
}

export function parseLongmaWorkbook(
	data: Uint8Array,
	context: ParseContext,
): ParseResult {
	const workbook = read(data, { type: "array", cellDates: false });
	const sheetName = workbook.SheetNames.includes("键盘布局")
		? "键盘布局"
		: workbook.SheetNames[0];
	if (!sheetName) throw new Error("龙码简码工作簿没有工作表");
	const sheet = workbook.Sheets[sheetName];
	if (!sheet) throw new Error(`龙码简码工作簿缺少工作表：${sheetName}`);
	const rows = utils.sheet_to_json<unknown[]>(sheet, {
		header: 1,
		raw: true,
		defval: null,
	});
	const records: CorpusRecord[] = [];
	const sourcePath = `${context.sourcePath}#${sheetName}`;
	const addCell = (
		rowIndex: number,
		columnIndex: number,
		code: string,
		declaredLevel: "one-code" | "two-code",
		rankOffset = 0,
	): void => {
		const value = text(rows[rowIndex]?.[columnIndex]);
		if (!value) return;
		for (const [candidateIndex, rawWord] of value.split(/\r?\n/u).entries()) {
			const word = rawWord.trim();
			if (!word) continue;
			records.push(
				corpusRecord(
					word,
					code,
					rowIndex + 1,
					candidateIndex + 1 + rankOffset,
					null,
					context,
					{
						evidenceRole: "shortcut",
						declaredLevel,
						sheet: sheetName,
						cell: utils.encode_cell({ r: rowIndex, c: columnIndex }),
					},
					sourcePath,
				),
			);
		}
	};

	for (let columnIndex = 1; columnIndex <= 26; columnIndex += 1) {
		const code = text(rows[1]?.[columnIndex]);
		if (!code) continue;
		addCell(2, columnIndex, code, "one-code");
		addCell(3, columnIndex, code, "one-code", 1);
	}
	for (let rowIndex = 6; rowIndex <= 31; rowIndex += 1) {
		const first = text(rows[rowIndex]?.[0]);
		if (!first) continue;
		for (let columnIndex = 1; columnIndex <= 26; columnIndex += 1) {
			const second = text(rows[5]?.[columnIndex]);
			if (second) addCell(rowIndex, columnIndex, first + second, "two-code");
		}
	}
	return { records, diagnostics: [] };
}

function archiveEntry(
	entries: Record<string, Uint8Array>,
	baseName: string,
): [string, Uint8Array] {
	const match = Object.entries(entries).find(([path]) =>
		path.replace(/\\/gu, "/").endsWith(`/${baseName}`),
	);
	if (!match) throw new Error(`龙码压缩包缺少 ${baseName}`);
	return match;
}

function parseWeight(value: string | undefined): number | null {
	if (!value || !/^\d+(?:\.\d+)?$/u.test(value.trim())) return null;
	return Number(value);
}

function parseRimeFixed(
	entries: Record<string, Uint8Array>,
	context: ParseContext,
): CorpusRecord[] {
	const [entryPath, bytes] = archiveEntry(
		entries,
		"moran_fixed_simp.dict.yaml",
	);
	const lines = strFromU8(bytes)
		.replace(/^\uFEFF/u, "")
		.split(/\r?\n/u);
	const bodyStart = lines.findIndex((line) => line.trim() === "...");
	const ranks = new Map<string, number>();
	const records: CorpusRecord[] = [];
	for (
		let index = Math.max(0, bodyStart + 1);
		index < lines.length;
		index += 1
	) {
		const raw = lines[index] ?? "";
		if (!raw || raw.startsWith("#") || !raw.includes("\t")) continue;
		const [word, code, _stem, rawWeight] = raw.split("\t");
		if (!word || !code || !/^\p{Script=Han}+$/u.test(word)) continue;
		const rank = (ranks.get(code) ?? 0) + 1;
		ranks.set(code, rank);
		records.push(
			corpusRecord(
				word,
				code,
				index + 1,
				rank,
				parseWeight(rawWeight),
				context,
				{ evidenceRole: "fixed", archiveProfile: "rime-fixed" },
				`${context.sourcePath}!${entryPath.replace(/\\/gu, "/")}`,
			),
		);
	}
	return records;
}

function parseNoAuxSingles(
	entries: Record<string, Uint8Array>,
	context: ParseContext,
): CorpusRecord[] {
	const [entryPath, bytes] = archiveEntry(entries, "雪字出.txt");
	const records: CorpusRecord[] = [];
	for (const [index, raw] of strFromU8(bytes)
		.replace(/^\uFEFF/u, "")
		.split(/\r?\n/u)
		.entries()) {
		if (!raw || !raw.includes("\t")) continue;
		const [word, code, rawWeight] = raw.split("\t");
		if (
			!word ||
			!code ||
			[...word].length !== 1 ||
			!/^\p{Script=Han}$/u.test(word)
		)
			continue;
		records.push(
			corpusRecord(
				word,
				code,
				index + 1,
				1,
				parseWeight(rawWeight),
				context,
				{ evidenceRole: "inventory", archiveProfile: "no-aux-singles" },
				`${context.sourcePath}!${entryPath.replace(/\\/gu, "/")}`,
			),
		);
	}
	return records;
}

export function parseLongmaArchive(
	data: Uint8Array,
	context: ParseContext,
	profile: LongmaArchiveProfile,
): ParseResult {
	if (data.byteLength > 64 * 1024 * 1024) {
		throw new Error("龙码压缩包超过 64 MiB 安全上限");
	}
	const entries = unzipSync(data);
	const records =
		profile === "rime-fixed"
			? parseRimeFixed(entries, context)
			: parseNoAuxSingles(entries, context);
	return { records, diagnostics: [] };
}
