import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { CorpusRecord } from "./types";

export interface EvidenceBand {
	sources: string[];
	families: string[];
	bestRank: number;
}

export interface WordEvidence {
	/** Exact original code length, rather than a cumulative threshold. */
	byCodeLength: Partial<Record<"1" | "2" | "3", EvidenceBand>>;
}

export interface FixedEvidenceSnapshot {
	schemaVersion: 1;
	policy: {
		excludedSources: string[];
		excludedRoles: string[];
		maximumCodeLength: 3;
	};
	statistics: {
		inputRecords: number;
		eligibleRecords: number;
		words: number;
		sources: number;
		families: number;
	};
	words: Record<string, WordEvidence>;
}

interface MutableBand {
	sources: Set<string>;
	families: Set<string>;
	bestRank: number;
}

interface MutableEvidence {
	byCodeLength: Map<number, MutableBand>;
}

export interface BuildEvidenceOptions {
	allowedWords?: ReadonlySet<string>;
	excludedSources?: ReadonlySet<string>;
}

const hanWordPattern = /^\p{Script=Han}+$/u;

function evidenceRole(record: CorpusRecord) {
	return typeof record.metadata.evidenceRole === "string"
		? record.metadata.evidenceRole
		: null;
}

export function isEligibleEvidence(
	record: CorpusRecord,
	options: BuildEvidenceOptions = {},
) {
	const excludedSources = options.excludedSources ?? new Set(["snow-current"]);
	return (
		!excludedSources.has(record.sourceId) &&
		evidenceRole(record) !== "inventory" &&
		record.codeLength >= 1 &&
		record.codeLength <= 3 &&
		record.wordLength >= 1 &&
		record.wordLength <= 4 &&
		hanWordPattern.test(record.word) &&
		(!options.allowedWords || options.allowedWords.has(record.word))
	);
}

export async function buildEvidenceSnapshot(
	lines: AsyncIterable<string>,
	options: BuildEvidenceOptions = {},
): Promise<FixedEvidenceSnapshot> {
	const excludedSources = options.excludedSources ?? new Set(["snow-current"]);
	const words = new Map<string, MutableEvidence>();
	const sources = new Set<string>();
	const families = new Set<string>();
	let inputRecords = 0;
	let eligibleRecords = 0;

	for await (const line of lines) {
		if (!line.trim()) continue;
		inputRecords += 1;
		const record = JSON.parse(line) as CorpusRecord;
		if (!isEligibleEvidence(record, { ...options, excludedSources })) continue;
		eligibleRecords += 1;
		sources.add(record.sourceId);
		families.add(record.family);
		const evidence = words.get(record.word) ?? { byCodeLength: new Map() };
		const band = evidence.byCodeLength.get(record.codeLength) ?? {
			sources: new Set<string>(),
			families: new Set<string>(),
			bestRank: Number.POSITIVE_INFINITY,
		};
		band.sources.add(record.sourceId);
		band.families.add(record.family);
		band.bestRank = Math.min(band.bestRank, record.rank || 1);
		evidence.byCodeLength.set(record.codeLength, band);
		words.set(record.word, evidence);
	}

	const outputWords: Record<string, WordEvidence> = {};
	for (const word of [...words.keys()].sort((a, b) =>
		a.localeCompare(b, "zh-CN"),
	)) {
		const evidence = words.get(word);
		if (!evidence) continue;
		const byCodeLength: WordEvidence["byCodeLength"] = {};
		for (const length of [1, 2, 3] as const) {
			const band = evidence.byCodeLength.get(length);
			if (!band) continue;
			byCodeLength[String(length) as "1" | "2" | "3"] = {
				sources: [...band.sources].sort(),
				families: [...band.families].sort(),
				bestRank: band.bestRank,
			};
		}
		outputWords[word] = { byCodeLength };
	}

	return {
		schemaVersion: 1,
		policy: {
			excludedSources: [...excludedSources].sort(),
			excludedRoles: ["inventory"],
			maximumCodeLength: 3,
		},
		statistics: {
			inputRecords,
			eligibleRecords,
			words: words.size,
			sources: sources.size,
			families: families.size,
		},
		words: outputWords,
	};
}

export function corpusLines(path: string) {
	return createInterface({
		input: createReadStream(path, { encoding: "utf8" }),
		crlfDelay: Number.POSITIVE_INFINITY,
	});
}

export function readEvidenceSnapshot(path: string): FixedEvidenceSnapshot {
	const snapshot = JSON.parse(
		readFileSync(path, "utf8"),
	) as FixedEvidenceSnapshot;
	if (snapshot.schemaVersion !== 1)
		throw new Error(`不支持的固顶证据版本：${snapshot.schemaVersion}`);
	return snapshot;
}

export function cumulativeEvidence(
	evidence: WordEvidence | undefined,
	maximumCodeLength: 1 | 2 | 3,
) {
	const sources = new Set<string>();
	const families = new Set<string>();
	let bestRank = Number.POSITIVE_INFINITY;
	for (let length = 1; length <= maximumCodeLength; length += 1) {
		const band = evidence?.byCodeLength[String(length) as "1" | "2" | "3"];
		if (!band) continue;
		for (const source of band.sources) sources.add(source);
		for (const family of band.families) families.add(family);
		bestRank = Math.min(bestRank, band.bestRank);
	}
	return {
		sources: [...sources].sort(),
		families: [...families].sort(),
		bestRank: Number.isFinite(bestRank) ? bestRank : null,
	};
}
