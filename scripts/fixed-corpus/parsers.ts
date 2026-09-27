import type {
	CorpusCategory,
	CorpusRecord,
	ParseContext,
	ParseDiagnostic,
	ParseResult,
} from "./types";

interface ClassifiableRecord {
	wordLength: number;
	codeLength: number;
}

export function classifyRecord(record: ClassifiableRecord): {
	category: CorpusCategory;
	level: string;
} {
	const levelNames: Record<number, string> = {
		1: "one-code",
		2: "two-code",
		3: "three-code",
	};
	const level = levelNames[record.codeLength] ?? `${record.codeLength}-code`;
	if (record.wordLength === 1) return { category: "single", level };
	if (record.wordLength === 2 && record.codeLength === 2) {
		return { category: "erjian", level };
	}
	if (record.codeLength <= 3) return { category: "shortcut", level };
	return { category: "full", level };
}

function normalizeCode(code: string, markers: string[] = []): string {
	let normalized = code.replace(/\s+/gu, "");
	for (const marker of markers) {
		if (marker.length > 0) normalized = normalized.split(marker).join("");
	}
	return normalized;
}

function createRecord(
	word: string,
	code: string,
	line: number,
	rank: number,
	weight: number | null,
	context: ParseContext,
): CorpusRecord {
	const normalizedCode = normalizeCode(code, context.codeMarkers);
	const lengths = {
		wordLength: Array.from(word).length,
		codeLength: Array.from(normalizedCode).length,
	};
	return {
		schemaVersion: 1,
		sourceId: context.sourceId,
		family: context.family,
		sourcePath: context.sourcePath,
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
		metadata: {},
	};
}

function malformed(
	context: ParseContext,
	line: number,
	raw: string,
	message: string,
): ParseDiagnostic {
	return {
		sourceId: context.sourceId,
		sourcePath: context.sourcePath,
		line,
		severity: "warning",
		message,
		raw,
	};
}

function physicalLines(text: string): string[] {
	const lines = text.split(/\r?\n/u);
	if (lines.length > 0) lines[0] = lines[0].replace(/^\uFEFF/u, "");
	return lines;
}

function parseTabular(text: string, context: ParseContext): ParseResult {
	const records: CorpusRecord[] = [];
	const diagnostics: ParseDiagnostic[] = [];
	let inHeader = false;

	for (const [index, raw] of physicalLines(text).entries()) {
		const line = index + 1;
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		if (trimmed === "---") {
			inHeader = true;
			continue;
		}
		if (inHeader) {
			if (trimmed === "...") inHeader = false;
			continue;
		}

		const columns = raw.split("\t");
		if (columns.length < 2 || !columns[0].trim() || !columns[1].trim()) {
			diagnostics.push(
				malformed(context, line, raw, "数据行至少需要词条和编码两列"),
			);
			continue;
		}
		const word = columns[0].trim();
		const code = columns[1].trim();
		const rawWeight = columns[2]?.trim();
		const weight = rawWeight && /^\d+(?:\.\d+)?$/u.test(rawWeight)
			? Number(rawWeight)
			: null;
		records.push(createRecord(word, code, line, 1, weight, context));
	}

	return { records, diagnostics };
}

export function parseRimeTable(text: string, context: ParseContext): ParseResult {
	return parseTabular(text, context);
}

export function parseCustomPhrase(text: string, context: ParseContext): ParseResult {
	return parseTabular(text, context);
}

export function parseOrderedFixed(text: string, context: ParseContext): ParseResult {
	const records: CorpusRecord[] = [];
	const diagnostics: ParseDiagnostic[] = [];
	for (const [index, raw] of physicalLines(text).entries()) {
		const line = index + 1;
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const [code, ...candidates] = trimmed.split(/\s+/u);
		if (!code || candidates.length === 0) {
			diagnostics.push(
				malformed(context, line, raw, "固顶行至少需要编码和一个候选"),
			);
			continue;
		}
		for (const [candidateIndex, word] of candidates.entries()) {
			records.push(
				createRecord(word, code, line, candidateIndex + 1, null, context),
			);
		}
	}
	return { records, diagnostics };
}
