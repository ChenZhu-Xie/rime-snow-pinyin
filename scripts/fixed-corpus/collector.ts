import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { load } from "js-yaml";
import { deriveWordCode, parseEncoderRules } from "./encoder";
import type {
	CorpusManifest,
	SourceDefinition,
	SourceInput,
} from "./manifest";
import { isAllowedSourcePath } from "./manifest";
import {
	classifyRecord,
	parseCustomPhrase,
	parseOrderedFixed,
	parseRimeTable,
} from "./parsers";
import {
	parseLongmaArchive,
	parseLongmaWorkbook,
	type LongmaArchiveProfile,
} from "./longma";
import {
	readSourceRevision,
	resolveSource,
	listSourceFiles,
} from "./source-resolver";
import type {
	ResolveSourceOptions,
	ResolvedSource,
} from "./source-resolver";
import {
	renderSummaryMarkdown,
	summarizeCorpus,
} from "./summary";
import type {
	CorpusSummary,
	SourceCollectionSummary,
} from "./summary";
import type { CorpusRecord, ParseDiagnostic, ParseResult } from "./types";

export interface CollectionDiagnostic {
	sourceId: string;
	sourcePath?: string;
	line?: number;
	severity: "warning" | "error";
	code: string;
	message: string;
	raw?: string;
}

export interface CollectionOptions extends ResolveSourceOptions {
	inspectWords?: string[];
}

export interface SourceProvenance {
	id: string;
	family: string;
	resolution: string;
	revision: string;
	files: Array<{ path: string; sha256: string }>;
}

export interface CollectionResult {
	records: CorpusRecord[];
	diagnostics: CollectionDiagnostic[];
	summary: CorpusSummary;
	provenance: { schemaVersion: 1; sources: SourceProvenance[] };
	markdown: string;
}

interface ParsedSource {
	records: CorpusRecord[];
	diagnostics: CollectionDiagnostic[];
	files: string[];
}

interface DictionaryEntry {
	word: string;
	code: string | null;
	stem: string | null;
	weight: number | null;
	line: number;
	sourcePath: string;
}

interface DictionaryDocument {
	header: {
		columns?: string[];
		import_tables?: string[];
	};
	entries: DictionaryEntry[];
}

function sha256(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeRelative(path: string): string {
	return path.split(sep).join("/");
}

function parseDictionaryDocument(text: string, sourcePath: string): DictionaryDocument {
	const lines = text.replace(/^\uFEFF/u, "").split(/\r?\n/u);
	const headerStart = lines.findIndex((line) => line.trim() === "---");
	const headerEnd = lines.findIndex(
		(line, index) => index > headerStart && line.trim() === "...",
	);
	const headerLimit = headerEnd > headerStart ? headerEnd : lines.length;
	const header = headerStart >= 0
		? (load(lines.slice(headerStart + 1, headerLimit).join("\n")) as DictionaryDocument["header"])
		: {};
	const columns = header.columns ?? ["text", "code", "weight"];
	const entries: DictionaryEntry[] = [];
	const dataStart = headerEnd >= 0 ? headerEnd + 1 : headerStart >= 0 ? lines.length : 0;
	for (let index = dataStart; index < lines.length; index += 1) {
		const raw = lines[index];
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const values = raw.split("\t");
		const byColumn = new Map(columns.map((column, columnIndex) => [column, values[columnIndex]?.trim()]));
		const word = byColumn.get("text") ?? values[0]?.trim();
		if (!word) continue;
		const rawWeight = byColumn.get("weight");
		entries.push({
			word,
			code: byColumn.get("code") || null,
			stem: byColumn.get("stem") || null,
			weight: rawWeight && /^\d+(?:\.\d+)?$/u.test(rawWeight) ? Number(rawWeight) : null,
			line: index + 1,
			sourcePath,
		});
	}
	return { header, entries };
}

function importedPath(currentPath: string, table: string): string {
	const withExtension = table.endsWith(".dict.yaml") ? table : `${table}.dict.yaml`;
	return normalizeRelative(withExtension.startsWith("./")
		? join(dirname(currentPath), withExtension)
		: withExtension);
}

function loadEncoderDocuments(
	root: string,
	mainPath: string,
	input: SourceInput,
	manifest: CorpusManifest,
): { documents: DictionaryDocument[]; files: string[] } {
	const documents: DictionaryDocument[] = [];
	const files: string[] = [];
	const seen = new Set<string>();
	const visit = (sourcePath: string): void => {
		const normalized = normalizeRelative(sourcePath);
		if (seen.has(normalized)) return;
		seen.add(normalized);
		const syntheticInput: SourceInput = { ...input, include: [normalized] };
		if (!isAllowedSourcePath(normalized, syntheticInput, manifest.globalPolicy)) return;
		const fullPath = resolve(root, normalized);
		if (!existsSync(fullPath)) return;
		const document = parseDictionaryDocument(readFileSync(fullPath, "utf8"), normalized);
		documents.push(document);
		files.push(normalized);
		for (const imported of document.header.import_tables ?? []) {
			visit(importedPath(normalized, imported));
		}
	};
	visit(mainPath);
	return { documents, files };
}

function createDerivedRecord(
	entry: DictionaryEntry,
	code: string,
	definition: SourceDefinition,
	revision: string,
	derived: boolean,
	metadata: Record<string, unknown>,
): CorpusRecord {
	const wordLength = Array.from(entry.word).length;
	const codeLength = Array.from(code.replace(/\s+/gu, "")).length;
	return {
		schemaVersion: 1,
		sourceId: definition.id,
		family: definition.family,
		sourcePath: entry.sourcePath,
		sourceRevision: revision,
		line: entry.line,
		word: entry.word,
		originalCode: code,
		normalizedCode: code.replace(/\s+/gu, ""),
		wordLength,
		codeLength,
		...classifyRecord({ wordLength, codeLength }),
		rank: 1,
		weight: entry.weight,
		derived,
		metadata,
	};
}

function parseEncoderInput(
	manifest: CorpusManifest,
	source: ResolvedSource,
	input: SourceInput,
	mainPath: string,
): ParsedSource {
	if (!source.root || !source.revision) return { records: [], diagnostics: [], files: [] };
	const { documents, files } = loadEncoderDocuments(
		source.root,
		mainPath,
		input,
		manifest,
	);
	const mainText = readFileSync(resolve(source.root, mainPath), "utf8");
	const rules = parseEncoderRules(mainText);
	const entries = documents.flatMap((document) => document.entries);
	const charCodes = new Map<string, string[]>();
	for (const entry of entries) {
		if (Array.from(entry.word).length !== 1) continue;
		const code = entry.stem ?? entry.code;
		if (!code) continue;
		const codes = charCodes.get(entry.word) ?? [];
		if (!codes.includes(code)) codes.push(code);
		charCodes.set(entry.word, codes);
	}
	const records: CorpusRecord[] = [];
	const diagnostics: CollectionDiagnostic[] = [];
	for (const entry of entries) {
		if (entry.code) {
			records.push(
				createDerivedRecord(entry, entry.code, source.definition, source.revision, false, {
					...(entry.stem ? { stem: entry.stem } : {}),
				}),
			);
			continue;
		}
		if (Array.from(entry.word).length < 2) continue;
		const result = deriveWordCode(entry, rules, charCodes);
		for (const code of result.codes) {
			records.push(
				createDerivedRecord(entry, code, source.definition, source.revision, true, {
					formula: result.rule?.formula,
				}),
			);
		}
		for (const message of result.diagnostics) {
			diagnostics.push({
				sourceId: source.definition.id,
				sourcePath: entry.sourcePath,
				line: entry.line,
				severity: "warning",
				code: "ENCODER_DERIVATION_FAILED",
				message,
			});
		}
	}
	return { records, diagnostics, files };
}

function convertDiagnostics(diagnostics: ParseDiagnostic[]): CollectionDiagnostic[] {
	return diagnostics.map((diagnostic) => ({
		sourceId: diagnostic.sourceId,
		sourcePath: diagnostic.sourcePath,
		line: diagnostic.line,
		severity: diagnostic.severity,
		code: "PARSE_WARNING",
		message: diagnostic.message,
		raw: diagnostic.raw,
	}));
}

function parseExplicitInput(
	source: ResolvedSource,
	input: SourceInput,
	path: string,
): ParsedSource {
	if (!source.root || !source.revision) return { records: [], diagnostics: [], files: [] };
	const context = {
		sourceId: source.definition.id,
		family: source.definition.family,
		sourcePath: path,
		sourceRevision: source.revision,
		codeMarkers: input.codeMarkers,
	};
	const fullPath = resolve(source.root, path);
	let result: ParseResult;
	if (input.adapter === "longma-workbook") {
		result = parseLongmaWorkbook(readFileSync(fullPath), context);
	} else if (input.adapter === "longma-archive") {
		const profile = input.options?.profile;
		if (profile !== "rime-fixed" && profile !== "no-aux-singles") {
			throw new Error(`龙码压缩包 ${path} 缺少有效 profile`);
		}
		result = parseLongmaArchive(
			readFileSync(fullPath),
			context,
			profile as LongmaArchiveProfile,
		);
	} else {
		const text = readFileSync(fullPath, "utf8");
		result = input.adapter === "ordered-fixed"
			? parseOrderedFixed(text, context)
			: input.adapter === "custom-phrase"
				? parseCustomPhrase(text, context)
				: parseRimeTable(text, context);
	}
	return {
		records: result.records,
		diagnostics: convertDiagnostics(result.diagnostics),
		files: [path],
	};
}

function recordComparator(sourceOrder: Map<string, number>) {
	return (a: CorpusRecord, b: CorpusRecord): number =>
		(sourceOrder.get(a.sourceId) ?? Number.MAX_SAFE_INTEGER) -
			(sourceOrder.get(b.sourceId) ?? Number.MAX_SAFE_INTEGER) ||
		a.sourcePath.localeCompare(b.sourcePath, "en") ||
		a.line - b.line ||
		a.normalizedCode.localeCompare(b.normalizedCode, "en") ||
		a.word.localeCompare(b.word, "zh-CN") ||
		a.rank - b.rank;
}

function appendAll<T>(target: T[], items: Iterable<T>): void {
	for (const item of items) target.push(item);
}

export function* serializeJsonLineChunks(
	records: Iterable<CorpusRecord>,
	maxChunkCharacters = 4 * 1024 * 1024,
): Generator<string> {
	if (!Number.isInteger(maxChunkCharacters) || maxChunkCharacters < 1) {
		throw new Error("maxChunkCharacters 必须是正整数");
	}
	let chunk = "";
	for (const record of records) {
		const line = `${JSON.stringify(record)}\n`;
		if (chunk.length > 0 && chunk.length + line.length > maxChunkCharacters) {
			yield chunk;
			chunk = line;
		} else {
			chunk += line;
		}
	}
	if (chunk.length > 0) yield chunk;
}

export function writeJsonLines(records: CorpusRecord[], path: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const handle = openSync(path, "w");
	try {
		for (const chunk of serializeJsonLineChunks(records)) writeSync(handle, chunk, null, "utf8");
	} finally {
		closeSync(handle);
	}
}

export async function collectCorpus(
	manifest: CorpusManifest,
	options: CollectionOptions,
): Promise<CollectionResult> {
	const cacheRoot = resolve(options.cacheRoot);
	const normalizedRoot = join(cacheRoot, "normalized");
	const reportsRoot = join(cacheRoot, "reports");
	mkdirSync(normalizedRoot, { recursive: true });
	mkdirSync(reportsRoot, { recursive: true });
	const records: CorpusRecord[] = [];
	const diagnostics: CollectionDiagnostic[] = [];
	const provenanceSources: SourceProvenance[] = [];
	const sourceSummaries: SourceCollectionSummary[] = [];
	const sourceOrder = new Map(manifest.sources.map((source, index) => [source.id, index]));

	for (const definition of manifest.sources) {
		let source: ResolvedSource;
		try {
			source = await resolveSource(definition, options);
		} catch (error) {
			if (definition.required) throw error;
			sourceSummaries.push({
				id: definition.id,
				name: definition.name,
				family: definition.family,
				resolution: "failed",
				recordCount: 0,
				fileCount: 0,
			});
			diagnostics.push({
				sourceId: definition.id,
				severity: "warning",
				code: "SOURCE_RESOLUTION_FAILED",
				message: error instanceof Error ? error.message : String(error),
			});
			continue;
		}
		if (!source.root || !source.revision) {
			sourceSummaries.push({
				id: definition.id,
				name: definition.name,
				family: definition.family,
				resolution: "missing",
				recordCount: 0,
				fileCount: 0,
			});
			for (const diagnostic of source.diagnostics) {
				diagnostics.push({
					sourceId: definition.id,
					severity: definition.required ? "error" : "warning",
					code: diagnostic.code,
					message: diagnostic.message,
				});
			}
			if (definition.required) throw new Error(`必需来源缺失：${definition.id}`);
			continue;
		}

		const sourceRecords: CorpusRecord[] = [];
		const files = new Set<string>();
		for (const input of definition.inputs) {
			const matchedFiles = listSourceFiles(source, input, manifest.globalPolicy);
			for (const path of matchedFiles) {
				const parsed = input.adapter === "encoder-derived"
					? parseEncoderInput(manifest, source, input, path)
					: parseExplicitInput(source, input, path);
				appendAll(sourceRecords, parsed.records);
				appendAll(diagnostics, parsed.diagnostics);
				for (const file of parsed.files) files.add(file);
			}
		}
		sourceRecords.sort(recordComparator(sourceOrder));
		writeJsonLines(sourceRecords, join(normalizedRoot, `${definition.id}.jsonl`));
		appendAll(records, sourceRecords);
		const provenanceFiles = [...files]
			.sort((a, b) => a.localeCompare(b, "en"))
			.map((path) => ({ path, sha256: sha256(resolve(source.root as string, path)) }));
		const revision = source.resolution === "local" && !/^[0-9a-f]{40,64}$/u.test(source.revision)
			? readSourceRevision(source.root, provenanceFiles.map((file) => file.path))
			: source.revision;
		provenanceSources.push({
			id: definition.id,
			family: definition.family,
			resolution: source.resolution,
			revision,
			files: provenanceFiles,
		});
		sourceSummaries.push({
			id: definition.id,
			name: definition.name,
			family: definition.family,
			resolution: source.resolution,
			recordCount: sourceRecords.length,
			fileCount: provenanceFiles.length,
		});
	}

	records.sort(recordComparator(sourceOrder));
	writeJsonLines(records, join(cacheRoot, "corpus.jsonl"));
	const provenance = { schemaVersion: 1 as const, sources: provenanceSources };
	writeFileSync(join(cacheRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
	const summary = summarizeCorpus(records, sourceSummaries, options.inspectWords);
	writeFileSync(join(reportsRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
	const markdown = renderSummaryMarkdown(summary);
	return { records, diagnostics, summary, provenance, markdown };
}
