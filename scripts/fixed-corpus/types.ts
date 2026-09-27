export type CorpusCategory = "single" | "erjian" | "shortcut" | "full";

export interface CorpusRecord {
	schemaVersion: 1;
	sourceId: string;
	family: string;
	sourcePath: string;
	sourceRevision: string;
	line: number;
	word: string;
	originalCode: string;
	normalizedCode: string;
	wordLength: number;
	codeLength: number;
	category: CorpusCategory;
	level: string;
	rank: number;
	weight: number | null;
	derived: boolean;
	metadata: Record<string, unknown>;
}

export interface ParseDiagnostic {
	sourceId: string;
	sourcePath: string;
	line: number;
	severity: "warning" | "error";
	message: string;
	raw: string;
}

export interface ParseContext {
	sourceId: string;
	family: string;
	sourcePath: string;
	sourceRevision: string;
	codeMarkers?: string[];
}

export interface ParseResult {
	records: CorpusRecord[];
	diagnostics: ParseDiagnostic[];
}

